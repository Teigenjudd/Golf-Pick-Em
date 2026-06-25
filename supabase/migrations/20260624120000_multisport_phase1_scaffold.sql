-- ============================================================================
-- Multi-sport — Phase 1: additive scaffold.
--
-- Creates the new shared (public) tables and an empty `golf` schema ALONGSIDE
-- the existing tables. This migration does NOT move data, modify existing
-- tables, or change anything the live app reads. The app keeps running on the
-- old tables. Fully reversible by dropping the new objects.
--
-- Row Level Security (the database's per-row "who can see this" rules) is turned
-- ON for every new table but no policies are added yet, so normal users see zero
-- rows — a safe default while the tables are empty. Real policies land in a later
-- phase. The service role (used by background functions) bypasses RLS.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- public.sports — registry of supported sports (just golf today)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sports (
  id         text PRIMARY KEY,                 -- 'golf' (later 'nfl', etc.)
  name       text NOT NULL,
  enabled    boolean NOT NULL DEFAULT true,
  theme      jsonb,                            -- per-sport page colors/gradients
  vocabulary jsonb,                            -- per-sport labels ("PGA Leaders", …)
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.sports (id, name) VALUES ('golf', 'PGA Golf')
  ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- public.events — a real-world event; the hinge many pools can share
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_id   text NOT NULL REFERENCES public.sports(id),
  name       text NOT NULL,
  status     text NOT NULL DEFAULT 'draft',
  starts_at  timestamptz,
  ends_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- public.pools — the contest people join (generic; was "tournaments")
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pools (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name             text NOT NULL,
  join_code        text UNIQUE,
  status           text NOT NULL DEFAULT 'draft',
  lock_time        timestamptz,
  stake_amount     numeric,
  payout_structure jsonb,
  created_by       uuid REFERENCES public.profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- public.pool_participants — sport-agnostic membership (who is in a pool)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pool_participants (
  pool_id   uuid NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pool_id, user_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- public.pool_standings — generic standings cache the shared UI can render
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pool_standings (
  pool_id    uuid NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rank       int,
  total      numeric,
  display    jsonb,                            -- pre-rendered bits for the shared UI
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pool_id, user_id)
);

-- ============================================================================
-- golf schema — owns golf's full contest structure
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS golf;

-- 1:1 golf-specific extension of public.events
CREATE TABLE IF NOT EXISTS golf.event_details (
  event_id                 uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  slash_golf_tournament_id text,
  pga_name                 text,
  course_name              text,
  latitude                 numeric,
  longitude                numeric,
  pick_count               int,
  scores_to_keep           int,
  badge_config             jsonb
);

CREATE TABLE IF NOT EXISTS golf.tiers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tier_number int NOT NULL,
  label       text
);

CREATE TABLE IF NOT EXISTS golf.tier_players (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id     uuid NOT NULL REFERENCES golf.tiers(id) ON DELETE CASCADE,
  player_id   text NOT NULL,
  player_name text NOT NULL,
  odds        int
);

CREATE TABLE IF NOT EXISTS golf.picks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id     uuid NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  tier_id     uuid NOT NULL REFERENCES golf.tiers(id),
  user_id     uuid NOT NULL REFERENCES public.profiles(id),
  player_id   text NOT NULL,
  player_name text NOT NULL,
  status      text NOT NULL DEFAULT 'pending',
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- exactly one pick per (pool, user, tier)
  CONSTRAINT golf_picks_one_per_tier UNIQUE (pool_id, user_id, tier_id)
);

CREATE TABLE IF NOT EXISTS golf.leaderboard_cache (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  data       jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes on the foreign keys we'll filter/join on
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_events_sport            ON public.events(sport_id);
CREATE INDEX IF NOT EXISTS idx_pools_event             ON public.pools(event_id);
CREATE INDEX IF NOT EXISTS idx_golf_tiers_event        ON golf.tiers(event_id);
CREATE INDEX IF NOT EXISTS idx_golf_tier_players_tier  ON golf.tier_players(tier_id);
CREATE INDEX IF NOT EXISTS idx_golf_picks_pool         ON golf.picks(pool_id);
CREATE INDEX IF NOT EXISTS idx_golf_picks_tier         ON golf.picks(tier_id);
CREATE INDEX IF NOT EXISTS idx_golf_picks_user         ON golf.picks(user_id);
CREATE INDEX IF NOT EXISTS idx_golf_lbcache_event      ON golf.leaderboard_cache(event_id);

-- ============================================================================
-- Permissions. On this project new tables are NOT auto-exposed to the API
-- roles, so we grant explicitly. (Granting by name on public so we never touch
-- the existing hardened tables like profiles.) RLS still decides which ROWS are
-- visible; these grants only open the tables at all.
-- ============================================================================

-- public: new tables only, by name
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.sports, public.events, public.pools, public.pool_participants, public.pool_standings
  TO authenticated;
GRANT ALL
  ON public.sports, public.events, public.pools, public.pool_participants, public.pool_standings
  TO service_role;

-- golf: whole schema (only contains the new tables)
GRANT USAGE ON SCHEMA golf TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA golf TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA golf TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA golf
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA golf
  GRANT ALL ON TABLES TO service_role;

-- ============================================================================
-- Turn on Row Level Security (deny-all until policies are added in a later phase)
-- ============================================================================
ALTER TABLE public.sports            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pools             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_standings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE golf.event_details       ENABLE ROW LEVEL SECURITY;
ALTER TABLE golf.tiers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE golf.tier_players        ENABLE ROW LEVEL SECURITY;
ALTER TABLE golf.picks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE golf.leaderboard_cache   ENABLE ROW LEVEL SECURITY;
