-- ── Poll-leaderboard cron schedule ───────────────────────────────────────────
-- EDT = UTC-4 | Window: 7am–8pm ET (11:00–00:00 UTC)
-- Polls every 20 minutes during the window on tournament days.
--
-- ACTIVATE (run the morning of the first round):

select cron.schedule(
  'poll-thursday',
  '*/20 11-23 * * 4',
  $$
  select net.http_post(
    url     := 'https://ryvwayvaudnroewhpnpj.supabase.co/functions/v1/poll-leaderboard',
    headers := '{"Content-Type":"application/json","x-cron-secret":"golf-pick-em-cron-2026","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5dndheXZhdWRucm9ld2hwbnBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1Njk4NTYsImV4cCI6MjA5NzE0NTg1Nn0.di8PcSTA3GJ6iH4UntE7Gdh2_PzmYVu-iCIgw0syvZ4"}'::jsonb,
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
    headers := '{"Content-Type":"application/json","x-cron-secret":"golf-pick-em-cron-2026","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5dndheXZhdWRucm9ld2hwbnBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1Njk4NTYsImV4cCI6MjA5NzE0NTg1Nn0.di8PcSTA3GJ6iH4UntE7Gdh2_PzmYVu-iCIgw0syvZ4"}'::jsonb,
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
    headers := '{"Content-Type":"application/json","x-cron-secret":"golf-pick-em-cron-2026","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5dndheXZhdWRucm9ld2hwbnBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1Njk4NTYsImV4cCI6MjA5NzE0NTg1Nn0.di8PcSTA3GJ6iH4UntE7Gdh2_PzmYVu-iCIgw0syvZ4"}'::jsonb,
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
    headers := '{"Content-Type":"application/json","x-cron-secret":"golf-pick-em-cron-2026","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5dndheXZhdWRucm9ld2hwbnBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1Njk4NTYsImV4cCI6MjA5NzE0NTg1Nn0.di8PcSTA3GJ6iH4UntE7Gdh2_PzmYVu-iCIgw0syvZ4"}'::jsonb,
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
