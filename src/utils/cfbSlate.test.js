// Tests for the CFBD slate transform (supabase/functions/_shared/cfbSlate.ts). The
// transform is server-only (the poll-cfb-lines poller owns it) but pure, so vitest
// imports the .ts directly — same approach as cfbLive/cfbScoring. These are the first
// committed tests for buildGameRows (the PR3 "25 fixtures" predated vitest and were
// never committed); shapes approximate CFBD /games + /lines.

import { describe, it, expect } from 'vitest'
import {
  chooseLine, favoriteFromFormattedSpread, buildGameRows,
  WEEK_ZERO_CFBD_WEEK, isWeekZeroGame, ourWeekToCfbdWeek,
} from '../../supabase/functions/_shared/cfbSlate.ts'

describe('chooseLine', () => {
  it('prefers the consensus provider', () => {
    const entry = { lines: [
      { provider: 'DraftKings', spread: -6.5, formattedSpread: 'Michigan -6.5' },
      { provider: 'consensus', spread: -7, formattedSpread: 'Michigan -7' },
    ] }
    expect(chooseLine(entry)).toEqual({ spread: -7, formattedSpread: 'Michigan -7' })
  })

  it('pools by median when there is no consensus', () => {
    const entry = { lines: [
      { provider: 'A', spread: -6, formattedSpread: 'Michigan -6' },
      { provider: 'B', spread: -7, formattedSpread: 'Michigan -7' },
      { provider: 'C', spread: -8, formattedSpread: 'Michigan -8' },
    ] }
    expect(chooseLine(entry).spread).toBe(-7)
  })

  it('returns null spread when no provider posts a line', () => {
    expect(chooseLine({ lines: [] })).toEqual({ spread: null, formattedSpread: null })
    expect(chooseLine({ lines: [{ provider: 'A' }] })).toEqual({ spread: null, formattedSpread: null })
  })

  // Real sportsbook spreads are always whole- or half-point. An even-provider median
  // (averaging two middle values) can land on a quarter point, which nobody actually
  // posted — chooseLine rounds it away. Math.round ties toward +Infinity: -8.5 → -8.
  it('rounds an even-provider median off a quarter point to the nearest half-point', () => {
    const entry = { lines: [
      { provider: 'A', spread: -4, formattedSpread: 'Team -4' },
      { provider: 'B', spread: -4.5, formattedSpread: 'Team -4.5' },
    ] }
    expect(chooseLine(entry).spread).toBe(-4) // median -4.25 → -8.5 → round → -8 → -4
  })

  it('rounds even a consensus-provider spread, as a hard guarantee against any quarter point', () => {
    const entry = { lines: [{ provider: 'consensus', spread: -6.75, formattedSpread: 'Team -6.75' }] }
    expect(chooseLine(entry).spread).toBe(-6.5) // -13.5 → round → -13 → -6.5
  })
})

describe('favoriteFromFormattedSpread', () => {
  it('parses the favored team from the label', () => {
    expect(favoriteFromFormattedSpread('Michigan -7.5', 'Michigan', 'Ohio State')).toBe('Michigan')
    expect(favoriteFromFormattedSpread('Ohio State -3', 'Michigan', 'Ohio State')).toBe('Ohio State')
  })
  it('handles multi-word team names', () => {
    expect(favoriteFromFormattedSpread('Miami (OH) -3.5', 'Miami (OH)', 'Kent State')).toBe('Miami (OH)')
  })
  it('returns null for pick\'em / EVEN / unparseable / unmatched', () => {
    expect(favoriteFromFormattedSpread('EVEN', 'A', 'B')).toBeNull()
    expect(favoriteFromFormattedSpread('Michigan 7', 'Michigan', 'B')).toBeNull() // positive → not a favorite label
    expect(favoriteFromFormattedSpread('Texas -7', 'Michigan', 'Ohio State')).toBeNull() // names neither team
    expect(favoriteFromFormattedSpread(null, 'A', 'B')).toBeNull()
  })
})

describe('buildGameRows', () => {
  const fbs = [
    { school: 'Michigan', logos: ['https://a.example/michigan.png'] },
    { school: 'Ohio State', logos: ['https://a.example/ohio-state.png'] },
    { school: 'Alabama' }, // no logos field → stays unmapped
    { school: 'Vanderbilt', logos: [] }, // empty logos array → stays unmapped
  ]

  it('shapes an FBS-vs-FBS game with a line: signed home_spread + positive underdog', () => {
    const games = [{ id: 1, week: 5, homeTeam: 'Michigan', awayTeam: 'Ohio State', homeConference: 'Big Ten', awayConference: 'Big Ten', startDate: '2026-10-10T16:00:00Z', completed: false }]
    const lines = [{ id: 1, lines: [{ provider: 'consensus', spread: -7, formattedSpread: 'Michigan -7' }] }]
    const [row] = buildGameRows(games, lines, fbs)
    expect(row).toMatchObject({
      cfbd_game_id: '1', week: 5, home_team: 'Michigan', away_team: 'Ohio State',
      home_team_logo: 'https://a.example/michigan.png', away_team_logo: 'https://a.example/ohio-state.png',
      home_spread: -7, is_fbs_vs_fbs: true, status: 'scheduled',
      home_score: null, away_score: null,
      underdog_team: 'Ohio State', underdog_spread: 7, // away is the dog, positive
    })
  })

  it('falls back to null when a team has no logo (missing or empty logos array)', () => {
    const games = [{ id: 4, week: 5, homeTeam: 'Vanderbilt', awayTeam: 'Alabama' }]
    const lines = [{ id: 4, lines: [{ provider: 'consensus', spread: 10, formattedSpread: 'Alabama -10' }] }]
    const [row] = buildGameRows(games, lines, fbs)
    expect(row).toMatchObject({ home_team_logo: null, away_team_logo: null })
  })

  it('excludes a game with no posted line', () => {
    const games = [{ id: 2, week: 5, homeTeam: 'Michigan', awayTeam: 'Ohio State' }]
    expect(buildGameRows(games, [{ id: 2, lines: [] }], fbs)).toEqual([])
  })

  it('excludes a non-FBS-vs-FBS game', () => {
    const games = [{ id: 3, week: 5, homeTeam: 'Michigan', awayTeam: 'Youngstown State' }]
    const lines = [{ id: 3, lines: [{ provider: 'consensus', spread: -35, formattedSpread: 'Michigan -35' }] }]
    expect(buildGameRows(games, lines, fbs)).toEqual([])
  })

  it('derives the underdog from a home dog (positive spread → home gets points)', () => {
    const games = [{ id: 4, week: 5, homeTeam: 'Vanderbilt', awayTeam: 'Alabama' }]
    const lines = [{ id: 4, lines: [{ provider: 'consensus', spread: 10, formattedSpread: 'Alabama -10' }] }]
    const [row] = buildGameRows(games, lines, fbs)
    expect(row).toMatchObject({ home_spread: 10, underdog_team: 'Vanderbilt', underdog_spread: 10 })
  })

  it('skips a game whose numeric sign disagrees with its text label', () => {
    const games = [{ id: 5, week: 5, homeTeam: 'Michigan', awayTeam: 'Ohio State' }]
    // spread -7 implies Michigan favored, but the label names Ohio State → drift → skip
    const lines = [{ id: 5, lines: [{ provider: 'consensus', spread: -7, formattedSpread: 'Ohio State -7' }] }]
    expect(buildGameRows(games, lines, fbs)).toEqual([])
  })

  it('carries final scores for a completed game', () => {
    const games = [{ id: 6, week: 1, homeTeam: 'Michigan', awayTeam: 'Ohio State', completed: true, homePoints: 30, awayPoints: 24 }]
    const lines = [{ id: 6, lines: [{ provider: 'consensus', spread: -7, formattedSpread: 'Michigan -7' }] }]
    const [row] = buildGameRows(games, lines, fbs)
    expect(row).toMatchObject({ status: 'final', home_score: 30, away_score: 24 })
  })

  it('keeps a genuine posted pick\'em (spread 0 → no underdog)', () => {
    const games = [{ id: 8, week: 5, homeTeam: 'Michigan', awayTeam: 'Ohio State' }]
    const lines = [{ id: 8, lines: [{ provider: 'consensus', spread: 0, formattedSpread: 'EVEN' }] }]
    const [row] = buildGameRows(games, lines, fbs)
    expect(row).toMatchObject({ cfbd_game_id: '8', home_spread: 0, underdog_team: null, underdog_spread: null })
  })

  it('falls back to per-game classification when the FBS team set is absent', () => {
    const games = [{ id: 7, week: 5, homeTeam: 'A', awayTeam: 'B', homeClassification: 'fbs', awayClassification: 'fbs' }]
    const lines = [{ id: 7, lines: [{ provider: 'consensus', spread: -3, formattedSpread: 'A -3' }] }]
    expect(buildGameRows(games, lines, []).length).toBe(1)
  })
})

describe('isWeekZeroGame', () => {
  it('matches a kickoff inside the configured 2026 window', () => {
    expect(isWeekZeroGame(2026, '2026-08-29T19:00:00.000Z')).toBe(true)
  })

  it('matches a late Saturday-night ET kickoff that rolls into Sunday UTC', () => {
    expect(isWeekZeroGame(2026, '2026-08-30T02:30:00.000Z')).toBe(true)
  })

  it('rejects the following weekend (the real Week 1, same CFBD week number)', () => {
    expect(isWeekZeroGame(2026, '2026-09-05T19:00:00.000Z')).toBe(false)
  })

  it('rejects a season with no configured window', () => {
    expect(isWeekZeroGame(2027, '2027-08-28T19:00:00.000Z')).toBe(false)
  })

  it('rejects a missing kickoff time', () => {
    expect(isWeekZeroGame(2026, null)).toBe(false)
  })
})

describe('ourWeekToCfbdWeek', () => {
  it('maps our Week 0 to the CFBD week it actually draws from', () => {
    expect(ourWeekToCfbdWeek(0)).toBe(WEEK_ZERO_CFBD_WEEK)
  })

  it('passes every other week number through unchanged', () => {
    expect(ourWeekToCfbdWeek(1)).toBe(1)
    expect(ourWeekToCfbdWeek(9)).toBe(9)
  })
})
