import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SLASH_GOLF_BASE = 'https://live-golf-data.p.rapidapi.com'
const MONTHLY_CAP = 1800

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

Deno.serve(async (req) => {
  // CORS preflight: the browser sends this before the real call and it carries
  // no auth, so answer it immediately, before any auth check.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Auth: accept cron secret (from pg_cron) or a valid admin JWT (from frontend)
  const cronSecret = Deno.env.get('CRON_SECRET')
  const providedSecret = req.headers.get('x-cron-secret')
  const authHeader = req.headers.get('Authorization')

  let authorized = false

  if (cronSecret && providedSecret === cronSecret) {
    authorized = true
  } else if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const { data: { user } } = await supabase.auth.getUser(token)
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (profile?.role === 'admin') authorized = true
    }
  }

  if (!authorized) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  }

  const slashGolfKey = Deno.env.get('SLASH_GOLF_API_KEY')!

  // Check monthly cap before doing anything
  const month = new Date().toISOString().slice(0, 7)
  const { data: usage } = await supabase
    .from('api_usage')
    .select('slash_golf_calls')
    .eq('month', month)
    .single()

  const currentCount = usage?.slash_golf_calls ?? 0
  if (currentCount >= MONTHLY_CAP) {
    return new Response(
      JSON.stringify({ error: `Monthly Slash Golf API cap (${MONTHLY_CAP}) reached` }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // Optional: target a single event (used by admin manual refresh)
  let targetEventId: string | null = null
  try {
    const body = await req.json()
    targetEventId = body?.event_id ?? null
  } catch {
    // No body — poll every event that has an active pool
  }

  // An event is worth polling if it has at least one open/locked pool.
  let poolQuery = supabase
    .from('pools')
    .select('event_id')
    .in('status', ['open', 'locked'])

  if (targetEventId) {
    poolQuery = poolQuery.eq('event_id', targetEventId)
  }

  const { data: activePools, error: poolsError } = await poolQuery

  if (poolsError) {
    return new Response(JSON.stringify({ error: poolsError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const eventIds = [...new Set((activePools ?? []).map((p) => p.event_id))]

  // The Slash Golf id lives on golf.event_details (per event). An empty id list
  // is a valid query that simply returns no rows.
  const { data: details, error: detailsError } = await supabase
    .schema('golf')
    .from('event_details')
    .select('event_id, slash_golf_tournament_id')
    .in('event_id', eventIds)

  if (detailsError) {
    console.error('[poll] detailsError (golf query failed):', detailsError.message)
    return new Response(JSON.stringify({ error: detailsError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const active = (details ?? []).filter((d) => d.slash_golf_tournament_id)

  console.log('[poll] target=', targetEventId,
    'activePools=', activePools?.length,
    'eventIds=', JSON.stringify(eventIds),
    'detailRows=', details?.length,
    'active=', JSON.stringify(active))

  if (!active.length) {
    return new Response(JSON.stringify({ message: 'No active events' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const year = new Date().getFullYear()
  const results: Array<{ id: string; ok?: boolean; error?: string }> = []
  let callsThisPoll = 0

  for (const event of active) {
    // Re-check cap before each call in case we're polling multiple events
    if (currentCount + callsThisPoll >= MONTHLY_CAP) {
      results.push({ id: event.event_id, error: 'Monthly cap reached mid-poll' })
      continue
    }

    try {
      const res = await fetch(
        `${SLASH_GOLF_BASE}/leaderboard?orgId=1&tournId=${event.slash_golf_tournament_id}&year=${year}`,
        {
          headers: {
            'x-rapidapi-key': slashGolfKey,
            'x-rapidapi-host': 'live-golf-data.p.rapidapi.com',
          },
        },
      )

      console.log('[poll] fetch tournId=', event.slash_golf_tournament_id, 'year=', year, 'status=', res.status)

      if (!res.ok) {
        results.push({ id: event.event_id, error: `Slash Golf ${res.status}` })
        continue
      }

      const data = await res.json()
      callsThisPoll++
      console.log('[poll] leaderboardRows=', (data?.leaderboardRows?.length ?? 'none'))

      await supabase
        .schema('golf')
        .from('leaderboard_cache')
        .delete()
        .eq('event_id', event.event_id)

      const { error: insertError } = await supabase
        .schema('golf')
        .from('leaderboard_cache')
        .insert({ event_id: event.event_id, data })

      console.log('[poll] cache write err=', insertError?.message ?? 'none')
      results.push(
        insertError
          ? { id: event.event_id, error: insertError.message }
          : { id: event.event_id, ok: true },
      )
    } catch (err) {
      console.error('[poll] threw', (err as Error).message)
      results.push({ id: event.event_id, error: (err as Error).message })
    }
  }

  // Update usage counter with all successful calls this poll
  if (callsThisPoll > 0) {
    await supabase.from('api_usage').upsert(
      { month, slash_golf_calls: currentCount + callsThisPoll },
      { onConflict: 'month' },
    )
  }

  console.log('[poll] done results=', JSON.stringify(results))
  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
