// Pure transform: a CollegeFootballData /scoreboard row → the fields poll-cfb-scores
// writes onto cfb.games. Import-free and exported so it can be unit-tested with vitest
// (src/utils/cfbLive.test.js imports this .ts directly, same as the scoring parity
// test) and reasoned about in isolation. The poller does the DB I/O; this only shapes.
//
// The /scoreboard payload (one call returns the whole live FBS slate) nests the score
// under home/away team objects and reports an in-game `status`. Field names have
// shifted between CFBD versions, so read defensively.
//
// NOTE: the exact live-field names (situation/possession/lastPlay) should be
// confirmed against a real Tier-2 /scoreboard response before the UI leans on them
// (same "verify the shape when we build" step we did for /games). Anything missing
// just lands null — the transform never throws on an unexpected shape.

function field(obj: any, ...names: string[]) {
  for (const n of names) {
    if (obj?.[n] !== undefined && obj?.[n] !== null) return obj[n]
  }
  return null
}
function toInt(v: any): number | null {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

// CFBD scoreboard status → our cfb.games.status CHECK domain.
//   'completed' → 'final' | 'in_progress' → 'in_progress' | anything else → 'scheduled'
export function mapScoreboardStatus(raw: any): 'scheduled' | 'in_progress' | 'final' {
  const s = String(raw ?? '').toLowerCase()
  if (s === 'completed' || s === 'final') return 'final'
  if (s === 'in_progress' || s === 'inprogress') return 'in_progress'
  return 'scheduled'
}

export interface LiveState {
  cfbd_game_id: string | null
  status: 'scheduled' | 'in_progress' | 'final'
  completed: boolean
  home_score: number | null
  away_score: number | null
  live: {
    period: number | null
    clock: string | null
    possession: string | null // 'home' | 'away' (whichever CFBD reports)
    situation: string | null   // e.g. "3rd & 7 at MICH 42"
    last_play: string | null
  }
}

// Shape one /scoreboard row. cfbd_game_id is null when the row has no id (caller
// should skip those — nothing to match to cfb.games).
export function buildLiveState(row: any): LiveState {
  const home = field(row, 'homeTeam', 'home_team', 'home')
  const away = field(row, 'awayTeam', 'away_team', 'away')
  const status = mapScoreboardStatus(field(row, 'status'))
  const id = field(row, 'id', 'gameId', 'game_id')

  return {
    cfbd_game_id: id == null ? null : String(id),
    status,
    completed: status === 'final',
    // Score can be nested under the team object (points) or flat (homePoints).
    home_score: toInt(field(home, 'points', 'score') ?? field(row, 'homePoints', 'home_points')),
    away_score: toInt(field(away, 'points', 'score') ?? field(row, 'awayPoints', 'away_points')),
    live: {
      period: toInt(field(row, 'period', 'quarter')),
      clock: field(row, 'clock'),
      possession: field(row, 'possession'),
      situation: field(row, 'situation'),
      last_play: field(row, 'lastPlay', 'last_play'),
    },
  }
}
