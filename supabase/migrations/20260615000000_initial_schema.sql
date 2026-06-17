-- 1. Profiles
CREATE TABLE public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name text,
  role        text NOT NULL DEFAULT 'player',
  status      text NOT NULL DEFAULT 'pending',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Helper: check if current user is an admin (must be after profiles table)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Auto-create profile row on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Tournaments
CREATE TABLE public.tournaments (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     text NOT NULL,
  slash_golf_tournament_id text,
  pick_count               int,
  scores_to_keep           int,
  status                   text NOT NULL DEFAULT 'draft',
  lock_time                timestamptz,
  join_code                text UNIQUE,
  created_by               uuid REFERENCES public.profiles,
  created_at               timestamptz NOT NULL DEFAULT now()
);

-- 3. Tiers
CREATE TABLE public.tiers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments ON DELETE CASCADE,
  tier_number   int NOT NULL,
  label         text
);

-- 4. Tier Players
CREATE TABLE public.tier_players (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id     uuid NOT NULL REFERENCES public.tiers ON DELETE CASCADE,
  player_id   text NOT NULL,
  player_name text NOT NULL,
  odds        int
);

-- 5. Picks
CREATE TABLE public.picks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments ON DELETE CASCADE,
  tier_id       uuid NOT NULL REFERENCES public.tiers,
  user_id       uuid NOT NULL REFERENCES public.profiles,
  player_id     text NOT NULL,
  player_name   text NOT NULL,
  status        text NOT NULL DEFAULT 'pending',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 6. Leaderboard Cache
CREATE TABLE public.leaderboard_cache (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments ON DELETE CASCADE,
  data          jsonb NOT NULL,
  fetched_at    timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tier_players      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.picks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_cache ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (is_admin());

-- tournaments
CREATE POLICY "Authenticated users can read non-draft tournaments"
  ON public.tournaments FOR SELECT
  USING (auth.role() = 'authenticated' AND status != 'draft');

CREATE POLICY "Admins have full access to tournaments"
  ON public.tournaments FOR ALL
  USING (is_admin());

-- tiers
CREATE POLICY "Authenticated users can read tiers"
  ON public.tiers FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can write tiers"
  ON public.tiers FOR ALL
  USING (is_admin());

-- tier_players
CREATE POLICY "Authenticated users can read tier_players"
  ON public.tier_players FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can write tier_players"
  ON public.tier_players FOR ALL
  USING (is_admin());

-- picks
CREATE POLICY "Users can insert own picks"
  ON public.picks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own picks"
  ON public.picks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read confirmed picks"
  ON public.picks FOR SELECT
  USING (status = 'confirmed');

CREATE POLICY "Admins can read all picks"
  ON public.picks FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can update picks"
  ON public.picks FOR UPDATE
  USING (is_admin());

-- leaderboard_cache
CREATE POLICY "Authenticated users can read leaderboard cache"
  ON public.leaderboard_cache FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can write leaderboard cache"
  ON public.leaderboard_cache FOR ALL
  USING (auth.role() = 'service_role');
