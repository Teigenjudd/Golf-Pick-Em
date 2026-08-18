-- ============================================================================
-- CFB — per-game kickoff lock.
--
-- Until now, cfb_submit_week_picks only gated on the WEEK's lock_time — so a
-- player could still pick (or change a pick on) a Thursday/Friday game right up
-- until the whole week locked, even though that game had already kicked off.
-- That made it impossible to set a generous week lock_time (e.g. Friday evening,
-- to give players time to build their Saturday picks) without also leaving
-- already-started games pickable in the meantime.
--
-- Fix: once a game's kickoff_at has passed, its slot in the submitted card must
-- match what's already on file — unchanged carry-forward is fine (the whole-card
-- resubmit always re-sends every slot, including ones the player didn't touch),
-- but a NEW, CHANGED, or DROPPED pick on a started game is rejected. The client
-- (CfbGameCard/CfbPicks) greys the game out so a normal user can never produce a
-- differing payload in the first place; this is the server-side backstop, same
-- rationale as freezing locked_spread server-side — the RPC can't trust the client.
-- ============================================================================

CREATE OR REPLACE FUNCTION cfb.cfb_submit_week_picks(
  p_pool_id uuid,
  p_week_id uuid,
  p_picks   jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = cfb, public
AS $fn$
DECLARE
  v_uid         uuid := auth.uid();
  v_pool_event  uuid;
  v_week_event  uuid;
  v_week_status text;
  v_week_lock   timestamptz;
  v_total       int;
  v_ats         int;
  v_dog         int;
  v_distinct    int;
  v_dd          int;
  v_dd_nonats   int;
  v_malformed   int;
  v_badtype     int;
  v_missing     int;
  v_badteam     int;
  v_started     int;
  v_dropped     int;
BEGIN
  -- 1. Must be signed in.
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- 2. Must be a member of this pool.
  IF NOT EXISTS (
    SELECT 1 FROM public.pool_participants
    WHERE pool_id = p_pool_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'You are not a member of this pool' USING ERRCODE = '42501';
  END IF;

  -- 3. Pool and week must exist, and the week must belong to the pool's season.
  SELECT event_id INTO v_pool_event FROM public.pools WHERE id = p_pool_id;
  IF v_pool_event IS NULL THEN
    RAISE EXCEPTION 'Pool not found' USING ERRCODE = '22023';
  END IF;

  SELECT event_id, status, lock_time
    INTO v_week_event, v_week_status, v_week_lock
    FROM cfb.weeks WHERE id = p_week_id;
  IF v_week_event IS NULL THEN
    RAISE EXCEPTION 'Week not found' USING ERRCODE = '22023';
  END IF;

  IF v_week_event <> v_pool_event THEN
    RAISE EXCEPTION 'That week does not belong to this pool''s season' USING ERRCODE = '22023';
  END IF;

  -- 4. The week must still be open for picks.
  IF v_week_status IN ('locked', 'graded')
     OR (v_week_lock IS NOT NULL AND v_week_lock <= now()) THEN
    RAISE EXCEPTION 'Picks are locked for this week' USING ERRCODE = '22023';
  END IF;

  -- 5. Payload must be a JSON array.
  IF p_picks IS NULL OR jsonb_typeof(p_picks) <> 'array' THEN
    RAISE EXCEPTION 'Picks must be a list' USING ERRCODE = '22023';
  END IF;

  -- ── Expand the card, join each pick to its real game (this week only), and
  --    compute every validation count in a single pass. A LEFT JOIN so a pick on
  --    an unknown / wrong-week game surfaces as g_id IS NULL (v_missing) rather
  --    than silently dropping out. `matches_existing` flags a row that's identical
  --    to what's already on file for this pool/week/game, so a started game's slot
  --    can carry forward unchanged without tripping the kickoff-lock check below. ─
  WITH existing AS (
    SELECT game_id, pick_type, selected_team, is_double_down
    FROM cfb.picks
    WHERE pool_id = p_pool_id AND user_id = v_uid AND week_id = p_week_id
  ),
  input AS (
    SELECT
      (e->>'game_id')::uuid                            AS game_id,
      e->>'pick_type'                                  AS pick_type,
      e->>'selected_team'                              AS selected_team,
      COALESCE((e->>'is_double_down')::boolean, false) AS is_double_down
    FROM jsonb_array_elements(p_picks) AS e
  ),
  joined AS (
    SELECT
      i.*,
      g.id          AS g_id,
      g.home_team,
      g.away_team,
      g.underdog_team,
      g.kickoff_at,
      EXISTS (
        SELECT 1 FROM existing ex
        WHERE ex.game_id = i.game_id
          AND ex.pick_type = i.pick_type
          AND ex.selected_team = i.selected_team
          AND ex.is_double_down = i.is_double_down
      ) AS matches_existing
    FROM input i
    LEFT JOIN cfb.games g
      ON g.id = i.game_id AND g.week_id = p_week_id
  )
  SELECT
    count(*),
    count(*) FILTER (WHERE pick_type = 'ats'),
    count(*) FILTER (WHERE pick_type = 'underdog'),
    count(DISTINCT game_id),
    count(*) FILTER (WHERE is_double_down),
    count(*) FILTER (WHERE is_double_down AND pick_type IS DISTINCT FROM 'ats'),
    count(*) FILTER (WHERE game_id IS NULL OR pick_type IS NULL OR selected_team IS NULL),
    count(*) FILTER (WHERE pick_type IS DISTINCT FROM 'ats' AND pick_type IS DISTINCT FROM 'underdog'),
    count(*) FILTER (WHERE g_id IS NULL),
    count(*) FILTER (WHERE g_id IS NOT NULL AND (
         (pick_type = 'ats'      AND selected_team NOT IN (home_team, away_team))
      OR (pick_type = 'underdog' AND (underdog_team IS NULL OR selected_team IS DISTINCT FROM underdog_team))
    )),
    count(*) FILTER (WHERE g_id IS NOT NULL AND kickoff_at IS NOT NULL AND kickoff_at <= now() AND NOT matches_existing)
  INTO
    v_total, v_ats, v_dog, v_distinct, v_dd, v_dd_nonats,
    v_malformed, v_badtype, v_missing, v_badteam, v_started
  FROM joined;

  -- 6. Whole-card validation. Ordered so the most fundamental problem reports
  --    first. Every failure is a bad-request (22023) so the client can show it.
  IF v_malformed > 0 THEN
    RAISE EXCEPTION 'Every pick needs a game, a type, and a team' USING ERRCODE = '22023';
  END IF;
  IF v_total <> 6 THEN
    RAISE EXCEPTION 'A weekly card must have exactly 6 picks (got %)', v_total USING ERRCODE = '22023';
  END IF;
  IF v_badtype > 0 THEN
    RAISE EXCEPTION 'Each pick must be type ats or underdog' USING ERRCODE = '22023';
  END IF;
  IF v_ats <> 5 OR v_dog <> 1 THEN
    RAISE EXCEPTION 'A card must be exactly 5 ATS picks and 1 underdog pick' USING ERRCODE = '22023';
  END IF;
  IF v_distinct <> 6 THEN
    RAISE EXCEPTION 'Each pick must be on a different game' USING ERRCODE = '22023';
  END IF;
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'Every pick must be on a game in this week' USING ERRCODE = '22023';
  END IF;
  IF v_dd > 1 THEN
    RAISE EXCEPTION 'You can flag at most one double-down' USING ERRCODE = '22023';
  END IF;
  IF v_dd_nonats > 0 THEN
    RAISE EXCEPTION 'The double-down must be one of your ATS picks' USING ERRCODE = '22023';
  END IF;
  IF v_badteam > 0 THEN
    RAISE EXCEPTION 'Each pick must select a valid team; the underdog pick must be the underdog' USING ERRCODE = '22023';
  END IF;

  -- 6b. Kickoff lock. A game that's already started may only appear with the
  --     exact pick already on file (v_started) — a NEW/CHANGED pick on it is
  --     refused. Likewise a pick already on file for a started game may not be
  --     silently dropped from the resubmitted card (v_dropped) — both directions
  --     of "you can't touch a game that's already kicked off."
  SELECT count(*)
    INTO v_dropped
    FROM cfb.picks ex
    JOIN cfb.games g ON g.id = ex.game_id
    WHERE ex.pool_id = p_pool_id AND ex.user_id = v_uid AND ex.week_id = p_week_id
      AND g.kickoff_at IS NOT NULL AND g.kickoff_at <= now()
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_picks) e
        WHERE (e->>'game_id')::uuid = ex.game_id
          AND e->>'pick_type' = ex.pick_type
          AND e->>'selected_team' = ex.selected_team
          AND COALESCE((e->>'is_double_down')::boolean, false) = ex.is_double_down
      );

  IF v_started > 0 OR v_dropped > 0 THEN
    RAISE EXCEPTION 'One of those games has already kicked off — you can''t add, drop, or change that pick' USING ERRCODE = '22023';
  END IF;

  -- 7. Atomic replace. A plpgsql function body is a single transaction, so the
  --    delete and re-insert commit together — there is no window where the old
  --    card is gone but the new one is not (the non-atomic delete-then-insert
  --    that BACKLOG B5 flags for golf). Re-submitting simply replaces the card.
  DELETE FROM cfb.picks
    WHERE pool_id = p_pool_id AND user_id = v_uid AND week_id = p_week_id;

  INSERT INTO cfb.picks (
    pool_id, week_id, user_id, game_id, pick_type, selected_team,
    is_double_down, locked_spread, status, auto_filled
  )
  SELECT
    p_pool_id,
    p_week_id,
    v_uid,
    i.game_id,
    i.pick_type,
    i.selected_team,
    i.is_double_down,
    -- Freeze the spread from the PICKED team's perspective, read server-side from
    -- the current game row (never trusting the client). Negative = your pick is
    -- laying points; positive = your pick is getting them. The underdog slot's
    -- team is always getting points, so its underdog_spread is the positive line.
    CASE
      WHEN i.pick_type = 'underdog'      THEN g.underdog_spread
      WHEN i.selected_team = g.home_team THEN g.home_spread
      ELSE                                    -g.home_spread
    END,
    'confirmed',
    false
  FROM (
    SELECT
      (e->>'game_id')::uuid                            AS game_id,
      e->>'pick_type'                                  AS pick_type,
      e->>'selected_team'                              AS selected_team,
      COALESCE((e->>'is_double_down')::boolean, false) AS is_double_down
    FROM jsonb_array_elements(p_picks) AS e
  ) i
  JOIN cfb.games g ON g.id = i.game_id AND g.week_id = p_week_id;
END;
$fn$;
