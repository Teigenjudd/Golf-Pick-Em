-- Allow authenticated users to read profiles of anyone with confirmed picks.
-- Required for the leaderboard to show participant display names.
CREATE POLICY "Authenticated users can read confirmed participant profiles"
  ON public.profiles FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.picks
      WHERE picks.user_id = profiles.id
        AND picks.status = 'confirmed'
    )
  );
