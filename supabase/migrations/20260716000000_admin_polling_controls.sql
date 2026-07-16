-- ============================================================================
-- Admin controls for leaderboard polling — replace the hand-run cron SQL ritual.
--
-- Turning tournament-weekend polling on/off used to mean pasting four
-- cron.schedule() blocks (with the secret filled in) into the SQL editor, then
-- four cron.unschedule() blocks afterward. This moves that behind three
-- admin-only RPCs the Admin panel calls with a button.
--
-- Shape mirrors admin_set_role (20260714000000): SECURITY DEFINER so the body
-- runs as the function owner (which can touch the `cron` and `vault` schemas the
-- browser role cannot), with is_admin() re-checked INSIDE each function — the
-- EXECUTE grant lets `authenticated` call it, is_admin() decides if it may.
--
-- The CRON_SECRET the jobs send lives in Supabase Vault (name 'cron_secret') and
-- must equal the poll-leaderboard edge function's CRON_SECRET env — these
-- functions read it from Vault so the secret never lands in this migration or in
-- the client. The Bearer token below is the project's PUBLIC anon JWT (it also
-- ships in the browser bundle), so it is safe to commit.
--
-- Note for the future commissioner role: is_admin() checks role = 'admin', so a
-- non-admin commissioner is already refused here at the server; that split then
-- only needs to hide the UI card, not re-secure these RPCs.
-- ============================================================================

-- ── start: (re)schedule the 4 weekday poll jobs ─────────────────────────────
-- Flat every 20 min during the 7am–8pm ET window (11–23 UTC). cron.schedule
-- upserts by job name, so calling this while already running just re-sets the
-- same four jobs — safe to press twice.
CREATE OR REPLACE FUNCTION public.admin_start_leaderboard_polling()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  secret text;
  anon   text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5dndheXZhdWRucm9ld2hwbnBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1Njk4NTYsImV4cCI6MjA5NzE0NTg1Nn0.di8PcSTA3GJ6iH4UntE7Gdh2_PzmYVu-iCIgw0syvZ4';
  cmd    text;
  rec    record;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE = '42501';
  END IF;

  SELECT decrypted_secret INTO secret
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret';

  IF secret IS NULL THEN
    RAISE EXCEPTION 'cron_secret not found in Vault' USING ERRCODE = '42704';
  END IF;

  FOR rec IN
    SELECT * FROM (VALUES
      ('poll-thursday', '*/20 11-23 * * 4'),
      ('poll-friday',   '*/20 11-23 * * 5'),
      ('poll-saturday', '*/20 11-23 * * 6'),
      ('poll-sunday',   '*/20 11-23 * * 0')
    ) AS v(jobname, sched)
  LOOP
    -- %L quote-literals the secret into the stored job command. The secret ends
    -- up in cron.job.command (unavoidable — the job must send it), but that table
    -- is not readable by the browser roles.
    cmd := format(
      $job$select net.http_post(
        url := 'https://ryvwayvaudnroewhpnpj.supabase.co/functions/v1/poll-leaderboard',
        headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', %L, 'Authorization', %L),
        body := '{}'::jsonb
      )$job$, secret, 'Bearer ' || anon);

    PERFORM cron.schedule(rec.jobname, rec.sched, cmd);
  END LOOP;
END;
$fn$;

-- ── stop: unschedule every poll-* job that exists ───────────────────────────
-- Looping over cron.job by id avoids the "could not find job" error that
-- cron.unschedule(name) raises when a job is already gone — so stop is safe to
-- call even when nothing is scheduled.
CREATE OR REPLACE FUNCTION public.admin_stop_leaderboard_polling()
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

  FOR rec IN SELECT jobid FROM cron.job WHERE jobname LIKE 'poll-%' LOOP
    PERFORM cron.unschedule(rec.jobid);
  END LOOP;
END;
$fn$;

-- ── status: is polling currently armed? ─────────────────────────────────────
-- True if at least one poll-* job is scheduled and active. The browser role
-- cannot read cron.job directly, so the toggle relies on this to show state.
CREATE OR REPLACE FUNCTION public.admin_polling_status()
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
    SELECT 1 FROM cron.job WHERE jobname LIKE 'poll-%' AND active
  );
END;
$fn$;

-- ── Grants: callable by authenticated, gated inside by is_admin() ───────────
REVOKE EXECUTE ON FUNCTION public.admin_start_leaderboard_polling() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_stop_leaderboard_polling()  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_polling_status()            FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_start_leaderboard_polling() TO authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_stop_leaderboard_polling()  TO authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_polling_status()            TO authenticated;
