# Poold

**The handshake bet, modernized.**

A social sports pick'em platform for friend groups. Currently focused on PGA golf: a commissioner creates a tournament, shares a join link, friends each pick one golfer per tier, live scores update automatically throughout the weekend, and lowest score wins.

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS v4
- **Backend:** Supabase (Postgres + Auth + Edge Functions + RLS)
- **Hosting:** Netlify — [getpoold.app](https://getpoold.app)
- **APIs:** Slash Golf via RapidAPI (proxied), The Odds API, Open-Meteo (weather + geocoding)

## Local Development

```bash
npm install
npm run dev
```

Create a `.env` file at the project root:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Third-party API keys are **Supabase secrets, never local env vars** — anything prefixed `VITE_` is inlined into the browser bundle by Vite and is therefore public. Slash Golf (`SLASH_GOLF_API_KEY`) and The Odds API (`ODDS_API_KEY`) are both read server-side by their edge-function proxies.

## Supabase Setup

```bash
supabase link --project-ref ryvwayvaudnroewhpnpj
supabase db push
supabase functions deploy poll-leaderboard
supabase functions deploy slash-golf-proxy
```

## Cron Schedule

Leaderboard polling runs via pg_cron, every 20 minutes during the 7am–8pm ET window. Arm/disarm it from the **Admin panel** (Tournaments tab → "Leaderboard polling" toggle) before and after each tournament weekend; the toggle calls admin-only RPCs that read the cron secret from Supabase Vault. The raw `supabase/cron-schedule.sql` block still works as a manual fallback in the SQL editor.

## Key Architecture Decisions

- **No passwords** — magic link auth only via Supabase `signInWithOtp`
- **Join code is the access gate** — no admin approval step for new users
- **No third-party API key touches the browser** — Slash Golf and The Odds API are both proxied through edge functions; leaderboard data is cached in Supabase
- **WD/CUT players penalized +20** — kept in the scoring pool rather than dropped
- **Optional money pools** — commissioners can set a per-player stake and payout percentages (enforced to sum to 100%); the leaderboard shows the prize breakdown by placement
- **Public demo at `/demo`** — no sign-up; runs entirely on a static fixture and never touches the database
- **Per-sport Postgres schemas** — sport-agnostic core in `public` (events, pools, participants), golf's contest structure in the `golf` schema; all golf data access goes through `src/lib/golf.js`
- **`profiles` is column-locked** — RLS can't restrict columns, so GRANTs do it: a user can only ever write their own `display_name`. Role changes go through the `admin_set_role()` RPC. (See `docs/BACKLOG.md` for what's still open — A3, A4, A5.)
