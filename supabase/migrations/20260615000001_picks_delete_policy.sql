-- Allow users to delete their own pending picks so they can resubmit before lock
CREATE POLICY "Users can delete own pending picks"
  ON public.picks FOR DELETE
  USING (auth.uid() = user_id AND status = 'pending');
