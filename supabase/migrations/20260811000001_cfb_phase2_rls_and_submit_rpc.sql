-- ============================================================================
-- CFB (sport #2) — Phase 2: row-visibility rules + the weekly-card submit function.
--
-- Two things land here:
--
--  A) RLS POLICIES for the four cfb tables. Row Level Security was switched ON
--     (deny-all) in PR1; this adds the actual "who can see / change which row"
--     rules, mirroring golf's phase-3 policies. Reference tables (event_details,
--     weeks, games) are readable by any signed-in user and managed by admins;
--     picks are private until their week locks.
--
--  B) The cfb_submit_week_picks() FUNCTION — the ONLY way a player writes a
--     weekly card.
--
-- WHY a function instead of plain row policies for writing picks:
-- RLS checks one row at a time. But a valid CFB card is a rule ACROSS 6 rows at
-- once — exactly 5 ATS picks on 5 different games, exactly 1 underdog on a 6th
-- different game, at most 1 double-down (and only on an ATS pick). A per-row rule
-- literally cannot express "these 6 rows together are legal," so we deliberately
-- grant the client NO direct insert/update/delete on cfb.picks. Every card must
-- go through this SECURITY DEFINER function, which validates the whole set and
-- writes it in one transaction. (Finding 2 in docs/CFB_BUILD_PLAN.md; rules of
-- record in docs/CFB_FORMAT.md.) Allowing direct row writes "for defense in
-- depth" would REOPEN the hole — a crafted API call could insert 6 ATS picks or
-- two double-downs that pass every per-row check but corrupt scoring.
--
-- The service role (background grading + auto-fill jobs) bypasses RLS as usual;
-- admins keep read/fix access.
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════════
-- PART A — RLS policies
-- ════════════════════════════════════════════════════════════════════════════
-- Conventions (same as golf phase-3): auth.uid() / auth.role() are auth-schema
-- functions; public.is_admin() is schema-qualified so it resolves from cfb
-- policies. Multiple SELECT policies combine with OR. A FOR ALL policy with only
-- USING also gates inserts/updates. Server-side writes to weeks/games (slate
-- import, week grading) run as service_role, which bypasses RLS — so those need
-- no explicit write policy here.

-- ── cfb.event_details ────────────────────────────────────────────────────────
CREATE POLICY "read event details"         ON cfb.event_details FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "admin manage event details" ON cfb.event_details FOR ALL    USING (public.is_admin());

-- ── cfb.weeks ────────────────────────────────────────────────────────────────
CREATE POLICY "read weeks"         ON cfb.weeks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "admin manage weeks" ON cfb.weeks FOR ALL    USING (public.is_admin());

-- ── cfb.games ────────────────────────────────────────────────────────────────
CREATE POLICY "read games"         ON cfb.games FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "admin manage games" ON cfb.games FOR ALL    USING (public.is_admin());

-- ── cfb.picks ────────────────────────────────────────────────────────────────
-- See your own picks anytime.
CREATE POLICY "read own picks" ON cfb.picks FOR SELECT
  USING (auth.uid() = user_id);

-- See everyone's confirmed picks only after THAT PICK'S WEEK has locked. Privacy
-- is gated per-week via cfb.weeks (a season has many weekly locks), not per-pool
-- like golf (one tournament, one lock).
CREATE POLICY "read confirmed picks after week lock" ON cfb.picks FOR SELECT
  USING (
    status = 'confirmed'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM cfb.weeks w
      WHERE w.id = picks.week_id
        AND (w.status IN ('locked','graded') OR (w.lock_time IS NOT NULL AND w.lock_time <= now()))
    )
  );

-- Admins can read / fix / remove any pick.
CREATE POLICY "admin read picks"   ON cfb.picks FOR SELECT USING (public.is_admin());
CREATE POLICY "admin update picks" ON cfb.picks FOR UPDATE USING (public.is_admin());
CREATE POLICY "admin delete picks" ON cfb.picks FOR DELETE USING (public.is_admin());

-- Background jobs (grading writes result/points; auto-fill inserts missed cards)
-- run as service_role.
CREATE POLICY "service manage picks" ON cfb.picks FOR ALL USING (auth.role() = 'service_role');

-- NOTE: there is deliberately NO client insert/update/delete policy on cfb.picks.
-- With RLS on and no such policy, a normal user's direct write is denied — the
-- only write path is cfb_submit_week_picks() below (SECURITY DEFINER, runs as the
-- function owner, bypasses RLS). See the header for why this is safer than
-- golf-style per-row write policies.

-- ════════════════════════════════════════════════════════════════════════════
-- PART B — cfb_submit_week_picks(): validate + atomically write one weekly card
-- ════════════════════════════════════════════════════════════════════════════
-- Client calls: supabase.schema('cfb').rpc('cfb_submit_week_picks', { p_pool_id,
-- p_week_id, p_picks }). p_picks is a JSON array of exactly 6 objects:
--   { "game_id": uuid, "pick_type": "ats"|"underdog",
--     "selected_team": text, "is_double_down": bool }
-- The client does NOT send locked_spread — the function freezes it server-side
-- from the current game row, so a stale or tampered client price can't be used
-- for grading.

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
  --    than silently dropping out. ───────────────────────────────────────────
  WITH input AS (
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
      g.underdog_team
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
    ))
  INTO
    v_total, v_ats, v_dog, v_distinct, v_dd, v_dd_nonats,
    v_malformed, v_badtype, v_missing, v_badteam
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

-- Any signed-in user may call it; the function itself checks pool membership and
-- the whole-card rules. (Mirrors how golf's SECURITY DEFINER RPCs are granted.)
REVOKE EXECUTE ON FUNCTION cfb.cfb_submit_week_picks(uuid, uuid, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION cfb.cfb_submit_week_picks(uuid, uuid, jsonb) TO authenticated;
