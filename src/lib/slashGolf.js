import { supabase } from './supabase'

const year = new Date().getFullYear()

async function proxyCall(endpoint, params) {
  const { data, error } = await supabase.functions.invoke('slash-golf-proxy', {
    body: { endpoint, params },
  })
  if (error) throw error
  return data
}

export function getTournaments() {
  return proxyCall('schedule', { orgId: '1', year })
}

export function getTournamentField(tournamentId) {
  return proxyCall('tournament', { orgId: '1', tournId: tournamentId, year })
}

export function getRankings() {
  return proxyCall('stats', { statId: '186', year })
}
