// Pure CFBD-slate transform: raw /games + /lines + /teams → cfb.games row shapes.
// This is now the SINGLE source of truth for slate building (moved server-side from
// src/lib/cfb.js when slate import went automated — the hourly poll-cfb-lines poller
// owns it, and the browser only triggers a refresh). Import-free, so it's unit-tested
// via vitest in src/utils/cfbSlate.test.js (which imports this .ts directly, same as
// cfbLive/cfbScoring). Rules of record: docs/CFB_FORMAT.md, docs/NAME_MATCHING.md.
//
// Contract the cfb_submit_week_picks RPC (PR2) trusts verbatim:
//   • Only FBS-vs-FBS games with a posted line are emitted (no line → excluded).
//   • home_spread is signed from the HOME team's perspective (negative = home favored).
//   • underdog_team is the ACTUAL underdog; underdog_spread is stored POSITIVE. A
//     pick'em (spread 0) has no underdog → both NULL.
//   • buildGameRows also surfaces `week` (CFBD's OWN week number) so the poller can fan
//     a shaped row out to every pool's matching cfb.weeks row. `week` is stripped
//     before the row is written to cfb.games (which keys off week_id, not
//     week_number). See WEEK_ZERO_CFBD_WEEK below for why that fan-out needs more than
//     a straight week-number match.

// CFBD has shipped both snake_case and camelCase field names across versions.
export function field(obj: any, ...names: string[]) {
  for (const n of names) {
    if (obj?.[n] !== undefined && obj?.[n] !== null) return obj[n]
  }
  return null
}

// ── "Week 0" (the pre-Labor-Day slate — e.g. TCU/UNC) ───────────────────────────────
// CFBD does NOT give this slate its own week number — confirmed against real CFBD
// output, not assumed. It lumps those games together with the following weekend's
// real Week 1 games under the SAME week: 1. So arithmetic can't split them; only
// kickoff date can. cfb.weeks.week_number = 0 is the fan-facing "Week 0" a pool can
// start at (see the 20260817 migration); it always draws its games from CFBD's week 1.
//
// The date window is deliberately a manual, per-season lookup, not computed — "the
// Saturday before Labor Day" shifts every year and CFBD's own boundary for it isn't
// worth reverse-engineering. UPDATE THIS before each new season Week 0 support is
// needed; a season missing from the map just never resolves a game to Week 0 (its
// week-1 games all land in week_number 1, i.e. Week 0 support silently does nothing
// for that season — not broken, just inert).
export const WEEK_ZERO_CFBD_WEEK = 1

// [start, end) UTC bounds, generous enough to cover a Saturday-night ET kickoff that
// crosses into the next UTC day. Confirmed for 2026: the slate plays Sat 8/29.
const WEEK_ZERO_WINDOW: Record<number, [string, string]> = {
  2026: ['2026-08-29T00:00:00Z', '2026-08-31T00:00:00Z'],
}

// Does this CFBD game (already known to report week: WEEK_ZERO_CFBD_WEEK) actually
// belong to the Week 0 slate, by kickoff date? False for a season with no configured
// window, or a game with no kickoff time yet.
export function isWeekZeroGame(season: number, kickoffIso: string | null | undefined): boolean {
  const window = WEEK_ZERO_WINDOW[season]
  if (!window || !kickoffIso) return false
  const [start, end] = window
  return kickoffIso >= start && kickoffIso < end
}

// cfb.weeks.week_number 0 → the CFBD week its games actually live under. (Every other
// week_number passes through unchanged — no season-wide offset, only Week 0 is special.)
export function ourWeekToCfbdWeek(ourWeek: number): number {
  return ourWeek === 0 ? WEEK_ZERO_CFBD_WEEK : ourWeek
}

// Median of a numeric list (pools multiple providers' spreads).
function median(nums: number[]) {
  if (!nums.length) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// Real sportsbook spreads are always whole- or half-point — never a quarter point.
// An even-provider median (average of two middle values, e.g. -4 and -4.5) can land
// on X.25/X.75, which is not a line anyone actually posted. Applied unconditionally
// (even on a single "consensus" provider) as a hard guarantee: no quarter-point value
// can ever be written to cfb.games, regardless of which path produced it. Ties round
// toward +Infinity, matching doubleDownBuffer's existing "ties round up" convention.
function roundToHalfPoint(n: number) {
  return Math.round(n * 2) / 2
}

// Pick one home-perspective spread from a CFBD lines entry. Prefer the "consensus"
// provider; otherwise pool providers by median. Returns { spread, formattedSpread } —
// the text label (e.g. "Michigan -17.5") lets buildGameRows corroborate the sign.
export function chooseLine(lineEntry: any) {
  // A provider with no spread field must be EXCLUDED, not read as 0 — field() returns
  // null for a missing key and Number(null) === 0 (finite), which would otherwise turn a
  // lineless provider into a phantom pick'em. A real posted 0 (spread present) is kept.
  const providers = (lineEntry?.lines ?? []).filter((p: any) => {
    const s = field(p, 'spread')
    return s != null && Number.isFinite(Number(s))
  })
  if (!providers.length) return { spread: null, formattedSpread: null }

  const fmt = (p: any) => field(p, 'formattedSpread', 'formatted_spread')

  const consensus = providers.find(
    (p: any) => String(field(p, 'provider') ?? '').toLowerCase() === 'consensus',
  )
  if (consensus) {
    return { spread: roundToHalfPoint(Number(field(consensus, 'spread'))), formattedSpread: fmt(consensus) }
  }

  const med = median(providers.map((p: any) => Number(field(p, 'spread'))))
  let rep = providers[0]
  let best = Infinity
  for (const p of providers) {
    const d = Math.abs(Number(field(p, 'spread')) - (med as number))
    if (d < best) { best = d; rep = p }
  }
  return { spread: roundToHalfPoint(med as number), formattedSpread: fmt(rep) }
}

export function chooseSpread(lineEntry: any) {
  return chooseLine(lineEntry).spread
}

// CFBD writes the favorite in formattedSpread with a negative number, e.g.
// "Michigan -17.5". Returns the favored team IFF it matches a game team; null on a
// pick'em/EVEN/unparseable label. Used to catch a CFBD sign-convention flip.
export function favoriteFromFormattedSpread(text: any, home: string, away: string) {
  if (!text || typeof text !== 'string') return null
  const parts = text.trim().split(/\s+/)
  const num = Number(parts[parts.length - 1])
  if (!Number.isFinite(num) || num >= 0) return null // EVEN / pick'em / unexpected
  const name = parts.slice(0, -1).join(' ')
  if (name === home) return home
  if (name === away) return away
  return null
}

// Raw CFBD games + lines + FBS team set → cfb.games row objects (minus week_id, which
// the poller stamps per pool). Filters to FBS-vs-FBS games with a posted line; skips a
// game whose numeric sign disagrees with its own text label (a CFBD drift) rather than
// freezing a wrong underdog. Each row carries `week` for the poller's fan-out.
export function buildGameRows(games: any[], lines: any[], fbsTeams: any[]) {
  const fbsSet = new Set(
    (fbsTeams ?? []).map((t: any) => field(t, 'school', 'team')).filter(Boolean),
  )
  const logoBySchool = new Map<string, string>()
  for (const t of fbsTeams ?? []) {
    const school = field(t, 'school', 'team')
    const logos = field(t, 'logos')
    if (school && Array.isArray(logos) && logos[0]) logoBySchool.set(school, logos[0])
  }
  const lineByGameId = new Map<string, any>()
  for (const entry of lines ?? []) {
    const id = field(entry, 'id', 'gameId', 'game_id')
    if (id != null) lineByGameId.set(String(id), chooseLine(entry))
  }

  const rows: any[] = []
  for (const g of games ?? []) {
    const gameId = field(g, 'id', 'gameId', 'game_id')
    const home = field(g, 'homeTeam', 'home_team')
    const away = field(g, 'awayTeam', 'away_team')
    if (gameId == null || !home || !away) continue

    const bothFbs = fbsSet.size
      ? fbsSet.has(home) && fbsSet.has(away)
      : field(g, 'homeClassification', 'home_classification') === 'fbs'
        && field(g, 'awayClassification', 'away_classification') === 'fbs'
    if (!bothFbs) continue

    const line = lineByGameId.get(String(gameId))
    const spread = line?.spread
    if (spread == null || !Number.isFinite(spread)) continue // no line → not pickable

    // Corroborate CFBD's numeric sign against its own text label.
    const signFavorite = spread < 0 ? home : spread > 0 ? away : null
    if (signFavorite) {
      const textFavorite = favoriteFromFormattedSpread(line.formattedSpread, home, away)
      if (textFavorite && textFavorite !== signFavorite) {
        console.warn(
          `[cfb slate] sign mismatch on game ${gameId} (${away} @ ${home}): ` +
          `spread ${spread} implies ${signFavorite}, label "${line.formattedSpread}" ` +
          `names ${textFavorite}. Skipping.`,
        )
        continue
      }
    }

    let underdogTeam: string | null = null
    let underdogSpread: number | null = null
    if (spread < 0) { underdogTeam = away; underdogSpread = Math.abs(spread) }
    else if (spread > 0) { underdogTeam = home; underdogSpread = Math.abs(spread) }

    const completed = field(g, 'completed') === true
    rows.push({
      cfbd_game_id: String(gameId),
      week: field(g, 'week', 'weekNumber', 'week_number'), // for the poller's fan-out; stripped before write
      home_team: home,
      away_team: away,
      home_team_logo: logoBySchool.get(home) ?? null,
      away_team_logo: logoBySchool.get(away) ?? null,
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
