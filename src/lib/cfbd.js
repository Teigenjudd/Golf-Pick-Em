// Thin browser client for the CollegeFootballData API, mirroring slashGolf.js.
// Every call goes through the cfd-proxy edge function (admin-JWT gated) so the
// CFBD_API_KEY never reaches the browser. These return CFBD's raw JSON; the
// slate importer in src/lib/cfb.js shapes it into cfb.games rows.

import { supabase } from './supabase'

async function proxyCall(endpoint, params) {
  const { data, error } = await supabase.functions.invoke('cfd-proxy', {
    body: { endpoint, params },
  })
  if (error) throw error
  // The proxy returns { error } (200-wrapped or via a non-2xx body) on CFBD/cap
  // failures; surface those as thrown errors so callers don't treat them as data.
  if (data && !Array.isArray(data) && data.error) throw new Error(data.error)
  return data
}

// All regular-season FBS games for a week (schedule, teams, kickoff, scores).
export function getGames({ year, week, seasonType = 'regular' }) {
  return proxyCall('games', { year, week, seasonType, classification: 'fbs' })
}

// Betting lines (spreads) for a week, one entry per game with a `lines` array.
export function getLines({ year, week, seasonType = 'regular' }) {
  return proxyCall('lines', { year, week, seasonType })
}

// The FBS team list for a season — the authoritative "is this team FBS" set.
export function getFbsTeams(year) {
  return proxyCall('teams/fbs', { year })
}
