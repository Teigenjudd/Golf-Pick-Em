-- ============================================================================
-- Multi-sport — Phase 2: copy existing golf data into the new tables.
--
-- Duplicates the live data from the old tables into the new public + golf tables,
-- PRESERVING primary keys so every foreign-key reference stays valid. The old
-- tables are left untouched and keep serving the live app, so this is fully
-- reversible (the old tables are only dropped in a later phase, after cutover).
--
-- ID strategy: each old tournaments.id is reused as BOTH the new events.id and
-- the new pools.id, so every old tournament_id reference resolves correctly with
-- no remapping:
--   tiers.tournament_id             -> golf.tiers.event_id
--   leaderboard_cache.tournament_id -> golf.leaderboard_cache.event_id
--   picks.tournament_id             -> golf.picks.pool_id
--
-- Every INSERT uses ON CONFLICT DO NOTHING so the migration is safe to re-run.
-- ============================================================================

-- The old tournaments.manual_refresh_count (leaderboard refresh counter) had no
-- home in the new schema. The leaderboard is per-event now, so park it on
-- golf.event_details before backfilling.
ALTER TABLE golf.event_details
  ADD COLUMN IF NOT EXISTS manual_refresh_count int NOT NULL DEFAULT 0;

-- 1) events — real-world event identity (one per old tournament).
--    Event name prefers the official PGA name; falls back to the pool name.
INSERT INTO public.events (id, sport_id, name, status, created_at)
SELECT t.id, 'golf', COALESCE(t.pga_name, t.name), t.status, t.created_at
FROM public.tournaments t
ON CONFLICT (id) DO NOTHING;

-- 2) pools — the contest people join (reuses the tournament id).
INSERT INTO public.pools (id, event_id, name, join_code, status, lock_time,
                          stake_amount, payout_structure, created_by, created_at)
SELECT t.id, t.id, t.name, t.join_code, t.status, t.lock_time,
       t.stake_amount, t.payout_structure, t.created_by, t.created_at
FROM public.tournaments t
ON CONFLICT (id) DO NOTHING;

-- 3) golf.event_details — golf-specific event info, with the badge pulled in
--    from pga_event_badges by the Slash Golf tournament id.
INSERT INTO golf.event_details (event_id, slash_golf_tournament_id, pga_name,
                                course_name, latitude, longitude, pick_count,
                                scores_to_keep, badge_config, manual_refresh_count)
SELECT t.id, t.slash_golf_tournament_id, t.pga_name, t.course_name,
       t.latitude, t.longitude, t.pick_count, t.scores_to_keep,
       b.badge_config, COALESCE(t.manual_refresh_count, 0)
FROM public.tournaments t
LEFT JOIN public.pga_event_badges b
  ON b.tourn_id = t.slash_golf_tournament_id
ON CONFLICT (event_id) DO NOTHING;

-- 4) golf.tiers — the field is event-level (event_id = old tournament_id).
INSERT INTO golf.tiers (id, event_id, tier_number, label)
SELECT ti.id, ti.tournament_id, ti.tier_number, ti.label
FROM public.tiers ti
ON CONFLICT (id) DO NOTHING;

-- 5) golf.tier_players
INSERT INTO golf.tier_players (id, tier_id, player_id, player_name, odds)
SELECT tp.id, tp.tier_id, tp.player_id, tp.player_name, tp.odds
FROM public.tier_players tp
ON CONFLICT (id) DO NOTHING;

-- 6) golf.picks — pool_id = old tournament_id (= pools.id), tier_id preserved.
INSERT INTO golf.picks (id, pool_id, tier_id, user_id, player_id, player_name, status, created_at)
SELECT p.id, p.tournament_id, p.tier_id, p.user_id, p.player_id, p.player_name, p.status, p.created_at
FROM public.picks p
ON CONFLICT (id) DO NOTHING;

-- 7) golf.leaderboard_cache — per-event (event_id = old tournament_id).
INSERT INTO golf.leaderboard_cache (id, event_id, data, fetched_at)
SELECT lc.id, lc.tournament_id, lc.data, lc.fetched_at
FROM public.leaderboard_cache lc
ON CONFLICT (id) DO NOTHING;

-- 8) pool_participants — anyone who has a pick in a pool is a participant.
INSERT INTO public.pool_participants (pool_id, user_id)
SELECT DISTINCT p.tournament_id, p.user_id
FROM public.picks p
ON CONFLICT (pool_id, user_id) DO NOTHING;

-- pool_standings is intentionally left empty here — it's a computed cache that
-- the golf scoring logic fills in later (it can't be computed in plain SQL).
