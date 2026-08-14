// Helpers for the CFB weekly card (docs/CFB_UI_PLAN.md §7). Two jobs:
//   1. the card BUILDER — the client-side mirror of the real gate
//      (cfb.cfb_submit_week_picks validates the whole card server-side and is
//      authoritative; cfbCardValidity/buildPicksPayload let the UI show live
//      validity/warnings and build the RPC payload without duplicating that logic).
//   2. shapeCard — turn a user's stored picks + the week's games into the
//      display-ready, graded shape both CfbStandings (pool-detail expand) and the
//      read-only picks view render. Grading is recomputed client-side with the shared
//      scoring engine so the two surfaces can't drift.

import { gradeWeekCard, pickMargin } from './cfbScoring'
import { pickLine } from './cfbFormat'

// The card being built, in UI-state shape:
//   atsPicks         — { [game_id]: selected_team } — up to 5 entries
//   doubleDownGameId — a game_id that's a key of atsPicks, or null (≤1 double-down)
//   underdogGameId   — a game_id (the mandatory 6th, distinct game), or null

// Live validity + counts for the sticky tracker. `valid` mirrors the RPC's whole-card
// rule: exactly 5 ATS on 5 distinct games + exactly 1 underdog on a distinct 6th game +
// the double-down (if any) is one of the 5 ATS games. `warning` is a short human string
// for an ACTIVELY violated rule (not just "incomplete") — null otherwise.
export function cfbCardValidity({ atsPicks, doubleDownGameId, underdogGameId }) {
  const atsGameIds = Object.keys(atsPicks ?? {})
  const atsCount = atsGameIds.length
  const dogCount = underdogGameId != null ? 1 : 0

  const ddOnAts = doubleDownGameId != null && atsGameIds.includes(doubleDownGameId)
  const ddCount = doubleDownGameId != null ? 1 : 0

  const allIds = dogCount ? [...atsGameIds, underdogGameId] : atsGameIds
  const distinctCount = new Set(allIds).size

  const collision = underdogGameId != null && atsGameIds.includes(underdogGameId)
  const ddOffCard = doubleDownGameId != null && !ddOnAts

  let warning = null
  if (collision) {
    warning = "That game can't be both an ATS pick and your underdog."
  } else if (ddOffCard) {
    warning = 'Double-down must be one of your 5 ATS picks.'
  } else if (atsCount > 5) {
    warning = 'Only 5 ATS picks allowed.'
  }

  const valid =
    atsCount === 5 &&
    dogCount === 1 &&
    distinctCount === 6 &&
    (doubleDownGameId == null || ddOnAts)

  return { atsCount, ddCount, dogCount, distinctCount, valid, warning }
}

// Build the RPC's p_picks payload — the 6-object array cfb_submit_week_picks expects.
// gamesById must contain every game referenced by the card (so the underdog row can
// look up that game's underdog_team).
export function buildPicksPayload({ atsPicks, doubleDownGameId, underdogGameId }, gamesById) {
  const atsRows = Object.entries(atsPicks ?? {}).map(([gameId, selectedTeam]) => ({
    game_id: gameId,
    pick_type: 'ats',
    selected_team: selectedTeam,
    is_double_down: gameId === doubleDownGameId,
  }))

  const dogGame = gamesById?.[underdogGameId]
  const dogRow = {
    game_id: underdogGameId,
    pick_type: 'underdog',
    selected_team: dogGame?.underdog_team,
    is_double_down: false,
  }

  return [...atsRows, dogRow]
}

// Turn one user's stored picks + a lookup of the week's games into the display-ready,
// graded card shape consumed by CfbStandings and the read-only picks view:
//   { total, picks: [{ slot, pickType, isDoubleDown, autoFilled, line, matchup,
//                       awayTeam, homeTeam, awayScore, homeScore, status, live,
//                       kickoffAt, result, points, selectedTeam, lockedSpread }] }
// Picks are ordered 5 ATS (by kickoff) then the underdog. gamesById is keyed by game_id.
export function shapeCard(userPicks, gamesById) {
  const enriched = userPicks.map(p => {
    const g = gamesById[p.game_id] ?? {}
    // Only FINAL games award points. An in-progress game has a live score (shown in
    // the game line) but stays ungraded — matches the server grader and keeps points
    // from flip-flopping mid-game (docs/CFB_UI_PLAN.md §6: "points update as games
    // go final").
    const margin = g.status === 'final'
      ? pickMargin({
          selectedTeam: p.selected_team,
          homeTeam: g.home_team, awayTeam: g.away_team,
          homeScore: g.home_score, awayScore: g.away_score,
        })
      : null
    return { ...p, margin, game: g }
  })

  const graded = gradeWeekCard(enriched)
  const ats = graded.picks
    .filter(p => p.pick_type === 'ats')
    .sort((a, b) => new Date(a.game.kickoff_at ?? 0) - new Date(b.game.kickoff_at ?? 0))
  const dogs = graded.picks.filter(p => p.pick_type === 'underdog')

  const displayPicks = [...ats, ...dogs].map(p => {
    const g = p.game ?? {}
    return {
      slot: p.pick_type === 'underdog' ? null : ats.indexOf(p) + 1,
      pickType: p.pick_type,
      isDoubleDown: p.is_double_down,
      autoFilled: p.auto_filled,
      line: pickLine(p.selected_team, p.locked_spread),
      matchup: `${g.away_team ?? '?'} @ ${g.home_team ?? '?'}`,
      awayTeam: g.away_team, homeTeam: g.home_team,
      awayScore: g.away_score, homeScore: g.home_score,
      status: g.status, live: g.live, kickoffAt: g.kickoff_at,
      result: p.result,
      points: (p.base_points ?? 0) + (p.bonus_points ?? 0),
      selectedTeam: p.selected_team,
      lockedSpread: p.locked_spread,
    }
  })

  return { total: graded.total, picks: displayPicks }
}
