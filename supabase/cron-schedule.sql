-- ── Poll-leaderboard cron schedule ───────────────────────────────────────────
-- EDT = UTC-4 | Window: 7am–8pm ET (11:00–00:00 UTC)
-- Polls every 20 minutes during the window on tournament days.
--
-- ⚠️  SECRETS — DO NOT COMMIT REAL VALUES
-- This file ships with placeholders only. Before running it in the Supabase SQL
-- editor, replace the two placeholders below with the live values:
--
--   __CRON_SECRET__   The shared secret checked by the poll-leaderboard function
--                     (Deno.env CRON_SECRET). Generate a strong random value and
--                     set it as the edge function secret, then paste the same
--                     value here at run time. Never commit it.
--   __ANON_KEY__      The project's anon JWT. This one is public (it also ships
--                     in the browser bundle), but it's kept out of source here
--                     so this file stays copy-paste-safe.
--
-- NOTE: the previous secret value was committed to git history and must be
-- treated as compromised — rotate CRON_SECRET in Supabase before the next
-- tournament so the old value no longer works.
--
-- ACTIVATE (run the morning of the first round):

select cron.schedule(
  'poll-thursday',
  '*/20 11-23 * * 4',
  $$
  select net.http_post(
    url     := 'https://ryvwayvaudnroewhpnpj.supabase.co/functions/v1/poll-leaderboard',
    headers := '{"Content-Type":"application/json","x-cron-secret":"__CRON_SECRET__","Authorization":"Bearer __ANON_KEY__"}'::jsonb,
    body    := '{}'::jsonb
  )
  $$
);

select cron.schedule(
  'poll-friday',
  '*/20 11-23 * * 5',
  $$
  select net.http_post(
    url     := 'https://ryvwayvaudnroewhpnpj.supabase.co/functions/v1/poll-leaderboard',
    headers := '{"Content-Type":"application/json","x-cron-secret":"__CRON_SECRET__","Authorization":"Bearer __ANON_KEY__"}'::jsonb,
    body    := '{}'::jsonb
  )
  $$
);

select cron.schedule(
  'poll-saturday',
  '*/20 11-23 * * 6',
  $$
  select net.http_post(
    url     := 'https://ryvwayvaudnroewhpnpj.supabase.co/functions/v1/poll-leaderboard',
    headers := '{"Content-Type":"application/json","x-cron-secret":"__CRON_SECRET__","Authorization":"Bearer __ANON_KEY__"}'::jsonb,
    body    := '{}'::jsonb
  )
  $$
);

select cron.schedule(
  'poll-sunday',
  '*/20 11-23 * * 0',
  $$
  select net.http_post(
    url     := 'https://ryvwayvaudnroewhpnpj.supabase.co/functions/v1/poll-leaderboard',
    headers := '{"Content-Type":"application/json","x-cron-secret":"__CRON_SECRET__","Authorization":"Bearer __ANON_KEY__"}'::jsonb,
    body    := '{}'::jsonb
  )
  $$
);

-- ── DEACTIVATE (run after the final round ends): ──────────────────────────────

select cron.unschedule('poll-thursday');
select cron.unschedule('poll-friday');
select cron.unschedule('poll-saturday');
select cron.unschedule('poll-sunday');

-- ── Check which jobs are currently active: ────────────────────────────────────

select jobname, schedule, active from cron.job order by jobname;
