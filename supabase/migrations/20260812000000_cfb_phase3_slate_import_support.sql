-- ============================================================================
-- CFB (sport #2) — Phase 3: data-layer support for slate import.
--
-- Additive only. Two small changes prepare the DB for the new cfd-proxy edge
-- function and the src/lib/cfb.js slate importer (both land in this same PR,
-- PR3). Nothing existing is touched; golf is unaffected.
--
--  (A) public.api_usage.cfbd_calls — a monthly call counter for the new
--      cfd-proxy edge function, mirroring the existing slash_golf_calls column
--      exactly. The proxy reads-then-writes this to enforce a monthly cap
--      (CFBD's free tier = 1000 calls/month).
--
--  (B) cfb.games underdog_spread sign guard — the cfb_submit_week_picks RPC
--      (PR2) trusts underdog_spread VERBATIM: for an underdog pick it freezes
--      locked_spread := games.underdog_spread with no sign/null check, and grades
--      off that frozen number. So the *table* enforces the contract the RPC
--      assumes: underdog_spread is either NULL (a pick'em game — no underdog, so
--      that game just can't be used for the underdog slot) or STRICTLY POSITIVE
--      (the points the dog is getting). A negative or zero value here would let
--      the importer silently freeze a wrong grade that nothing downstream catches.
--      The importer computes it with abs(); this CHECK is the belt-and-suspenders.
-- ============================================================================

-- (A) monthly counter for the cfd-proxy (mirrors slash_golf_calls)
ALTER TABLE public.api_usage
  ADD COLUMN IF NOT EXISTS cfbd_calls integer NOT NULL DEFAULT 0;

-- (B) underdog_spread must be NULL or strictly positive.
-- Guarded so a repeated `db push` during dev doesn't error on the constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cfb_games_underdog_spread_positive'
      AND conrelid = 'cfb.games'::regclass
  ) THEN
    ALTER TABLE cfb.games
      ADD CONSTRAINT cfb_games_underdog_spread_positive
      CHECK (underdog_spread IS NULL OR underdog_spread > 0);
  END IF;
END $$;
