// Shared CFB grading routine, used by BOTH edge functions that can finalize games:
//   • grade-cfb-week   — the manual/scan grader (pulls CFBD /games for a week)
//   • poll-cfb-scores  — the live poller (pulls CFBD /scoreboard; when a game flips
//                        final, it grades that week so standings move live)
// Extracting it here means one grading implementation, not two that can drift. It
// grades off the shared scoring engine (./cfbScoring.ts, kept in sync with
// src/utils/cfbScoring.js by the parity test), and writes the neutral
// public.pool_standings projection. All functions here take the service-role client
// as an argument (they bypass RLS as usual) and touch only cfb + the shared public
// standings tables.

import {
  gradeAtsPick,
  gradeDoubleDown,
  gradeUnderdogPick,
  pickMargin,
  projectSeasonStandings,
} from './cfbScoring.ts'

// CFBD has shipped both camelCase and snake_case across versions — read whichever.
export function field(obj: any, ...names: string[]) {
  for (const n of names) {
    if (obj?.[n] !== undefined && obj?.[n] !== null) return obj[n]
  }
  return null
}
export function toInt(v: any): number | null {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

// A final-score lookup keyed by cfbd_game_id. Both callers build one of these (from
// /games or from /scoreboard) and hand it in; only entries with completed === true
// and both scores present are graded — a mid-game score never mis-grades.
export type FinalScoreMap = Map<
  string,
  { home: number | null; away: number | null; completed: boolean }
>

// Update one event's games with final scores, grade its picks, and set the week's
// status. Returns { picksGraded, allFinal }. Idempotent — re-running refreshes.
export async function gradeWeek(
  supabase: any,
  week: { id: string; status: string; lock_time: string | null },
  scoreByGameId: FinalScoreMap,
) {
  const { data: games, error: gErr } = await supabase.schema('cfb').from('games')
    .select('id, cfbd_game_id, home_team, away_team, status, home_score, away_score')
    .eq('week_id', week.id)
  if (gErr) throw gErr

  let allFinal = (games ?? []).length > 0
  const finalById = new Map<string, any>()

  for (const g of games ?? []) {
    const s = g.cfbd_game_id ? scoreByGameId.get(String(g.cfbd_game_id)) : null
    const mapFinal = !!(s && s.completed && s.home != null && s.away != null)
    // Only completed games are written final + graded; a mid-game score would
    // mis-grade, so anything not completed leaves the game unscored and the week
    // not-yet-final (re-running later finishes it).
    if (mapFinal) {
      if (g.status !== 'final' || g.home_score !== s!.home || g.away_score !== s!.away) {
        await supabase.schema('cfb').from('games')
          .update({ status: 'final', home_score: s!.home, away_score: s!.away })
          .eq('id', g.id)
      }
      g.home_score = s!.home
      g.away_score = s!.away
      finalById.set(g.id, g)
    } else if (g.status === 'final' && g.home_score != null && g.away_score != null) {
      // Already recorded final in a PRIOR run. The live poller grades from a partial
      // scoreboard map (only today's games), so a game that finalized earlier won't be
      // in `scoreByGameId` — trust its stored final score rather than un-finalizing the
      // week. Its picks are already graded; re-grading with the same score is a no-op.
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
export async function recomputeStandings(supabase: any, poolId: string, eventId: string) {
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
