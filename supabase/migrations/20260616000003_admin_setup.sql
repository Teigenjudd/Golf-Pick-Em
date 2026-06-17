-- 1. Add email column to profiles so admins can see it without querying auth.users
ALTER TABLE public.profiles ADD COLUMN email text;

-- 2. Update new-user trigger to set display_name and email on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (
    NEW.id,
    split_part(NEW.email, '@', 1),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- 3. Backfill existing profiles from auth.users
--    Only sets display_name if currently null; always sets email.
UPDATE public.profiles p
SET
  display_name = COALESCE(p.display_name, split_part(u.email, '@', 1)),
  email        = u.email
FROM auth.users u
WHERE p.id = u.id;

-- 4. Allow admins to delete any picks (for "Remove from Tournament")
CREATE POLICY "Admins can delete picks"
  ON public.picks FOR DELETE
  USING (is_admin());
