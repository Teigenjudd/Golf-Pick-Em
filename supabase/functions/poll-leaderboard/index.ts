import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SLASH_GOLF_BASE = 'https://live-golf-data.p.rapidapi.com'

Deno.serve(async (req) => {
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
    return new Response('Unauthorized', { status: 401 })
  }

  const slashGolfKey = Deno.env.get('SLASH_GOLF_API_KEY')!

  // Optional: target a single tournament (used by admin manual refresh)
  let targetTournamentId: string | null = null
  try {
    const body = await req.json()
    targetTournamentId = body?.tournament_id ?? null
  } catch {
    // No body — poll all active tournaments
  }

  let query = supabase
    .from('tournaments')
    .select('id, slash_golf_tournament_id')
    .in('status', ['open', 'locked'])

  if (targetTournamentId) {
    query = query.eq('id', targetTournamentId)
  }

  const { data: tournaments, error: tournamentsError } = await query

  if (tournamentsError) {
    return new Response(JSON.stringify({ error: tournamentsError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const active = (tournaments ?? []).filter((t) => t.slash_golf_tournament_id)

  if (!active.length) {
    return new Response(JSON.stringify({ message: 'No active tournaments' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const year = new Date().getFullYear()
  const results: Array<{ id: string; ok?: boolean; error?: string }> = []

  for (const tournament of active) {
    try {
      const res = await fetch(
        `${SLASH_GOLF_BASE}/leaderboard?orgId=1&tournId=${tournament.slash_golf_tournament_id}&year=${year}`,
        {
          headers: {
            'x-rapidapi-key': slashGolfKey,
            'x-rapidapi-host': 'live-golf-data.p.rapidapi.com',
          },
        },
      )

      if (!res.ok) {
        results.push({ id: tournament.id, error: `Slash Golf ${res.status}` })
        continue
      }

      const data = await res.json()

      await supabase
        .from('leaderboard_cache')
        .delete()
        .eq('tournament_id', tournament.id)

      const { error: insertError } = await supabase
        .from('leaderboard_cache')
        .insert({ tournament_id: tournament.id, data })

      results.push(
        insertError
          ? { id: tournament.id, error: insertError.message }
          : { id: tournament.id, ok: true },
      )
    } catch (err) {
      results.push({ id: tournament.id, error: (err as Error).message })
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
