# Next Steps

> The full ranked backlog lives in **`docs/BACKLOG.md`** (security → docs, severity-tagged,
> item IDs A1–H4). This file is just the short list of what's up next.

## Security

- [ ] **A1 (critical):** Fix the `profiles` UPDATE RLS policy — any signed-in user can
  currently set their own `role = 'admin'`. Highest-priority item in the repo.
- [ ] **A2:** Move The Odds API calls from the browser to a Supabase Edge Function
  - `VITE_ODDS_API_KEY` is bundled into the frontend JS and visible in DevTools
  - Same pattern as the existing `slash-golf-proxy` function (the Slash Golf key is
    already server-side)
  - After: rotate the key in The Odds API dashboard, remove the VITE_ version from
    `.env` and Netlify

## Migration tail

- [ ] **F1:** Phase 5 cleanup — drop the legacy `public.tournaments/tiers/tier_players/
  picks/leaderboard_cache/pga_event_badges` tables; decide `public.pool_standings`
  (populate or drop). See `docs/MULTI_SPORT_MIGRATION.md`.

## Tournament Format

- [ ] **G1:** Make tier format configurable in the tournament creation UI
  - Currently hardcoded in `src/utils/tierBuilder.js`: 6 regular tiers × 6 players +
    2 wildcard tiers × ~32 players (top 100 total)
  - Constants to expose: `REGULAR_TIER_SIZE`, `WILDCARD_TIER_COUNT`, `WILDCARD_POOL_SIZE`
  - Could add inputs on the Create Tournament Step 1 form alongside the existing
    pick count / scores-to-keep fields
