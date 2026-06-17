-- ── Poll-leaderboard cron schedule ───────────────────────────────────────────
-- EDT = UTC-4 | Window: 7am–8pm ET (11:00–00:00 UTC)
-- Last auto-poll each day fires at 23:00 UTC (7pm ET).
-- 8pm ET slot = 00:00 UTC next day; add optional jobs below if needed.
--
-- ACTIVATE (run the morning of the first round):

select cron.schedule(
  'poll-thursday',
  '0 11-23 * * 4',
  $$
  select net.http_post(
    url     := 'https://ryvwayvaudnroewhpnpj.supabase.co/functions/v1/poll-leaderboard',
    headers := '{"Content-Type":"application/json","x-cron-secret":"golf-pick-em-cron-2026"}'::jsonb,
    body    := '{}'::jsonb
  )
  $$
);

select cron.schedule(
  'poll-friday',
  '0 11-23 * * 5',
  $$
  select net.http_post(
    url     := 'https://ryvwayvaudnroewhpnpj.supabase.co/functions/v1/poll-leaderboard',
    headers := '{"Content-Type":"application/json","x-cron-secret":"golf-pick-em-cron-2026"}'::jsonb,
    body    := '{}'::jsonb
  )
  $$
);

select cron.schedule(
  'poll-saturday',
  '0,30 11-23 * * 6',
  $$
  select net.http_post(
    url     := 'https://ryvwayvaudnroewhpnpj.supabase.co/functions/v1/poll-leaderboard',
    headers := '{"Content-Type":"application/json","x-cron-secret":"golf-pick-em-cron-2026"}'::jsonb,
    body    := '{}'::jsonb
  )
  $$
);

select cron.schedule(
  'poll-sunday',
  '0,15,30,45 11-23 * * 0',
  $$
  select net.http_post(
    url     := 'https://ryvwayvaudnroewhpnpj.supabase.co/functions/v1/poll-leaderboard',
    headers := '{"Content-Type":"application/json","x-cron-secret":"golf-pick-em-cron-2026"}'::jsonb,
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
