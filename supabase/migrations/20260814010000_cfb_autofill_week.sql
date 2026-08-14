-- ============================================================================
-- CFB (sport #2) — Auto-fill on missed deadline (build-plan PR10).
--
-- When a week locks, any pool participant who never submitted a card is dropped
-- a RANDOM valid one so they stay in the season's scoring pool. Poold requires a
-- full 6-pick card or nothing (the submit RPC has no partial path), so the only
-- case here is "submitted nothing" — there is never a partial card to top up.
--
-- The generated card is a legal card BY CONSTRUCTION: 5 ATS picks on 5 distinct
-- games (each on a random side), 1 underdog pick on a 6th distinct game, and NO
-- double-down — a missed deadline forfeits the double-down (docs/CFB_FORMAT.md).
-- auto_filled = true so the UI can badge it. IMPORTANT: the underdog slot may only
-- use an underdog-ELIGIBLE game (one with a real favorite/underdog) — a pick'em
-- (spread 0) has no underdog_team/underdog_spread and is legal only as an ATS pick,
-- exactly as cfb_submit_week_picks enforces for the client path.
--
-- This is a pure-DB operation (no CFBD calls): it reads games already imported and
-- writes picks, so it ships as a migration with no edge-function deploy. It runs as
-- SECURITY DEFINER (bypassing RLS the same way cfb_submit_week_picks does) and is
-- callable by admins (the "Auto-fill missing cards" button), by service_role
-- (grade-cfb-week's backstop), and from internal DB contexts with no request role
-- (pg_cron / migrations). It refuses to run before the week's deadline.
-- ============================================================================

CREATE OR REPLACE FUNCTION cfb.autofill_week(p_week_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = cfb, public
AS $fn$
DECLARE
  v_event    uuid;
  v_status   text;
  v_lock     timestamptz;
  v_games    integer;
  v_dog_ok   integer;
  v_filled   integer := 0;
  r          record;
BEGIN
  -- Auth allow-list (explicit — no reliance on three-valued-logic fall-through):
  --   • admins            → the "Auto-fill missing cards" button
  --   • service_role       → grade-cfb-week's backstop
  --   • NULL request role  → internal DB context (pg_cron, psql, migrations); PostgREST
  --                          never produces a NULL role, so this only admits trusted
  --                          server-side callers, not a browser.
  IF NOT (public.is_admin() OR auth.role() = 'service_role' OR auth.role() IS NULL) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT event_id, status, lock_time
    INTO v_event, v_status, v_lock
    FROM cfb.weeks WHERE id = p_week_id;
  IF v_event IS NULL THEN
    RAISE EXCEPTION 'Week not found' USING ERRCODE = '22023';
  END IF;

  -- Never fill before the deadline — players can still submit a real card, and a
  -- pre-lock fill could be reverse-engineered. lock_time is authoritative.
  IF NOT (v_status IN ('locked', 'graded')
          OR (v_lock IS NOT NULL AND v_lock <= now())) THEN
    RAISE EXCEPTION 'This week is not locked yet — auto-fill only runs after the pick deadline'
      USING ERRCODE = '22023';
  END IF;

  -- Serialize per-week: the cron, the grader backstop, and the admin button can all
  -- target one week at once. Without this, two concurrent runs each pass the "user has
  -- no card" check and each insert 6 rows on DIFFERENT random games → a corrupt 12-pick
  -- card (no CHECK constraint catches it). A transaction-scoped advisory lock makes the
  -- second caller wait, then see the first's inserted cards and fill nobody twice.
  PERFORM pg_advisory_xact_lock(hashtext('cfb.autofill_week:' || p_week_id::text));

  -- Need at least 6 games AND at least one underdog-eligible game (a pick'em can only
  -- be an ATS pick, never the mandatory underdog).
  SELECT count(*),
         count(*) FILTER (WHERE underdog_team IS NOT NULL AND underdog_spread IS NOT NULL)
    INTO v_games, v_dog_ok
    FROM cfb.games WHERE week_id = p_week_id;
  IF v_games < 6 THEN
    RAISE EXCEPTION 'This week has only % game(s); need at least 6 to build a card', v_games
      USING ERRCODE = '22023';
  END IF;
  IF v_dog_ok < 1 THEN
    RAISE EXCEPTION 'This week has no underdog-eligible game; cannot build a valid card'
      USING ERRCODE = '22023';
  END IF;

  -- Every non-draft pool participant on this week's season who has no card yet.
  -- (Idempotent: re-running only fills whoever is still missing.)
  FOR r IN
    SELECT pp.pool_id, pp.user_id
    FROM public.pool_participants pp
    JOIN public.pools p ON p.id = pp.pool_id
    WHERE p.event_id = v_event
      AND p.status <> 'draft'
      AND NOT EXISTS (
        SELECT 1 FROM cfb.picks pk
        WHERE pk.pool_id = pp.pool_id
          AND pk.user_id = pp.user_id
          AND pk.week_id = p_week_id
      )
  LOOP
    -- Pick the underdog game first from the eligible pool, then 5 distinct ATS games
    -- from the rest (any game — a pick'em is fine as an ATS pick). locked_spread is
    -- frozen from the picked team's perspective, the rule the submit RPC uses.
    INSERT INTO cfb.picks (
      pool_id, week_id, user_id, game_id, pick_type, selected_team,
      is_double_down, locked_spread, status, auto_filled
    )
    WITH dog AS (
      SELECT id, underdog_team, underdog_spread
      FROM cfb.games
      WHERE week_id = p_week_id
        AND underdog_team IS NOT NULL AND underdog_spread IS NOT NULL
      ORDER BY random()
      LIMIT 1
    ),
    ats AS (
      SELECT id, home_team, away_team, home_spread, (random() < 0.5) AS pick_home
      FROM cfb.games
      WHERE week_id = p_week_id
        AND id <> (SELECT id FROM dog)
      ORDER BY random()
      LIMIT 5
    )
    SELECT r.pool_id, p_week_id, r.user_id, x.game_id, x.pick_type, x.selected_team,
           false, x.locked_spread, 'confirmed', true
    FROM (
      SELECT a.id AS game_id, 'ats' AS pick_type,
             CASE WHEN a.pick_home THEN a.home_team   ELSE a.away_team    END AS selected_team,
             CASE WHEN a.pick_home THEN a.home_spread ELSE -a.home_spread END AS locked_spread
      FROM ats a
      UNION ALL
      SELECT d.id, 'underdog', d.underdog_team, d.underdog_spread
      FROM dog d
    ) x;

    v_filled := v_filled + 1;
  END LOOP;

  RETURN v_filled;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION cfb.autofill_week(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION cfb.autofill_week(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION cfb.autofill_week(uuid) TO service_role;
