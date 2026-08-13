-- ============================================================================
-- CFB (sport #2) — live in-game scores support.
--
-- Additive only. Adds one nullable JSONB column to cfb.games to hold the ephemeral
-- in-game state pulled from CollegeFootballData's /scoreboard endpoint by the new
-- poll-cfb-scores edge function (period, clock, possession, situation, last play).
-- Nothing else is touched; golf is unaffected; fully reversible by dropping the
-- column.
--
-- Why a JSONB blob rather than typed columns: this is a fast-changing display cache
-- (refreshed ~every minute while a game is live) whose exact field set we expect to
-- grow — mirrors golf's leaderboard_cache "store the provider payload we need"
-- approach. The AUTHORITATIVE score/status stay in the existing typed columns
-- (home_score, away_score, status), which the grader reads; `live` is display-only.
-- The current live score is also mirrored into home_score/away_score/status so the UI
-- has one place to read "current score" — grading is unaffected because it only ever
-- grades games the poller reports as completed (see _shared/cfbGrading.ts).
--
-- No new grants or RLS policies: the column rides on cfb.games' existing table-level
-- SELECT grant + "read games" policy (RLS is row-level; a new column is visible to
-- anyone who can already read the row). The poller writes as service_role.
-- ============================================================================

ALTER TABLE cfb.games
  ADD COLUMN IF NOT EXISTS live jsonb;

COMMENT ON COLUMN cfb.games.live IS
  'Ephemeral in-game state from CFBD /scoreboard (period, clock, possession, '
  'situation, last_play), refreshed by poll-cfb-scores. Display-only; the '
  'authoritative score/status live in home_score/away_score/status.';
