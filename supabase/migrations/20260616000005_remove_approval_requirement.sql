-- Set all existing pending users to approved and change the default
-- so new sign-ups are immediately active without admin action.
UPDATE public.profiles SET status = 'approved' WHERE status = 'pending';
ALTER TABLE public.profiles ALTER COLUMN status SET DEFAULT 'approved';
