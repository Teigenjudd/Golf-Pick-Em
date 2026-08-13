// Single place that talks to the per-sport `cfb` schema (plus the shared public
// tables it needs) — the CFB analogue of src/lib/golf.js, and the ONLY file that
// calls supabase.schema('cfb'). CFB code never imports golf and vice versa.
//
// PR3 scope: the weekly slate importer. It fetches a week's games + lines from
// CollegeFootballData (via the cfd-proxy) and upserts them into cfb.games. The
// pick UI, scoring, and grading arrive in later PRs.
//
// Data contract this file is solely responsible for (the cfb_submit_week_picks
// RPC from PR2 trusts it verbatim, with no defensive check — see
// docs/CFB_BUILD_PLAN.md § slate import):
//   • Only FBS-vs-FBS games that have a posted line are stored. A game without a
//     line is excluded entirely (the underdog slot needs a line to tier it).
//   • home_spread is signed from the HOME team's perspective (negative = home
//     favored / laying points).
//   • underdog_team is the ACTUAL underdog, and underdog_spread is stored
//     POSITIVE (the points the dog gets). A pick'em (spread 0) has no underdog:
//     both are NULL. A DB CHECK (PR3 migration) also enforces the positive rule.

import { supabase } from './supabase'
import { getGames, getLines, getFbsTeams } from './cfbd'

// All cfb-schema access funnels through here.
const cfb = () => supabase.schema('cfb')

// CFBD has shipped both snake_case and camelCase field names across API
// versions; read whichever is present.
function field(obj, ...names) {
  for (const n of names) {
    if (obj?.[n] !== undefined && obj?.[n] !== null) return obj[n]
  }
  return null
}

// Median of a numeric list (used to pool multiple providers' spreads).
function median(nums) {
  if (!nums.length) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// Pick a single home-perspective spread from a CFBD lines entry. Prefer the
// "consensus" provider when present; otherwise pool the providers by median so
// one outlier book can't skew the line. Also returns a representative
// `formattedSpread` — CFBD's own text label like "Michigan -17.5", which names
// the favorite — paired with the chosen number, so buildGameRows can corroborate
// the sign convention. Returns { spread, formattedSpread }; spread is null (no
// line) when nothing usable is posted.
export function chooseLine(lineEntry) {
  const providers = (lineEntry?.lines ?? []).filter(
    p => Number.isFinite(Number(field(p, 'spread'))),
  )
  if (!providers.length) return { spread: null, formattedSpread: null }

  const fmt = p => field(p, 'formattedSpread', 'formatted_spread')

  const consensus = providers.find(
    p => String(field(p, 'provider') ?? '').toLowerCase() === 'consensus',
  )
  if (consensus) return { spread: Number(field(consensus, 'spread')), formattedSpread: fmt(consensus) }

  const med = median(providers.map(p => Number(field(p, 'spread'))))
  // Representative label = the provider closest to the median we're storing.
  let rep = providers[0]
  let best = Infinity
  for (const p of providers) {
    const d = Math.abs(Number(field(p, 'spread')) - med)
    if (d < best) { best = d; rep = p }
  }
  return { spread: med, formattedSpread: fmt(rep) }
}

// Thin back-compat wrapper: just the chosen number.
export function chooseSpread(lineEntry) {
  return chooseLine(lineEntry).spread
}

// CFBD writes the favorite in `formattedSpread` with a negative line, e.g.
// "Michigan -17.5" (or "Miami (OH) -3.5", "Texas A&M -7"). Returns the favored
// team name IFF it matches one of this game's two teams; null when the label is
// a pick'em/EVEN, malformed, or names a team we can't match (can't corroborate).
// Used to catch a CFBD sign-convention flip: if the text names one favorite but
// the numeric spread's sign implies the other, the number has drifted.
export function favoriteFromFormattedSpread(text, home, away) {
  if (!text || typeof text !== 'string') return null
  const parts = text.trim().split(/\s+/)
  const num = Number(parts[parts.length - 1])
  if (!Number.isFinite(num) || num >= 0) return null // EVEN / pick'em / unexpected format
  const name = parts.slice(0, -1).join(' ')
  if (name === home) return home
  if (name === away) return away
  return null
}

// Pure transform: CFBD games + lines + FBS team set → cfb.games row objects
// (minus week_id, which the caller stamps on). Kept import-free and exported so
// it can be unit-tested (PR4) and reasoned about in isolation. Filters to
// FBS-vs-FBS games that have a posted line; everything else is dropped.
export function buildGameRows(games, lines, fbsTeams) {
  const fbsSet = new Set(
    (fbsTeams ?? []).map(t => field(t, 'school', 'team')).filter(Boolean),
  )
  const lineByGameId = new Map()
  for (const entry of lines ?? []) {
    const id = field(entry, 'id', 'gameId', 'game_id')
    if (id != null) lineByGameId.set(String(id), chooseLine(entry))
  }

  const rows = []
  for (const g of games ?? []) {
    const gameId = field(g, 'id', 'gameId', 'game_id')
    const home = field(g, 'homeTeam', 'home_team')
    const away = field(g, 'awayTeam', 'away_team')
    if (gameId == null || !home || !away) continue

    // Both teams must be FBS (the "all-FBS" slate). If we somehow lack the team
    // set, fall back to CFBD's per-game classification fields.
    const bothFbs = fbsSet.size
      ? fbsSet.has(home) && fbsSet.has(away)
      : field(g, 'homeClassification', 'home_classification') === 'fbs'
        && field(g, 'awayClassification', 'away_classification') === 'fbs'
    if (!bothFbs) continue

    const line = lineByGameId.get(String(gameId))
    const spread = line?.spread
    if (spread == null || !Number.isFinite(spread)) continue // no line → not pickable

    // Corroborate CFBD's numeric sign against its own text label (which names the
    // favorite). If the label names the OTHER team, CFBD's sign convention has
    // drifted — skip this game and flag it rather than freeze a wrong underdog.
    // (spread === 0 is a pick'em: no favorite to check.)
    const signFavorite = spread < 0 ? home : spread > 0 ? away : null
    if (signFavorite) {
      const textFavorite = favoriteFromFormattedSpread(line.formattedSpread, home, away)
      if (textFavorite && textFavorite !== signFavorite) {
        console.warn(
          `[cfb slate] sign mismatch on game ${gameId} (${away} @ ${home}): ` +
          `spread ${spread} implies ${signFavorite} favored, but CFBD label ` +
          `"${line.formattedSpread}" names ${textFavorite}. Skipping.`,
        )
        continue
      }
    }

    // Underdog is the team getting points; its spread is stored positive.
    // spread < 0: home favored → away is the dog. spread > 0: away favored →
    // home is the dog. spread === 0: pick'em → no underdog.
    let underdogTeam = null
    let underdogSpread = null
    if (spread < 0) {
      underdogTeam = away
      underdogSpread = Math.abs(spread)
    } else if (spread > 0) {
      underdogTeam = home
      underdogSpread = Math.abs(spread)
    }

    const completed = field(g, 'completed') === true
    rows.push({
      cfbd_game_id: String(gameId),
      home_team: home,
      away_team: away,
      home_conference: field(g, 'homeConference', 'home_conference'),
      away_conference: field(g, 'awayConference', 'away_conference'),
      kickoff_at: field(g, 'startDate', 'start_date') || null,
      home_spread: spread,
      is_fbs_vs_fbs: true,
      status: completed ? 'final' : 'scheduled',
      home_score: completed ? field(g, 'homePoints', 'home_points') : null,
      away_score: completed ? field(g, 'awayPoints', 'away_points') : null,
      underdog_team: underdogTeam,
      underdog_spread: underdogSpread,
    })
  }
  return rows
}

// Import one week's slate into cfb.games. Fetches games + lines + the FBS team
// set through the proxy, shapes them with buildGameRows, and upserts on
// (week_id, cfbd_game_id) (so a re-import as lines move just refreshes the rows —
// already-submitted picks are unaffected because they carry a frozen
// locked_spread). The three proxy calls run sequentially on purpose: each
// increments the shared api_usage.cfbd_calls counter with a read-then-write, so
// firing them in parallel would under-count against the monthly cap.
//
// weekId is an existing cfb.weeks row; seasonYear/weekNumber address the CFBD
// slate. Requires an admin session (the cfd-proxy enforces it). Returns a small
// summary for the admin UI.
export async function importWeekSlate({ weekId, seasonYear, weekNumber }) {
  // Guard: the CFBD week we're about to pull (seasonYear/weekNumber) must be the
  // same week the target row (weekId) actually is. Without this, a caller slip
  // would silently store one week's games under another week's id. Cheap: one
  // read of the stored week + its season.
  const { data: wk, error: wkErr } = await cfb()
    .from('weeks')
    .select('week_number, event_id')
    .eq('id', weekId)
    .maybeSingle()
  if (wkErr) throw wkErr
  if (!wk) throw new Error(`importWeekSlate: no cfb.weeks row for weekId ${weekId}`)
  if (wk.week_number !== weekNumber) {
    throw new Error(
      `importWeekSlate: weekId ${weekId} is week ${wk.week_number}, but weekNumber=${weekNumber} was passed`,
    )
  }
  // Season check via event_details (split query, not a nested embed — the
  // public/cfb boundary is joined in JS, same discipline as lib/golf.js).
  const { data: ed } = await cfb()
    .from('event_details')
    .select('season_year')
    .eq('event_id', wk.event_id)
    .maybeSingle()
  if (ed?.season_year != null && ed.season_year !== seasonYear) {
    throw new Error(
      `importWeekSlate: that week's season is ${ed.season_year}, but seasonYear=${seasonYear} was passed`,
    )
  }

  const games = await getGames({ year: seasonYear, week: weekNumber })
  const lines = await getLines({ year: seasonYear, week: weekNumber })
  const fbsTeams = await getFbsTeams(seasonYear)

  const rows = buildGameRows(games, lines, fbsTeams).map(r => ({ ...r, week_id: weekId }))

  if (rows.length) {
    // Upsert on (week_id, cfbd_game_id): CFB uses per-pool events, so the same real
    // CFBD game appears once per pool's week — the key must be per-week, not global,
    // or one pool's import would overwrite another's rows (see the 20260813 migration).
    const { error } = await cfb()
      .from('games')
      .upsert(rows, { onConflict: 'week_id,cfbd_game_id' })
    if (error) throw error
  }

  return { imported: rows.length, fetched: (games ?? []).length }
}

// Trigger authoritative grading of one week (admin "Grade week" button, PR9). Invokes
// the grade-cfb-week edge function, which runs as service_role — it pulls final scores
// from CFBD, grades every pick with the shared scoring engine, and recomputes each
// affected pool's season standings. Grading is NOT done client-side (users must not be
// able to score their own picks); this is just the trigger. Returns the function's
// summary ({ graded, standings, cfbd_calls }). Omit weekId to grade all due weeks.
export async function gradeCfbWeek(weekId) {
  const { data, error } = await supabase.functions.invoke('grade-cfb-week', {
    body: weekId ? { week_id: weekId } : {},
  })
  if (error) throw error
  if (data && data.error) throw new Error(data.error)
  return data
}

// Trigger a live-scoreboard poll on demand (admin "Refresh scores" button, PR9).
// Invokes the poll-cfb-scores edge function, which — if any game is currently in its
// live window — makes one CFBD /scoreboard call, updates live state + scores on
// cfb.games, and grades + restands any week whose game just went final. Normally this
// runs on a ~1-minute pg_cron during game days (armed in PR9); this is the manual
// analogue of golf's "Refresh Now". Returns the function's summary.
export async function refreshCfbScores() {
  const { data, error } = await supabase.functions.invoke('poll-cfb-scores', { body: {} })
  if (error) throw error
  if (data && data.error) throw new Error(data.error)
  return data
}

// ── Admin: CFB pool creation + weekly ops ────────────────────────────────────

// Create a CFB pool end to end: event(cfb) -> pool -> cfb.event_details -> seed
// cfb.weeks. Unlike golf (create-once, one lock), a CFB pool spans a season of weekly
// windows, so we seed one cfb.weeks row per week with a lock_time on a weekly (7-day)
// cadence from the Week-1 lock; the admin can fine-tune individual weeks in the ops
// page afterward. The pool's own lock_time doubles as the season join cutoff ("join
// before Week 1 locks", per docs/CFB_FORMAT.md). If any step fails, the event is
// deleted, which cascades away everything already created (same safety as createGolfPool).
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
        // Pool lock = the Week-1 lock = the season join cutoff.
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

    // Seed weeks first..last. Lock times step 7 days from the Week-1 lock (weekly
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
    .select('id, name, status, join_code, event_id, lock_time')
    .eq('id', poolId)
    .maybeSingle()
  if (!pool) return null
  const { data: ed } = await cfb()
    .from('event_details').select('season_year').eq('event_id', pool.event_id).maybeSingle()
  return { ...pool, season_year: ed?.season_year ?? null }
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
