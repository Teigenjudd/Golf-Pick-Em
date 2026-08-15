// Shared search/conference-filter/sort logic for CFB game lists — the weekly picks
// builder (CfbPicks) and the read-only slate page (CfbSlate) both list "this week's
// games" and offer the same view controls, so the filtering lives here once rather
// than drifting between two copies. Pure, no data access.

// Conferences actually in play this week, deduped + sorted, for filter chips.
export function conferencesInPlay(games) {
  const set = new Set()
  ;(games ?? []).forEach(g => {
    if (g.home_conference) set.add(g.home_conference)
    if (g.away_conference) set.add(g.away_conference)
  })
  return [...set].sort()
}

// Search (team name substring) + conference filter (empty set = all) + sort, applied
// on top of the full game list. Games already arrive kickoff-ordered from
// getCfbWeekGames, so sortBy 'kickoff' is a no-op and Array#filter preserves it.
export function filterAndSortGames(games, { search, selectedConferences, sortBy }) {
  let list = games ?? []
  const q = (search ?? '').trim().toLowerCase()
  if (q) {
    list = list.filter(g =>
      g.home_team.toLowerCase().includes(q) || g.away_team.toLowerCase().includes(q))
  }
  if (selectedConferences?.size > 0) {
    list = list.filter(g =>
      selectedConferences.has(g.home_conference) || selectedConferences.has(g.away_conference))
  }
  if (sortBy === 'alpha') {
    list = [...list].sort((a, b) => a.away_team.localeCompare(b.away_team))
  } else if (sortBy === 'spread') {
    list = [...list].sort((a, b) => Math.abs(Number(a.home_spread)) - Math.abs(Number(b.home_spread)))
  }
  return list
}
