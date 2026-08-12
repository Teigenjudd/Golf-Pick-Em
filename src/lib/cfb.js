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
// one outlier book can't skew the line. Returns a number or null (no line).
export function chooseSpread(lineEntry) {
  const providers = lineEntry?.lines ?? []
  const numeric = providers
    .map(p => field(p, 'spread'))
    .map(Number)
    .filter(n => Number.isFinite(n))
  if (!numeric.length) return null

  const consensus = providers.find(
    p => String(field(p, 'provider') ?? '').toLowerCase() === 'consensus',
  )
  const consensusSpread = consensus ? Number(field(consensus, 'spread')) : NaN
  return Number.isFinite(consensusSpread) ? consensusSpread : median(numeric)
}

// Pure transform: CFBD games + lines + FBS team set → cfb.games row objects
// (minus week_id, which the caller stamps on). Kept import-free and exported so
// it can be unit-tested (PR4) and reasoned about in isolation. Filters to
// FBS-vs-FBS games that have a posted line; everything else is dropped.
export function buildGameRows(games, lines, fbsTeams) {
  const fbsSet = new Set(
    (fbsTeams ?? []).map(t => field(t, 'school', 'team')).filter(Boolean),
  )
  const spreadByGameId = new Map()
  for (const entry of lines ?? []) {
    const id = field(entry, 'id', 'gameId', 'game_id')
    if (id != null) spreadByGameId.set(String(id), chooseSpread(entry))
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

    const spread = spreadByGameId.get(String(gameId))
    if (spread == null || !Number.isFinite(spread)) continue // no line → not pickable

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
      kickoff_at: field(g, 'startDate', 'start_date', 'startTimeTBD') || null,
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
// cfbd_game_id (so a re-import as lines move just refreshes the rows —
// already-submitted picks are unaffected because they carry a frozen
// locked_spread). The three proxy calls run sequentially on purpose: each
// increments the shared api_usage.cfbd_calls counter with a read-then-write, so
// firing them in parallel would under-count against the monthly cap.
//
// weekId is an existing cfb.weeks row; seasonYear/weekNumber address the CFBD
// slate. Requires an admin session (the cfd-proxy enforces it). Returns a small
// summary for the admin UI.
export async function importWeekSlate({ weekId, seasonYear, weekNumber }) {
  const games = await getGames({ year: seasonYear, week: weekNumber })
  const lines = await getLines({ year: seasonYear, week: weekNumber })
  const fbsTeams = await getFbsTeams(seasonYear)

  const rows = buildGameRows(games, lines, fbsTeams).map(r => ({ ...r, week_id: weekId }))

  if (rows.length) {
    const { error } = await cfb()
      .from('games')
      .upsert(rows, { onConflict: 'cfbd_game_id' })
    if (error) throw error
  }

  return { imported: rows.length, fetched: (games ?? []).length }
}
