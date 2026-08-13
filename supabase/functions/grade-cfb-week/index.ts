import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  gradeAtsPick,
  gradeDoubleDown,
  gradeUnderdogPick,
  pickMargin,
  projectSeasonStandings,
} from '../_shared/cfbScoring.ts'

// grade-cfb-week — the authoritative CFB grader. Runs server-side (service role) so
// users can never grade their own picks. Same "cron OR admin manual-refresh" shape as
// golf's poll-leaderboard, with a grading + standings step added (golf only caches a
// leaderboard; CFB standings are cumulative across weeks, so they must be recomputed
// each time a week is graded).
//
// For each due week it: (1) pulls final scores from CFBD ONCE per real (season, week)
// and fans them to every event's games that share it — the D3 dedup, mirroring the
// poller (spend scales with real weeks, not pools); (2) writes final scores onto
// cfb.games; (3) grades every pick with the shared scoring engine
// (../_shared/cfbScoring.ts, kept in sync with src/utils/cfbScoring.js by the parity
// test); (4) recomputes each affected pool's season-cumulative public.pool_standings.
//
// Trigger: no body → grade every week whose lock_time has passed and isn't fully
// graded yet (cron / admin "grade all due"); { "week_id": "…" } → grade just that week
// (admin "Grade week" button, PR9). Grading is idempotent — re-running refreshes.

const CFBD_BASE = 'https://api.collegefootballdata.com'
const MONTHLY_CAP = 1000 // CFBD free tier; mirrors cfd-proxy

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

// CFBD has shipped both camelCase and snake_case across versions — read whichever.
function field(obj: any, ...names: string[]) {
  for (const n of names) {
    if (obj?.[n] !== undefined && obj?.[n] !== null) return obj[n]
  }
  return null
}
function toInt(v: any): number | null {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
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
  try {
    const body = await req.json()
    targetWeekId = body?.week_id ?? null
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
  let currentCount = usage?.cfbd_calls ?? 0
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
        const result = await gradeWeek(supabase, w, scoreByGameId)
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

// Update one event's games with final scores, grade its picks, and set the week's
// status. Returns { picksGraded, allFinal }.
async function gradeWeek(
  supabase: any,
  week: { id: string; status: string; lock_time: string | null },
  scoreByGameId: Map<string, { home: number | null; away: number | null; completed: boolean }>,
) {
  const { data: games, error: gErr } = await supabase.schema('cfb').from('games')
    .select('id, cfbd_game_id, home_team, away_team, status, home_score, away_score')
    .eq('week_id', week.id)
  if (gErr) throw gErr

  let allFinal = (games ?? []).length > 0
  const finalById = new Map<string, any>()

  for (const g of games ?? []) {
    const s = g.cfbd_game_id ? scoreByGameId.get(String(g.cfbd_game_id)) : null
    // Only completed games are written final + graded; a mid-game score would
    // mis-grade, so anything not completed leaves the game unscored and the week
    // not-yet-final (re-running later finishes it).
    if (s && s.completed && s.home != null && s.away != null) {
      if (g.status !== 'final' || g.home_score !== s.home || g.away_score !== s.away) {
        await supabase.schema('cfb').from('games')
          .update({ status: 'final', home_score: s.home, away_score: s.away })
          .eq('id', g.id)
      }
      g.home_score = s.home
      g.away_score = s.away
      finalById.set(g.id, g)
    } else {
      allFinal = false
    }
  }

  // Grade this week's picks off the final games only.
  const { data: picks, error: pErr } = await supabase.schema('cfb').from('picks')
    .select('id, game_id, pick_type, selected_team, is_double_down, locked_spread')
    .eq('week_id', week.id)
  if (pErr) throw pErr

  let picksGraded = 0
  for (const p of picks ?? []) {
    const g = finalById.get(p.game_id)
    if (!g) continue // game not final yet → leave ungraded (result stays NULL)
    const margin = pickMargin({
      selectedTeam: p.selected_team,
      homeTeam: g.home_team,
      awayTeam: g.away_team,
      homeScore: g.home_score,
      awayScore: g.away_score,
    })
    let result: string | null
    let base_points: number
    let bonus_points: number
    if (p.pick_type === 'underdog') {
      const u = gradeUnderdogPick({ margin, spread: p.locked_spread })
      result = u.result; base_points = u.points; bonus_points = 0
    } else {
      const a = gradeAtsPick({ margin, lockedSpread: p.locked_spread })
      const bonus = p.is_double_down
        ? gradeDoubleDown({ margin, lockedSpread: p.locked_spread }).bonus
        : 0
      result = a.result; base_points = a.points; bonus_points = bonus
    }
    await supabase.schema('cfb').from('picks')
      .update({ result, base_points, bonus_points }).eq('id', p.id)
    picksGraded++
  }

  // Week status: 'graded' once every game is final; otherwise reflect that it's past
  // lock as 'locked'. (Cosmetic — lock_time is the authoritative pick gate.)
  const nextStatus = allFinal ? 'graded' : 'locked'
  if (week.status !== nextStatus) {
    await supabase.schema('cfb').from('weeks').update({ status: nextStatus }).eq('id', week.id)
  }

  return { picksGraded, allFinal }
}

// Recompute one pool's season-cumulative standings from all its graded picks and
// upsert the neutral public.pool_standings projection. Returns the row count.
async function recomputeStandings(supabase: any, poolId: string, eventId: string) {
  const { data: parts } = await supabase.from('pool_participants')
    .select('user_id').eq('pool_id', poolId)
  const userIds = [...new Set((parts ?? []).map((p: any) => p.user_id))]
  if (!userIds.length) return 0

  const { data: profs } = await supabase.from('profiles')
    .select('id, display_name').in('id', userIds)
  const nameById = new Map((profs ?? []).map((p: any) => [p.id, p.display_name ?? 'Participant']))

  const { data: pweeks } = await supabase.schema('cfb').from('weeks')
    .select('id, week_number, status').eq('event_id', eventId)
  const weekNumById = new Map((pweeks ?? []).map((w: any) => [w.id, w.week_number]))
  const gradedNums = (pweeks ?? []).filter((w: any) => w.status === 'graded').map((w: any) => w.week_number)
  const throughWeek = gradedNums.length ? Math.max(...gradedNums) : undefined

  const { data: ppicks } = await supabase.schema('cfb').from('picks')
    .select('user_id, week_id, base_points, bonus_points').eq('pool_id', poolId)

  // per-user → per-week point totals (points may be null on ungraded picks → 0)
  const perUser = new Map<string, Map<number, number>>()
  for (const uid of userIds) perUser.set(uid, new Map())
  for (const pk of ppicks ?? []) {
    const wn = weekNumById.get(pk.week_id)
    if (wn == null) continue
    if (!perUser.has(pk.user_id)) perUser.set(pk.user_id, new Map())
    const pts = (Number(pk.base_points) || 0) + (Number(pk.bonus_points) || 0)
    const m = perUser.get(pk.user_id)!
    m.set(wn, (m.get(wn) ?? 0) + pts)
  }

  const entries = userIds.map((uid) => ({
    user_id: uid,
    display_name: nameById.get(uid) ?? 'Participant',
    weeks: [...perUser.get(uid)!.entries()].map(([week_number, total]) => ({ week_number, total })),
  }))

  const rows = projectSeasonStandings(entries, { throughWeek })
  const stampedAt = new Date().toISOString()
  const upsertRows = rows.map((r) => ({
    pool_id: poolId,
    user_id: r.user_id,
    rank: r.rank,
    total: r.total,
    display: r.display,
    updated_at: stampedAt,
  }))
  if (upsertRows.length) {
    const { error } = await supabase.from('pool_standings')
      .upsert(upsertRows, { onConflict: 'pool_id,user_id' })
    if (error) throw error
  }
  return upsertRows.length
}
