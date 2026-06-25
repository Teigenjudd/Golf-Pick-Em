-- ============================================================================
-- Multi-sport — Phase 4 cutover: repoint profile visibility onto membership.
--
-- Until now, "which player names you may see on a leaderboard" was keyed off the
-- OLD public.picks table. The app now records membership in
-- public.pool_participants (and existing members were backfilled in Phase 2), so
-- switch the rule to key off that instead. This removes the last dependency the
-- shared core had on the old picks table.
--
-- Run order: this migration runs AFTER the new frontend ships, so that new
-- participants are being written to pool_participants by the live app.
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can read confirmed participant profiles" ON public.profiles;

CREATE POLICY "Read participant profiles"
  ON public.profiles FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.pool_participants pp
      WHERE pp.user_id = profiles.id
    )
  );
