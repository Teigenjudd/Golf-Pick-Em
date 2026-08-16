// CFB demo fixture — the /demo/cfb analogue of demoData.js. Simulates a season one
// week in: Week 1 is graded (a real card + games run through the actual scoring
// engine, src/utils/cfbCard.js's shapeCard, so every total/rank below is computed,
// not hand-typed), Week 2 is the open week the demo visitor builds a live card for.
// No backend — DemoCfbContext holds the visitor's Week 2 card in memory.

import { shapeCard } from '../utils/cfbCard'

export const demoCfbPool = {
  id: 'demo-cfb',
  name: 'Varsity Pick’em',
  season_year: 2026,
  stake_amount: 20,
  payout_structure: [70, 30],
}

export const demoCfbWeeks = [
  { id: 'demo-cfb-week-1', week_number: 1, label: 'Week 1', status: 'graded', lock_time: '2026-09-05T23:00:00Z' },
  { id: 'demo-cfb-week-2', week_number: 2, label: 'Week 2', status: 'scheduled', lock_time: '2026-09-13T16:00:00Z' },
]

// ── Week 1 — final, graded ───────────────────────────────────────────────────
export const demoCfbWeek1Games = [
  { id: 'demo-cfb-w1-g1', home_team: 'Ohio State', away_team: 'Texas', home_conference: 'Big Ten', away_conference: 'SEC', kickoff_at: '2026-09-05T19:30:00Z', home_spread: -13.5, underdog_team: 'Texas', underdog_spread: 13.5, status: 'final', home_score: 34, away_score: 20 },
  { id: 'demo-cfb-w1-g2', home_team: 'Georgia', away_team: 'Clemson', home_conference: 'SEC', away_conference: 'ACC', kickoff_at: '2026-09-05T20:00:00Z', home_spread: -3, underdog_team: 'Clemson', underdog_spread: 3, status: 'final', home_score: 27, away_score: 24 },
  { id: 'demo-cfb-w1-g3', home_team: 'Oregon', away_team: 'Michigan', home_conference: 'Big Ten', away_conference: 'Big Ten', kickoff_at: '2026-09-05T22:30:00Z', home_spread: -6.5, underdog_team: 'Michigan', underdog_spread: 6.5, status: 'final', home_score: 31, away_score: 17 },
  { id: 'demo-cfb-w1-g4', home_team: 'Alabama', away_team: 'Wisconsin', home_conference: 'SEC', away_conference: 'Big Ten', kickoff_at: '2026-09-05T23:00:00Z', home_spread: -10, underdog_team: 'Wisconsin', underdog_spread: 10, status: 'final', home_score: 24, away_score: 21 },
  { id: 'demo-cfb-w1-g5', home_team: 'Penn State', away_team: 'Illinois', home_conference: 'Big Ten', away_conference: 'Big Ten', kickoff_at: '2026-09-06T17:00:00Z', home_spread: -17, underdog_team: 'Illinois', underdog_spread: 17, status: 'final', home_score: 45, away_score: 10 },
  { id: 'demo-cfb-w1-g6', home_team: 'Utah', away_team: 'USC', home_conference: 'Big 12', away_conference: 'Big Ten', kickoff_at: '2026-09-06T20:00:00Z', home_spread: -4, underdog_team: 'USC', underdog_spread: 4, status: 'final', home_score: 20, away_score: 23 },
  { id: 'demo-cfb-w1-g7', home_team: 'Notre Dame', away_team: 'NC State', home_conference: 'Independent', away_conference: 'ACC', kickoff_at: '2026-09-06T19:30:00Z', home_spread: -8, underdog_team: 'NC State', underdog_spread: 8, status: 'final', home_score: 28, away_score: 14 },
  { id: 'demo-cfb-w1-g8', home_team: 'Florida State', away_team: 'Miami', home_conference: 'ACC', away_conference: 'ACC', kickoff_at: '2026-09-06T23:30:00Z', home_spread: -2.5, underdog_team: 'Miami', underdog_spread: 2.5, status: 'final', home_score: 17, away_score: 24 },
]

export const demoCfbParticipants = [
  { user_id: 'demo-cfb-you', display_name: 'You' },
  { user_id: 'demo-cfb-2', display_name: 'Tim Tebow' },
  { user_id: 'demo-cfb-3', display_name: 'Reggie Bush' },
  { user_id: 'demo-cfb-4', display_name: 'Herschel Walker' },
  { user_id: 'demo-cfb-5', display_name: 'Peyton Manning' },
  { user_id: 'demo-cfb-6', display_name: 'Barry Sanders' },
  { user_id: 'demo-cfb-7', display_name: 'Johnny Manziel' },
  { user_id: 'demo-cfb-8', display_name: 'Bo Jackson' },
]

// Each row: { game_id, pick_type, selected_team, is_double_down } keyed by user.
// Five ATS on five distinct games + one double-down flag + one underdog on a
// distinct sixth game — the same shape cfb_submit_week_picks accepts.
const WEEK1_CARDS = {
  'demo-cfb-you': { ats: [['demo-cfb-w1-g1', 'Ohio State'], ['demo-cfb-w1-g2', 'Georgia'], ['demo-cfb-w1-g3', 'Oregon'], ['demo-cfb-w1-g4', 'Alabama'], ['demo-cfb-w1-g5', 'Penn State']], dd: 'demo-cfb-w1-g3', dog: 'demo-cfb-w1-g6' },
  'demo-cfb-2': { ats: [['demo-cfb-w1-g1', 'Texas'], ['demo-cfb-w1-g2', 'Clemson'], ['demo-cfb-w1-g3', 'Michigan'], ['demo-cfb-w1-g4', 'Wisconsin'], ['demo-cfb-w1-g7', 'Notre Dame']], dd: 'demo-cfb-w1-g4', dog: 'demo-cfb-w1-g8' },
  'demo-cfb-3': { ats: [['demo-cfb-w1-g1', 'Ohio State'], ['demo-cfb-w1-g2', 'Georgia'], ['demo-cfb-w1-g5', 'Penn State'], ['demo-cfb-w1-g6', 'Utah'], ['demo-cfb-w1-g8', 'Florida State']], dd: 'demo-cfb-w1-g5', dog: 'demo-cfb-w1-g3' },
  'demo-cfb-4': { ats: [['demo-cfb-w1-g4', 'Wisconsin'], ['demo-cfb-w1-g6', 'USC'], ['demo-cfb-w1-g8', 'Miami'], ['demo-cfb-w1-g1', 'Ohio State'], ['demo-cfb-w1-g7', 'Notre Dame']], dd: 'demo-cfb-w1-g6', dog: 'demo-cfb-w1-g2' },
  'demo-cfb-5': { ats: [['demo-cfb-w1-g3', 'Oregon'], ['demo-cfb-w1-g4', 'Alabama'], ['demo-cfb-w1-g5', 'Illinois'], ['demo-cfb-w1-g7', 'NC State'], ['demo-cfb-w1-g8', 'Miami']], dd: 'demo-cfb-w1-g8', dog: 'demo-cfb-w1-g6' },
  'demo-cfb-6': { ats: [['demo-cfb-w1-g1', 'Ohio State'], ['demo-cfb-w1-g2', 'Clemson'], ['demo-cfb-w1-g3', 'Oregon'], ['demo-cfb-w1-g6', 'Utah'], ['demo-cfb-w1-g7', 'Notre Dame']], dd: 'demo-cfb-w1-g1', dog: 'demo-cfb-w1-g4' },
  'demo-cfb-7': { ats: [['demo-cfb-w1-g4', 'Wisconsin'], ['demo-cfb-w1-g6', 'USC'], ['demo-cfb-w1-g2', 'Georgia'], ['demo-cfb-w1-g5', 'Penn State'], ['demo-cfb-w1-g8', 'Florida State']], dd: 'demo-cfb-w1-g4', dog: 'demo-cfb-w1-g1' },
  'demo-cfb-8': { ats: [['demo-cfb-w1-g3', 'Michigan'], ['demo-cfb-w1-g4', 'Alabama'], ['demo-cfb-w1-g7', 'NC State'], ['demo-cfb-w1-g8', 'Miami'], ['demo-cfb-w1-g6', 'USC']], dd: 'demo-cfb-w1-g8', dog: 'demo-cfb-w1-g5' },
}

const week1GamesById = Object.fromEntries(demoCfbWeek1Games.map(g => [g.id, g]))

function lockedSpreadFor(gameId, selectedTeam) {
  const g = week1GamesById[gameId]
  return selectedTeam === g.home_team ? g.home_spread : -g.home_spread
}

export const demoCfbWeek1Picks = demoCfbParticipants.flatMap(({ user_id }) => {
  const card = WEEK1_CARDS[user_id]
  const dogGame = week1GamesById[card.dog]
  const atsRows = card.ats.map(([gameId, team]) => ({
    id: `${user_id}-${gameId}-ats`,
    user_id,
    game_id: gameId,
    pick_type: 'ats',
    selected_team: team,
    is_double_down: gameId === card.dd,
    locked_spread: lockedSpreadFor(gameId, team),
    auto_filled: false,
  }))
  const dogRow = {
    id: `${user_id}-${card.dog}-dog`,
    user_id,
    game_id: card.dog,
    pick_type: 'underdog',
    selected_team: dogGame.underdog_team,
    is_double_down: false,
    locked_spread: dogGame.underdog_spread,
    auto_filled: false,
  }
  return [...atsRows, dogRow]
})

// Season standings — the demo analogue of what grade-cfb-week already wrote to
// public.pool_standings after Week 1. Computed from the real scoring engine so it
// can't drift from the cards above.
export const demoCfbSeasonStandings = (() => {
  const picksByUser = {}
  demoCfbWeek1Picks.forEach(p => { (picksByUser[p.user_id] ??= []).push(p) })

  const totals = demoCfbParticipants.map(p => ({
    user_id: p.user_id,
    total: shapeCard(picksByUser[p.user_id] ?? [], week1GamesById).total,
  }))
  totals.sort((a, b) => b.total - a.total)

  return totals.map((e, _i, arr) => ({
    user_id: e.user_id,
    rank: arr.findIndex(x => x.total === e.total) + 1,
    total: e.total,
  }))
})()

// ── Week 2 — open, no picks yet (the visitor builds this one) ───────────────
export const demoCfbWeek2Games = [
  { id: 'demo-cfb-w2-g1', home_team: 'Clemson', away_team: 'Georgia', home_conference: 'ACC', away_conference: 'SEC', kickoff_at: '2026-09-12T19:30:00Z', home_spread: 2.5, underdog_team: 'Clemson', underdog_spread: 2.5, status: 'scheduled', home_score: null, away_score: null },
  { id: 'demo-cfb-w2-g2', home_team: 'Wisconsin', away_team: 'Alabama', home_conference: 'Big Ten', away_conference: 'SEC', kickoff_at: '2026-09-12T23:00:00Z', home_spread: 9, underdog_team: 'Wisconsin', underdog_spread: 9, status: 'scheduled', home_score: null, away_score: null },
  { id: 'demo-cfb-w2-g3', home_team: 'Michigan', away_team: 'Oregon', home_conference: 'Big Ten', away_conference: 'Big Ten', kickoff_at: '2026-09-13T16:00:00Z', home_spread: 5.5, underdog_team: 'Michigan', underdog_spread: 5.5, status: 'scheduled', home_score: null, away_score: null },
  { id: 'demo-cfb-w2-g4', home_team: 'Illinois', away_team: 'Penn State', home_conference: 'Big Ten', away_conference: 'Big Ten', kickoff_at: '2026-09-13T16:00:00Z', home_spread: 16, underdog_team: 'Illinois', underdog_spread: 16, status: 'scheduled', home_score: null, away_score: null },
  { id: 'demo-cfb-w2-g5', home_team: 'USC', away_team: 'Utah', home_conference: 'Big Ten', away_conference: 'Big 12', kickoff_at: '2026-09-13T19:00:00Z', home_spread: 6.5, underdog_team: 'USC', underdog_spread: 6.5, status: 'scheduled', home_score: null, away_score: null },
  { id: 'demo-cfb-w2-g6', home_team: 'NC State', away_team: 'Notre Dame', home_conference: 'ACC', away_conference: 'Independent', kickoff_at: '2026-09-13T19:30:00Z', home_spread: 7.5, underdog_team: 'NC State', underdog_spread: 7.5, status: 'scheduled', home_score: null, away_score: null },
  { id: 'demo-cfb-w2-g7', home_team: 'Miami', away_team: 'Florida State', home_conference: 'ACC', away_conference: 'ACC', kickoff_at: '2026-09-13T20:00:00Z', home_spread: -3.5, underdog_team: 'Florida State', underdog_spread: 3.5, status: 'scheduled', home_score: null, away_score: null },
  { id: 'demo-cfb-w2-g8', home_team: 'Texas', away_team: 'Ohio State', home_conference: 'SEC', away_conference: 'Big Ten', kickoff_at: '2026-09-13T23:30:00Z', home_spread: 3, underdog_team: 'Texas', underdog_spread: 3, status: 'scheduled', home_score: null, away_score: null },
]
