ALTER TABLE public.tournaments
  ADD COLUMN course_name text,
  ADD COLUMN latitude    numeric,
  ADD COLUMN longitude   numeric;
