// The repo's first unit tests (starts closing BACKLOG F4). Every case here is
// pulled straight from docs/CFB_FORMAT.md's rules and worked examples, plus the
// boundary conditions the format doc calls out explicitly. If a rule in the format
// spec changes, this file changes with it.

import { describe, it, expect } from 'vitest'
import {
  doubleDownBuffer,
  doubleDownWinBy,
  gradeAtsPick,
  gradeDoubleDown,
  underdogTier,
  gradeUnderdogPick,
  gradeWeekCard,
  pickMargin,
  projectSeasonStandings,
} from './cfbScoring'

// ─────────────────────────────────────────────────────────────────────────────
describe('doubleDownBuffer', () => {
  it('floors at 4 for any spread of 8 or less', () => {
    expect(doubleDownBuffer(0)).toBe(4)
    expect(doubleDownBuffer(3)).toBe(4)     // max(1.5, 4)
    expect(doubleDownBuffer(7)).toBe(4)     // max(3.5, 4)
    expect(doubleDownBuffer(8)).toBe(4)     // max(4, 4)
  })

  it('rises above 4 only for spreads of 8.5+', () => {
    expect(doubleDownBuffer(9)).toBe(4.5)   // 9 × 0.5 = 4.5
    expect(doubleDownBuffer(10)).toBe(5)    // 10 × 0.5 = 5
    expect(doubleDownBuffer(20)).toBe(10)
  })

  it('rounds quarter-point ties UP to the nearest 0.5 (format §Double-down)', () => {
    expect(doubleDownBuffer(8.5)).toBe(4.5)   // 4.25 → 4.5
    expect(doubleDownBuffer(10.5)).toBe(5.5)  // 5.25 → 5.5
    expect(doubleDownBuffer(14.5)).toBe(7.5)  // 7.25 → 7.5
  })

  it('is sign-agnostic (uses |spread|)', () => {
    expect(doubleDownBuffer(-9)).toBe(4.5)
    expect(doubleDownBuffer(-8.5)).toBe(4.5)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('doubleDownWinBy — strict "win by X+" copy helper', () => {
  it('an 8.5 favorite must win by 14+ (13 lands exactly on the threshold)', () => {
    // buffer 4.5, cover_margin > 4.5 → margin > 13 → 14
    expect(doubleDownWinBy(-8.5)).toBe(14)
  })

  it('a 7 favorite must win by 12+ (buffer 4, threshold 11)', () => {
    expect(doubleDownWinBy(-7)).toBe(12)
  })

  it('a 3 favorite must win by 8+ (matches the worked example: win by 8 clears, 7 does not)', () => {
    expect(doubleDownWinBy(-3)).toBe(8)
  })

  it('a 9 favorite must win by 14+ (buffer 4.5, threshold 13.5)', () => {
    expect(doubleDownWinBy(-9)).toBe(14)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('gradeAtsPick', () => {
  it('cover: 7-pt favorite wins by 10 → +1 (worked example)', () => {
    expect(gradeAtsPick({ margin: 10, lockedSpread: -7 })).toEqual({ result: 'cover', points: 1 })
  })

  it('push: 7-pt favorite wins by exactly 7 → 0 (worked example)', () => {
    expect(gradeAtsPick({ margin: 7, lockedSpread: -7 })).toEqual({ result: 'push', points: 0 })
  })

  it('miss: 7-pt favorite wins by only 3 → 0 (worked example)', () => {
    expect(gradeAtsPick({ margin: 3, lockedSpread: -7 })).toEqual({ result: 'miss', points: 0 })
  })

  it('underdog ATS cover: +6.5 dog loses by 3 → cover +1 (worked example)', () => {
    expect(gradeAtsPick({ margin: -3, lockedSpread: 6.5 })).toEqual({ result: 'cover', points: 1 })
  })

  it('null margin (not final) → null result, 0 points', () => {
    expect(gradeAtsPick({ margin: null, lockedSpread: -7 })).toEqual({ result: null, points: 0 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('gradeDoubleDown', () => {
  it('clears: DD on 3-pt favorite wins by 8 → cover_margin 5 > buffer 4 → +1 bonus', () => {
    expect(gradeDoubleDown({ margin: 8, lockedSpread: -3 })).toEqual({ bonus: 1 })
  })

  it('covers but does not clear: same favorite wins by 6 → cover_margin 3, no bonus', () => {
    expect(gradeDoubleDown({ margin: 6, lockedSpread: -3 })).toEqual({ bonus: 0 })
  })

  it('exactly on the buffer: wins by 7 → cover_margin 4, 4 > 4 is false → no bonus', () => {
    expect(gradeDoubleDown({ margin: 7, lockedSpread: -3 })).toEqual({ bonus: 0 })
  })

  it('misses: favorite wins by 2 → cover_margin −1 → no bonus, no penalty', () => {
    expect(gradeDoubleDown({ margin: 2, lockedSpread: -3 })).toEqual({ bonus: 0 })
  })

  it('half-point buffer boundary: 8.5 favorite, 13-pt win is exactly on (no bonus), 14 clears', () => {
    expect(gradeDoubleDown({ margin: 13, lockedSpread: -8.5 })).toEqual({ bonus: 0 })
    expect(gradeDoubleDown({ margin: 14, lockedSpread: -8.5 })).toEqual({ bonus: 1 })
  })

  it('null margin → no bonus', () => {
    expect(gradeDoubleDown({ margin: null, lockedSpread: -3 })).toEqual({ bonus: 0 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('underdogTier — boundaries from the format table', () => {
  it('tier 1: +1.5 to +6.5', () => {
    expect(underdogTier(1.5)).toBe(1)
    expect(underdogTier(3)).toBe(1)
    expect(underdogTier(6.5)).toBe(1)
  })

  it('tier 2: +7 to +13.5', () => {
    expect(underdogTier(7)).toBe(2)
    expect(underdogTier(9)).toBe(2)
    expect(underdogTier(13.5)).toBe(2)
  })

  it('tier 3: +14 or more', () => {
    expect(underdogTier(14)).toBe(3)
    expect(underdogTier(17)).toBe(3)
    expect(underdogTier(28)).toBe(3)
  })

  it('below the +1.5 minimum is not a real underdog → 0', () => {
    expect(underdogTier(0)).toBe(0)
    expect(underdogTier(1)).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('gradeUnderdogPick — outright win only, tiered', () => {
  it('+3 dog wins outright → tier 1 → 1 (worked example)', () => {
    expect(gradeUnderdogPick({ margin: 4, spread: 3 })).toEqual({ result: 'win', points: 1 })
  })

  it('+9 dog wins → tier 2 → 2 (worked example)', () => {
    expect(gradeUnderdogPick({ margin: 1, spread: 9 })).toEqual({ result: 'win', points: 2 })
  })

  it('+17 dog wins → tier 3 → 3 (worked example)', () => {
    expect(gradeUnderdogPick({ margin: 6, spread: 17 })).toEqual({ result: 'win', points: 3 })
  })

  it('+9 dog LOSES by a point → 0, even though covering is irrelevant (worked example)', () => {
    expect(gradeUnderdogPick({ margin: -1, spread: 9 })).toEqual({ result: 'loss', points: 0 })
  })

  it('a dog that would have covered but lost outright still scores 0', () => {
    // +6.5 dog loses by 3: covers ATS, but the underdog slot needs an outright win
    expect(gradeUnderdogPick({ margin: -3, spread: 6.5 })).toEqual({ result: 'loss', points: 0 })
  })

  it('null margin → null result, 0 points', () => {
    expect(gradeUnderdogPick({ margin: null, spread: 9 })).toEqual({ result: null, points: 0 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('pickMargin', () => {
  it('home pick → home − away', () => {
    expect(pickMargin({ selectedTeam: 'Michigan', homeTeam: 'Michigan', awayTeam: 'Ohio State', homeScore: 30, awayScore: 24 })).toBe(6)
  })

  it('away pick → away − home', () => {
    expect(pickMargin({ selectedTeam: 'Ohio State', homeTeam: 'Michigan', awayTeam: 'Ohio State', homeScore: 30, awayScore: 24 })).toBe(-6)
  })

  it('not final (null score) → null', () => {
    expect(pickMargin({ selectedTeam: 'Michigan', homeTeam: 'Michigan', awayTeam: 'Ohio State', homeScore: null, awayScore: null })).toBeNull()
  })

  it('team not in the game → null', () => {
    expect(pickMargin({ selectedTeam: 'Texas', homeTeam: 'Michigan', awayTeam: 'Ohio State', homeScore: 30, awayScore: 24 })).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('gradeWeekCard — the full 6-pick week', () => {
  // A representative card: 5 ATS (one flagged double-down) + 1 underdog.
  const card = [
    { pick_type: 'ats', is_double_down: true,  locked_spread: -3, margin: 8 },   // cover +1, DD +1
    { pick_type: 'ats', is_double_down: false, locked_spread: -7, margin: 10 },  // cover +1
    { pick_type: 'ats', is_double_down: false, locked_spread: -7, margin: 7 },   // push 0
    { pick_type: 'ats', is_double_down: false, locked_spread: -7, margin: 3 },   // miss 0
    { pick_type: 'ats', is_double_down: false, locked_spread: 6.5, margin: -3 }, // dog covers +1
    { pick_type: 'underdog', is_double_down: false, locked_spread: 9, margin: 1 }, // dog wins → tier 2 → 2
  ]

  it('breaks the week down into ats/bonus/underdog and totals them', () => {
    const g = gradeWeekCard(card)
    expect(g.atsPoints).toBe(3)       // 1 + 1 + 0 + 0 + 1
    expect(g.bonusPoints).toBe(1)     // the double-down
    expect(g.underdogPoints).toBe(2)  // tier 2
    expect(g.total).toBe(6)
  })

  it('stamps each pick with the DB result + points columns', () => {
    const g = gradeWeekCard(card)
    expect(g.picks[0]).toMatchObject({ result: 'cover', base_points: 1, bonus_points: 1 })
    expect(g.picks[2]).toMatchObject({ result: 'push', base_points: 0, bonus_points: 0 })
    expect(g.picks[3]).toMatchObject({ result: 'miss', base_points: 0, bonus_points: 0 })
    expect(g.picks[5]).toMatchObject({ result: 'win', base_points: 2, bonus_points: 0 })
  })

  it('a non-double-down pick never earns a bonus even if it clears the buffer', () => {
    const g = gradeWeekCard([{ pick_type: 'ats', is_double_down: false, locked_spread: -3, margin: 20 }])
    expect(g.picks[0].bonus_points).toBe(0)
    expect(g.total).toBe(1)
  })

  it('an auto-filled card (no double-down) can score 0 bonus but normal ATS/underdog points', () => {
    const autofill = [
      { pick_type: 'ats', is_double_down: false, locked_spread: -3, margin: 8 },
      { pick_type: 'underdog', is_double_down: false, locked_spread: 3, margin: 5 },
    ]
    const g = gradeWeekCard(autofill)
    expect(g.bonusPoints).toBe(0)
    expect(g.total).toBe(2) // 1 ATS cover + 1 underdog tier-1 win
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('projectSeasonStandings — the shared pool_standings projection', () => {
  const entries = [
    { user_id: 'a', display_name: 'Alice', weeks: [{ week_number: 1, total: 4 }, { week_number: 2, total: 5 }] }, // 9
    { user_id: 'b', display_name: 'Bob',   weeks: [{ week_number: 1, total: 6 }, { week_number: 2, total: 6 }] }, // 12
    { user_id: 'c', display_name: 'Cara',  weeks: [{ week_number: 1, total: 3 }, { week_number: 2, total: 6 }] }, // 9
  ]

  it('sorts DESCENDING by cumulative total (higher is better, opposite of golf)', () => {
    const s = projectSeasonStandings(entries, { throughWeek: 2 })
    expect(s.map(r => r.user_id)).toEqual(['b', 'a', 'c'])
    expect(s.map(r => r.total)).toEqual([12, 9, 9])
  })

  it('ties share a rank (1, 2, 2 style competition ranking)', () => {
    const s = projectSeasonStandings(entries, { throughWeek: 2 })
    expect(s.map(r => r.rank)).toEqual([1, 2, 2])
  })

  it('emits the neutral { user_id, rank, total, display } shape with a pre-rendered subtitle', () => {
    const s = projectSeasonStandings(entries, { throughWeek: 2 })
    expect(s[0]).toEqual({
      user_id: 'b',
      rank: 1,
      total: 12,
      display: { name: 'Bob', subtitle: '12 pts · Week 2' },
    })
  })

  it('singular "pt" at exactly 1 point, and omits the week when throughWeek is absent', () => {
    const s = projectSeasonStandings([{ user_id: 'x', display_name: 'Xander', weeks: [{ week_number: 1, total: 1 }] }])
    expect(s[0].display.subtitle).toBe('1 pt')
  })

  it('handles an empty pool', () => {
    expect(projectSeasonStandings([])).toEqual([])
  })
})
