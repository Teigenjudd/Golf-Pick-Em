import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildLiveState } from '../_shared/cfbLive.ts'
import { gradeWeek, recomputeStandings } from '../_shared/cfbGrading.ts'

// poll-cfb-scores — live in-game scoreboard poller. Runs server-side (service role).
//
// KEY EFFICIENCY: CFBD's /scoreboard returns the ENTIRE live FBS slate in ONE call,
// so a poll costs exactly one API call regardless of how many games/pools/players are
// involved (unlike /games, which is per season+week). That's what makes ~1-minute
// polling affordable on the Tier-2 (30k/mo) plan.
//
// SELF-REGULATING SCHEDULE: rather than hand-scheduling game windows, this gates on
// our own DB first — it only spends an API call when we actually have a game in a live
// window (kickoff has passed, not yet final, within a bounded window). So pg_cron can
// fire every minute year-round (PR9 wires + arms it) and cost tracks real live hours,
// not the clock. The bounded window also means a cancelled/stuck game stops being
// "live" a few hours after kickoff, so the live poller won't re-poll it forever.
//
// WHAT IT DOES each poll (when gated in): one /scoreboard call → writes live state +
// current score + status onto each matching cfb.games row (the `live` JSONB blob for
// display; home_score/away_score/status stay authoritative). When a game flips to
// final, it grades that week via the shared gradeWeek routine and recomputes the
// pool's standings — so standings move as games end ("Live — scores update as games go
// final"). grade-cfb-week remains the manual/backfill grader.

const CFBD_BASE = 'https://api.collegefootballdata.com'
const MONTHLY_CAP = 30000 // CFBD Tier 2 (30k/mo); keep in sync with cfd-proxy + grade-cfb-week
// A game is "live-window" from shortly before kickoff until this many hours after.
// The after-bound keeps polling through a long game / overtime and also bounds how
// long a stuck/cancelled game keeps the poller awake (it drops out 6h after kickoff).
const LIVE_WINDOW_AFTER_MS = 6 * 60 * 60 * 1000
// The look-ahead is intentionally SMALL: the gate spends an API call whenever a game
// sits in the window, so a wide look-ahead burns calls for hours before kickoff on
// nothing but "scheduled" rows — real idle spend against the monthly cap. 30 min is
// plenty to catch a kickoff on the next 1-minute tick (with margin for early starts /
// clock skew) while eliminating pre-game dead-air polling. (PR9 cron-cadence tuning —
// windowed schedule vs year-round every-minute — is a separate founder decision.)
const LIVE_WINDOW_AHEAD_MS = 30 * 60 * 1000

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Auth: cron secret (from pg_cron) or a valid admin JWT (admin "Refresh scores").
  const cronSecret = Deno.env.get('CRON_SECRET')
  const providedSecret = req.headers.get('x-cron-secret')
  const authHeader = req.headers.get('Authorization')
  let authorized = false
  if (cronSecret && providedSecret === cronSecret) {
    authorized = true
  } else if (authHeader?.startsWith('Bearer ')) {
    const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7))
    if (user) {
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role === 'admin') authorized = true
    }
  }
  if (!authorized) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  }

  const cfbdKey = Deno.env.get('CFBD_API_KEY')!
  const now = Date.now()
  const nowIso = new Date(now).toISOString()

  function json(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ── GATE: is anything actually live right now? Cheap DB query, no API spend. A
  //    candidate is a not-yet-final game whose kickoff sits in the live window. If
  //    none, return immediately — this is what makes an every-minute cron cost-free
  //    outside real game hours. ──────────────────────────────────────────────────
  const windowStart = new Date(now - LIVE_WINDOW_AFTER_MS).toISOString()
  const windowEnd = new Date(now + LIVE_WINDOW_AHEAD_MS).toISOString()
  const { data: candidates, error: candErr } = await supabase.schema('cfb').from('games')
    .select('id, cfbd_game_id, week_id, status')
    .neq('status', 'final')
    .not('kickoff_at', 'is', null)
    .gte('kickoff_at', windowStart)
    .lte('kickoff_at', windowEnd)
  if (candErr) return json({ error: candErr.message }, 500)
  if (!candidates?.length) {
    return json({ skipped: true, reason: 'no games in the live window', cfbd_calls: 0 })
  }

  // Monthly cap (shared counter with cfd-proxy + grade-cfb-week).
  const month = nowIso.slice(0, 7)
  const { data: usage } = await supabase.from('api_usage')
    .select('cfbd_calls').eq('month', month).single()
  const currentCount = usage?.cfbd_calls ?? 0
  if (currentCount >= MONTHLY_CAP) {
    return json({ error: `Monthly CFBD cap (${MONTHLY_CAP}) reached`, cfbd_calls: 0 }, 429)
  }

  // ── One /scoreboard call for the entire live FBS slate. ───────────────────────
  let rows: any[]
  try {
    const url = new URL(`${CFBD_BASE}/scoreboard`)
    url.searchParams.set('classification', 'fbs')
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${cfbdKey}`, Accept: 'application/json' },
    })
    if (!res.ok) return json({ error: `CFBD ${res.status}`, cfbd_calls: 0 }, 502)
    rows = await res.json()
  } catch (err) {
    return json({ error: (err as Error).message, cfbd_calls: 0 }, 502)
  }
  await supabase.from('api_usage').upsert(
    { month, cfbd_calls: currentCount + 1 }, { onConflict: 'month' },
  )

  // Index the scoreboard by cfbd_game_id; collect the completed ones for grading.
  const liveById = new Map<string, ReturnType<typeof buildLiveState>>()
  const finalScoreMap = new Map<string, { home: number | null; away: number | null; completed: boolean }>()
  for (const r of rows ?? []) {
    const ls = buildLiveState(r)
    if (!ls.cfbd_game_id) continue
    liveById.set(ls.cfbd_game_id, ls)
    if (ls.completed) {
      finalScoreMap.set(ls.cfbd_game_id, { home: ls.home_score, away: ls.away_score, completed: true })
    }
  }

  // ── Update each of our candidate games that appears on the scoreboard, and note
  //    which weeks just had a game flip to final. ────────────────────────────────
  let updated = 0
  const newlyFinalWeekIds = new Set<string>()
  for (const g of candidates) {
    if (!g.cfbd_game_id) continue
    const ls = liveById.get(String(g.cfbd_game_id))
    if (!ls) continue
    await supabase.schema('cfb').from('games').update({
      status: ls.status,
      home_score: ls.home_score,
      away_score: ls.away_score,
      live: ls.live,
    }).eq('id', g.id)
    updated++
    if (ls.completed && g.status !== 'final') newlyFinalWeekIds.add(g.week_id)
  }

  // ── Grade weeks with a newly-final game so standings move live. Reuses the shared
  //    gradeWeek (which trusts already-final games in the DB, so a partial scoreboard
  //    map doesn't un-finalize a week). ───────────────────────────────────────────
  const graded: Array<{ week_id: string; picks_graded?: number; final?: boolean; error?: string }> = []
  const affectedPools = new Set<string>()
  if (newlyFinalWeekIds.size) {
    const { data: weekRows } = await supabase.schema('cfb').from('weeks')
      .select('id, event_id, status, lock_time').in('id', [...newlyFinalWeekIds])
    const eventIds = [...new Set((weekRows ?? []).map((w) => w.event_id))]
    const { data: pools } = await supabase.from('pools')
      .select('id, event_id, status').neq('status', 'draft').in('event_id', eventIds)
    const poolsByEvent = new Map<string, string[]>()
    for (const p of pools ?? []) {
      const arr = poolsByEvent.get(p.event_id) ?? []
      arr.push(p.id)
      poolsByEvent.set(p.event_id, arr)
    }
    for (const w of weekRows ?? []) {
      try {
        const res = await gradeWeek(supabase, w, finalScoreMap)
        graded.push({ week_id: w.id, picks_graded: res.picksGraded, final: res.allFinal })
        for (const pid of poolsByEvent.get(w.event_id) ?? []) affectedPools.add(pid)
      } catch (err) {
        graded.push({ week_id: w.id, error: (err as Error).message })
      }
    }
    const poolEventById = new Map((pools ?? []).map((p) => [p.id, p.event_id]))
    for (const poolId of affectedPools) {
      try {
        await recomputeStandings(supabase, poolId, poolEventById.get(poolId)!)
      } catch (err) {
        console.error('[poll-cfb-scores] standings recompute failed', poolId, (err as Error).message)
      }
    }
  }

  return json({
    live_games: candidates.length,
    updated,
    newly_final_weeks: newlyFinalWeekIds.size,
    graded,
    cfbd_calls: 1,
  })
})
