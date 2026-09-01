// Single place that talks to the per-sport `cfb` schema (plus the shared public
// tables it needs) — the CFB analogue of src/lib/golf.js, and the ONLY browser file
// that calls supabase.schema('cfb'). CFB code never imports golf and vice versa.
//
// Slate building moved SERVER-SIDE when import went automated: the CFBD → cfb.games
// transform now lives in supabase/functions/_shared/cfbSlate.ts, owned by the hourly
// poll-cfb-lines poller. This file no longer shapes CFBD data — it does cfb-schema
// reads/writes for pool creation + admin ops, and triggers the server-side jobs
// (grading, live scores, slate refresh), which run as service_role.

import { supabase } from './supabase'

// All cfb-schema access funnels through here.
const cfb = () => supabase.schema('cfb')

// A week is "locked" for picking once it's graded/locked or its lock_time has passed.
// Shared by the CFB pool-detail and picks pages so they can't drift.
export function weekIsLocked(w) {
  if (!w) return false
  if (w.status === 'locked' || w.status === 'graded') return true
  return !!(w.lock_time && new Date(w.lock_time) <= new Date())
}

// ── Server-side job triggers ─────────────────────────────────────────────────
// These invoke edge functions that run as service_role. The heavy lifting (fetching
// CFBD, grading, writing standings/slates) is server-side so users can't tamper with
// it; the browser only triggers a run. Each surfaces a 200-wrapped { error } as a throw.

// Grade one week (admin "Grade week"); omit weekId to grade all due weeks.
export async function gradeCfbWeek(weekId) {
  const { data, error } = await supabase.functions.invoke('grade-cfb-week', {
    body: weekId ? { week_id: weekId } : {},
  })
  if (error) throw error
  if (data && data.error) throw new Error(data.error)
  return data
}

// Admin "finalize a stuck week as-is" escape hatch (PR9): a week can get stuck at
// 'locked' forever if one of its games never reports final (cancelled, postponed) —
// scan mode would otherwise re-poll CFBD for it every run. This grades whatever games
// DID finish normally, scores every other game's picks as a no-contest push (0
// points — there's no partial credit to compute), and forces the week to 'graded' so
// it stops showing up as due. Use sparingly; it's an override, not the normal path.
export async function finalizeCfbWeek(weekId) {
  const { data, error } = await supabase.functions.invoke('grade-cfb-week', {
    body: { week_id: weekId, finalize: true },
  })
  if (error) throw error
  if (data && data.error) throw new Error(data.error)
  return data
}

// Auto-fill missing cards for a LOCKED week (admin "Auto-fill missing cards"): every
// pool participant who never submitted gets a random valid card (no double-down),
// so they stay in the scoring pool. Pure-DB SECURITY DEFINER RPC (no CFBD call);
// returns the number of cards filled. The RPC refuses to run before the deadline.
export async function autofillCfbWeek(weekId) {
  const { data, error } = await cfb().rpc('autofill_week', { p_week_id: weekId })
  if (error) throw error
  return data ?? 0
}

// Trigger a live-scoreboard poll (admin "Refresh scores"); normally a ~1-min cron.
export async function refreshCfbScores() {
  const { data, error } = await supabase.functions.invoke('poll-cfb-scores', { body: {} })
  if (error) throw error
  if (data && data.error) throw new Error(data.error)
  return data
}

// Trigger a slate + spread refresh (admin "Refresh slates now"); normally an hourly
// cron. Pulls current CFBD games/lines for every active season and fans them onto all
// pools' weeks. See poll-cfb-lines.
export async function refreshCfbSlates() {
  const { data, error } = await supabase.functions.invoke('poll-cfb-lines', { body: {} })
  if (error) throw error
  if (data && data.error) throw new Error(data.error)
  return data
}

// ── Admin: CFB pool creation + weekly ops ────────────────────────────────────

// Create a CFB pool end to end: event(cfb) -> pool -> cfb.event_details -> seed
// cfb.weeks. Unlike golf (create-once, one lock), a CFB pool spans a season of weekly
// windows, so we seed one cfb.weeks row per week with a lock_time on a weekly (7-day)
// cadence from the first-week lock; the admin can fine-tune individual weeks in the ops
// page afterward. The pool's own lock_time doubles as the season join cutoff ("join
// before the first week locks", per docs/CFB_FORMAT.md). CFB uses PER-POOL events (each
// pool owns its own event/weeks/games — see DECISIONS 2026-08-13), so different pools on
// the same real season can start at different weeks with different locks. Slate import
// is automated (poll-cfb-lines) — nothing to import here. If any step fails, the event
// is deleted, cascading away everything already created (same safety as createGolfPool).
export async function createCfbPool({
  name, seasonYear, startWeek, endWeek, firstLockTime,
  stakeAmount, payouts, createdBy, joinCode,
}) {
  const hasStake = Number(stakeAmount) > 0
  const first = Number(startWeek)
  const last = Number(endWeek)

  const { data: event, error: eErr } = await supabase
    .from('events')
    .insert({ sport_id: 'cfb', name: `${seasonYear} College Football — ${name}`, status: 'open' })
    .select('id')
    .single()
  if (eErr) throw eErr

  try {
    const { data: pool, error: pErr } = await supabase
      .from('pools')
      .insert({
        event_id: event.id,
        name,
        join_code: joinCode,
        status: 'open',
        // Pool lock = the first-week lock = the season join cutoff.
        lock_time: firstLockTime ? new Date(firstLockTime).toISOString() : null,
        stake_amount: hasStake ? Number(stakeAmount) : null,
        payout_structure: hasStake ? payouts.map(Number) : null,
        created_by: createdBy,
      })
      .select('id')
      .single()
    if (pErr) throw pErr

    const { error: dErr } = await cfb().from('event_details').insert({
      event_id: event.id,
      season_year: Number(seasonYear),
    })
    if (dErr) throw dErr

    // Seed weeks first..last. Lock times step 7 days from the first-week lock (weekly
    // Saturday cadence); left null if no first lock was given.
    const base = firstLockTime ? new Date(firstLockTime) : null
    const weekRows = []
    for (let wn = first; wn <= last; wn++) {
      let lock = null
      if (base) {
        const d = new Date(base)
        d.setDate(d.getDate() + 7 * (wn - first))
        lock = d.toISOString()
      }
      weekRows.push({
        event_id: event.id,
        week_number: wn,
        label: `Week ${wn}`,
        lock_time: lock,
        status: 'scheduled',
      })
    }
    if (weekRows.length) {
      const { error: wErr } = await cfb().from('weeks').insert(weekRows)
      if (wErr) throw wErr
    }

    return { eventId: event.id, poolId: pool.id }
  } catch (err) {
    await supabase.from('events').delete().eq('id', event.id) // cascades to all children
    throw err
  }
}

// All CFB pools for the admin index (newest first), with their season year.
export async function getAdminCfbPools() {
  const { data: events } = await supabase.from('events').select('id').eq('sport_id', 'cfb')
  const eventIds = (events ?? []).map(e => e.id)
  if (!eventIds.length) return []

  const { data: pools } = await supabase
    .from('pools')
    .select('id, name, status, lock_time, join_code, created_at, event_id')
    .in('event_id', eventIds)
    .order('created_at', { ascending: false })
  if (!pools?.length) return []

  const { data: eds } = await cfb()
    .from('event_details').select('event_id, season_year').in('event_id', eventIds)
  const seasonByEvent = {}
  ;(eds ?? []).forEach(e => { seasonByEvent[e.event_id] = e.season_year })

  return pools.map(p => ({ ...p, season_year: seasonByEvent[p.event_id] ?? null }))
}

// One CFB pool + its season, for the ops page header.
export async function getCfbPool(poolId) {
  const { data: pool } = await supabase
    .from('pools')
    .select('id, name, status, join_code, event_id, lock_time, stake_amount, payout_structure')
    .eq('id', poolId)
    .maybeSingle()
  if (!pool) return null
  const { data: ed } = await cfb()
    .from('event_details').select('season_year').eq('event_id', pool.event_id).maybeSingle()
  // No cfb.event_details row → this isn't a CFB pool. Return null so a golf pool id
  // hitting a /cfb route shows "not found" rather than golf data in the CFB skin.
  if (!ed) return null
  return { ...pool, season_year: ed.season_year }
}

// The pool's weeks with a slate (game) count each, for the ops table.
export async function getCfbPoolWeeks(eventId) {
  const { data: weeks } = await cfb()
    .from('weeks')
    .select('id, week_number, label, lock_time, status')
    .eq('event_id', eventId)
    .order('week_number')
  if (!weeks?.length) return []

  const weekIds = weeks.map(w => w.id)
  const { data: games } = await cfb().from('games').select('week_id').in('week_id', weekIds)
  const countByWeek = {}
  ;(games ?? []).forEach(g => { countByWeek[g.week_id] = (countByWeek[g.week_id] ?? 0) + 1 })

  return weeks.map(w => ({ ...w, game_count: countByWeek[w.id] ?? 0 }))
}

export async function updateWeekLockTime(weekId, lockTime) {
  const { error } = await cfb()
    .from('weeks')
    .update({ lock_time: lockTime ? new Date(lockTime).toISOString() : null })
    .eq('id', weekId)
  if (error) throw error
}

// Current month's CFBD API usage against the Tier-2 cap, for the ops meter.
export async function getCfbdUsage() {
  const month = new Date().toISOString().slice(0, 7)
  const { data } = await supabase
    .from('api_usage').select('cfbd_calls').eq('month', month).maybeSingle()
  return { month, calls: data?.cfbd_calls ?? 0, cap: 30000 }
}

// ── Player-facing: CFB Pool Detail reads (docs/CFB_UI_PLAN.md §6) ─────────────
// These feed the season-standings hero, the week selector, the scorecard-expand,
// and the widget row. All read-only; grading/standings are written server-side.

// The season-cumulative standings the shared UI ranks by (public.pool_standings,
// written by the grader). Rows: { user_id, rank, total, display: {name, subtitle} }.
// Empty until the first week is graded — the page falls back to participants at 0.
export async function getCfbStandings(poolId) {
  const { data } = await supabase
    .from('pool_standings')
    .select('user_id, rank, total')
    .eq('pool_id', poolId)
  return data ?? []
}

// Every member of the pool + their display name, so the standings show everyone
// (even pre-season, before anyone has a standings row). Newest join last.
export async function getCfbParticipants(poolId) {
  const { data: parts } = await supabase
    .from('pool_participants')
    .select('user_id, joined_at')
    .eq('pool_id', poolId)
    .order('joined_at')
  const userIds = [...new Set((parts ?? []).map(p => p.user_id))]
  if (!userIds.length) return []

  const { data: profs } = await supabase
    .from('profiles').select('id, display_name, avatar_url').in('id', userIds)
  const profById = {}
  ;(profs ?? []).forEach(p => { profById[p.id] = p })

  return userIds.map(uid => ({
    user_id: uid,
    display_name: profById[uid]?.display_name ?? 'Participant',
    avatar_url: profById[uid]?.avatar_url ?? null,
  }))
}

// The slate for one week: cfb.games with the live blob + scores/status the poller
// keeps current. Ordered by kickoff so the board and expand read in game order.
export async function getCfbWeekGames(weekId) {
  const { data } = await cfb()
    .from('games')
    .select('id, cfbd_game_id, home_team, away_team, home_team_logo, away_team_logo, ' +
            'home_conference, away_conference, ' +
            'kickoff_at, home_spread, underdog_team, underdog_spread, status, ' +
            'home_score, away_score, live')
    .eq('week_id', weekId)
    .order('kickoff_at', { nullsFirst: false })
  return data ?? []
}

// Every player's picks for one pool-week. RLS returns only your own picks until
// that week locks, then everyone's confirmed picks — so before lock the expand
// only fills in for the current user, which the page handles.
export async function getCfbWeekPicks(poolId, weekId) {
  const { data } = await cfb()
    .from('picks')
    .select('id, user_id, game_id, pick_type, selected_team, is_double_down, ' +
            'locked_spread, auto_filled, result, base_points, bonus_points')
    .eq('pool_id', poolId)
    .eq('week_id', weekId)
  return data ?? []
}

// Submit (or re-submit) a full 6-pick weekly card. picks = array of 6 objects:
// { game_id, pick_type: 'ats'|'underdog', selected_team, is_double_down }. The RPC is
// the real gate (validates the whole card, freezes locked_spread server-side); we just
// send the card and surface its thrown message.
export async function submitCfbWeekPicks(poolId, weekId, picks) {
  const { data, error } = await cfb()
    .rpc('cfb_submit_week_picks', { p_pool_id: poolId, p_week_id: weekId, p_picks: picks })
  if (error) throw error
  return data
}

// Line-movement history for one real game (oldest → newest), for a future UI chart.
export async function getSpreadHistory(cfbdGameId) {
  const { data, error } = await cfb()
    .from('spread_history')
    .select('home_spread, underdog_team, underdog_spread, captured_at')
    .eq('cfbd_game_id', cfbdGameId)
    .order('captured_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

// ── Player-facing: Dashboard tile feed (docs/CFB_UI_PLAN.md §4) ──────────────
// One row per CFB pool this user belongs to, shaped for CfbPoolTile. Batches every
// step with .in(...) so the cost is a handful of queries total, not one per pool.
export async function getMyCfbPools(userId) {
  const { data: myParts } = await supabase
    .from('pool_participants').select('pool_id').eq('user_id', userId)
  const poolIds = [...new Set((myParts ?? []).map(p => p.pool_id))]
  if (!poolIds.length) return []

  const { data: pools } = await supabase
    .from('pools').select('id, name, event_id, lock_time, status').in('id', poolIds)
  if (!pools?.length) return []

  const eventIds = [...new Set(pools.map(p => p.event_id))]
  const { data: events } = await supabase
    .from('events').select('id, sport_id').in('id', eventIds)
  const cfbEventIds = new Set((events ?? []).filter(e => e.sport_id === 'cfb').map(e => e.id))
  const cfbPools = pools.filter(p => cfbEventIds.has(p.event_id))
  if (!cfbPools.length) return []

  const cfbEventIdList = [...new Set(cfbPools.map(p => p.event_id))]

  const [{ data: eds }, { data: weeks }, { data: standings }, { data: parts }] = await Promise.all([
    cfb().from('event_details').select('event_id, season_year').in('event_id', cfbEventIdList),
    cfb().from('weeks').select('id, event_id, week_number, label, lock_time, status')
      .in('event_id', cfbEventIdList).order('week_number'),
    supabase.from('pool_standings').select('pool_id, rank, total')
      .eq('user_id', userId).in('pool_id', cfbPools.map(p => p.id)),
    supabase.from('pool_participants').select('pool_id').in('pool_id', cfbPools.map(p => p.id)),
  ])

  const seasonByEvent = {}
  ;(eds ?? []).forEach(e => { seasonByEvent[e.event_id] = e.season_year })

  const weeksByEvent = {}
  ;(weeks ?? []).forEach(w => { (weeksByEvent[w.event_id] ??= []).push(w) })

  const standingByPool = {}
  ;(standings ?? []).forEach(s => { standingByPool[s.pool_id] = s })

  const playerCountByPool = {}
  ;(parts ?? []).forEach(p => { playerCountByPool[p.pool_id] = (playerCountByPool[p.pool_id] ?? 0) + 1 })

  // Current week per pool: the first not-locked week, else the last (highest number).
  const currentWeekByPool = {}
  cfbPools.forEach(p => {
    const ws = weeksByEvent[p.event_id] ?? []
    if (!ws.length) { currentWeekByPool[p.id] = null; return }
    currentWeekByPool[p.id] = ws.find(w => !weekIsLocked(w)) ?? ws[ws.length - 1]
  })

  // This user's pick count for each pool's current week, in one batched query.
  const currentWeekIds = [...new Set(
    Object.values(currentWeekByPool).filter(Boolean).map(w => w.id)
  )]
  const pickCountByWeek = {}
  if (currentWeekIds.length) {
    const { data: picks } = await cfb()
      .from('picks').select('week_id').eq('user_id', userId).in('week_id', currentWeekIds)
    ;(picks ?? []).forEach(p => { pickCountByWeek[p.week_id] = (pickCountByWeek[p.week_id] ?? 0) + 1 })
  }

  const result = cfbPools.map(p => {
    const w = currentWeekByPool[p.id]
    const standing = standingByPool[p.id]
    let cardStatus = 'preseason'
    if (w) {
      cardStatus = (pickCountByWeek[w.id] ?? 0) >= 6 ? 'card-in' : 'needs-picks'
    }
    return {
      poolId: p.id,
      name: p.name,
      status: p.status,
      seasonYear: seasonByEvent[p.event_id] ?? null,
      currentWeek: w ? {
        id: w.id,
        week_number: w.week_number,
        label: w.label,
        lock_time: w.lock_time,
        status: w.status,
        locked: weekIsLocked(w),
      } : null,
      cardStatus,
      rank: standing?.rank ?? null,
      total: standing?.total ?? 0,
      playerCount: playerCountByPool[p.id] ?? 0,
    }
  })

  result.sort((a, b) => (b.seasonYear ?? 0) - (a.seasonYear ?? 0) || a.name.localeCompare(b.name))
  return result
}

// ── CFB polling controls (admin) ─────────────────────────────────────────────
// The cfb-* cron jobs (poll-cfb-lines, poll-cfb-scores, grade-cfb-week) are turned
// on/off through admin-only RPCs (20260814000000_admin_cfb_polling_controls) —
// the CFB analogue of golf.js's getPollingStatus/startPolling/stopPolling. Each
// RPC re-checks is_admin() server-side; the admin button just calls them. These
// throw on error (unlike the read helpers above) — the toggle needs to surface
// failures, not silently no-op.
export async function getCfbPollingStatus() {
  const { data, error } = await supabase.rpc('admin_cfb_polling_status')
  if (error) throw error
  return !!data
}

export async function startCfbPolling() {
  const { error } = await supabase.rpc('admin_start_cfb_polling')
  if (error) throw error
}

export async function stopCfbPolling() {
  const { error } = await supabase.rpc('admin_stop_cfb_polling')
  if (error) throw error
}
