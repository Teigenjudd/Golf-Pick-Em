-- ============================================================================
-- CFB — automatic lock + auto-fill at deadline (build-plan PR10, cron half).
--
-- Picks already CLOSE automatically at a week's lock_time (the submit RPC and every
-- read path treat lock_time as authoritative), but two things did not happen on
-- their own: (1) the week's status LABEL stayed 'scheduled' until an admin/grader
-- flipped it, and (2) nobody's missed card got auto-filled without a button press.
--
-- cfb.process_locked_weeks() closes both gaps with pure-DB work (NO CFBD/API calls):
-- for every week past its deadline it flips status → 'locked' and runs autofill_week.
-- A dedicated pg_cron job runs it every 10 minutes in-season, so cards auto-fill and
-- weeks visibly lock with no admin action. Because it spends zero API budget, it is
-- armed here directly and runs independently of the billable CFBD pollers (which stay
-- behind the /admin/cfb polling toggle). The admin "Auto-fill missing cards" button
-- remains as a manual override / immediate-fill.
-- ============================================================================

CREATE OR REPLACE FUNCTION cfb.process_locked_weeks()
RETURNS integer  -- total cards auto-filled across all newly-due weeks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = cfb, public
AS $fn$
DECLARE
  w       record;
  v_total integer := 0;
BEGIN
  -- Flip the status label for weeks whose deadline has passed (behavior was already
  -- locked via lock_time; this just makes the admin label match reality).
  UPDATE cfb.weeks
    SET status = 'locked'
    WHERE lock_time IS NOT NULL
      AND lock_time <= now()
      AND status NOT IN ('locked', 'graded');

  -- Auto-fill missing cards for every recently-locked, not-yet-graded week. Each week
  -- runs in its own sub-block so one bad week (e.g. fewer than 6 games, which
  -- autofill_week raises on) is skipped without stalling the rest — but the failure is
  -- LOGGED (RAISE WARNING), not silently swallowed, so a broken week surfaces in the
  -- Postgres logs instead of players quietly dropping out of scoring. The 30-day recency
  -- bound stops an old stuck week from being retried (and re-logged) every 10 min forever.
  FOR w IN
    SELECT id FROM cfb.weeks wk
    WHERE wk.lock_time IS NOT NULL
      AND wk.lock_time <= now()
      AND wk.lock_time >= now() - interval '30 days'
      AND wk.status <> 'graded'
  LOOP
    BEGIN
      v_total := v_total + cfb.autofill_week(w.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'process_locked_weeks: autofill_week(%) failed: %', w.id, SQLERRM;
    END;
  END LOOP;

  RETURN v_total;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION cfb.process_locked_weeks() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION cfb.process_locked_weeks() TO service_role;

-- Arm the always-on, in-season (Aug–Jan) job. Pure SQL — no pg_net/HTTP, no cron
-- secret, no CFBD spend — so it is safe to run regardless of the poller toggle.
-- cron.schedule upserts by name, so re-applying is harmless.
SELECT cron.schedule(
  'cfb-lock-autofill',
  '*/10 * * 8-12,1 *',
  $$SELECT cfb.process_locked_weeks()$$
);
