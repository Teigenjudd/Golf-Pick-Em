import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { field, toInt, gradeWeek, recomputeStandings } from '../_shared/cfbGrading.ts'

// grade-cfb-week — the manual / scan CFB grader. Runs server-side (service role) so
// users can never grade their own picks. Same "cron OR admin manual-refresh" shape as
// golf's poll-leaderboard, with a grading + standings step added (golf only caches a
// leaderboard; CFB standings are cumulative across weeks, so they must be recomputed
// each time a week is graded).
//
// For each due week it: (1) pulls final scores from CFBD /games ONCE per real
// (season, week) and fans them to every event's games that share it — the D3 dedup,
// mirroring the poller (spend scales with real weeks, not pools); (2) grades via the
// shared cfbGrading routine (gradeWeek + recomputeStandings), which the live poller
// (poll-cfb-scores) also uses, so there is one grading implementation.
//
// Trigger: no body → grade every week whose lock_time has passed and isn't fully
// graded yet (cron / admin "grade all due"); { "week_id": "…" } → grade just that week
// (admin "Grade week" button, PR9). Grading is idempotent — re-running refreshes.
// { "week_id": "…", "finalize": true } → the admin "Finalize as-is" escape hatch
// (PR9): grades whatever's final, treats the rest as no-contest pushes, and forces
// the week to 'graded' — see gradeWeek's opts.finalize in _shared/cfbGrading.ts.
//
// NOTE: live in-game scoring is a separate function (poll-cfb-scores) that also calls
// gradeWeek when a game flips final, so standings move as games end. This function
// remains the authoritative manual/backfill path (e.g. grade a week whose live poll
// window has closed, or force a re-grade).

const CFBD_BASE = 'https://api.collegefootballdata.com'
const MONTHLY_CAP = 30000 // CFBD Tier 2 (30k/mo); keep in sync with cfd-proxy + poll-cfb-scores

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

  // Auth: cron secret (from pg_cron) or a valid admin JWT (from the admin UI).
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
  const nowIso = new Date().toISOString()

  // Optional: target a single week (admin "Grade week"); otherwise scan all due weeks.
  let targetWeekId: string | null = null
  let finalize = false
  try {
    const body = await req.json()
    targetWeekId = body?.week_id ?? null
    finalize = body?.finalize === true && targetWeekId != null
  } catch { /* no body → scan mode */ }

  // ── Which pools are live, and which event does each belong to. Standings only
  //    make sense for non-draft pools; a week whose event has no such pool is
  //    skipped (no participants, nothing to rank). ───────────────────────────────
  const { data: pools, error: poolsErr } = await supabase
    .from('pools').select('id, event_id, status').neq('status', 'draft')
  if (poolsErr) {
    return json({ error: poolsErr.message }, 500)
  }
  const poolsByEvent = new Map<string, string[]>()
  for (const p of pools ?? []) {
    const arr = poolsByEvent.get(p.event_id) ?? []
    arr.push(p.id)
    poolsByEvent.set(p.event_id, arr)
  }

  // ── The weeks to grade. Scan mode uses lock_time as the real gate (not the status
  //    label — nothing sets 'locked' until PR9's admin ops, same as how the submit
  //    RPC treats lock_time as authoritative). ──────────────────────────────────
  let weeksQuery = supabase.schema('cfb').from('weeks')
    .select('id, event_id, week_number, status, lock_time')
  if (targetWeekId) {
    weeksQuery = weeksQuery.eq('id', targetWeekId)
  } else {
    weeksQuery = weeksQuery.not('lock_time', 'is', null).lte('lock_time', nowIso).neq('status', 'graded')
  }
  const { data: allWeeks, error: weeksErr } = await weeksQuery
  if (weeksErr) return json({ error: weeksErr.message }, 500)

  // Lock guard — targeted path only. The scan path already gates on lock_time <= now
  // in weeksQuery above; a direct { week_id } grade had no such check, so an admin
  // (or a stray client call) could grade a week before its pick window even closed.
  if (targetWeekId) {
    const targetWeek = (allWeeks ?? []).find((w) => w.id === targetWeekId)
    if (targetWeek && (!targetWeek.lock_time || new Date(targetWeek.lock_time) > new Date())) {
      return json({ error: "This week isn't locked yet — you can only grade a week after its lock time." }, 400)
    }
  }

  // Keep only weeks whose event has a live pool.
  const weeks = (allWeeks ?? []).filter((w) => poolsByEvent.has(w.event_id))
  if (!weeks.length) {
    return json({ message: 'No weeks to grade', graded: [] })
  }

  // season_year per event (split query across the public/cfb boundary — same
  // discipline as lib/cfb.js: never a nested embed).
  const eventIds = [...new Set(weeks.map((w) => w.event_id))]
  const { data: eds } = await supabase.schema('cfb').from('event_details')
    .select('event_id, season_year').in('event_id', eventIds)
  const seasonByEvent = new Map((eds ?? []).map((e) => [e.event_id, e.season_year]))

  // ── Group weeks by the REAL (season, week_number) so CFBD is hit once per real
  //    week and fanned to every event's games sharing it. ───────────────────────
  const groups = new Map<string, { season: number; week: number; rows: typeof weeks }>()
  for (const w of weeks) {
    const season = seasonByEvent.get(w.event_id)
    if (season == null) continue
    const key = `${season}::${w.week_number}`
    const g = groups.get(key) ?? { season, week: w.week_number, rows: [] as typeof weeks }
    g.rows.push(w)
    groups.set(key, g)
  }

  // Monthly CFBD cap (shared counter with the slate importer's cfd-proxy).
  const month = nowIso.slice(0, 7)
  const { data: usage } = await supabase.from('api_usage')
    .select('cfbd_calls').eq('month', month).single()
  const currentCount = usage?.cfbd_calls ?? 0
  let callsThisRun = 0

  const graded: Array<{ week_id: string; picks_graded?: number; final?: boolean; error?: string }> = []
  const affectedPools = new Set<string>() // pool_id → recompute standings once at the end

  for (const [, group] of groups) {
    if (currentCount + callsThisRun >= MONTHLY_CAP) {
      for (const w of group.rows) graded.push({ week_id: w.id, error: 'Monthly CFBD cap reached' })
      continue
    }

    // One CFBD /games call for this real (season, week).
    let scoreRows: any[]
    try {
      const url = new URL(`${CFBD_BASE}/games`)
      url.searchParams.set('year', String(group.season))
      url.searchParams.set('week', String(group.week))
      url.searchParams.set('seasonType', 'regular')
      url.searchParams.set('classification', 'fbs') // matches the slate importer's game set

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${cfbdKey}`, Accept: 'application/json' },
      })
      if (!res.ok) {
        for (const w of group.rows) graded.push({ week_id: w.id, error: `CFBD ${res.status}` })
        continue
      }
      scoreRows = await res.json()
      callsThisRun++
    } catch (err) {
      for (const w of group.rows) graded.push({ week_id: w.id, error: (err as Error).message })
      continue
    }

    // cfbd_game_id → final result. Only completed games carry scores we grade on.
    const scoreByGameId = new Map<string, { home: number | null; away: number | null; completed: boolean }>()
    for (const g of scoreRows ?? []) {
      const id = field(g, 'id', 'gameId', 'game_id')
      if (id == null) continue
      scoreByGameId.set(String(id), {
        home: toInt(field(g, 'homePoints', 'home_points')),
        away: toInt(field(g, 'awayPoints', 'away_points')),
        completed: field(g, 'completed') === true,
      })
    }

    for (const w of group.rows) {
      try {
        // Backstop: fill a random card for anyone who never submitted, so no
        // participant is left out of scoring. Idempotent (skips players who already
        // have a card) and best-effort — a fill failure (e.g. a malformed week) must
        // not block grading the cards that WERE submitted. In normal operation the
        // admin (or a future lock-time cron) fills at lock; this catches the rest.
        try {
          await supabase.schema('cfb').rpc('autofill_week', { p_week_id: w.id })
        } catch (_) { /* non-fatal — proceed to grade submitted cards */ }

        const result = await gradeWeek(supabase, w, scoreByGameId, { finalize })
        graded.push({ week_id: w.id, picks_graded: result.picksGraded, final: result.allFinal })
        for (const pid of poolsByEvent.get(w.event_id) ?? []) affectedPools.add(pid)
      } catch (err) {
        graded.push({ week_id: w.id, error: (err as Error).message })
      }
    }
  }

  // Persist the CFBD usage increment (one row per month).
  if (callsThisRun > 0) {
    await supabase.from('api_usage').upsert(
      { month, cfbd_calls: currentCount + callsThisRun },
      { onConflict: 'month' },
    )
  }

  // Recompute each affected pool's season-cumulative standings once.
  const poolEventById = new Map((pools ?? []).map((p) => [p.id, p.event_id]))
  const standings: Array<{ pool_id: string; ranked?: number; error?: string }> = []
  for (const poolId of affectedPools) {
    try {
      const ranked = await recomputeStandings(supabase, poolId, poolEventById.get(poolId)!)
      standings.push({ pool_id: poolId, ranked })
    } catch (err) {
      standings.push({ pool_id: poolId, error: (err as Error).message })
    }
  }

  return json({ graded, standings, cfbd_calls: callsThisRun })

  function json(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
