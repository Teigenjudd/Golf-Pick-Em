const BASE_URL = 'https://api.the-odds-api.com/v4/sports'

export const GOLF_SPORT_KEYS = [
  { key: 'golf_masters_tournament_winner', label: 'Masters Tournament' },
  { key: 'golf_us_open_winner', label: 'US Open' },
  { key: 'golf_pga_championship_winner', label: 'PGA Championship' },
  { key: 'golf_the_open_championship_winner', label: 'The Open Championship' },
]

// Returns array of { name, price } using American odds from the first available bookmaker.
export async function getGolfOdds(sportKey) {
  const url = `${BASE_URL}/${sportKey}/odds?apiKey=${import.meta.env.VITE_ODDS_API_KEY}&regions=us&markets=outrights&oddsFormat=american`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Odds API error: ${res.status}`)
  const data = await res.json()

  if (!Array.isArray(data) || !data.length) return []

  const event = data[0]
  const bookmaker = event.bookmakers?.[0]
  const market = bookmaker?.markets?.find(m => m.key === 'outrights')

  return market?.outcomes ?? []
}
