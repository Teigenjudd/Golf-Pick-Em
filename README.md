# Poold

**The handshake bet, modernized.**

A social sports pick'em platform for friend groups. Currently focused on PGA golf: a commissioner creates a tournament, shares a join link, friends each pick one golfer per tier, live scores update automatically throughout the weekend, and lowest score wins.

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS v4
- **Backend:** Supabase (Postgres + Auth + Edge Functions + RLS)
- **Hosting:** Netlify — [getpoold.app](https://getpoold.app)
- **APIs:** Slash Golf via RapidAPI (proxied), The Odds API, Open-Meteo, Nominatim/OpenStreetMap

## Local Development

```bash
npm install
npm run dev
```

Create a `.env` file at the project root:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_ODDS_API_KEY=
```

Slash Golf API key is stored as a Supabase secret (`SLASH_GOLF_API_KEY`), not a local env var.

## Supabase Setup

```bash
supabase link --project-ref ryvwayvaudnroewhpnpj
supabase db push
supabase functions deploy poll-leaderboard
supabase functions deploy slash-golf-proxy
```

## Cron Schedule

Leaderboard polling runs via pg_cron, every 20 minutes during the 7am–8pm ET window. Before each tournament weekend, run the schedule block in `supabase/cron-schedule.sql` in the Supabase SQL editor. After the final round, run the unschedule block.

## Key Architecture Decisions

- **No passwords** — magic link auth only via Supabase `signInWithOtp`
- **Join code is the access gate** — no admin approval step for new users
- **Leaderboard data is cached in Supabase** — Slash Golf API is proxied through an edge function, never called from the browser
- **WD/CUT players penalized +20** — kept in the scoring pool rather than dropped
- **Optional money pools** — commissioners can set a per-player stake and payout percentages (enforced to sum to 100%); the leaderboard shows the prize breakdown by placement
- **Public demo at `/demo`** — no sign-up; runs entirely on a static fixture and never touches the database
- **The Odds API is still client-side** — known security TODO before public launch (see `docs/AUDIT.md`)
