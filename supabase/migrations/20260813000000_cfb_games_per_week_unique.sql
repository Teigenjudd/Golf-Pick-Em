-- ============================================================================
-- CFB: re-key cfb.games so cfbd_game_id is unique PER WEEK, not globally.
--
-- DECISION (2026-08-13, supersedes the earlier "one shared event per season"
-- assumption in docs/CFB_BUILD_PLAN.md / DECISIONS.md): CFB uses PER-POOL events,
-- like golf's D3 hinge. Each pool owns its own public.events row + cfb.weeks +
-- cfb.games, which is what lets two pools on the same real season start at
-- different weeks, carry different lock schedules, and show only their own weeks.
-- The grading + live-score functions were already written for this (they dedup CFBD
-- calls by real (season, week) across events), so the SAME real CFBD game legitimately
-- appears once per pool's week.
--
-- The problem this fixes: PR1 gave cfb.games a GLOBAL `cfbd_game_id text UNIQUE`, and
-- importWeekSlate upserts onConflict cfbd_game_id. So the moment a SECOND pool imported
-- an overlapping week, the upsert reassigned the first pool's game rows to the second
-- pool's week — silent slate corruption. The correct key is (week_id, cfbd_game_id):
-- unique within a week, repeatable across different pools' weeks.
--
-- Nothing depends on cfbd_game_id being globally unique: grading/live look games up by
-- cfbd_game_id VALUE within a week, never assuming a single global row. Safe to apply —
-- cfb.games is empty (no CFB slate imported yet). Reversible.
-- ============================================================================

DO $$
DECLARE
  cname       text;
  dog_attnum  smallint;
BEGIN
  -- Find and drop whatever single-column UNIQUE constraint sits on cfbd_game_id
  -- (auto-named games_cfbd_game_id_key, but resolve it dynamically to be safe).
  SELECT attnum INTO dog_attnum
    FROM pg_attribute
    WHERE attrelid = 'cfb.games'::regclass AND attname = 'cfbd_game_id' AND NOT attisdropped;

  SELECT conname INTO cname
    FROM pg_constraint
    WHERE conrelid = 'cfb.games'::regclass AND contype = 'u' AND conkey = ARRAY[dog_attnum];

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE cfb.games DROP CONSTRAINT %I', cname);
  END IF;

  -- Add the per-week composite unique (idempotent — guarded for repeated db push).
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cfb_games_week_cfbd_unique' AND conrelid = 'cfb.games'::regclass
  ) THEN
    ALTER TABLE cfb.games
      ADD CONSTRAINT cfb_games_week_cfbd_unique UNIQUE (week_id, cfbd_game_id);
  END IF;
END $$;
