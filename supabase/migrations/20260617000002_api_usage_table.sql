create table public.api_usage (
  month text primary key,         -- e.g. '2026-06'
  slash_golf_calls integer not null default 0
);

alter table public.api_usage enable row level security;

-- Only service role can read/write (edge functions use service role key)
