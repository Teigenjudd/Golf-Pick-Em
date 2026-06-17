import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SLASH_GOLF_BASE = 'https://live-golf-data.p.rapidapi.com'

Deno.serve(async (req) => {
  // Simple secret check — cron caller must pass this header
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const slashGolfKey = Deno.env.get('SLASH_GOLF_API_KEY')!

  // Find tournaments that are live (not draft or complete)
  const { data: tournaments, error: tournamentsError } = await supabase
    .from('tournaments')
    .select('id, slash_golf_tournament_id')
    .in('status', ['open', 'locked'])

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

      // Keep the table lean — one fresh row per tournament
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
