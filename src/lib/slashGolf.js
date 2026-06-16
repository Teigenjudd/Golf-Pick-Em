const BASE_URL = 'https://live-golf-data.p.rapidapi.com'

const headers = {
  'x-rapidapi-key': import.meta.env.VITE_SLASH_GOLF_API_KEY,
  'x-rapidapi-host': 'live-golf-data.p.rapidapi.com',
  'Content-Type': 'application/json',
}

export async function getTournaments() {
  const year = new Date().getFullYear()
  const res = await fetch(`${BASE_URL}/schedule?orgId=1&year=${year}`, { headers })
  if (!res.ok) throw new Error(`Slash Golf schedule error: ${res.status}`)
  return res.json()
}

// Returns tournament metadata + players field via /tournament endpoint
export async function getTournamentField(tournamentId) {
  const year = new Date().getFullYear()
  const res = await fetch(`${BASE_URL}/tournament?orgId=1&tournId=${tournamentId}&year=${year}`, { headers })
  if (!res.ok) throw new Error(`Slash Golf tournament error: ${res.status}`)
  return res.json()
}

// OWGR rankings via /stats endpoint (statId 186 = Official World Golf Ranking)
export async function getRankings() {
  const year = new Date().getFullYear()
  const res = await fetch(`${BASE_URL}/stats?statId=186&year=${year}`, { headers })
  if (!res.ok) throw new Error(`Slash Golf rankings error: ${res.status}`)
  return res.json()
}
