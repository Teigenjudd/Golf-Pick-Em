import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildGameRows } from '../_shared/cfbSlate.ts'

// poll-cfb-lines — the automated slate + spread refresher. Runs server-side (service
// role), on an hourly-ish cron (armed in PR9). Replaces the old manual per-week import:
// admins never touch slates; this keeps every pool's games and pre-game spreads current.
//
// How it works, per active season:
//   1. ONE season-wide CFBD fetch set (/games + /lines + /teams/fbs) — cheap, and it
//      naturally returns only the games that currently have a posted line (books post
//      lines ~1-2 weeks out), so far-future weeks come back empty until their lines drop.
//   2. buildGameRows shapes them, and each shaped game is fanned out to EVERY pool's
//      cfb.weeks row for that (season, week_number) — all pools run off the same numbers.
//   3. It only writes games that HAVEN'T kicked off yet (now < kickoff_at). After
//      kickoff a game is left alone, so its home_spread freezes at the last pre-kickoff
//      value = the closing/kickoff line (what we display forever after). This also keeps
//      it from clobbering the live poller (poll-cfb-scores), which owns status/scores/live
//      once a game starts. Per-pick grading always uses each player's frozen locked_spread.
//   4. When a game's spread MOVED since we last saw it, it appends a snapshot to
//      cfb.spread_history (keyed by the real game, with captured_at) — a movement log
//      only, not one row per poll.
//
// CFBD's lines are pre-game only (no live in-game odds), so polling can never surface a
// live line — exactly what we want.

const CFBD_BASE = 'https://api.collegefootballdata.com'
const MONTHLY_CAP = 30000 // CFBD Tier 2; shared api_usage.cfbd_calls counter

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Auth: cron secret (pg_cron) or an admin JWT (manual "refresh now").
  const cronSecret = Deno.env.get('CRON_SECRET')
  const providedSecret = req.headers.get('x-cron-secret')
  const authHeader = req.headers.get('Authorization')
  let authorized = false
  if (cronSecret && providedSecret === cronSecret) {
    authorized = true
  } else if (authHeader?.startsWith('Bearer ')) {
    const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7))
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role === 'admin') authorized = true
    }
  }
  if (!authorized) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const cfbdKey = Deno.env.get('CFBD_API_KEY')!
  const nowMs = Date.now()
  const nowIso = new Date(nowMs).toISOString()

  function json(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ── Active CFB seasons + the (season, week_number) → week_ids fan-out map. ──────
  const { data: pools, error: poolsErr } = await supabase
    .from('pools').select('event_id, status').neq('status', 'draft')
  if (poolsErr) return json({ error: poolsErr.message }, 500)
  const eventIds = [...new Set((pools ?? []).map((p) => p.event_id))]
  if (!eventIds.length) return json({ skipped: true, reason: 'no active pools', cfbd_calls: 0 })

  const { data: eds } = await supabase.schema('cfb').from('event_details')
    .select('event_id, season_year').in('event_id', eventIds)
  const seasonByEvent = new Map((eds ?? []).map((e) => [e.event_id, e.season_year]))
  const cfbEventIds = (eds ?? []).map((e) => e.event_id)
  if (!cfbEventIds.length) return json({ skipped: true, reason: 'no active CFB pools', cfbd_calls: 0 })

  const { data: weeks } = await supabase.schema('cfb').from('weeks')
    .select('id, event_id, week_number').in('event_id', cfbEventIds)
  const weekIdsBySeasonWeek = new Map<string, string[]>()
  const seasons = new Set<number>()
  for (const w of weeks ?? []) {
    const season = seasonByEvent.get(w.event_id)
    if (season == null) continue
    seasons.add(season)
    const key = `${season}::${w.week_number}`
    const arr = weekIdsBySeasonWeek.get(key) ?? []
    arr.push(w.id)
    weekIdsBySeasonWeek.set(key, arr)
  }
  if (!seasons.size) return json({ skipped: true, reason: 'no seeded weeks', cfbd_calls: 0 })

  // Current stored spread per real game (for change detection → spread_history).
  const allWeekIds = (weeks ?? []).map((w) => w.id)
  const currentSpread = new Map<string, number>()
  if (allWeekIds.length) {
    const { data: existing } = await supabase.schema('cfb').from('games')
      .select('cfbd_game_id, home_spread').in('week_id', allWeekIds)
    for (const g of existing ?? []) currentSpread.set(String(g.cfbd_game_id), Number(g.home_spread))
  }

  // Monthly CFBD cap.
  const month = nowIso.slice(0, 7)
  const { data: usage } = await supabase.from('api_usage').select('cfbd_calls').eq('month', month).single()
  const currentCount = usage?.cfbd_calls ?? 0
  if (currentCount >= MONTHLY_CAP) {
    return json({ error: `Monthly CFBD cap (${MONTHLY_CAP}) reached`, cfbd_calls: 0 }, 429)
  }

  async function cfbd(path: string, params: Record<string, string | number>) {
    const url = new URL(`${CFBD_BASE}/${path}`)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${cfbdKey}`, Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`CFBD ${path} ${res.status}`)
    return res.json()
  }

  const upsertRows: any[] = []
  const historyRows: any[] = []
  const perSeason: Array<{ season: number; games?: number; error?: string }> = []
  let calls = 0

  for (const season of seasons) {
    if (currentCount + calls + 3 > MONTHLY_CAP) {
      perSeason.push({ season, error: 'Monthly CFBD cap reached' })
      continue
    }
    try {
      const games = await cfbd('games', { year: season, seasonType: 'regular', classification: 'fbs' }); calls++
      const lines = await cfbd('lines', { year: season, seasonType: 'regular' }); calls++
      const teams = await cfbd('teams/fbs', { year: season }); calls++

      let shaped = 0
      for (const row of buildGameRows(games, lines, teams)) {
        // Pre-kickoff only: after kickoff the line freezes and the live poller owns the row.
        const koMs = row.kickoff_at ? Date.parse(row.kickoff_at) : NaN
        if (Number.isFinite(koMs) && koMs <= nowMs) continue

        const targets = weekIdsBySeasonWeek.get(`${season}::${row.week}`) ?? []
        if (!targets.length) continue // no pool plays this week

        const prev = currentSpread.get(row.cfbd_game_id)
        if (prev === undefined || Number(prev) !== Number(row.home_spread)) {
          historyRows.push({
            cfbd_game_id: row.cfbd_game_id, season_year: season, week_number: row.week,
            home_team: row.home_team, away_team: row.away_team,
            home_spread: row.home_spread,
            underdog_team: row.underdog_team, underdog_spread: row.underdog_spread,
            captured_at: nowIso,
          })
        }

        const { week: _week, ...gameRow } = row // strip week_number before writing
        for (const wid of targets) upsertRows.push({ ...gameRow, week_id: wid })
        shaped++
      }
      perSeason.push({ season, games: shaped })
    } catch (err) {
      perSeason.push({ season, error: (err as Error).message })
    }
  }

  // Write games (fan-out) then the movement log.
  let upserted = 0
  if (upsertRows.length) {
    const { error } = await supabase.schema('cfb').from('games')
      .upsert(upsertRows, { onConflict: 'week_id,cfbd_game_id' })
    if (error) return json({ error: error.message, per_season: perSeason }, 500)
    upserted = upsertRows.length
  }
  if (historyRows.length) {
    const { error } = await supabase.schema('cfb').from('spread_history').insert(historyRows)
    if (error) console.error('[poll-cfb-lines] spread_history insert failed:', error.message)
  }
  if (calls > 0) {
    await supabase.from('api_usage').upsert(
      { month, cfbd_calls: currentCount + calls }, { onConflict: 'month' },
    )
  }

  return json({
    per_season: perSeason,
    game_rows_written: upserted,
    spread_moves_logged: historyRows.length,
    cfbd_calls: calls,
  })
})
