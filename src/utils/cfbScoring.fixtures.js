// Shared CFB scoring fixtures — the single source of truth for the ENGINE'S
// BEHAVIOR, consumed by two test files:
//   • src/utils/cfbScoring.test.js         — runs them against the JS engine
//   • src/utils/cfbScoring.parity.test.js  — runs them against BOTH the JS engine
//     and the server-side TS mirror (supabase/functions/_shared/cfbScoring.ts),
//     asserting the two produce identical output.
// So if the browser engine and the server grader ever drift, the parity test fails
// — the drift guard the founder chose over a "keep in sync" comment (agents/pm/
// DECISIONS.md 2026-08-12, Q1). Every case is pulled verbatim from
// docs/CFB_FORMAT.md's rules and worked examples.
//
// Shape: FIXTURES[functionName] = [{ label, args: [...], expected }]. A runner calls
// mod[functionName](...args) and deep-equals the result to `expected`, so the same
// fixture drives any implementation of the module.

const standingsEntries = [
  { user_id: 'a', display_name: 'Alice', weeks: [{ week_number: 1, total: 4 }, { week_number: 2, total: 5 }] }, // 9
  { user_id: 'b', display_name: 'Bob',   weeks: [{ week_number: 1, total: 6 }, { week_number: 2, total: 6 }] }, // 12
  { user_id: 'c', display_name: 'Cara',  weeks: [{ week_number: 1, total: 3 }, { week_number: 2, total: 6 }] }, // 9
]

export const FIXTURES = {
  // buffer = max(|spread|·0.5, 4), round-nearest-0.5, quarter-ties up
  doubleDownBuffer: [
    { label: '0 → floor 4', args: [0], expected: 4 },
    { label: '3 → floor 4', args: [3], expected: 4 },
    { label: '8 → exactly 4', args: [8], expected: 4 },
    { label: '9 → 4.5', args: [9], expected: 4.5 },
    { label: '10 → 5', args: [10], expected: 5 },
    { label: '8.5 → 4.25 ties up → 4.5', args: [8.5], expected: 4.5 },
    { label: '10.5 → 5.25 ties up → 5.5', args: [10.5], expected: 5.5 },
    { label: 'sign-agnostic: -9 → 4.5', args: [-9], expected: 4.5 },
  ],

  // minimum integer margin (picked-team perspective) to clear the buffer
  doubleDownWinBy: [
    { label: '8.5 favorite → 14 (13 lands on threshold)', args: [-8.5], expected: 14 },
    { label: '7 favorite → 12', args: [-7], expected: 12 },
    { label: '3 favorite → 8', args: [-3], expected: 8 },
    { label: '9 favorite → 14', args: [-9], expected: 14 },
    { label: '+10 underdog → -4 (lose by ≤4 or win)', args: [10], expected: -4 },
  ],

  // the double-down's effective line = locked_spread − buffer (picked-team sign)
  effectiveDoubleDownLine: [
    { label: '-1.5 favorite → -5.5', args: [-1.5], expected: -5.5 },
    { label: '-3 favorite → -7', args: [-3], expected: -7 },
    { label: '-6.5 favorite → -10.5', args: [-6.5], expected: -10.5 },
    { label: '-9 favorite → -13.5 (buffer scales)', args: [-9], expected: -13.5 },
    { label: '+7 underdog → +3 (lose by ≤2 or win)', args: [7], expected: 3 },
    { label: '+10 underdog → +5', args: [10], expected: 5 },
  ],

  gradeAtsPick: [
    { label: '7-fav wins by 10 → cover', args: [{ margin: 10, lockedSpread: -7 }], expected: { result: 'cover', points: 1 } },
    { label: '7-fav wins by exactly 7 → push', args: [{ margin: 7, lockedSpread: -7 }], expected: { result: 'push', points: 0 } },
    { label: '7-fav wins by only 3 → miss', args: [{ margin: 3, lockedSpread: -7 }], expected: { result: 'miss', points: 0 } },
    { label: '+6.5 dog loses by 3 → cover', args: [{ margin: -3, lockedSpread: 6.5 }], expected: { result: 'cover', points: 1 } },
    { label: 'null margin → null', args: [{ margin: null, lockedSpread: -7 }], expected: { result: null, points: 0 } },
  ],

  gradeDoubleDown: [
    { label: '3-fav wins by 8 → clears', args: [{ margin: 8, lockedSpread: -3 }], expected: { bonus: 1 } },
    { label: '3-fav wins by 6 → covers, no clear', args: [{ margin: 6, lockedSpread: -3 }], expected: { bonus: 0 } },
    { label: '3-fav wins by 7 → exactly on buffer, no bonus', args: [{ margin: 7, lockedSpread: -3 }], expected: { bonus: 0 } },
    { label: '3-fav wins by 2 → miss, no penalty', args: [{ margin: 2, lockedSpread: -3 }], expected: { bonus: 0 } },
    { label: '8.5-fav win by 13 → exactly on → no bonus', args: [{ margin: 13, lockedSpread: -8.5 }], expected: { bonus: 0 } },
    { label: '8.5-fav win by 14 → clears', args: [{ margin: 14, lockedSpread: -8.5 }], expected: { bonus: 1 } },
    { label: '+10 dog loses by 4 → clears', args: [{ margin: -4, lockedSpread: 10 }], expected: { bonus: 1 } },
    { label: '+10 dog loses by 5 → exactly on → no bonus', args: [{ margin: -5, lockedSpread: 10 }], expected: { bonus: 0 } },
    { label: 'null margin → no bonus', args: [{ margin: null, lockedSpread: -3 }], expected: { bonus: 0 } },
  ],

  underdogTier: [
    { label: '+1.5 → T1', args: [1.5], expected: 1 },
    { label: '+6.5 → T1', args: [6.5], expected: 1 },
    { label: '+7 → T2', args: [7], expected: 3 },
    { label: '+13.5 → T2', args: [13.5], expected: 3 },
    { label: '+14 → T3', args: [14], expected: 5 },
    { label: '+28 → T3', args: [28], expected: 5 },
    { label: '+1 below minimum → 0', args: [1], expected: 0 },
  ],

  gradeUnderdogPick: [
    { label: '+3 dog wins → T1', args: [{ margin: 4, spread: 3 }], expected: { result: 'win', points: 1 } },
    { label: '+9 dog wins → T2', args: [{ margin: 1, spread: 9 }], expected: { result: 'win', points: 3 } },
    { label: '+17 dog wins → T3', args: [{ margin: 6, spread: 17 }], expected: { result: 'win', points: 5 } },
    { label: '+9 dog loses by 1 → 0', args: [{ margin: -1, spread: 9 }], expected: { result: 'loss', points: 0 } },
    { label: '+6.5 dog covers but loses → 0', args: [{ margin: -3, spread: 6.5 }], expected: { result: 'loss', points: 0 } },
    { label: 'null margin → null', args: [{ margin: null, spread: 9 }], expected: { result: null, points: 0 } },
  ],

  pickMargin: [
    { label: 'home pick → home − away', args: [{ selectedTeam: 'Michigan', homeTeam: 'Michigan', awayTeam: 'Ohio State', homeScore: 30, awayScore: 24 }], expected: 6 },
    { label: 'away pick → away − home', args: [{ selectedTeam: 'Ohio State', homeTeam: 'Michigan', awayTeam: 'Ohio State', homeScore: 30, awayScore: 24 }], expected: -6 },
    { label: 'not final → null', args: [{ selectedTeam: 'Michigan', homeTeam: 'Michigan', awayTeam: 'Ohio State', homeScore: null, awayScore: null }], expected: null },
    { label: 'team not in game → null', args: [{ selectedTeam: 'Texas', homeTeam: 'Michigan', awayTeam: 'Ohio State', homeScore: 30, awayScore: 24 }], expected: null },
  ],

  projectSeasonStandings: [
    {
      label: 'descending, ties share rank, neutral shape',
      args: [standingsEntries, { throughWeek: 2 }],
      expected: [
        { user_id: 'b', rank: 1, total: 12, display: { name: 'Bob', subtitle: '12 pts · Week 2' } },
        { user_id: 'a', rank: 2, total: 9, display: { name: 'Alice', subtitle: '9 pts · Week 2' } },
        { user_id: 'c', rank: 2, total: 9, display: { name: 'Cara', subtitle: '9 pts · Week 2' } },
      ],
    },
    {
      label: 'singular pt at 1, omits week when throughWeek absent',
      args: [[{ user_id: 'x', display_name: 'Xander', weeks: [{ week_number: 1, total: 1 }] }]],
      expected: [{ user_id: 'x', rank: 1, total: 1, display: { name: 'Xander', subtitle: '1 pt' } }],
    },
    { label: 'empty pool', args: [[]], expected: [] },
  ],
}
