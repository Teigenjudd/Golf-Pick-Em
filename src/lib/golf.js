// Single place that talks to the per-sport `golf` schema (plus the shared
// public tables it needs). Screens call these helpers instead of querying
// Supabase directly, and the helpers return the SAME shapes the old
// `tournaments`/`tiers`/`picks` queries returned — so the visual components and
// the demo don't have to change.
//
// We deliberately use separate queries across the public/golf boundary and
// stitch results in JS (rather than one nested cross-schema query) — see the
// Phase 0 decision in docs/MULTI_SPORT_MIGRATION.md.

import { supabase } from './supabase'

// All golf-schema access funnels through here.
const golf = () => supabase.schema('golf')

// Flatten a pool (public) + its golf event_details into one object that looks
// like the old `tournaments` row the screens were built around.
function mergePoolView(pool, details) {
  if (!pool) return null
  return {
    id: pool.id,
    event_id: pool.event_id,
    name: pool.name,
    status: pool.status,
    join_code: pool.join_code,
    lock_time: pool.lock_time,
    stake_amount: pool.stake_amount,
    payout_structure: pool.payout_structure,
    // golf event detail, flattened to the old field names
    pga_name: details?.pga_name ?? null,
    course_name: details?.course_name ?? null,
    latitude: details?.latitude ?? null,
    longitude: details?.longitude ?? null,
    pick_count: details?.pick_count ?? null,
    scores_to_keep: details?.scores_to_keep ?? null,
    slash_golf_tournament_id: details?.slash_golf_tournament_id ?? null,
    badge_config: details?.badge_config ?? null,
    manual_refresh_count: details?.manual_refresh_count ?? 0,
  }
}

async function fetchDetails(eventId) {
  const { data } = await golf().from('event_details').select('*').eq('event_id', eventId).maybeSingle()
  return data
}

// One merged pool view by pool id (null if not found).
export async function getPoolView(poolId) {
  const { data: pool } = await supabase.from('pools').select('*').eq('id', poolId).maybeSingle()
  if (!pool) return null
  return mergePoolView(pool, await fetchDetails(pool.event_id))
}

// One merged pool view by join code (null if not found).
export async function getPoolViewByCode(joinCode) {
  const { data: pool } = await supabase.from('pools').select('*').eq('join_code', joinCode).maybeSingle()
  if (!pool) return null
  return mergePoolView(pool, await fetchDetails(pool.event_id))
}

// Several merged pool views by id (used by the dashboard list).
export async function getPoolViewsByIds(poolIds) {
  if (!poolIds?.length) return []
  const { data: pools } = await supabase.from('pools').select('*').in('id', poolIds)
  if (!pools?.length) return []
  const eventIds = [...new Set(pools.map(p => p.event_id))]
  const { data: detailRows } = await golf().from('event_details').select('*').in('event_id', eventIds)
  const detailByEvent = {}
  ;(detailRows ?? []).forEach(d => { detailByEvent[d.event_id] = d })
  return pools.map(p => mergePoolView(p, detailByEvent[p.event_id]))
}

// Picks for one pool, shaped like the old nested select:
//   { user_id, player_id, player_name, status, tier_id,
//     profiles: { display_name }, tiers: { tier_number, label } }
// tiers is embedded (same schema); display names are stitched from public.profiles.
export async function getPoolPicks(poolId, { confirmedOnly = true } = {}) {
  let q = golf()
    .from('picks')
    .select('user_id, player_id, player_name, status, tier_id, tiers(tier_number, label)')
    .eq('pool_id', poolId)
  if (confirmedOnly) q = q.eq('status', 'confirmed')
  const { data: picks } = await q
  if (!picks?.length) return []

  const userIds = [...new Set(picks.map(p => p.user_id))]
  const { data: profs } = await supabase.from('profiles').select('id, display_name').in('id', userIds)
  const nameById = {}
  ;(profs ?? []).forEach(p => { nameById[p.id] = p.display_name })

  return picks.map(p => ({ ...p, profiles: { display_name: nameById[p.user_id] ?? 'Participant' } }))
}

// The current user's pick rows (pool_id + status), for the dashboard summary.
export async function getMyPickRows(userId) {
  const { data } = await golf().from('picks').select('pool_id, status').eq('user_id', userId)
  return data ?? []
}

// Latest cached leaderboard for an event ({ data, fetched_at } or null).
export async function getLatestLeaderboard(eventId) {
  const { data } = await golf()
    .from('leaderboard_cache')
    .select('data, fetched_at')
    .eq('event_id', eventId)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ?? null
}

// All pools (for the dashboard admin list).
export async function getAllPools() {
  const { data } = await supabase
    .from('pools')
    .select('id, name, status, join_code, created_at')
    .order('created_at', { ascending: false })
  return data ?? []
}

// An event's tiers with their players embedded (shape the picker expects):
//   [{ id, tier_number, label, tier_players: [{ id, player_id, player_name, odds }] }]
export async function getEventTiers(eventId) {
  const { data } = await golf()
    .from('tiers')
    .select('id, tier_number, label, tier_players(id, player_id, player_name, odds)')
    .eq('event_id', eventId)
    .order('tier_number')
  return data ?? []
}

// The current user's existing picks in a pool.
export async function getMyPicks(poolId, userId) {
  const { data } = await golf()
    .from('picks')
    .select('id, tier_id, player_id, player_name, status')
    .eq('pool_id', poolId)
    .eq('user_id', userId)
  return data ?? []
}

// Replace the user's picks for a pool and record their pool membership.
// picks: [{ tier_id, player_id, player_name }]
export async function submitPicks({ poolId, userId, picks }) {
  const { error: delErr } = await golf().from('picks')
    .delete().eq('pool_id', poolId).eq('user_id', userId)
  if (delErr) throw delErr

  const { error: insErr } = await golf().from('picks').insert(
    picks.map(p => ({
      pool_id: poolId,
      tier_id: p.tier_id,
      user_id: userId,
      player_id: p.player_id,
      player_name: p.player_name,
      status: 'confirmed',
    }))
  )
  if (insErr) throw insErr

  // Record membership so leaderboards can show this player's name. DO NOTHING on
  // conflict (no UPDATE needed/allowed for a normal user).
  const { error: partErr } = await supabase
    .from('pool_participants')
    .upsert({ pool_id: poolId, user_id: userId }, { onConflict: 'pool_id,user_id', ignoreDuplicates: true })
  if (partErr) throw partErr
}
