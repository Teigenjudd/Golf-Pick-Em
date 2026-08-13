// Unit tests for the live-scoreboard transform. The transform itself lives in
// supabase/functions/_shared/cfbLive.ts (server-only — it shapes CFBD /scoreboard
// rows for the poller), but it's pure and import-free, so vitest imports the .ts
// directly and tests it here (same approach as the cfbScoring TS-mirror parity test).
//
// Fixtures approximate CFBD's /scoreboard shape (nested home/away team objects, an
// in-game status). The exact live-field names are confirmed against a real Tier-2
// response when the UI is built; these lock in the transform's contract meanwhile.

import { describe, it, expect } from 'vitest'
import { buildLiveState, mapScoreboardStatus } from '../../supabase/functions/_shared/cfbLive.ts'

describe('mapScoreboardStatus', () => {
  it('maps CFBD statuses into our games.status domain', () => {
    expect(mapScoreboardStatus('completed')).toBe('final')
    expect(mapScoreboardStatus('in_progress')).toBe('in_progress')
    expect(mapScoreboardStatus('scheduled')).toBe('scheduled')
  })
  it('is case-insensitive and defaults unknowns to scheduled', () => {
    expect(mapScoreboardStatus('Completed')).toBe('final')
    expect(mapScoreboardStatus('inProgress')).toBe('in_progress')
    expect(mapScoreboardStatus(null)).toBe('scheduled')
    expect(mapScoreboardStatus('postponed')).toBe('scheduled')
  })
})

describe('buildLiveState', () => {
  const liveRow = {
    id: 401520001,
    status: 'in_progress',
    period: 3,
    clock: '07:42',
    possession: 'home',
    situation: '3rd & 7 at MICH 42',
    lastPlay: 'Pass complete for 8 yards',
    homeTeam: { name: 'Michigan', points: 21 },
    awayTeam: { name: 'Ohio State', points: 17 },
  }

  it('shapes an in-progress row: score, status, and the live blob', () => {
    expect(buildLiveState(liveRow)).toEqual({
      cfbd_game_id: '401520001',
      status: 'in_progress',
      completed: false,
      home_score: 21,
      away_score: 17,
      live: {
        period: 3,
        clock: '07:42',
        possession: 'home',
        situation: '3rd & 7 at MICH 42',
        last_play: 'Pass complete for 8 yards',
      },
    })
  })

  it('marks a completed game final + completed', () => {
    const done = buildLiveState({ ...liveRow, status: 'completed', clock: '00:00', period: 4 })
    expect(done.status).toBe('final')
    expect(done.completed).toBe(true)
    expect(done.home_score).toBe(21)
  })

  it('handles a scheduled game with no score yet', () => {
    const pre = buildLiveState({
      id: 5, status: 'scheduled',
      homeTeam: { name: 'Georgia' }, awayTeam: { name: 'Georgia Tech' },
    })
    expect(pre).toMatchObject({
      cfbd_game_id: '5',
      status: 'scheduled',
      completed: false,
      home_score: null,
      away_score: null,
    })
    expect(pre.live.clock).toBeNull()
  })

  it('reads flat homePoints/awayPoints and snake_case fallbacks', () => {
    const flat = buildLiveState({
      game_id: 9, status: 'in_progress',
      home_team: { name: 'A' }, away_team: { name: 'B' },
      homePoints: 14, awayPoints: 10, last_play: 'Kickoff',
    })
    expect(flat.cfbd_game_id).toBe('9')
    expect(flat.home_score).toBe(14)
    expect(flat.away_score).toBe(10)
    expect(flat.live.last_play).toBe('Kickoff')
  })

  it('never throws on a malformed row (missing id/teams → nulls)', () => {
    const junk = buildLiveState({})
    expect(junk.cfbd_game_id).toBeNull()
    expect(junk.home_score).toBeNull()
    expect(junk.status).toBe('scheduled')
  })
})
