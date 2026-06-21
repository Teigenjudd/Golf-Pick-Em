-- Optional money pool per tournament.
--   stake_amount      $ each participant puts in (null = no money tracking)
--   payout_structure  ordered array of percentages by placement, e.g. [60,30,10]
--                     (only meaningful when stake_amount is set; must sum to 100)
-- Additive + nullable: existing rows and the currently-deployed frontend are
-- unaffected (they neither read nor write these columns).
ALTER TABLE public.tournaments
  ADD COLUMN stake_amount     numeric,
  ADD COLUMN payout_structure jsonb;
