-- ============================================================================
-- CFB: spread history log.
--
-- Additive. The hourly poll-cfb-lines poller refreshes each game's pre-kickoff line
-- and, whenever a game's spread CHANGES, appends a snapshot here (not every poll — only
-- on a move), so we can show line-movement over time ("opened -6.5 → closed -7.5").
--
-- Keyed by the REAL game (cfbd_game_id), NOT a per-pool cfb.games row: all pools share
-- the same real game and the same line, so one shared history avoids duplicating the
-- same movement N times. captured_at is when we first observed that spread value.
--
-- Read-only to players (so a future UI can chart the movement); only the service role
-- (the poller) and admins write. Column grants ride on the schema's ALTER DEFAULT
-- PRIVILEGES from PR1, but we GRANT explicitly too (belt-and-suspenders).
-- ============================================================================

CREATE TABLE IF NOT EXISTS cfb.spread_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cfbd_game_id    text NOT NULL,
  season_year     int NOT NULL,
  week_number     int,
  home_team       text,
  away_team       text,
  home_spread     numeric NOT NULL,           -- signed vs home, as stored on cfb.games
  underdog_team   text,
  underdog_spread numeric,
  captured_at     timestamptz NOT NULL DEFAULT now()
);

-- Fast "history for this game, newest first" and "latest per game" lookups.
CREATE INDEX IF NOT EXISTS idx_cfb_spread_history_game
  ON cfb.spread_history (cfbd_game_id, captured_at DESC);

GRANT SELECT ON cfb.spread_history TO authenticated;
GRANT ALL    ON cfb.spread_history TO service_role;

ALTER TABLE cfb.spread_history ENABLE ROW LEVEL SECURITY;

-- Any signed-in user may read the movement history; the poller (service_role) and
-- admins write it.
CREATE POLICY "read spread history"   ON cfb.spread_history FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "service manage spread history" ON cfb.spread_history FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "admin manage spread history"   ON cfb.spread_history FOR ALL USING (public.is_admin());
