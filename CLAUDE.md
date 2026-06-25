# Poold — Project Reference

## Brand

**Name:** Poold
**Domain:** getpoold.app
**Tagline:** "Make it interesting."
**Descriptor:** "Drop your picks. Jump in the pool. Make it interesting."

**Voice:** Casual, confident, social, competitive. Sunday afternoon energy. Group chat popping off. Everyone's got something on the line.

**NOT:** Sportsbook. ESPN. Corporate fantasy app. Anything that takes itself too seriously.

**Theme system:** Two registers — *general* (auth, dashboard, admin — brand-level, sport-agnostic) and *sport-specific* (pool detail + picks page — theme swaps per sport type). Currently golf only. Future sports get their own theme applied only on those two pages.

**Page inventory:** Full page-by-page breakdown of data, layout, and functionality lives in `docs/PAGES.md`. **Keep it in sync:** any time a page's data, layout, functionality, or design notes change, update the corresponding section in `docs/PAGES.md` as part of the same PR.

## Working Style

When given a substantial instruction or multi-step request, respond with a short summary (under 100 words) of what you understand and plan to do — then wait for approval or refinement before writing any code. Skip this for simple one-liner fixes where the intent is unambiguous.

**Audience / how to explain things:** The user is a **data scientist/analyst**, comfortable with **intermediate Python and OOP**, but **not a web/backend/frontend/infra developer**. When explaining backend, frontend, database-internals, DevOps, or web concepts (RLS, schemas, PostgREST, edge functions, FKs, embedding, CORS, etc.), **explain in plain language with analogies to Python/data work** (modules/packages, DataFrames/merges, class methods/getters, `sudo`, file permissions, scratch notebooks). Avoid unexplained web jargon — when a term is unavoidable, define it in one short clause. Keep technical callouts ELI5-friendly. SQL and Python itself can be assumed; web/infra plumbing cannot.

## Design System

**Stack:** React + Vite + Tailwind CSS v4 (`@tailwindcss/vite`). Theme tokens live in `src/index.css` via `@theme {}` — there is no `tailwind.config.js`.

### Color Tokens

| Token | Hex | Usage |
|---|---|---|
| `fairway` | `#1B4332` | Primary dark — headers, primary buttons, active states |
| `cream` | `#F8F5EE` | Page background |
| `gold` | `#C9A368` | Accent — "you" tag, tier markers, left-bar on scorecard expand |
| `birdie` | `#B23A2D` | Under-par scores ONLY (red = good in golf) |
| `charcoal` | `#2D2D2A` | Body text |
| `warm-100` | `#F0EBE1` | Card backgrounds, hover states |
| `warm-200` | `#E4DDD0` | Borders, dividers |
| `warm-300` | `#C9BFB0` | Light borders |
| `warm-400` | `#9E9488` | Muted/secondary text |
| `warm-500` | `#736A5F` | Slightly less muted |
| `warm-600` | `#4A4440` | Dark muted |

### Typography

- **`font-display`** — Barlow Condensed 700/800. Use on: tournament names, leaderboard section headers (`LEADERBOARD`, `MY PICKS`), rank numbers, score totals, tier labels. Always `tracking-tight` or `uppercase tracking-widest`.
- **`font-body`** (default) — Inter 400/500/600. Use on: player names, form inputs, descriptions, body copy.
- **Scores:** always `font-display font-bold tabular-nums`. `text-birdie` for negative (under par), `text-charcoal` for positive (over par), `font-medium text-charcoal` for even (0/"E"), `text-warm-400` for unscored.

### Component Patterns

**Cards:** `bg-white border border-warm-200 rounded-lg` — not `rounded-2xl`. Clubhouse, not consumer app.

**Primary button:** `bg-fairway hover:bg-fairway/90 text-cream font-medium py-2.5 px-4 rounded-lg transition-colors`

**Secondary button:** `border border-warm-300 text-charcoal hover:bg-warm-100 py-2 px-3 rounded-lg transition-colors`

**Danger button:** `border border-birdie/30 text-birdie hover:bg-birdie/5`

**Form input:** `border border-warm-300 rounded-lg px-3 py-2.5 text-charcoal bg-white placeholder:text-warm-300 focus:outline-none focus:ring-2 focus:ring-fairway/20 focus:border-fairway transition-colors`

**Section header label:** `font-display font-bold text-xs uppercase tracking-widest text-warm-400`

**Status badges:**
- open → `bg-fairway/10 text-fairway`
- locked → `bg-gold/20 text-gold`
- complete/draft → `bg-warm-200 text-warm-400`

### Signature Element: The Scorecard Expand

On the leaderboard (TournamentDetail), each row expands via a `flex` container where the first child is a `w-[3px] bg-gold` bar — the gold stripe that runs the full height of the expanded content. Inside: tier numbers as small `w-5 h-5 rounded-full bg-fairway/80` circles with `text-cream` numbers (hole-marker style), player names, and tabular scores. The last row is a "TOTAL" row with `border-t border-warm-200`.

### Page Header Pattern

Pages with a primary subject (TournamentDetail, Dashboard) use a `bg-fairway` header band with `text-cream` content. Auth/utility pages (Login, Join) use a centered layout on `bg-cream` with a large `font-display font-bold text-fairway` wordmark.

### Copy Guidelines

- Empty leaderboard: "Leaderboard opens once the first tee times go off."
- No picks submitted: "No cards in yet."
- Tournament status → "Close Tournament" (not "Mark Complete")
- Picks locked notice: "Picks are locked for this tournament."
- Picks confirmed: "Your picks are in — you can update them before the round locks."
- Score display: negative = red (birdie), positive = charcoal, 0 = "E" in charcoal/medium

## Architecture Summary

- **Brand:** App is called Poold, domain is getpoold.app (deployed on Netlify).
- **Auth:** Supabase magic link (`signInWithOtp`). `AuthCallback.jsx` redirects to `/dashboard` or `/join/:code` — no status gate. `ProtectedRoute` checks `user` exists; `AdminRoute` checks `profile.role === 'admin'`. Profiles auto-approve on creation via DB trigger. Join code + magic link is the access gate.
- **Picks:** Auto-confirmed on submit (`status: 'confirmed'`). Re-submit deletes existing picks and re-inserts. RLS enforces integrity (one pick per tier via a unique constraint; the tier must belong to the tournament and the player must exist in that tier) and privacy (you only see other participants' picks after lock/lock_time).
- **Prize pool (optional):** `tournaments.stake_amount` (numeric) + `payout_structure` (jsonb — ordered % per placement, enforced to sum to 100 at creation). The leaderboard renders a `PrizePoolWidget`: total = `stake × participants`, distributed by placement in whole dollars (rounding remainder folded into 1st). Omitted when no stake is set.
- **Demo:** Public, no-auth showcase at `/demo` (routes outside `ProtectedRoute`). Runs entirely off a static fixture (`src/demo/demoData.js`) — a snapshot of public golf data with fabricated participants; it never imports `supabase` or touches the DB. `DemoProvider` holds the visitor's picks in memory only.
- **Shared UI:** Both the live pool pages and the demo render through the same components so they can't drift apart (change once, both update):
  - **Page shells** in `src/components/pool/` — `PoolHeader` (gradient leaderboard header + SportBadge), `PicksHeader` (gradient picks header), `PicksSubmitBar` (sticky submit), `StandingsCard` (section label + standings card shell), `WidgetGrid` (widget row). The pages pass their own data source (Supabase vs `src/demo/` fixture); the chrome is identical. When you restyle a pool/picks page, edit the shell — not the page.
  - **Leaf components** — leaderboard widgets + scorecard-expand standings in `src/components/leaderboard/`; the tier/player pick grid in `src/components/picks/TierPicker.jsx`.
  - Slash Golf data helpers (`parseScore`, `normalizeName`, `unwrapNumber`) are exported from `src/utils/scoring.js`; money/ordinal formatting in `src/utils/format.js`.
- **Leaderboard:** Cached in `leaderboard_cache` table. Poll via `poll-leaderboard` edge function (pg_cron on tournament weekends, or admin "Refresh Now" button — 3/tournament limit via `tournaments.manual_refresh_count`).
- **Scoring:** `src/utils/scoring.js`. Scores are relative-to-par strings (`"-12"`, `"E"`, `"+4"`, `"-"`). `parseInt` handles signed strings; `"E"` → 0; `"-"`/null → null (not started). WD and CUT both penalized +20 and remain in scoring pool. Best N of M scores count.
- **APIs:**
  - Slash Golf via RapidAPI — proxied through `slash-golf-proxy` edge function (field + live leaderboard). API key stored as Supabase secret, never exposed to browser.
  - The Odds API — called client-side (`VITE_ODDS_API_KEY`). Outright winner markets for majors only.
  - Open-Meteo — weather forecast, called client-side on TournamentDetail load. No key required.
  - Nominatim/OpenStreetMap — geocoding at tournament creation time only. No key required.
- **Weather:** `latitude`/`longitude` stored on `tournaments` table, fetched via Nominatim at creation. Open-Meteo forecast called client-side on TournamentDetail load. Omitted silently if `latitude`/`longitude` is null.
- **Cron schedule:** 4 pg_cron jobs (`poll-thursday` through `poll-sunday`), each polling every 20 minutes (`*/20 11-23`) during the 7am–8pm ET window. SQL lives in `supabase/cron-schedule.sql`. Run manually before tournament weekend, unschedule after.
- **Security:** Audit items C1–C4 are fixed (pick-integrity + pre-lock-privacy RLS, email column-locked with admin access via the `admin_list_users()` RPC, cron secret rotated out of source). **Still open:** the Odds API key is client-side (`VITE_ODDS_API_KEY`, exposed in browser) and should move to an edge function before public launch. Full remaining backlog (medium/low) lives in `docs/AUDIT.md`.

## Routes

| Route | Component | Access |
|---|---|---|
| `/` | Login.jsx | Public |
| `/auth/callback` | AuthCallback.jsx | Public |
| `/join/:code` | Join.jsx | Public |
| `/demo` | DemoLanding.jsx (in DemoLayout) | Public |
| `/demo/tournament` | DemoTournament.jsx | Public |
| `/demo/picks` | DemoPicks.jsx | Public |
| `/dashboard` | Dashboard.jsx | Protected |
| `/tournament/:id` | TournamentDetail.jsx | Protected |
| `/tournament/:id/picks` | Picks.jsx | Protected |
| `/admin` | AdminDashboard.jsx | Admin only |
| `/admin/create-tournament` | CreateTournament.jsx | Admin only |

## Leaderboard Page Layout (TournamentDetail.jsx)

- **Fairway header:** tournament name, course, status badge. Weather inline next to course name: `"78°F · Clear · 8mph"`. Omitted silently if `latitude`/`longitude` is null on the tournament row.
- **Full-width Pick'em Standings:** main hero section with scorecard-expand interaction (gold left-bar, tier circles, tabular scores, TOTAL row).
- **Widget row (below standings):** 3 columns normally, 4 when a prize pool is set. Components live in `src/components/leaderboard/Widgets.jsx`.
  - Prize Pool — total + per-placement payout (only when `stake_amount` is set; shown first)
  - PGA Leaders — top 5 players from leaderboard cache
  - Most Popular Picks — bar chart of confirmed picks by player
  - Tier Value — best score per tier
