-- ============================================================================
-- Admin controls for CFB polling — the CFB analogue of
-- 20260716000000_admin_polling_controls.sql (golf's leaderboard-polling toggle).
--
-- CFB has THREE poller jobs, not golf's one: the hourly slate/spread poller
-- (poll-cfb-lines), the in-game live-score poller (poll-cfb-scores), and a
-- twice-daily grading backstop (grade-cfb-week) that catches any week whose
-- live poller never saw a game go final. All three are windowed to the CFB
-- season (Aug through the January bowl games) instead of running year-round.
--
-- Shape mirrors admin_start_leaderboard_polling exactly: SECURITY DEFINER so
-- the body runs as the function owner (which can touch the `cron` and `vault`
-- schemas the browser role cannot), with is_admin() re-checked INSIDE each
-- function — the EXECUTE grant lets `authenticated` call it, is_admin()
-- decides if it may.
--
-- The CRON_SECRET the jobs send lives in Supabase Vault (name 'cron_secret') —
-- the SAME secret golf's jobs use, since it's checked by a shared convention
-- across edge functions, not a per-sport one — and must equal each edge
-- function's CRON_SECRET env or the poll silently 401s. The Bearer token below
-- is the project's PUBLIC anon JWT (identical constant to golf's migration; it
-- also ships in the browser bundle), so it is safe to commit.
--
-- IMPORTANT: golf's jobs are named 'poll-*' and are managed exclusively by
-- admin_start/stop_leaderboard_polling. CFB's jobs are named 'cfb-*' and are
-- managed exclusively by the functions below. Neither set's stop/status
-- function ever matches the other's prefix, so arming/disarming one sport's
-- pollers can never touch the other's — this migration does not modify golf's
-- existing migration or its poll-* jobs.
-- ============================================================================

-- ── start: (re)schedule the 3 CFB poll jobs ─────────────────────────────────
-- cron.schedule upserts by job name, so calling this while already running
-- just re-sets the same three jobs — safe to press twice.
--
-- Schedules (all UTC, months 8-12,1 = Aug–Dec + Jan bowl season):
--   cfb-lines  — '0 * * 8-12,1 *'            hourly slate/spread refresh, all season
--   cfb-scores — '*/2 15-23,0-7 * 8-12,1 *' every 2 min during game hours, all days
--                (hours 15-23,0-7 UTC span the US game window across time zones; runs
--                every in-season day so Mon CFP championship / weekday bowls get live
--                scores too — the poller self-gates to zero API calls when nothing's live)
--   cfb-grade  — '0 8,20 * 8-12,1 *'          twice daily, backstop grading sweep
CREATE OR REPLACE FUNCTION public.admin_start_cfb_polling()
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
      ('cfb-lines',  '0 * * 8-12,1 *',              'poll-cfb-lines'),
      ('cfb-scores', '*/2 15-23,0-7 * 8-12,1 *',    'poll-cfb-scores'),
      ('cfb-grade',  '0 8,20 * 8-12,1 *',            'grade-cfb-week')
    ) AS v(jobname, sched, fn_slug)
  LOOP
    -- %L quote-literals the secret into the stored job command. The secret ends
    -- up in cron.job.command (unavoidable — the job must send it), but that table
    -- is not readable by the browser roles.
    cmd := format(
      $job$select net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', %L, 'Authorization', %L),
        body := '{}'::jsonb
      )$job$,
      'https://ryvwayvaudnroewhpnpj.supabase.co/functions/v1/' || rec.fn_slug,
      secret, 'Bearer ' || anon);

    PERFORM cron.schedule(rec.jobname, rec.sched, cmd);
  END LOOP;
END;
$fn$;

-- ── stop: unschedule every cfb-* job that exists ────────────────────────────
-- Looping over cron.job by id avoids the "could not find job" error that
-- cron.unschedule(name) raises when a job is already gone — so stop is safe to
-- call even when nothing is scheduled. Matches 'cfb-%' ONLY — golf's 'poll-%'
-- jobs are untouched.
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

  FOR rec IN SELECT jobid FROM cron.job WHERE jobname LIKE 'cfb-%' LOOP
    PERFORM cron.unschedule(rec.jobid);
  END LOOP;
END;
$fn$;

-- ── status: is CFB polling currently armed? ─────────────────────────────────
-- True if at least one cfb-* job is scheduled and active. The browser role
-- cannot read cron.job directly, so the toggle relies on this to show state.
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
    SELECT 1 FROM cron.job WHERE jobname LIKE 'cfb-%' AND active
  );
END;
$fn$;

-- ── Grants: callable by authenticated, gated inside by is_admin() ───────────
REVOKE EXECUTE ON FUNCTION public.admin_start_cfb_polling()   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_stop_cfb_polling()    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_cfb_polling_status()  FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_start_cfb_polling()   TO authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_stop_cfb_polling()    TO authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_cfb_polling_status()  TO authenticated;
