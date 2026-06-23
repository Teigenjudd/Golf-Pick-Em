# Poold — Page Inventory & Design Reference

> "Drop your picks. Jump in the pool. Make it interesting."

This document describes every page in the app: what it does, what data it displays, what it needs to function, and design notes for the evolving multi-sport theme system.

---

## Theme System Overview

The app is moving toward two distinct visual registers:

**General theme** — used for auth, dashboard, and admin pages. Brand-level identity. Not sport-specific. Clean, confident, social. Works for any pool type.

**Sport theme** — applied at the tournament/pool level. Currently golf only (`fairway` greens, scorecard vocabulary, birdie/bogey scoring). As new sports are added, each will have its own theme that activates on the pool detail and picks pages only.

The dividing line: **does this page belong to a specific pool?** If yes → sport theme. If no → general theme.

---

## Pages

### 1. Login — `/`

**Theme:** General

**What it does:** Entry point for new and returning users. Sends a magic link to the supplied email. No passwords.

**Data available:**
- None — pure form, no server data displayed.

**Data submitted:**
- Email address → `supabase.auth.signInWithOtp()`

**What must be on this page:**
- Poold wordmark + tagline
- Email input + submit button
- "Check your email" confirmation state after send
- Link to the public `/demo` route for non-committed visitors

**Design notes:**
- Currently says "PICK'EM / PGA Golf · Friends Edition" — should be updated to Poold branding ("Make it interesting.")
- Centered layout on `bg-cream`. No header band.
- The wordmark is the only brand moment on this page — make it count.

---

### 2. Join — `/join/:code`

**Theme:** General (with tournament name as context)

**What it does:** Landing page for users arriving via a pool invite link. Two states: unauthenticated (shows magic link form), authenticated (shows tournament card with CTA).

**Data available:**
- `tournaments.name` — the pool name
- `tournaments.status` — open / locked / complete
- `tournaments.lock_time` — when picks lock
- `tournaments.pick_count` — how many picks per participant

**What must be on this page:**
- Poold wordmark (unauthenticated state)
- Join code confirmation (unauthenticated)
- Magic link form (unauthenticated)
- Tournament name + pick count (authenticated state)
- "You're invited" messaging
- CTA to make picks, or locked notice if applicable
- Link to dashboard

**Design notes:**
- The invite moment is a conversion event — someone just received a link from a friend. This is the "jump in the pool" entry point. Should feel exciting, not like a login page.
- Authenticated state should emphasize the pool name, not the mechanics.

---

### 3. Auth Callback — `/auth/callback`

**Theme:** General (utility)

**What it does:** Handles the magic link redirect from email. Checks session, redirects to dashboard or back to a join flow if a `?join=` query param is present.

**Data available:** None displayed.

**What must be on this page:** Loading state only (minimal).

---

### 4. Dashboard — `/dashboard`

**Theme:** General

**What it does:** Home base after login. Shows the user's active pools with pick status, and admin controls if applicable.

**Data available:**

*My Picks section:*
- `tournaments.id`, `name`, `status` (open / locked / complete)
- `tournaments.lock_time`
- `picks.status` — whether picks are confirmed or pending for each tournament

*Admin section (admin users only):*
- All tournaments: `id`, `name`, `status`, `join_code`
- Links to admin panel and create tournament flow

**What must be on this page:**
- App wordmark / nav bar
- "My Picks" section — list of pools the user has joined, each with:
  - Pool name (link to leaderboard)
  - Pick status indicator (confirmed / pending / closed)
  - Quick link to edit picks (if open)
  - Quick link to leaderboard
- Empty state when no pools joined
- Admin section (visible to admins only): list of all tournaments with status badges, links to admin panel and create flow
- Sign out

**Design notes:**
- Dashboard pool tiles are the primary surface for **sport-specific theming**. A golf pool tile should look like golf; a football pool tile should look like football. The list-row format currently has no sport flavor — this is the biggest opportunity.
- Consider a card-based layout where each pool tile shows the sport, status, and maybe a quick score snapshot.
- "Show closed" toggle exists — closed pools should feel clearly archived.

---

### 5. Tournament Detail (Leaderboard) — `/tournament/:id`

**Theme:** Sport-specific (currently: Golf)

**What it does:** The main event. Shows the pick'em standings for a pool in progress, alongside context widgets. This is the page everyone watches during a tournament weekend.

**Data available:**

*Tournament row:*
- `name` — pool name set by admin
- `pga_name` — official PGA event name (e.g. "The Masters Tournament")
- `course_name` — host course (e.g. "Augusta National Golf Club")
- `status` — open / locked / complete / draft
- `scores_to_keep` — how many of N picks count toward total
- `pick_count` — total picks per participant
- `join_code` — for admin copy-invite
- `lock_time`
- `latitude` / `longitude` — for weather
- `stake_amount` — optional buy-in per participant
- `payout_structure` — ordered array of payout percentages by placement

*Picks (all confirmed participants):*
- `user_id`, `player_id`, `player_name`, `tier_id`
- `profiles.display_name` — participant name
- `tiers.tier_number`, `tiers.label`

*Leaderboard cache:*
- `leaderboardRows[]` — each with `playerId`, `firstName`, `lastName`, `position`, `total` (relative-to-par string), `status` (cut/wd/active), `thru`
- `roundId` — current round number
- `status` — "In Progress" / "Official"

*Weather (Open-Meteo, client-side):*
- Temperature (°F), wind speed (mph), weather code → description

**What must be on this page:**

*Header:*
- Back to dashboard
- Course name (hero) with PGA event name as sub-label in accent color
- Weather inline: `78°F · Clear · 8mph`
- Round badge: `Round 2 · In Progress`
- Last updated timestamp
- Share invite button (admin only)

*Pick'em Standings (full width, main content):*
- Each participant row: rank, display name, "you" tag, total score
- Expandable scorecard: gold left bar, tier circles, player name, score per pick, WD/CUT badges, "thru" hole, TOTAL row
- Empty states: draft / no leaderboard data yet / no cards in
- Picks-hidden notice before lock

*Widget row (below standings, 3–4 columns):*
- **Prize Pool** (when stake set): total pot, per-placement dollar payouts
- **PGA Leaders**: top 5 from the real leaderboard
- **Most Popular Picks**: bar chart of most-picked players across all participants
- **Tier Value**: best current score for each tier

**Design notes:**
- This is the deepest sport-theme surface. Golf version: `fairway` header, scorecard vocabulary, `birdie` red for under-par, `gold` accent for rank 1 and the expanding scorecard bar.
- For future sports: this page's header, color scheme, and scoring vocabulary should all be theme-swapped based on the pool's sport type.
- The standings expand interaction (gold left-bar scorecard) is the signature UI moment of the product. Keep it.

---

### 6. Picks — `/tournament/:id/picks`

**Theme:** Sport-specific (currently: Golf)

**What it does:** The pick submission form. Users select one player per tier, then submit their card. Re-submittable until locked.

**Data available:**

*Tournament:*
- `name`, `status`, `lock_time`, `pick_count`

*Tiers (nested):*
- `tiers.id`, `tier_number`, `label`
- `tier_players.player_id`, `player_name`, `odds` (American format, optional)

*Existing picks (if re-editing):*
- `tier_id`, `player_id`, `player_name`, `status`

**What must be on this page:**
- Header with tournament name and "pick one from each tier" instruction
- Back navigation
- Locked notice (if picks are closed)
- Existing-picks notice with update CTA (if picks already submitted and still editable)
- **TierPicker** — the pick grid. Each tier shows: tier number, tier label, list of players with optional odds. Selecting a player highlights it.
- Submit / Update Picks button
- Success confirmation state (with link back to dashboard)
- Read-only view of picks when locked

**Design notes:**
- The tier picker is the core interaction mechanic. Currently: card list with name + odds. Opportunity to make this feel more like a draft/selection moment.
- Odds (`+1200`, `-150`) are American format from The Odds API, shown as context only — not interactive.
- For future sports: the "Tier 1 / Tier 2" labeling could become sport-specific (e.g. "QB / RB / WR" for NFL, "Singles / Doubles" for tennis).

---

### 7. Admin Dashboard — `/admin`

**Theme:** General

**What it does:** Operational control panel for admins. Three tabs: Tournaments, Participants, Users.

**Data available:**

*Tournaments tab:*
- All tournaments: `id`, `name`, `status`, `lock_time`, `join_code`, `created_at`, `manual_refresh_count`, `slash_golf_tournament_id`

*Participants tab:*
- Selectable tournament → participants with `display_name`, `email`, picks (player name + tier)

*Users tab:*
- All users: `id`, `display_name`, `email`, `role` (player / admin) — via `admin_list_users()` RPC

**What must be on this page:**

*Tournaments tab:*
- Tournament list with name, status badge, lock time
- Join link with copy button
- Lock / Re-open / Close Tournament controls
- Manual score refresh button (3 uses per tournament, requires `slash_golf_tournament_id`)
- Hide/show closed tournaments
- Link to create new tournament

*Participants tab:*
- Tournament selector
- Per-participant card: name, email, their picks by tier
- Remove participant (with confirm dialog)

*Users tab:*
- User list: name, email, role badge
- Toggle player ↔ admin role (cannot toggle yourself)

**Design notes:**
- Admin pages are purely functional. They should look clean and trustworthy, not sporty.
- The three-tab layout works. No strong redesign pull here — just bring it in line with the general Poold brand voice.

---

### 8. Create Tournament — `/admin/create-tournament`

**Theme:** General (admin utility)

**What it does:** Two-step admin flow for creating a new pool. Step 1 sets metadata and pulls field/odds data. Step 2 lets the admin drag players between tiers before saving.

**Data available / submitted:**

*Step 1 inputs:*
- Pool name (free text)
- Slash Golf tournament selection (live list from API)
- Odds market (optional — majors only, The Odds API)
- Picks per participant (number)
- Scores to keep (number)
- Lock time (datetime)
- Stake amount per player (optional, $)
- Payout structure (array of %, must sum to 100 when stake set)

*Step 1 fetched data:*
- Tournament field (player list with IDs) via Slash Golf
- Odds by player name via The Odds API
- OWGR rankings via Slash Golf
- Course location → lat/lon via Nominatim geocoding

*Step 2:*
- Drag-and-drop tier grid (auto-built from odds/OWGR, adjustable by admin)
- Each player card shows: name, odds, OWGR rank

**What must be on this page:**
- Step indicator
- Step 1: all form fields, odds-unavailable warning state with retry/continue options
- Step 2: tier grid with draggable player cards, Back and Create Tournament buttons
- Error states throughout

**Design notes:**
- This is an infrequently used admin-only flow. Functional clarity beats visual polish.
- The drag-and-drop tier builder is power-user territory — keep it dense and informative (name + odds + rank visible).

---

### 9. Demo Landing — `/demo`

**Theme:** General (with golf pool tile)

**What it does:** Public, no-auth showcase. Looks like the dashboard but populated with a static fixture dataset. Lets visitors see the product before signing up.

**Data available:**
- `demoTournament` — static fixture with name, course, pick count, status
- `demoParticipants` — fabricated participant picks
- Participant count derived from above

**What must be on this page:**
- Poold wordmark
- Tagline / brief description
- A single pool tile (the demo golf tournament) — same design as a dashboard tile
- "Sign in to play for real" CTA

---

### 10. Demo Tournament — `/demo/tournament`

**Theme:** Sport-specific (Golf), static data

**What it does:** The full leaderboard experience using static fixture data. The visitor's own picks (if submitted via Demo Picks) appear in the standings as "You."

**Data available:**
- All of `demoTournament` (name, course, pick_count, scores_to_keep, stake_amount, payout_structure)
- `demoParticipants` + visitor's in-memory picks (from DemoContext)
- `demoLeaderboardData` — frozen PGA leaderboard snapshot

**What must be on this page:**
- Same layout as TournamentDetail
- Pick CTA banner if visitor hasn't picked yet, or "Your card is in" + edit link if they have
- Full standings with visitor highlighted as "You"
- All four widgets (or three if no prize pool)

---

### 11. Demo Picks — `/demo/picks`

**Theme:** Sport-specific (Golf), static data

**What it does:** The pick selection experience using static tier/player data from the demo fixture. Selections are held in DemoContext (memory only, no DB).

**Data available:**
- `demoTournament` — name, pick_count
- `demoTiers` — static tiers with players and odds

**What must be on this page:**
- Same layout as Picks
- TierPicker with demo players
- Submit drops visitor into the demo standings as "You"

---

## Shared Components

### `Standings` — `src/components/leaderboard/Standings.jsx`

The pick'em standings list with the signature scorecard-expand interaction. Presentational only — takes pre-computed `standings` array, `currentUserId`, `pickCount`.

Per-row data: `user_id`, `display_name`, `rank`, `total_score`, `picks[]` (each with `player_name`, `score`, `used_in_total`, `withdrawn`, `cut`, `thru`).

### `TierPicker` — `src/components/picks/TierPicker.jsx`

The player selection grid. Takes `tiers[]` (each with `id`, `tier_number`, `label`, `tier_players[]`), `selections` map, and `onSelect` callback.

### Widgets — `src/components/leaderboard/Widgets.jsx`

Four self-contained widgets. All presentational, all conditionally render if data is absent:

| Widget | Props | Output |
|---|---|---|
| `PrizePoolWidget` | `stakeAmount`, `participantCount`, `payoutStructure` | Total pot + per-placement payouts |
| `PGALeadersWidget` | `leaderboardData` | Top 5 players by score |
| `MostPopularWidget` | `picks` | Bar chart of most-picked players |
| `TierValueWidget` | `picks`, `leaderboardData` | Best live score per tier |

---

## Future Multi-Sport Design Direction

The goal is a system where sport-specific visual theming is contained to the pool detail page (`TournamentDetail`) and the picks page (`Picks`), so adding a new sport means adding a new theme — not rewriting pages.

**What would need to change per sport:**
- Header color scheme and vocabulary (course name → stadium name → arena name)
- Score display format (relative-to-par → points → time, etc.)
- Tier labels (Tier 1/2/3 → QB/RB/WR, or custom names)
- Widget copy ("PGA Leaders" → sport-appropriate label)
- Scoring logic in `src/utils/scoring.js`

**What stays the same across sports:**
- Standings structure (rank, name, score, expandable card)
- TierPicker mechanic (select one per group)
- Dashboard tile format
- Auth, admin, and join flows
