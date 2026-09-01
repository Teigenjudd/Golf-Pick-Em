-- ============================================================================
-- Per senior-dev review of feat/profile-avatars: the column-grant pattern that
-- makes avatar_url self-writable (GRANT UPDATE (avatar_url) + the existing
-- "auth.uid() = id" RLS policy) checks WHO can write, never WHAT gets written.
-- A user could bypass uploadAvatarForUser() entirely and PATCH avatar_url to
-- any external URL -- e.g. a tracking pixel that logs every viewer's IP when
-- the leaderboard renders it. This constraint closes that: the value must
-- point into our own avatars bucket (or be null), no matter which path wrote
-- it.
-- ============================================================================

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_avatar_url_is_our_storage
  CHECK (
    avatar_url IS NULL
    OR avatar_url LIKE 'https://ryvwayvaudnroewhpnpj.supabase.co/storage/v1/object/public/avatars/%'
  );
