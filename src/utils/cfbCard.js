// Pure, import-free helpers for the CFB weekly card builder (docs/CFB_UI_PLAN.md §7).
// The client-side mirror of the real gate — cfb.cfb_submit_week_picks validates the
// whole card server-side and is authoritative; this module exists so the UI can show
// live validity/warnings and build the RPC payload without duplicating that logic
// ad hoc in the page component. Same discipline as src/utils/cfbScoring.js.

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
