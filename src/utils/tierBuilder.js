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

// Format: tiers 1–(tierCount-2) get REGULAR_TIER_SIZE players each (best available),
// the final 2 tiers are wildcard pools splitting the next WILDCARD_POOL_SIZE players.
// Total player pool is capped at REGULAR_TIER_SIZE * (tierCount-2) + WILDCARD_POOL_SIZE.
// TODO: make these values configurable in the tournament creation UI.
const REGULAR_TIER_SIZE   = 6
const WILDCARD_TIER_COUNT = 2
const WILDCARD_POOL_SIZE  = 64

// players: [{ player_id, player_name, odds, owgr_rank }]
// Returns: { tiers: [{ tier_number, label, players }] }
export function buildTiers(players, tierCount) {
  const withOdds = players
    .filter(p => p.odds != null)
    .map(p => ({ ...p, _prob: impliedProbability(p.odds) }))

  const withRankOnly = players.filter(p => p.odds == null && p.owgr_rank != null)

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

  // All rankable players sorted best → worst; players with no signal are excluded.
  const allOrdered = [...withOdds, ...estimatedRankOnly]
    .sort((a, b) => b._prob - a._prob)

  const regularTierCount = tierCount - WILDCARD_TIER_COUNT
  const regularPool      = regularTierCount * REGULAR_TIER_SIZE
  const totalPool        = regularPool + WILDCARD_POOL_SIZE

  const regular  = allOrdered.slice(0, regularPool)
  const wildcard = allOrdered.slice(regularPool, totalPool)

  const tiers = Array.from({ length: tierCount }, (_, i) => ({
    tier_number: i + 1,
    label: i < regularTierCount ? `Tier ${i + 1}` : `Wildcard ${i - regularTierCount + 1}`,
    players: [],
  }))

  // Fill regular tiers — exactly REGULAR_TIER_SIZE players each
  regular.forEach((player, i) => {
    tiers[Math.floor(i / REGULAR_TIER_SIZE)].players.push(player)
  })

  // Fill wildcard tiers — split the pool evenly across the 2 wildcard tiers
  const wildcardChunk = Math.ceil(wildcard.length / WILDCARD_TIER_COUNT)
  wildcard.forEach((player, i) => {
    const tierIdx = regularTierCount + Math.min(Math.floor(i / wildcardChunk), WILDCARD_TIER_COUNT - 1)
    tiers[tierIdx].players.push(player)
  })

  return { tiers }
}
