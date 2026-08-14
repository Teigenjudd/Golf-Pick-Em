-- ============================================================================
-- CFB (sport #2) — Auto-fill on missed deadline (build-plan PR10).
--
-- When a week locks, any pool participant who never submitted a card is dropped
-- a RANDOM valid one so they stay in the season's scoring pool. Poold requires a
-- full 6-pick card or nothing (the submit RPC has no partial path), so the only
-- case here is "submitted nothing" — there is never a partial card to top up.
--
-- The generated card is a legal card BY CONSTRUCTION: 5 ATS picks on 5 distinct
-- games (each on a random side), 1 underdog pick on a 6th distinct game (its
-- underdog_team), and NO double-down — a missed deadline forfeits the double-down
-- (docs/CFB_FORMAT.md). auto_filled = true so the UI can badge it.
--
-- This is a pure-DB operation (no CFBD calls): it reads games already imported and
-- writes picks, so it ships as a migration with no edge-function deploy. It runs as
-- SECURITY DEFINER (bypassing RLS the same way cfb_submit_week_picks does) and is
-- callable by admins (the "Auto-fill missing cards" button) and by service_role
-- (grade-cfb-week's backstop, and a future lock-time cron). It refuses to run
-- before the week's deadline — filling early would overwrite nobody but would let
-- a card be assigned while players can still submit their own.
-- ============================================================================

CREATE OR REPLACE FUNCTION cfb.autofill_week(p_week_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = cfb, public
AS $fn$
DECLARE
  v_event  uuid;
  v_status text;
  v_lock   timestamptz;
  v_games  integer;
  v_filled integer := 0;
  r        record;
BEGIN
  -- Auth: admins (the UI button) or background jobs (service_role: the grader /
  -- a future lock-time cron). A normal player can never call this. Mirrors how the
  -- golf admin RPCs re-check authorization server-side regardless of the caller.
  IF NOT public.is_admin() AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT event_id, status, lock_time
    INTO v_event, v_status, v_lock
    FROM cfb.weeks WHERE id = p_week_id;
  IF v_event IS NULL THEN
    RAISE EXCEPTION 'Week not found' USING ERRCODE = '22023';
  END IF;

  -- Never fill before the deadline — players can still submit a real card, and a
  -- pre-lock fill could be reverse-engineered. lock_time is authoritative (nothing
  -- sets status='locked' until the admin ops / cron era), same as the submit RPC.
  IF NOT (v_status IN ('locked', 'graded')
          OR (v_lock IS NOT NULL AND v_lock <= now())) THEN
    RAISE EXCEPTION 'This week is not locked yet — auto-fill only runs after the pick deadline'
      USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_games FROM cfb.games WHERE week_id = p_week_id;
  IF v_games < 6 THEN
    RAISE EXCEPTION 'This week has only % game(s); need at least 6 to build a card', v_games
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
    -- 6 distinct random games: the first 5 become ATS picks (random side), the 6th
    -- the underdog. locked_spread is frozen from the picked team's perspective, the
    -- same rule the submit RPC uses (home_spread / -home_spread / underdog_spread).
    INSERT INTO cfb.picks (
      pool_id, week_id, user_id, game_id, pick_type, selected_team,
      is_double_down, locked_spread, status, auto_filled
    )
    SELECT
      r.pool_id, p_week_id, r.user_id, c.id,
      CASE WHEN c.rn <= 5 THEN 'ats' ELSE 'underdog' END,
      CASE WHEN c.rn = 6    THEN c.underdog_team
           WHEN c.pick_home THEN c.home_team
           ELSE                  c.away_team END,
      false,
      CASE WHEN c.rn = 6    THEN c.underdog_spread
           WHEN c.pick_home THEN c.home_spread
           ELSE                 -c.home_spread END,
      'confirmed', true
    FROM (
      SELECT
        g.id, g.home_team, g.away_team, g.home_spread,
        g.underdog_team, g.underdog_spread,
        row_number() OVER (ORDER BY random()) AS rn,
        (random() < 0.5)                      AS pick_home
      FROM cfb.games g
      WHERE g.week_id = p_week_id
    ) c
    WHERE c.rn <= 6;

    v_filled := v_filled + 1;
  END LOOP;

  RETURN v_filled;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION cfb.autofill_week(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION cfb.autofill_week(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION cfb.autofill_week(uuid) TO service_role;
