-- Picks are now confirmed on insert (no manual approval step).
-- Update delete policy to allow users to replace their picks until lock.
DROP POLICY "Users can delete own pending picks" ON public.picks;

CREATE POLICY "Users can delete own picks before lock"
  ON public.picks FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.tournaments
      WHERE id = tournament_id
        AND status != 'locked'
        AND (lock_time IS NULL OR lock_time > now())
    )
  );
