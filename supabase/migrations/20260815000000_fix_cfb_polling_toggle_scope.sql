-- ============================================================================
-- Fix: the CFB polling toggle (20260814000000_admin_cfb_polling_controls.sql)
-- matched jobs with `jobname LIKE 'cfb-%'`, written before cfb-lock-autofill
-- existed (20260814020000_cfb_lock_autofill_cron.sql, same day, later). That
-- job is also prefixed 'cfb-', so it collided with both functions below:
--   - admin_cfb_polling_status() reported "on" any time cfb-lock-autofill was
--     armed, regardless of whether the billable pollers were actually running.
--   - admin_stop_cfb_polling() unscheduled cfb-lock-autofill along with the
--     three billable jobs, silently killing the free auto-fill/auto-lock cron
--     every time an admin toggled polling off.
--
-- Fix: scope both functions to the three billable job names explicitly instead
-- of a wildcard prefix, and re-arm cfb-lock-autofill (deleted in prod by this
-- bug during testing on 2026-08-15) since cron.schedule upserts by name and is
-- safe to re-run.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_stop_cfb_polling()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  rec record;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE = '42501';
  END IF;

  FOR rec IN SELECT jobid FROM cron.job WHERE jobname IN ('cfb-lines', 'cfb-scores', 'cfb-grade') LOOP
    PERFORM cron.unschedule(rec.jobid);
  END LOOP;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.admin_cfb_polling_status()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $fn$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE = '42501';
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM cron.job WHERE jobname IN ('cfb-lines', 'cfb-scores', 'cfb-grade') AND active
  );
END;
$fn$;

-- Restore the job this bug deleted. Pure SQL, no pg_net/HTTP, no cron secret,
-- no CFBD spend — safe to re-run regardless of the billable-poller toggle state.
SELECT cron.schedule(
  'cfb-lock-autofill',
  '*/10 * * 8-12,1 *',
  $$SELECT cfb.process_locked_weeks()$$
);
