function impliedProbability(americanOdds) {
  if (americanOdds < 0) return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100)
  return 100 / (americanOdds + 100)
}

// Linear interpolation of implied probability from OWGR rank,
// calibrated against players who have both odds and a rank.
function interpolateProb(rank, calibration) {
  if (!calibration.length) return null
  if (rank <= calibration[0].owgr_rank) return calibration[0]._prob
  const last = calibration[calibration.length - 1]
  if (rank >= last.owgr_rank) return last._prob
  for (let i = 0; i < calibration.length - 1; i++) {
    const lo = calibration[i]
    const hi = calibration[i + 1]
    if (rank >= lo.owgr_rank && rank <= hi.owgr_rank) {
      const t = (rank - lo.owgr_rank) / (hi.owgr_rank - lo.owgr_rank)
      return lo._prob * (1 - t) + hi._prob * t
    }
  }
  return last._prob
}

function distributeEvenly(players, tiers) {
  if (!players.length) return
  const chunkSize = Math.ceil(players.length / tiers.length)
  players.forEach((player, i) => {
    const tierIndex = Math.min(Math.floor(i / chunkSize), tiers.length - 1)
    tiers[tierIndex].players.push(player)
  })
}

// players: [{ player_id, player_name, odds, owgr_rank }]
// Returns: { tiers: [{ tier_number, label, players }], unassigned: [...] }
export function buildTiers(players, tierCount) {
  const withOdds = players
    .filter(p => p.odds != null)
    .map(p => ({ ...p, _prob: impliedProbability(p.odds) }))

  const withRankOnly = players.filter(p => p.odds == null && p.owgr_rank != null)
  const noSignal = players.filter(p => p.odds == null && p.owgr_rank == null)

  // Calibration points: players with both signals, sorted by OWGR rank ascending
  const calibration = withOdds
    .filter(p => p.owgr_rank != null)
    .sort((a, b) => a.owgr_rank - b.owgr_rank)

  // Estimate probability for rank-only players using the calibrated curve,
  // falling back to 1/rank if there aren't enough calibration points.
  const estimatedRankOnly = withRankOnly.map(p => ({
    ...p,
    _prob: calibration.length >= 2
      ? interpolateProb(p.owgr_rank, calibration)
      : 1 / p.owgr_rank,
  }))

  // Merge both groups and sort together by probability descending
  const allOrdered = [...withOdds, ...estimatedRankOnly]
    .sort((a, b) => b._prob - a._prob)

  const tiers = Array.from({ length: tierCount }, (_, i) => ({
    tier_number: i + 1,
    label: `Tier ${i + 1}`,
    players: [],
  }))

  distributeEvenly(allOrdered, tiers)
  tiers[tierCount - 1].players.push(...noSignal)

  return { tiers }
}
