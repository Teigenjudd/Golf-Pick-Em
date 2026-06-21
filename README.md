# Poold

**The handshake bet, modernized.**

A social sports pick'em platform for friend groups. Currently focused on PGA golf: a commissioner creates a tournament, shares a join link, friends each pick one golfer per tier, live scores update automatically throughout the weekend, and lowest score wins.

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS v4
- **Backend:** Supabase (Postgres + Auth + Edge Functions + RLS)
- **Hosting:** Netlify — [getpoold.app](https://getpoold.app)
- **APIs:** Slash Golf via RapidAPI, The Odds API, Open-Meteo, Nominatim/OpenStreetMap

## Local Development

```bash
npm install
cp .env.example .env   # fill in values below
npm run dev
```

Required `.env` values:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_ODDS_API_KEY=
VITE_SLASH_GOLF_API_KEY=
```

## Supabase Setup

```bash
supabase link --project-ref ryvwayvaudnroewhpnpj
supabase db push
supabase functions deploy poll-leaderboard
```

## Cron Schedule

Leaderboard polling runs via pg_cron. Before each tournament weekend, run the schedule block in `supabase/cron-schedule.sql` in the Supabase SQL editor. After the final round, run the unschedule block.

## Key Architecture Decisions

- **No passwords** — magic link auth only via Supabase `signInWithOtp`
- **Join code is the access gate** — no admin approval step for new users
- **Leaderboard data is cached in Supabase** — never fetched from the browser directly
- **WD/CUT players penalized +20** — kept in the scoring pool rather than dropped
- **API keys are client-side currently** — known security TODO before public launch
