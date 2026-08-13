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
    const { error } = await cfb()
      .from('games')
      .upsert(rows, { onConflict: 'cfbd_game_id' })
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
