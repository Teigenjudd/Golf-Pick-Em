# Next Steps

## Security

- [ ] Move Odds API and Slash Golf API calls from the browser to a Supabase Edge Function
  - Currently `VITE_ODDS_API_KEY` and `VITE_SLASH_GOLF_API_KEY` are bundled into the frontend JS and visible in DevTools
  - Fix: create a `tournament-setup` edge function that proxies `getTournamentField()`, `getRankings()`, and `getGolfOdds()` calls server-side
  - After: rotate both keys in The Odds API and RapidAPI dashboards, remove the VITE_ versions from .env and Netlify
  - Reference: same pattern as the existing `poll-leaderboard` edge function
