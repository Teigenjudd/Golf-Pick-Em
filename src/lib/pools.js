// The first cross-sport seam: reads/writes only `public.*` tables, never a per-sport
// schema (golf() / cfb()). Used by the two pages that must branch by sport before they
// know which sport's lib to hand off to — Dashboard and Join.

import { supabase } from './supabase'

// Look up a pool by its join code, sport-agnostically. Returns the base pool + its
// sport so the shared Join page can branch. null if no such non-draft pool.
export async function getPoolByCode(code) {
  const { data: pool } = await supabase
    .from('pools')
    .select('id, name, event_id, status, lock_time')
    .eq('join_code', code)
    .neq('status', 'draft')
    .maybeSingle()
  if (!pool) return null
  const { data: event } = await supabase
    .from('events').select('sport_id').eq('id', pool.event_id).maybeSingle()
  return { ...pool, sport_id: event?.sport_id ?? null }
}

// Record pool membership for the current user (idempotent). Golf does this implicitly
// at pick-submit; CFB needs it explicit because its submit RPC requires membership to
// already exist. The "join self" RLS policy allows a user to insert only their own row.
export async function joinPool(poolId, userId) {
  const { error } = await supabase
    .from('pool_participants')
    .upsert({ pool_id: poolId, user_id: userId }, { onConflict: 'pool_id,user_id', ignoreDuplicates: true })
  if (error) throw error
}
