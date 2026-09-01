-- ============================================================================
-- Profile pictures: a new self-service (and admin-overridable) avatar_url on
-- profiles, plus the app's first Supabase Storage bucket to hold the images.
--
-- avatar_url follows the same column-grant pattern as display_name (A1,
-- 20260714000000): self-writable via a plain GRANT + the existing
-- "auth.uid() = id" RLS policy, with an admin override going through a
-- SECURITY DEFINER RPC (mirrors admin_set_role) since admins need to write
-- ANOTHER user's row, which the plain grant/policy never allows.
-- ============================================================================

-- ── 1. Column + grants ───────────────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN avatar_url text;

GRANT SELECT (avatar_url) ON public.profiles TO anon, authenticated;
GRANT UPDATE (avatar_url) ON public.profiles TO authenticated;

-- ── 2. Admin override RPC ────────────────────────────────────────────────────
-- Unlike admin_set_role, there's no "can't change your own" guard here --
-- setting your own avatar is exactly what the plain grant above already
-- allows, this RPC only exists to reach OTHER users' rows.
CREATE OR REPLACE FUNCTION public.admin_set_avatar_url(target_user uuid, url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles SET avatar_url = url WHERE id = target_user;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_avatar_url(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_set_avatar_url(uuid, text) TO authenticated;

-- ── 3. admin_list_users() now carries avatar_url ────────────────────────────
-- Signature change (new OUT column) requires dropping first -- Postgres won't
-- let CREATE OR REPLACE add/reorder columns on an existing RETURNS TABLE.
DROP FUNCTION public.admin_list_users();

CREATE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id           uuid,
  display_name text,
  email        text,
  role         text,
  avatar_url   text,
  created_at   timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.id, p.display_name, p.email, p.role, p.avatar_url, p.created_at
  FROM public.profiles p
  WHERE public.is_admin()
  ORDER BY p.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- ── 4. Storage bucket ─────────────────────────────────────────────────────────
-- Public read (so <img src> works with no signed URL), 5MB cap, image types
-- only -- both enforced by Storage itself, not just client-side trust.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Path convention: {user_id}/avatar.<ext> -- storage.foldername(name) splits
-- the object path on '/', so [1] is that leading user-id folder.
CREATE POLICY "Avatar images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can replace their own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can upload any avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND public.is_admin());

CREATE POLICY "Admins can replace any avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND public.is_admin());
