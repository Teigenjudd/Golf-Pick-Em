# Next Steps

## Security

- [ ] Move Odds API and Slash Golf API calls from the browser to a Supabase Edge Function
  - Currently `VITE_ODDS_API_KEY` and `VITE_SLASH_GOLF_API_KEY` are bundled into the frontend JS and visible in DevTools
  - Fix: create a `tournament-setup` edge function that proxies `getTournamentField()`, `getRankings()`, and `getGolfOdds()` calls server-side
  - After: rotate both keys in The Odds API and RapidAPI dashboards, remove the VITE_ versions from .env and Netlify
  - Reference: same pattern as the existing `poll-leaderboard` edge function

## Tournament Format

- [ ] Make tier format configurable in the tournament creation UI
  - Currently hardcoded in `src/utils/tierBuilder.js`: 6 regular tiers × 6 players + 2 wildcard tiers × ~32 players (top 100 total)
  - Constants to expose: `REGULAR_TIER_SIZE`, `WILDCARD_TIER_COUNT`, `WILDCARD_POOL_SIZE`
  - Could add inputs on the Create Tournament Step 1 form alongside the existing pick count / scores to keep fields
