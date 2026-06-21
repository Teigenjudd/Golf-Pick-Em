-- Security hardening — audit items C1, C2, C3.
--
--   C1  Picks had no server-side integrity checks: a user calling the REST API
--       directly could submit arbitrary players, multiple per tier, or players
--       from another tournament's tier.
--   C2  Every confirmed pick was readable by anyone at any time, so a player
--       could see opponents' picks before lock and adjust their own.
--   C3  The leaderboard profiles policy exposed the whole profiles row
--       (including email) to any authenticated user.

-- ════════════════════════════════════════════════════════════════════════════
-- C1 — Pick integrity
-- ════════════════════════════════════════════════════════════════════════════

-- Exactly one pick per (tournament, user, tier).
ALTER TABLE public.picks
  ADD CONSTRAINT picks_one_per_tier UNIQUE (tournament_id, user_id, tier_id);

-- Re-create the INSERT policy so a pick must reference a tier that belongs to
-- the tournament AND a player that actually exists in that tier. The lock-time
-- gate from the previous policy is preserved.
DROP POLICY "Users can insert own picks" ON public.picks;

CREATE POLICY "Users can insert own picks"
  ON public.picks FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = picks.tournament_id
        AND t.status <> 'locked'
        AND (t.lock_time IS NULL OR t.lock_time > now())
    )
    AND EXISTS (
      SELECT 1 FROM public.tiers ti
      WHERE ti.id = picks.tier_id
        AND ti.tournament_id = picks.tournament_id
    )
    AND EXISTS (
      SELECT 1 FROM public.tier_players tp
      WHERE tp.tier_id = picks.tier_id
        AND tp.player_id = picks.player_id
        AND tp.player_name = picks.player_name
    )
  );

-- ════════════════════════════════════════════════════════════════════════════
-- C2 — Don't reveal other players' picks before lock
-- ════════════════════════════════════════════════════════════════════════════

-- You always see your own picks (via "Users can read own picks"); you only see
-- other participants' confirmed picks once the tournament has locked or its
-- lock_time has passed.
DROP POLICY "Anyone can read confirmed picks" ON public.picks;

CREATE POLICY "Read confirmed picks after lock"
  ON public.picks FOR SELECT
  USING (
    status = 'confirmed'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = picks.tournament_id
        AND (
          t.status IN ('locked', 'complete')
          OR (t.lock_time IS NOT NULL AND t.lock_time <= now())
        )
    )
  );

-- ════════════════════════════════════════════════════════════════════════════
-- C3 — Stop exposing participant email addresses to non-admins
-- ════════════════════════════════════════════════════════════════════════════

-- RLS is row-level, so the leaderboard policy that lets authenticated users read
-- participant profiles also handed out email. Move profiles to column-level
-- grants: the anon/authenticated roles can never SELECT email, no matter what
-- columns the request asks for. Row-level policies still decide which rows.
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT  SELECT (id, display_name, role, status, created_at)
  ON public.profiles TO anon, authenticated;

-- Admin screens still need emails. Serve them through a SECURITY DEFINER
-- function that bypasses the column grant but only returns rows to admins.
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id           uuid,
  display_name text,
  email        text,
  role         text,
  created_at   timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.id, p.display_name, p.email, p.role, p.created_at
  FROM public.profiles p
  WHERE public.is_admin()
  ORDER BY p.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
