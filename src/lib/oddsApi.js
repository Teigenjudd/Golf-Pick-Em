import { supabase } from './supabase'
import { canonicalName } from '../utils/playerMatch'

export const GOLF_SPORT_KEYS = [
  { key: 'golf_masters_tournament_winner', label: 'Masters Tournament' },
  { key: 'golf_us_open_winner', label: 'US Open' },
  { key: 'golf_pga_championship_winner', label: 'PGA Championship' },
  { key: 'golf_the_open_championship_winner', label: 'The Open Championship' },
]

// American odds sort monotonically by implied probability (more negative = likelier,
// more positive = longer shot), so the median is taken as an order statistic — it
// always returns a price a bookmaker actually posted. On an even count we keep the
// lower of the two middle prices rather than averaging them: no valid American price
// exists between -100 and +100, and averaging can land there (-110 and +110 → 0).
function medianPrice(prices) {
  const sorted = [...prices].sort((a, b) => a - b)
  return sorted[Math.ceil(sorted.length / 2) - 1]
}

// Returns array of { name, price } using American odds.
//
// Bookmakers differ in how deep they price a field — some list only the top few dozen
// players, others the full field — so we union the outcomes across every book the API
// returns and keep each player's median price. Reading a single book would cap the
// field at whatever that one book happened to list.
export async function getGolfOdds(sportKey) {
  // Proxied server-side so the API key stays out of the browser bundle (A2).
  // invoke() does not throw on a 4xx/5xx from the function — it returns { error }.
  const { data, error } = await supabase.functions.invoke('odds-proxy', {
    body: { sportKey },
  })
  if (error) throw error

  if (!Array.isArray(data) || !data.length) return []

  const event = data[0]

  // Books spell names inconsistently — even between each other — so collapse them
  // onto the canonical name before pooling prices, or the same player lands in two
  // buckets. Keep the first spelling seen for display.
  const byPlayer = new Map()

  for (const bookmaker of event.bookmakers ?? []) {
    const market = bookmaker.markets?.find(m => m.key === 'outrights')
    for (const outcome of market?.outcomes ?? []) {
      if (!outcome?.name || typeof outcome.price !== 'number') continue
      const key = canonicalName(outcome.name)
      if (!key) continue
      if (!byPlayer.has(key)) byPlayer.set(key, { name: outcome.name, prices: [] })
      byPlayer.get(key).prices.push(outcome.price)
    }
  }

  return [...byPlayer.values()].map(({ name, prices }) => ({
    name,
    price: medianPrice(prices),
  }))
}
