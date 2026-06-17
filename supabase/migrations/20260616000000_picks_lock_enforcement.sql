-- Enforce lock_time at the DB level on picks INSERT and DELETE.
-- Users cannot submit or retract picks once the tournament is locked
-- or its lock_time has passed, even via direct API calls.

DROP POLICY "Users can insert own picks" ON public.picks;

CREATE POLICY "Users can insert own picks"
  ON public.picks FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.tournaments
      WHERE id = tournament_id
        AND status != 'locked'
        AND (lock_time IS NULL OR lock_time > now())
    )
  );

DROP POLICY "Users can delete own pending picks" ON public.picks;

CREATE POLICY "Users can delete own pending picks"
  ON public.picks FOR DELETE
  USING (
    auth.uid() = user_id
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.tournaments
      WHERE id = tournament_id
        AND status != 'locked'
        AND (lock_time IS NULL OR lock_time > now())
    )
  );
