-- ============================================================================
-- Multi-sport — Phase 3: row-permission rules (RLS policies) for the new tables.
--
-- Faithfully mirrors the protections the existing tables have today, pointed at
-- the new public + golf tables. The live app still uses the OLD tables, so these
-- policies do not change current behavior — they make the new tables ready for
-- cutover.
--
-- Conventions: auth.uid() / auth.role() are auth-schema functions; is_admin()
-- lives in public and is schema-qualified so it resolves from golf policies too.
-- Multiple SELECT policies on a table combine with OR (a row is visible if ANY
-- applies). A FOR ALL policy with only USING also gates inserts/updates.
--
-- NOTE: public.profiles visibility is intentionally NOT changed here — see the
-- Phase 3 note in docs/MULTI_SPORT_MIGRATION.md. It moves at cutover.
-- ============================================================================

-- ── public.sports ───────────────────────────────────────────────────────────
CREATE POLICY "read sports"         ON public.sports FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "admin manage sports" ON public.sports FOR ALL    USING (public.is_admin());

-- ── public.events ───────────────────────────────────────────────────────────
CREATE POLICY "read events"         ON public.events FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "admin manage events" ON public.events FOR ALL    USING (public.is_admin());

-- ── public.pools (mirror old tournaments: authenticated read non-draft) ──────
CREATE POLICY "read non-draft pools" ON public.pools FOR SELECT
  USING (auth.role() = 'authenticated' AND status <> 'draft');
CREATE POLICY "admin manage pools"   ON public.pools FOR ALL
  USING (public.is_admin());

-- ── public.pool_participants ────────────────────────────────────────────────
-- Read the membership of any non-draft pool (needed to render a leaderboard).
-- References public.pools (not itself) to avoid RLS recursion.
CREATE POLICY "read participants of visible pools" ON public.pool_participants FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM public.pools p WHERE p.id = pool_participants.pool_id AND p.status <> 'draft')
  );
CREATE POLICY "join self"  ON public.pool_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "leave self" ON public.pool_participants FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "admin manage participants" ON public.pool_participants FOR ALL USING (public.is_admin());

-- ── public.pool_standings ───────────────────────────────────────────────────
CREATE POLICY "read standings of visible pools" ON public.pool_standings FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM public.pools p WHERE p.id = pool_standings.pool_id AND p.status <> 'draft')
  );
CREATE POLICY "admin manage standings" ON public.pool_standings FOR ALL USING (public.is_admin());

-- ── golf.event_details (mirror old badges + tournament detail reads) ─────────
CREATE POLICY "read event details"         ON golf.event_details FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "admin manage event details" ON golf.event_details FOR ALL    USING (public.is_admin());

-- ── golf.tiers (mirror old tiers) ───────────────────────────────────────────
CREATE POLICY "read tiers"         ON golf.tiers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "admin manage tiers" ON golf.tiers FOR ALL    USING (public.is_admin());

-- ── golf.tier_players (mirror old tier_players) ─────────────────────────────
CREATE POLICY "read tier players"         ON golf.tier_players FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "admin manage tier players" ON golf.tier_players FOR ALL    USING (public.is_admin());

-- ── golf.picks (mirror old picks: integrity + pre-lock privacy) ─────────────
-- See your own picks anytime.
CREATE POLICY "read own picks" ON golf.picks FOR SELECT
  USING (auth.uid() = user_id);

-- See everyone's confirmed picks only after the pool has locked.
CREATE POLICY "read confirmed picks after lock" ON golf.picks FOR SELECT
  USING (
    status = 'confirmed'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.pools p
      WHERE p.id = picks.pool_id
        AND (p.status IN ('locked','complete') OR (p.lock_time IS NOT NULL AND p.lock_time <= now()))
    )
  );

-- Admins can read / update / delete any picks.
CREATE POLICY "admin read picks"   ON golf.picks FOR SELECT USING (public.is_admin());
CREATE POLICY "admin update picks" ON golf.picks FOR UPDATE USING (public.is_admin());
CREATE POLICY "admin delete picks" ON golf.picks FOR DELETE USING (public.is_admin());

-- Insert only your own pick, only before lock, only a tier that belongs to the
-- pool's event, and only a player that actually exists in that tier.
CREATE POLICY "insert own pick" ON golf.picks FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.pools p
      WHERE p.id = picks.pool_id
        AND p.status <> 'locked'
        AND (p.lock_time IS NULL OR p.lock_time > now())
    )
    AND EXISTS (
      SELECT 1 FROM golf.tiers ti
      JOIN public.pools p ON p.id = picks.pool_id
      WHERE ti.id = picks.tier_id AND ti.event_id = p.event_id
    )
    AND EXISTS (
      SELECT 1 FROM golf.tier_players tp
      WHERE tp.tier_id = picks.tier_id
        AND tp.player_id = picks.player_id
        AND tp.player_name = picks.player_name
    )
  );

-- Delete your own pick before lock (so picks can be resubmitted).
CREATE POLICY "delete own pick before lock" ON golf.picks FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.pools p
      WHERE p.id = picks.pool_id
        AND p.status <> 'locked'
        AND (p.lock_time IS NULL OR p.lock_time > now())
    )
  );

-- ── golf.leaderboard_cache (mirror old) ─────────────────────────────────────
CREATE POLICY "read leaderboard cache"          ON golf.leaderboard_cache FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "service writes leaderboard cache" ON golf.leaderboard_cache FOR ALL    USING (auth.role() = 'service_role');
