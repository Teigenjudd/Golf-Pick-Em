-- ============================================================================
-- Display names: users pick their own, and no name is ever derived from email.
--
-- handle_new_user() has been seeding display_name with split_part(email, '@', 1)
-- since 20260616000003. That means every leaderboard, every standings row, and
-- every "Most Popular Picks" widget has been publishing the local-part of each
-- player's email address to everyone else in the pool. It is the one place the
-- column-level SELECT grant on profiles (C3 / 20260620000000) cannot help:
-- display_name is a column players are *supposed* to read — the email was simply
-- copied into it.
--
-- Fix, in three parts:
--   1. New accounts land with display_name NULL. The app routes them to /welcome
--      and will not let them past it until they choose a name.
--   2. display_name_set_at records that a human actually chose the name. Existing
--      rows keep their email-derived name but have a NULL stamp, which is what
--      the dashboard nudge keys off — "you've never picked a name."
--   3. The stamp is written by a BEFORE UPDATE trigger, not by the client, so it
--      cannot be faked to dodge the nudge, and the client keeps using the plain
--      GRANT UPDATE (display_name) from A1 (20260714000000) — no new write path.
-- ============================================================================

-- ── 1. Stop deriving a name from the email address ──────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- display_name stays NULL on purpose: the app treats NULL as "this account has
  -- not been through onboarding yet" and sends them to /welcome to choose one.
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

-- ── 2. Track whether the user chose the name themselves ─────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name_set_at timestamptz;

-- Existing rows are left alone: their display_name is still the email local-part,
-- and display_name_set_at is NULL, so the dashboard shows them the nudge until
-- they set a real one. Nobody is locked out or interrupted.

-- ── 3. Bound what a name can be ─────────────────────────────────────────────
-- The client validates too, but the client is not a security boundary: without
-- this, a crafted request could park a 5,000-character name in everyone's
-- leaderboard. NOT VALID so the constraint applies to future writes only —
-- pre-existing email-derived names may be longer than 24 chars and must not
-- block the migration or their owner's next update.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_display_name_length;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_display_name_length
  CHECK (display_name IS NULL OR char_length(btrim(display_name)) BETWEEN 2 AND 24)
  NOT VALID;

-- ── 4. Stamp + normalize on write ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.stamp_display_name_set_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.display_name IS NOT NULL THEN
    NEW.display_name := btrim(NEW.display_name);
  END IF;

  IF NEW.display_name IS DISTINCT FROM OLD.display_name THEN
    NEW.display_name_set_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_stamp_display_name ON public.profiles;

CREATE TRIGGER profiles_stamp_display_name
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.stamp_display_name_set_at();

-- ── 5. Let the client read the stamp ────────────────────────────────────────
-- profiles is column-locked (C3): a column the role holds no SELECT grant on is
-- unreadable no matter what the RLS policy says. The app needs this one to know
-- whether to show the nudge. anon has no use for it, so authenticated only.
GRANT SELECT (display_name_set_at) ON public.profiles TO authenticated;
