-- ============================================================================
-- CFB (sport #2) — Phase 1: additive scaffold.
--
-- Creates an empty `cfb` schema (four tables) ALONGSIDE the existing `public`
-- and `golf` schemas, and registers 'cfb' as a supported sport. This migration
-- does NOT touch any existing table, does NOT move data, and does NOT change
-- anything the live app reads today — golf keeps running exactly as before.
-- Fully reversible by dropping the new objects.
--
-- Row Level Security (the database's per-row "who can see this" rules) is turned
-- ON for every new table but no policies are added yet, so normal users see zero
-- rows — a safe default while the tables are empty. Real policies (plus the
-- cfb_submit_week_picks RPC that enforces the whole weekly card as one unit)
-- land in PR2. The service role (used by background functions) bypasses RLS.
--
-- Schema shape mirrors golf's per-sport pattern (see
-- 20260624120000_multisport_phase1_scaffold.sql) with one structural
-- difference: golf's event = one tournament (one lock, scored once); CFB's
-- event = one season, with weeks/games hanging off it. FKs point within `cfb`
-- or from `cfb` → `public` only — never `cfb` → `golf`.
-- Rules of record: docs/CFB_FORMAT.md. Sequencing: docs/CFB_BUILD_PLAN.md.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- public.sports — register CFB as a supported sport (table already exists)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.sports (id, name) VALUES ('cfb', 'College Football')
  ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- cfb schema — owns CFB's full contest structure
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS cfb;

-- 1:1 CFB-specific extension of public.events (one event = one season)
CREATE TABLE IF NOT EXISTS cfb.event_details (
  event_id    uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  season_year int NOT NULL
);

-- event-level: one slate/lock per week, shared by every pool on the season
CREATE TABLE IF NOT EXISTS cfb.weeks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  week_number int NOT NULL,
  label       text,
  lock_time   timestamptz,
  status      text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'open', 'locked', 'graded')),
  -- one row per (season, week number): makes week seeding idempotent and gives
  -- every game/pick a single addressable "Week N of this season" to attach to
  CONSTRAINT cfb_weeks_one_per_number UNIQUE (event_id, week_number)
);

CREATE TABLE IF NOT EXISTS cfb.games (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id          uuid NOT NULL REFERENCES cfb.weeks(id) ON DELETE CASCADE,
  cfbd_game_id     text UNIQUE,
  home_team        text NOT NULL,
  away_team        text NOT NULL,
  home_conference  text,
  away_conference  text,
  kickoff_at       timestamptz,
  home_spread      numeric NOT NULL,             -- signed vs home; away = -home_spread
  is_fbs_vs_fbs    boolean NOT NULL,
  status           text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_progress', 'final')),
  home_score       int,
  away_score       int,
  underdog_team    text,                         -- denormalized for the picks UI
  underdog_spread  numeric,                       -- denormalized for the picks UI
  -- lets cfb.picks reference (game_id, week_id) as a composite FK, so a pick's
  -- game is structurally guaranteed to belong to that pick's week
  CONSTRAINT cfb_games_id_week UNIQUE (id, week_id)
);

CREATE TABLE IF NOT EXISTS cfb.picks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id         uuid NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  week_id         uuid NOT NULL REFERENCES cfb.weeks(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.profiles(id),
  game_id         uuid NOT NULL,
  pick_type       text NOT NULL CHECK (pick_type IN ('ats', 'underdog')),
  selected_team   text NOT NULL,
  is_double_down  boolean NOT NULL DEFAULT false,
  locked_spread   numeric NOT NULL,               -- spread frozen at submit, for grading
  auto_filled     boolean NOT NULL DEFAULT false,
  status          text NOT NULL DEFAULT 'confirmed',
  result          text CHECK (result IN ('cover', 'push', 'miss', 'win', 'loss')), -- NULL until graded
  base_points     numeric,
  bonus_points    numeric,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- exactly one pick per (pool, user, week, game)
  CONSTRAINT cfb_picks_one_per_game UNIQUE (pool_id, user_id, week_id, game_id),
  -- the picked game must belong to the pick's week (composite FK into cfb.games);
  -- enforces game∈week structurally, for every write path, not just the PR2 RPC
  CONSTRAINT cfb_picks_game_in_week FOREIGN KEY (game_id, week_id)
    REFERENCES cfb.games (id, week_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes on the foreign keys we'll filter/join on
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cfb_weeks_event  ON cfb.weeks(event_id);
CREATE INDEX IF NOT EXISTS idx_cfb_games_week   ON cfb.games(week_id);
CREATE INDEX IF NOT EXISTS idx_cfb_picks_pool   ON cfb.picks(pool_id);
CREATE INDEX IF NOT EXISTS idx_cfb_picks_week   ON cfb.picks(week_id);
CREATE INDEX IF NOT EXISTS idx_cfb_picks_user   ON cfb.picks(user_id);
CREATE INDEX IF NOT EXISTS idx_cfb_picks_game   ON cfb.picks(game_id);

-- ============================================================================
-- Permissions. On this project new tables are NOT auto-exposed to the API
-- roles, so we grant explicitly. RLS still decides which ROWS are visible;
-- these grants only open the tables at all. Missing this block = "permission
-- denied" for every request, before RLS ever runs.
-- ============================================================================

-- cfb: whole schema (only contains the new tables)
GRANT USAGE ON SCHEMA cfb TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA cfb TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA cfb TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA cfb
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA cfb
  GRANT ALL ON TABLES TO service_role;

-- ============================================================================
-- Turn on Row Level Security (deny-all until policies are added in PR2)
-- ============================================================================
ALTER TABLE cfb.event_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE cfb.weeks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE cfb.games         ENABLE ROW LEVEL SECURITY;
ALTER TABLE cfb.picks         ENABLE ROW LEVEL SECURITY;
