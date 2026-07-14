-- ============================================================================
-- A1 — Privilege escalation: any signed-in user could make themselves an admin.
--
-- The policy "Users can update own profile" was FOR UPDATE USING (auth.uid() = id)
-- with no WITH CHECK and no column restriction, and `authenticated` held a
-- table-level UPDATE grant. So this succeeded from the browser:
--
--     supabase.from('profiles').update({ role: 'admin' }).eq('id', myId)
--
-- AdminRoute and is_admin() both gate on `role`, so that was a full takeover of
-- the admin surface — create/lock pools, read every user's email via
-- admin_list_users(), remove participants.
--
-- The fix mirrors what C3 (20260620000000) did for reads. RLS is row-level and
-- cannot restrict columns, so the gate has to be the GRANT: column-level UPDATE
-- privileges are checked BEFORE any policy runs, which makes `role` unreachable
-- from the client no matter what a policy says. Admins change roles through a
-- SECURITY DEFINER RPC instead, the same shape as admin_list_users().
-- ============================================================================

-- ── 1. Column-locked writes ─────────────────────────────────────────────────
-- display_name is the only column a user may ever write to their own row.
-- role / status / id / created_at become unwritable from the Data API entirely.
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT  UPDATE (display_name) ON public.profiles TO authenticated;

-- ── 2. Close the missing WITH CHECK ─────────────────────────────────────────
-- USING decides which rows you may target; WITH CHECK decides what the row is
-- allowed to look like afterwards. Without it, the post-update row was never
-- re-validated. Belt-and-braces now that the column grant is the real gate.
DROP POLICY "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── 3. Role changes move behind an admin-only RPC ───────────────────────────
-- SECURITY DEFINER runs as the function owner, so it bypasses the column grant
-- above — which is exactly why it has to check is_admin() itself, first.
CREATE OR REPLACE FUNCTION public.admin_set_role(target_user uuid, new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE = '42501';
  END IF;

  IF new_role NOT IN ('player', 'admin') THEN
    RAISE EXCEPTION 'Invalid role: %', new_role USING ERRCODE = '22023';
  END IF;

  -- The admin UI already hides the toggle on your own row. Enforce it here too:
  -- a sole admin demoting themselves leaves nobody who can promote anyone, and
  -- recovery needs raw SQL access. (We have locked ourselves out of admin once
  -- already; that is enough.)
  IF target_user = auth.uid() THEN
    RAISE EXCEPTION 'Admins cannot change their own role' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles SET role = new_role WHERE id = target_user;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_role(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_set_role(uuid, text) TO authenticated;

-- ── 4. Pin search_path on is_admin() ────────────────────────────────────────
-- Same class of hole, one line away: is_admin() is SECURITY DEFINER but was
-- created without a search_path, so it resolves `public.profiles` against
-- whatever search_path the caller brings. Every RLS policy in the app calls it.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;
