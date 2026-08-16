-- Team crest URLs, denormalized onto cfb.games alongside home_team/away_team (same
-- pattern as underdog_team/underdog_spread) — sourced from CFBD's teams/fbs "logos"
-- field, which poll-cfb-lines already fetches every hour for name validation, so this
-- costs zero extra CFBD calls. Nullable: a team CFBD doesn't return a logo for (or a
-- game imported before this migration, which poll-cfb-lines only backfills pre-kickoff)
-- falls back to text-only in the UI, same silent-fallback pattern as weather/lat-lon.
ALTER TABLE cfb.games
  ADD COLUMN IF NOT EXISTS home_team_logo text,
  ADD COLUMN IF NOT EXISTS away_team_logo text;
