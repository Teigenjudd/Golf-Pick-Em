// Slash Golf data helpers (exported — shared by the leaderboard widgets,
// TournamentDetail, and CreateTournament; keep a single copy here).

// Parses the Slash Golf `total` string to a number.
// "-10" → -10, "+3" → 3, "E" → 0, "-" / "" / null → null (not yet scored)
export function parseScore(total) {
  if (!total || total === '-' || total === '') return null
  if (total === 'E') return 0
  const n = parseInt(total, 10)
  return isNaN(n) ? null : n
}

export function normalizeName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Unwraps MongoDB Extended JSON numbers from Slash Golf responses.
// { $numberInt: "3" } → 3, { $numberDouble: "1.5" } → 1.5, plain number → itself,
// anything else → null.
export function unwrapNumber(val) {
  if (val == null) return null
  if (typeof val === 'number') return val
  if (val.$numberInt !== undefined) return parseInt(val.$numberInt, 10)
  if (val.$numberDouble !== undefined) return parseFloat(val.$numberDouble)
  return null
}

// picks: rows from Supabase — { user_id, player_id, player_name, profiles: { display_name } }
// leaderboardData: raw leaderboard_cache.data JSON blob
// scoresToKeep: number from tournament
//
// Returns array of { user_id, display_name, total_score, picks } sorted ascending (lowest wins).
export function computeScores({ picks, leaderboardData, scoresToKeep }) {
  if (!picks?.length) return []

  const rows = leaderboardData?.leaderboardRows ?? []

  // Build lookup by playerId (plain string in leaderboard response)
  const byId = {}
  const byName = {}
  rows.forEach(row => {
    const status = (row.status ?? '').toLowerCase()
    const entry = {
      score: parseScore(row.total),
      rawScore: row.total ?? '-',
      thru: row.thru ?? '',
      position: row.position ?? '-',
      withdrawn: status === 'wd',
      cut: status === 'cut',
    }
    byId[String(row.playerId)] = entry
    byName[normalizeName(`${row.firstName} ${row.lastName}`)] = entry
  })

const WD_PENALTY = 20

  // Group picks by user
  const userMap = {}
  picks.forEach(pick => {
    const uid = pick.user_id
    if (!userMap[uid]) {
      userMap[uid] = {
        user_id: uid,
        display_name: pick.profiles?.display_name ?? 'Participant',
        rawPicks: [],
      }
    }
    const entry = byId[String(pick.player_id)] ?? byName[normalizeName(pick.player_name)]
    const withdrawn = entry?.withdrawn ?? false
    const cut = entry?.cut ?? false
    const penalized = withdrawn || cut
    userMap[uid].rawPicks.push({
      player_name: pick.player_name,
      player_id: pick.player_id,
      // WD and CUT both get +20 penalty for not completing all 4 rounds
      score: penalized ? WD_PENALTY : (entry?.score ?? null),
      rawScore: penalized ? `+${WD_PENALTY}` : (entry?.rawScore ?? '-'),
      thru: entry?.thru ?? '',
      position: entry?.position ?? '-',
      withdrawn,
      cut,
    })
  })

  return Object.values(userMap)
    .map(user => {
      const eligible = user.rawPicks.filter(p => p.score !== null)
      const excluded = user.rawPicks.filter(p => p.score === null)

      // Best scores first (WD's +20 will naturally sort toward the bottom)
      eligible.sort((a, b) => a.score - b.score)

      const used = eligible.slice(0, scoresToKeep)
      const bench = eligible.slice(scoresToKeep)
      const totalScore = used.length > 0 ? used.reduce((sum, p) => sum + p.score, 0) : null

      return {
        user_id: user.user_id,
        display_name: user.display_name,
        total_score: totalScore,
        picks: [
          ...used.map(p => ({ ...p, used_in_total: true })),
          ...bench.map(p => ({ ...p, used_in_total: false })),
          ...excluded.map(p => ({ ...p, used_in_total: false })),
        ],
      }
    })
    .sort((a, b) => {
      if (a.total_score === null && b.total_score === null) return 0
      if (a.total_score === null) return 1
      if (b.total_score === null) return -1
      return a.total_score - b.total_score
    })
}

// Assigns ranks to a sorted standings array. Ties share the same rank.
export function assignRanks(standings) {
  return standings.map((entry, _i, arr) => {
    if (entry.total_score === null) return { ...entry, rank: null }
    const firstIdx = arr.findIndex(e => e.total_score === entry.total_score)
    return { ...entry, rank: firstIdx + 1 }
  })
}

export function formatScore(score) {
  if (score === null || score === undefined) return '–'
  if (score === 0) return 'E'
  return score > 0 ? `+${score}` : `${score}`
}
