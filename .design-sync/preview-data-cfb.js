// Hand-authored CFB fixtures for the design-sync preview cards. The app's demo
// fixture (src/demo/demoData.js) is golf-only, so — unlike preview-data.js, which is
// generated from it — this file is written by hand. Pure data, no imports (so no app
// module, toxic-regex or otherwise, enters the preview bundle). Shapes mirror what the
// CFB pages hand their presentational components (see each component's header doc).
// Regenerate/extend by hand if a CFB component's prop shape changes.

// The minus glyph below is the real U+2212 the CFB formatters emit (formatSpread), so
// preview lines match production exactly. Season 2026, "Week 4" throughout.

const MINUS = '−' // −

// ── This week's slate (cfb.games rows) ────────────────────────────────────────
// home_spread is home-perspective (negative = home favored). Mixed statuses so the
// slate widget shows scheduled / live / final rows.
export const games = [
  { id: 'g1', away_team: 'Ohio State', home_team: 'Michigan', away_conference: 'Big Ten', home_conference: 'Big Ten',
    kickoff_at: '2026-09-26T16:00:00Z', home_spread: 3.5, underdog_team: 'Michigan', underdog_spread: 3.5,
    status: 'final', away_score: 24, home_score: 27 },
  { id: 'g2', away_team: 'Georgia', home_team: 'Alabama', away_conference: 'SEC', home_conference: 'SEC',
    kickoff_at: '2026-09-26T19:30:00Z', home_spread: -2.5, underdog_team: 'Georgia', underdog_spread: 2.5,
    status: 'final', away_score: 20, home_score: 31 },
  { id: 'g3', away_team: 'Texas', home_team: 'Oklahoma', away_conference: 'SEC', home_conference: 'SEC',
    kickoff_at: '2026-09-26T20:00:00Z', home_spread: 9.5, underdog_team: 'Oklahoma', underdog_spread: 9.5,
    status: 'in_progress', away_score: 17, home_score: 14 },
  { id: 'g4', away_team: 'Oregon', home_team: 'Washington', away_conference: 'Big Ten', home_conference: 'Big Ten',
    kickoff_at: '2026-09-26T23:00:00Z', home_spread: -6.5, underdog_team: 'Oregon', underdog_spread: 6.5,
    status: 'scheduled', away_score: null, home_score: null },
  { id: 'g5', away_team: 'LSU', home_team: 'Ole Miss', away_conference: 'SEC', home_conference: 'SEC',
    kickoff_at: '2026-09-27T00:00:00Z', home_spread: 1.5, underdog_team: 'Ole Miss', underdog_spread: 1.5,
    status: 'scheduled', away_score: null, home_score: null },
  { id: 'g6', away_team: 'Penn State', home_team: 'USC', away_conference: 'Big Ten', home_conference: 'Big Ten',
    kickoff_at: '2026-09-27T02:30:00Z', home_spread: 14.5, underdog_team: 'USC', underdog_spread: 14.5,
    status: 'scheduled', away_score: null, home_score: null },
]

// ── A single game for the builder card (CfbGameCard) ───────────────────────────
export const builderGame = games[0]

// ── A fully graded weekly card (5 ATS + underdog), display-ready rows ──────────
// Matches CfbCardRows/CfbCardReadonly/CfbStandings row shape. One of each outcome:
// cover, cover w/ double-down bonus (+2), miss, cover, push, underdog win (+3).
export const gradedCard = {
  total: 7,
  picks: [
    { slot: 1, pickType: 'ats', isDoubleDown: false, autoFilled: false, lockedSpread: 3.5,
      line: `Michigan +3.5`, matchup: 'Ohio State @ Michigan', awayTeam: 'Ohio State', homeTeam: 'Michigan',
      awayScore: 24, homeScore: 27, status: 'final', live: null, kickoffAt: '2026-09-26T16:00:00Z',
      result: 'cover', points: 1 },
    { slot: 2, pickType: 'ats', isDoubleDown: true, autoFilled: false, lockedSpread: -2.5,
      line: `Alabama ${MINUS}2.5`, matchup: 'Georgia @ Alabama', awayTeam: 'Georgia', homeTeam: 'Alabama',
      awayScore: 20, homeScore: 31, status: 'final', live: null, kickoffAt: '2026-09-26T19:30:00Z',
      result: 'cover', points: 2 },
    { slot: 3, pickType: 'ats', isDoubleDown: false, autoFilled: false, lockedSpread: -9.5,
      line: `Texas ${MINUS}9.5`, matchup: 'Texas @ Oklahoma', awayTeam: 'Texas', homeTeam: 'Oklahoma',
      awayScore: 20, homeScore: 17, status: 'final', live: null, kickoffAt: '2026-09-26T20:00:00Z',
      result: 'miss', points: 0 },
    { slot: 4, pickType: 'ats', isDoubleDown: false, autoFilled: false, lockedSpread: -6.5,
      line: `Washington ${MINUS}6.5`, matchup: 'Oregon @ Washington', awayTeam: 'Oregon', homeTeam: 'Washington',
      awayScore: 21, homeScore: 28, status: 'final', live: null, kickoffAt: '2026-09-26T23:00:00Z',
      result: 'cover', points: 1 },
    { slot: 5, pickType: 'ats', isDoubleDown: false, autoFilled: false, lockedSpread: -3,
      line: `Notre Dame ${MINUS}3`, matchup: 'Navy @ Notre Dame', awayTeam: 'Navy', homeTeam: 'Notre Dame',
      awayScore: 24, homeScore: 27, status: 'final', live: null, kickoffAt: '2026-09-26T17:00:00Z',
      result: 'push', points: 0 },
    { slot: 6, pickType: 'underdog', isDoubleDown: false, autoFilled: false, lockedSpread: 14.5,
      line: `USC +14.5`, matchup: 'Penn State @ USC', awayTeam: 'Penn State', homeTeam: 'USC',
      awayScore: 31, homeScore: 34, status: 'final', live: null, kickoffAt: '2026-09-27T02:30:00Z',
      result: 'win', points: 3 },
  ],
}

// A live/in-progress card (some games graded, one live, some scheduled) — shows the
// "Live" chip + em-dash points for ungraded rows.
export const liveCard = {
  total: 3,
  picks: [
    { slot: 1, pickType: 'ats', isDoubleDown: false, autoFilled: false, lockedSpread: 3.5,
      line: `Michigan +3.5`, matchup: 'Ohio State @ Michigan', awayTeam: 'Ohio State', homeTeam: 'Michigan',
      awayScore: 24, homeScore: 27, status: 'final', live: null, kickoffAt: '2026-09-26T16:00:00Z',
      result: 'cover', points: 1 },
    { slot: 2, pickType: 'ats', isDoubleDown: true, autoFilled: false, lockedSpread: -2.5,
      line: `Alabama ${MINUS}2.5`, matchup: 'Georgia @ Alabama', awayTeam: 'Georgia', homeTeam: 'Alabama',
      awayScore: 20, homeScore: 31, status: 'final', live: null, kickoffAt: '2026-09-26T19:30:00Z',
      result: 'cover', points: 2 },
    { slot: 3, pickType: 'ats', isDoubleDown: false, autoFilled: false, lockedSpread: -9.5,
      line: `Texas ${MINUS}9.5`, matchup: 'Texas @ Oklahoma', awayTeam: 'Texas', homeTeam: 'Oklahoma',
      awayScore: 17, homeScore: 14, status: 'in_progress', live: { period: 3, clock: '4:12' },
      kickoffAt: '2026-09-26T20:00:00Z', result: null, points: 0 },
    { slot: 4, pickType: 'ats', isDoubleDown: false, autoFilled: false, lockedSpread: -6.5,
      line: `Washington ${MINUS}6.5`, matchup: 'Oregon @ Washington', awayTeam: 'Oregon', homeTeam: 'Washington',
      awayScore: null, homeScore: null, status: 'scheduled', live: null, kickoffAt: '2026-09-26T23:00:00Z',
      result: null, points: 0 },
    { slot: 5, pickType: 'ats', isDoubleDown: false, autoFilled: false, lockedSpread: 1.5,
      line: `Ole Miss +1.5`, matchup: 'LSU @ Ole Miss', awayTeam: 'LSU', homeTeam: 'Ole Miss',
      awayScore: null, homeScore: null, status: 'scheduled', live: null, kickoffAt: '2026-09-27T00:00:00Z',
      result: null, points: 0 },
    { slot: 6, pickType: 'underdog', isDoubleDown: false, autoFilled: false, lockedSpread: 14.5,
      line: `USC +14.5`, matchup: 'Penn State @ USC', awayTeam: 'Penn State', homeTeam: 'USC',
      awayScore: null, homeScore: null, status: 'scheduled', live: null, kickoffAt: '2026-09-27T02:30:00Z',
      result: null, points: 0 },
  ],
}

// An auto-filled card (missed the deadline) — every row flagged Auto, no double-down.
export const autoFilledCard = {
  total: 4,
  picks: gradedCard.picks.map((p, i) => ({
    ...p,
    isDoubleDown: false,
    autoFilled: true,
    // recompute a plausible points total without the DD bonus
    points: p.pickType === 'underdog' ? 3 : (i === 0 || i === 3) ? 1 : 0,
  })),
}

// ── Season standings for the pool-detail hero (CfbStandings entries) ───────────
export const currentUserId = 'u-jordan'

export const standings = [
  { user_id: 'u-jordan', display_name: 'Jordan Vega', rank: 1, total: 96,
    week: { state: 'card', total: gradedCard.total, picks: gradedCard.picks } },
  { user_id: 'u-marcus', display_name: 'Marcus Lee', rank: 2, total: 88,
    week: { state: 'card', total: liveCard.total, picks: liveCard.picks } },
  { user_id: 'u-taylor', display_name: 'Taylor Brooks', rank: 3, total: 81,
    week: { state: 'card', total: autoFilledCard.total, picks: autoFilledCard.picks } },
  { user_id: 'u-priya', display_name: 'Priya Nair', rank: 4, total: 74,
    week: { state: 'nocard', total: 0, picks: [] } },
]

// ── Week selector (rendered on the navy header band) ──────────────────────────
export const weeks = [
  { id: 'w1', week_number: 1, label: 'Week 1', status: 'graded' },
  { id: 'w2', week_number: 2, label: 'Week 2', status: 'graded' },
  { id: 'w3', week_number: 3, label: 'Week 3', status: 'graded' },
  { id: 'w4', week_number: 4, label: 'Week 4', status: 'locked' },
  { id: 'w5', week_number: 5, label: 'Week 5', status: 'open' },
]
export const selectedWeekNumber = 4

// ── Dashboard pool tiles (CfbPoolTile) ────────────────────────────────────────
export const tileNeedsPicks = {
  poolId: 'p-1', name: 'Saturday Degens', seasonYear: 2026, playerCount: 14, rank: 1, total: 96,
  cardStatus: 'needs-picks',
  currentWeek: { week_number: 5, lock_time: '2026-10-03T16:00:00Z', status: 'open', locked: false },
}
export const tileGraded = {
  poolId: 'p-2', name: 'Big Ten Basement', seasonYear: 2026, playerCount: 9, rank: 3, total: 71,
  cardStatus: 'card-in',
  currentWeek: { week_number: 4, lock_time: '2026-09-26T16:00:00Z', status: 'graded', locked: true },
}

// ── Widget-row inputs (CfbWidgets) ────────────────────────────────────────────
export const weeklyPoints = [
  { user_id: 'u-jordan', name: 'Jordan Vega', points: 7 },
  { user_id: 'u-marcus', name: 'Marcus Lee', points: 5 },
  { user_id: 'u-taylor', name: 'Taylor Brooks', points: 4 },
  { user_id: 'u-priya', name: 'Priya Nair', points: 3 },
  { user_id: 'u-devon', name: 'Devon Park', points: 2 },
]

export const weekPicks = [
  { user_id: 'u-jordan', name: 'Jordan Vega', pickType: 'ats', selectedTeam: 'Alabama', lockedSpread: -2.5, result: 'cover', points: 2 },
  { user_id: 'u-marcus', name: 'Marcus Lee', pickType: 'ats', selectedTeam: 'Alabama', lockedSpread: -2.5, result: 'cover', points: 1 },
  { user_id: 'u-taylor', name: 'Taylor Brooks', pickType: 'ats', selectedTeam: 'Michigan', lockedSpread: 3.5, result: 'cover', points: 1 },
  { user_id: 'u-priya', name: 'Priya Nair', pickType: 'ats', selectedTeam: 'Alabama', lockedSpread: -2.5, result: 'cover', points: 1 },
  { user_id: 'u-devon', name: 'Devon Park', pickType: 'ats', selectedTeam: 'Michigan', lockedSpread: 3.5, result: 'cover', points: 1 },
  { user_id: 'u-jordan', name: 'Jordan Vega', pickType: 'underdog', selectedTeam: 'USC', lockedSpread: 14.5, result: 'win', points: 3 },
  { user_id: 'u-marcus', name: 'Marcus Lee', pickType: 'underdog', selectedTeam: 'Oklahoma', lockedSpread: 9.5, result: 'loss', points: 0 },
  { user_id: 'u-taylor', name: 'Taylor Brooks', pickType: 'underdog', selectedTeam: 'USC', lockedSpread: 14.5, result: 'win', points: 3 },
]

// Prize-pool inputs (Prize Pool widget is reused from golf inside CfbWidgets)
export const prize = {
  stakeAmount: 25,
  participantCount: 14,
  payoutStructure: [60, 30, 10],
}
