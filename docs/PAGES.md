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

**What it does:** Entry point for new and returning users. Sends a sign-in link to the supplied email ("Email me a sign-in link" — renamed from "Send Magic Link" 2026-07-17, PR #36; Supabase's own dashboard template is still labeled "Magic Link" internally). No passwords. `/` is gated by a `RootRoute` guard in `src/App.jsx`: while the session is resolving it renders nothing (avoids a login-form flash), an already-authenticated visitor is redirected straight to `/dashboard`, and everyone else sees the form below. (Fixed 2026-07-16 — previously `/` always rendered `<Login />`, even for signed-in visitors.)

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

**What it does:** Landing page for users arriving via a pool invite link. Two states: unauthenticated (shows sign-in link form), authenticated (shows an invite card with CTA). **Sport-dispatch shipped 2026-08-13** (`docs/CFB_UI_PLAN.md` §5, part of the CFB sport-dispatch layer): once authenticated, the page first calls the sport-neutral `getPoolByCode(code)` (`src/lib/pools.js`) to learn the pool's `sport_id`, then branches.

**Data available:**
- Neutral lookup: `getPoolByCode(code)` — `pools.id/name/status/lock_time` + `events.sport_id`, via two plain `public.*` queries (no golf/cfb schema access)
- **Golf branch** (`sport_id === 'golf'`, untouched): `getPoolViewByCode(code)` — `tournaments.name`, `status`, `lock_time`, `pick_count`
- **CFB branch** (`sport_id === 'cfb'`): `getCfbPool(pool.id)` (season_year, lock_time — the pool's `lock_time` doubles as the season join cutoff) + `getCfbParticipants(pool.id)` for a player count
- Unknown/null `sport_id`, or no matching non-draft pool → the existing "Invalid code" error state

**What must be on this page:**
- Poold wordmark (unauthenticated state)
- Join code confirmation (unauthenticated)
- Magic link form (unauthenticated)
- **Golf invite card** (byte-identical to before): tournament name + pick count, "You're invited" messaging, "Make Your Picks →" CTA (or a locked notice), link to dashboard
- **CFB invite card:** CFB `SportBadge` (`sm`) + pool name preview, sport line `"College Football Pick'em · Season {year}"`, a compact format explainer ("Every week: pick 5 to cover the spread, double-down your best one, and take an underdog to win outright. Points stack all season."), `"{N} players in"` social proof, and a **"Join & make picks →"** CTA. Unlike golf — which records `pool_participants` membership implicitly at pick-submit — CFB's `cfb_submit_week_picks` RPC requires membership to already exist, so this CTA **explicitly joins first**: it calls `joinPool(pool.id, user.id)` (`src/lib/pools.js`, an idempotent upsert onto `public.pool_participants` under the "join self" RLS policy) and only then navigates to `/cfb/pool/:id/picks`. A join error (e.g. RLS rejection) surfaces inline and the user stays on the card.
- **CFB join-cutoff closed state:** if `now > cfbPool.lock_time` (the season's Week-1 lock has passed), the card shows "This pool's season has already started — joining is closed." instead of a join button — no mid-season entry, per `docs/CFB_FORMAT.md`.
- Link to dashboard
- Consent line + `Footer` (shared, unchanged — the consent line lives on the sign-in-link form, before sport is known)

**Link preview (the part that happens before the page loads):** `/join/*` is served through the `join-preview` **Netlify edge function** (`netlify/edge-functions/join-preview.js`), which rewrites the page's Open Graph tags *before the HTML is sent*. This is why it can't be done in React: iMessage, WhatsApp, Slack, Discord, and Twitter fetch the URL and read `<head>` **without running JavaScript**, so an SPA that paints the page client-side is invisible to them — the link would unfurl as a bare URL.

The function reads the pool through `public.pool_preview(code)`, a `SECURITY DEFINER` RPC returning a fixed projection (pool name, organizer, course, pick count, lock time, badge) so the edge never needs a service-role key. The card reads:

> **{Organizer} invited you to {pool name}**
> {N} picks. No app, no password, no download. Tap the link and you're in.

Image is `public/og-default.png` (1200×630), generated by `npm run og` from `scripts/og/card.html`. **The organizer's display name appears on this card** — one more reason names are user-chosen and not derived from email. Lookup failure, a bad code, or a timeout all fall back silently to the default tags in `index.html`; a preview card is never worth breaking the join page over.

**Design notes:**
- The invite moment is a conversion event — someone just received a link from a friend. This is the "jump in the pool" entry point. Should feel exciting, not like a login page.
- Authenticated state should emphasize the pool name, not the mechanics.
- Testing the preview: **use a fresh join code every time.** iMessage caches a preview per URL, so a link it has already seen as a bare URL will keep looking bare no matter what ships.

---

### 3. Auth Callback — `/auth/callback`

**Theme:** General (utility)

**What it does:** Handles the sign-in link redirect from email. Advances as soon as a **session** exists (on `user`, not `profile`) — then routes: a brand-new account with a known-empty `display_name` goes to `/welcome?next=…`; everyone else goes to the dashboard, or back to a join flow if a `?join=` query param is present. If the profile row hasn't loaded yet (the signup-trigger race), it heads to the destination and lets `ProtectedRoute` enforce the display-name gate once the row arrives. If auth resolves with no session at all, it bounces to `/`. (Fixed 2026-07-15, PR #27 — it used to block on `profile` and could spin forever; backlog C1.)

**Data available:** None displayed.

**What must be on this page:** Loading state ("Signing you in…"), plus a **"Back to sign in" fallback after ~8s** so the spinner can never dead-end silently.

---

### 4. Welcome — `/welcome`

**Theme:** General (auth)

**What it does:** First-run display-name capture. The signup trigger leaves `profiles.display_name` NULL on purpose, and `ProtectedRoute` bounces any signed-in user without one here — so this is the wall every new account hits before it can reach a pool. Saving the name redirects to `?next=` (validated to be an app-internal path) or `/dashboard`.

**Data available:** `profiles.display_name` (writing it).

**What must be on this page:**
- POOLD wordmark + tagline (same centered auth layout as Login / Join)
- Card: "What should we call you?" + one text input + submit
- Explanation that this name is what the rest of the pool sees
- Validation errors (2–24 characters, enforced again by a DB `CHECK`)

**Design notes:**
- No skip link. An unnamed account would otherwise show up on a leaderboard as "Participant."
- Not wrapped in `ProtectedRoute` — it is where `ProtectedRoute` sends people, so wrapping it would loop.

---

### 5. Profile ("You") — `/profile`

**Theme:** General

**What it does:** The "You" tab in the bottom nav. Lets an existing user change their display name; also the sign-out surface. Deliberately shows **no email address** — see the note under Dashboard.

**Data available:**
- `profiles.display_name`, `profiles.display_name_set_at`, `profiles.role`

**What must be on this page:**
- Avatar (initials) + current display name + role label (Player / Admin)
- Display name field + Save (disabled until the value actually changes; "Saved." confirmation)
- Gold callout when `display_name_set_at` is NULL — i.e. the user still has the name that was auto-derived from their email before onboarding existed
- Sign out
- `BottomNav` with the "You" tab active

---

### 6. Dashboard — `/dashboard`

**Theme:** General

**What it does:** Home base after login. Shows the user's active pools with pick status, and admin controls if applicable. **CFB tile shipped 2026-08-13** (`docs/CFB_UI_PLAN.md` §4, part of the CFB sport-dispatch layer): golf pool tiles are unchanged; CFB pool tiles render after them in the same "Your Active Pools" list.

**Data available:**

*My Picks section (golf):*
- `tournaments.id`, `name`, `status` (open / locked / complete)
- `tournaments.lock_time`
- `picks.status` — whether picks are confirmed or pending for each tournament

*CFB tiles:* `getMyCfbPools(userId)` (`src/lib/cfb.js`) — one row per CFB pool the user belongs to, batched (no per-pool queries): pool name, `season_year`, the resolved **current week** (first not-`weekIsLocked` week, else the last), this user's card status for that week (`cfb.picks` count for `(pool_id, user_id, week_id)` — 6 → `card-in`, else `needs-picks`; no current week → `preseason`), this user's `public.pool_standings` rank/total, and a participant count.

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
- **CFB pool tiles** (`CfbPoolTile`, `src/components/cfb/`), rendered after the golf tiles: CFB `SportBadge` (`md`) on a Varsity Navy sport strip, an eyebrow word for the tile's state, pool name (links to `/cfb/pool/:id`), a season line (`"Season {year} · N player(s)"`), a **week-status chip** — `Week N · Needs picks — locks {formatLockLabel(lock_time)}` (primary CTA, brick fill, → picks) / `Week N · Card in ✓` (→ picks, still editable) / `Week N · Locked` (→ pool; see Design notes on the deferred "· Live" variant) / `Week N · Graded` (→ pool) / `Season starts soon` (no current week, no link) — and, when a standings row exists, a `"#{rank} · {total} pts"` season snapshot.
- Empty state when no pools joined (now gated on **both** `myTournaments` and `cfbPools` being empty)
- Admin section (visible to admins only): list of all tournaments with status badges, links to admin panel and create flow
- Sign out
- `BottomNav` with the "Pools" tab active — carries the display-name nudge (see Shared Components)

**Design notes:**
- **No email addresses on this or any other player-facing page.** Display names used to be seeded from the email local-part, which published it to every pool member; the signup trigger no longer does that, and `/welcome` + the nudge exist to retire the names that were. `/admin` is the only screen that shows email, via the admin-gated `admin_list_users()` RPC.
- Dashboard pool tiles are the primary surface for **sport-specific theming**. A golf pool tile should look like golf; a football pool tile should look like football. The CFB tile is the first pool tile in a non-golf colorway.
- Each tile now carries the event's `SportBadge` (`md`, 40×46) in its per-tournament colors, so the tiles already read as *which* event, not just which sport — the Masters tile is green, The Open's is navy, CFB tiles are Varsity Navy. Extending that flavor to the rest of the row (score snapshot, sport-tinted chrome) is the remaining opportunity for golf tiles; CFB's already carries it end to end.
- Consider a card-based layout where each pool tile shows the sport, status, and maybe a quick score snapshot.
- "Show closed" toggle exists for golf pools — closed pools should feel clearly archived. CFB tiles don't participate in that toggle yet (no CFB "closed pool" concept built); they always render.
- **Known gap:** `docs/CFB_UI_PLAN.md` §4 specifies a `Week N · Locked · Live` chip variant while a locked week has an in-progress game. `getMyCfbPools` doesn't fetch per-game status (it would add a query per pool to a list endpoint), so the tile currently shows `Locked` for both the mid-game and between-games cases — a deliberate scope cut for this PR, not a bug.

---

### 7. Tournament Detail (Leaderboard) — `/tournament/:id`

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
- `badge_config` — the event's badge art (`{ line1, line2, bg, border }`), rendered by `SportBadge` at `lg`

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

### 8. Picks — `/tournament/:id/picks`

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

### 9. Admin Dashboard — `/admin`

**Theme:** General

**What it does:** Operational control panel for admins. Three tabs: Tournaments, Participants, Users. A `AdminSportSwitcher` (Golf|CFB segmented control) sits at the top of the body, above the tabs, linking over to `/admin/cfb` — the golf/CFB admin panels are still two separate pages, but now navigable as one admin area with a sport dimension.

**Data available:**

*Tournaments tab:*
- Golf tournaments only: `id`, `name`, `status`, `lock_time`, `join_code`, `created_at`, `manual_refresh_count`, `slash_golf_tournament_id` — `getAdminPools()`/`getAllPools()` (`src/lib/golf.js`) filter out CFB pools (by presence of a `golf.event_details` row / by `events.sport_id`) so they don't leak into this list and link to `/tournament/:id`, which can't load a CFB pool
- Leaderboard polling on/off state — via the `admin_polling_status()` RPC

*Participants tab:*
- Selectable tournament → participants with `display_name`, `email`, picks (player name + tier)

*Users tab:*
- All users: `id`, `display_name`, `email`, `role` (player / admin) — via `admin_list_users()` RPC

**What must be on this page:**

*Tournaments tab:*
- **Leaderboard polling on/off** card (`PollingControl`) at the top of the tab — a global toggle that arms/disarms the four `poll-*` pg_cron jobs via `admin_start_leaderboard_polling()` / `admin_stop_leaderboard_polling()`, showing current state from `admin_polling_status()`. Replaces the old ritual of hand-pasting `cron.schedule`/`unschedule` SQL. Shows a green dot + "On — pulling scores every 20 min, Thu–Sun" when armed. Any admin sees it today; a future commissioner role is refused server-side (the RPCs re-check `is_admin()`).
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
- Toggle player ↔ admin role (cannot toggle yourself) — writes via the `admin_set_role(target_user, new_role)` RPC, **not** a direct `profiles` update: `profiles.role` is column-locked against the client (A1). The RPC re-checks `is_admin()` server-side and refuses a self-role-change, so "cannot toggle yourself" is now an enforced invariant rather than a UI convention.
- Inline error line if the role change is refused (previously the update failed silently)

**Design notes:**
- White sticky nav: `← Dashboard | POOLD Admin` on the left, "Sign out" text button on the right. Same nav pattern as CreateTournament.
- Page background is `bg-sand`. Tab switcher uses `bg-[#EAD8C4]` container with `rounded-[10px]`, active tab is `bg-white`.
- Tournament/participant/user cards use `rounded-[14px]` / `rounded-[13px]` with `border-[#EAD8C4]`.
- Join link field uses `bg-sand` display (not a `<code>` element), with a Copy button that turns green/fairway when copied.

---

### 9a. Create Pool (sport chooser) — `/admin/create`

**Theme:** General (admin utility)

**What it does:** The sport-agnostic entry point for creating a pool (`src/pages/admin/CreatePoolChooser.jsx`). The Dashboard's "+ New" link and the Admin Dashboard's "+ New Pool" quick-list link both route here instead of hardwiring golf, so adding a pool doesn't assume a sport. Each card leads into that sport's existing create flow — this page adds no new creation logic of its own.

**Data available:** None from the DB — a static list of two sports, each with its real `SportBadge` config (golf's fixed `{PGA / GOLF}` badge; CFB's `cfbBadge(currentYear)`).

**What must be on this page:**
- Sticky nav: `← Dashboard | POOLD New Pool`
- "Create a pool" heading + "Pick a sport to set one up." subtitle
- Two cards (Golf → `/admin/create-tournament`, CFB → `/admin/cfb/create-pool`), each showing the sport's `SportBadge`, a title, and a one-line blurb

**Design notes:**
- Same card language as the rest of general admin (`bg-white border border-[#EAD8C4] rounded-[16px]`).
- Adding a third sport is one more row in `CreatePoolChooser`'s `SPORTS` array plus its create route — no other change needed here.

---

### 10. Create Tournament — `/admin/create-tournament`

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
- Odds by player name via The Odds API — outcomes are unioned across **every** US bookmaker the API returns (books differ in field depth, so one book alone under-covers the field) and each player keeps the **median** posted price. Median is an order statistic, so the stored value is always a price a book actually posted and a single stale line can't shift a player's tier.
- Odds and OWGR are joined onto the field **by name** (the two APIs share no player ID), via the layered resolver in `src/utils/playerMatch.js` — normalize → surname + first-initial fallback → alias table. An ambiguous fallback is refused rather than guessed, so a player may legitimately show `N/A`; that is recoverable by dragging, whereas a wrong price would silently mis-tier the field. See `docs/NAME_MATCHING.md`.
- OWGR rankings via Slash Golf
- Course location → lat/lon via Nominatim free-text search (`courseName, city, state`, falling back to a town-level `city, state` query if the specific query returns nothing)

*Step 2:*
- Drag-and-drop tier grid (auto-built from odds/OWGR, adjustable by admin)
- Each player card shows: name, odds, OWGR rank

**What must be on this page:**
- Step indicator
- Step 1: all form fields, odds-unavailable warning state with retry/continue options
- Step 2: tier grid with draggable player cards, Back and Create Tournament buttons
- Error states throughout

**Design notes:**
- White sticky nav: `← Admin | POOLD Create Tournament` on the left, step circle indicator + "of 2" on the right. 3px progress bar immediately below nav (50% at step 1, 100% at step 2).
- Page background is `bg-sand`. Step 1 opens with `"Set it up."` heading (Barlow Condensed 800, 30px), then a `bg-white rounded-[16px] border-[1.5px] border-[#EAD8C4]` form card.
- All inputs: `rounded-[11px] border-[1.5px] border-[#EAD8C4] bg-[#FFFAF6] py-3 px-[14px] text-[14px]`. Labels: 11px Inter semibold, uppercase, tracking-[.12em], warm-400.
- Step 2 heading: `"Set the tiers."` (same font), subtitle in warm-400. Tier cards: `border-[2px] border-[#EAD8C4] rounded-[13px]`. Player cards: `bg-white border border-[#EAD8C4] rounded-[8px]`. Tier list area: `bg-sand`.
- The drag-and-drop tier builder is power-user territory — keep it dense and informative (name + odds + rank visible).

---

### 10b. Privacy Policy — `/privacy` and Terms of Use — `/terms`

**Theme:** General (utility)

**What they do:** Static legal documents. **Public on purpose** — a policy you have to sign in to read is not a policy. Both render through the shared `LegalPage` shell (`src/pages/legal/LegalPage.jsx`), which applies all typography from the wrapper so the documents themselves stay close to plain prose and are easy to edit.

**Data available:** None — no Supabase call, no auth check.

**What must be on these pages:**
- Privacy: what we collect (email for sign-in-link auth, display name, picks, host logs), that **email is never shown to other players**, service providers (Supabase, Netlify), that sports-data API calls carry no user data, deletion on request, cookies, 18+, contact.
- Terms: what Poold is; **that Poold never processes, holds, escrows, or transfers money** (stakes are a calculator, settling is between participants, we are not a party to it); accounts and display-name conduct; that third-party score data can be wrong and the organizer has the final say; fair play; as-is warranty; limitation of liability; Utah governing law; contact.

**Design notes:**
- The money clause is the point of the whole exercise. If a future feature ever *does* touch money, the Terms must change before it ships.
- Contact address is `tljvllc@gmail.com` (interim mitigation, 2026-08-10, PR #38 —
  `privacy@getpoold.app` has no inbound MX and bounces; BACKLOG A7's permanent
  inbound-forwarder fix is still open).

---

### 10c. CFB Admin Index — `/admin/cfb`

**Theme:** General (admin utility) — no sport colorway, per the CFB build plan's rule that
CFB's colorway only applies to the two player-facing sport pages (§10f/§10g).

**What it does:** Entry point for the CFB (college football) admin surface. Lists every CFB pool
and links to creating a new one. Kept as its own index (not folded into `AdminDashboard`'s
Tournaments tab) because CFB pools have a fundamentally different admin object — a season of
weekly windows, not a single lock. An `AdminSportSwitcher` (Golf|CFB) sits at the top of the
page, linking back to `/admin`.

**Data available:**
- All CFB pools via `getAdminCfbPools()` (`src/lib/cfb.js`): `id`, `name`, `status`, `lock_time`, `join_code`, `created_at`, `season_year` (joined from `cfb.event_details`)
- CFB polling on/off state — via the `admin_cfb_polling_status()` RPC

**What must be on this page:**
- Sticky nav: `← Dashboard | POOLD Admin` — same pattern as `AdminDashboard`'s nav (previously `← Admin | POOLD College Football`; both admin headers now read consistently)
- `AdminSportSwitcher` (`active="cfb"`, `size="lg"`) directly below the nav
- **CFB polling on/off** card (`CfbPollingControl`) at the top of the page, above the pool list — the CFB analogue of `AdminDashboard`'s `PollingControl`. A global toggle that arms/disarms three `cfb-*` pg_cron jobs via `admin_start_cfb_polling()` / `admin_stop_cfb_polling()` (`supabase/migrations/20260814000000_admin_cfb_polling_controls.sql`), showing current state from `admin_cfb_polling_status()`. The three jobs, all windowed to the Aug–Jan season: `cfb-lines` (hourly slate/spread refresh via `poll-cfb-lines`), `cfb-scores` (every 2 min during game hours on every in-season day, not just Thu–Sun, so the Monday CFP championship and weekday bowls also get live scores — via `poll-cfb-scores`), and `cfb-grade` (twice-daily grading backstop via `grade-cfb-week`, catching any week the live poller didn't see go final). Shows a green dot + "On — slates, live scores, and grading are running on schedule" when armed. Same `is_admin()`-gated-RPC pattern as golf — the `cfb-*` job-name prefix keeps this toggle from ever touching golf's `poll-*` jobs, and vice versa. The migration is not yet applied to prod and the toggle has not yet been flipped on — see `docs/CFB_BUILD_PLAN.md` PR9.
- "+ New CFB Pool" link → `/admin/cfb/create-pool`
- Pool list: name, season year, join code, status badge (open/locked/complete/draft — same badge vocabulary as golf's tournament list)
- Empty state: "No CFB pools yet. Create one to seed a season of weekly slates."
- Each row links to `/admin/cfb/pool/:id`

**Design notes:**
- Reuses `AdminDashboard`'s badge color system (`bg-fairway/10 text-fairway` open, `bg-gold/20 text-gold` locked, `bg-warm-200 text-warm-400` complete/draft) and the `bg-sand`/`#EAD8C4`-border card language from `CreateTournament`.
- `CfbPollingControl` reuses `PollingControl`'s exact card styling (`bg-white border border-[#EAD8C4] rounded-[14px]`, green/warm status dot, birdie-red "Turn off" vs fairway "Turn on" button) — same idiom, no CFB colorway (this page is general admin register).

---

### 10d. Create CFB Pool — `/admin/cfb/create-pool`

**Theme:** General (admin utility)

**What it does:** Single-step form to stand up a whole CFB season pool at once — unlike golf's
create-once tournament, this seeds a full range of weekly windows (`cfb.weeks`) with a recurring
lock cadence. `createCfbPool()` (`src/lib/cfb.js`) writes `public.events`(sport `cfb`) →
`public.pools` → `cfb.event_details` → one `cfb.weeks` row per week in the range, each lock
stepped 7 days from the first-week lock; rollback deletes the event (cascades) on any failure,
mirroring `createGolfPool`. Shipped 2026-08-13, PR #46.

**Data submitted:**
- Pool name, season year, first week / last week (defines the `cfb.weeks` range seeded)
- First-week lock time — **required**: doubles as the season join cutoff, and every seeded week's lock steps off it. (Made required in this PR's review-fix commit; originally optional, which could silently produce a pool that never locks.)
- Optional stake amount + payout structure (same shared `pools.stake_amount`/`payout_structure` convention as golf, validated to sum to 100%)

**What must be on this page:**
- Sticky nav: `← CFB Admin | POOLD New CFB Pool`
- Form fields above; disabled submit until name, season, a valid week range, and the first-week lock are all filled
- Payout builder (add/remove placement rows, running % total, only shown when a stake is set)
- On success, navigates to `/admin/cfb/pool/:id` (the new pool's ops page)

**Design notes:**
- Same input/label/card styling as `CreateTournament` (`rounded-[11px] border-[1.5px] border-[#EAD8C4] bg-[#FFFAF6]` inputs, sand page background).
- Field is labeled "First-Week Lock," not "Week 1 Lock" — a pool can start at any week (e.g. `startWeek=4`), so the field always sets whichever week is seeded first, not literally week 1 (senior-review nit, fixed in this PR).

---

### 10e. CFB Pool Ops — `/admin/cfb/pool/:id`

**Theme:** General (admin utility)

**What it does:** The recurring weekly admin surface golf never needed — where a CFB season is
run week by week after creation. Slates and spreads are pulled **automatically** by the
hourly `poll-cfb-lines` poller (games appear as CFBD posts lines, roughly 1-2 weeks before
kickoff) — there is no per-week manual import. Live in-game scores are pulled by
`poll-cfb-scores` (normally a ~1-minute cron once armed). Grading — turning final scores into
graded picks and season standings — is admin-triggered from this page (**PR9a, shipped**;
cron-armed grading is a separate later step). Manual per-week import shipped 2026-08-13
(PR #46); replaced by the automated poller 2026-08-13 (PR #47, `cfb-auto-lines-poller`); grading
+ finalize-override controls shipped 2026-08-13 (PR9a, `feat/cfb-admin-grading-ops` — see
`agents/pm/DECISIONS.md`).

**Data available:**
- Pool + season year via `getCfbPool(poolId)`
- Weeks with game counts via `getCfbPoolWeeks(eventId)`: `id`, `week_number`, `label`, `lock_time`, `status`, `game_count`
- CFBD usage via `getCfbdUsage()`: current month's `cfbd_calls` against the shared 30,000/mo Tier-2 cap

**What must be on this page:**
- Sticky nav: `← CFB Admin | POOLD Season Ops`
- Pool name, season, join code header; CFBD usage meter (calls / cap) top-right
- Auto-slate banner: "Slates & spreads update automatically every hour" + note that games appear as lines post (~1-2 wks out) and each game's spread freezes at kickoff, plus two buttons — "Refresh scores" (`refreshCfbScores()`, triggers `poll-cfb-scores` on demand — the manual analogue of the live poller) and "Refresh slates now" (`refreshCfbSlates()`) — each with its own inline result line
- Per-week card: label, status badge (scheduled/open/locked/graded), game count ("N games loaded"), editable lock-time input + "Save lock" button (via `updateWeekLockTime`) — no per-week import button
- Once a week's `lock_time` has passed and it isn't yet `graded`, the card also shows:
  - **"Auto-fill missing cards"** (`autofillCfbWeek(weekId)` → `cfb.autofill_week` RPC, pure-DB, no CFBD call) — drops a random valid card (5 ATS + 1 underdog-eligible underdog, no double-down) for every participant who never submitted; reports how many were filled, or that everyone already has a card. A manual override only — an always-on `cfb-lock-autofill` pg_cron job already does this automatically ~10 min after lock (`docs/CFB_BUILD_PLAN.md` PR10).
  - **"Grade week"** (`gradeCfbWeek(weekId)` → `grade-cfb-week` with `{ week_id }`) — grades every final game's picks and recomputes season standings; reports picks scored and whether the week fully finished. The edge function refuses to grade a week before its `lock_time` (a defense-in-depth guard — the UI already only shows the button post-lock).
  - **"Finalize as-is"** (`finalizeCfbWeek(weekId)` → `grade-cfb-week` with `{ week_id, finalize: true }`), styled as the override (birdie-red outline, not the primary brand button) — the escape hatch for a week stuck on a game that will never report final (cancelled/postponed): grades whatever DID finish normally, scores every other game's picks as a no-contest push (0 points — `cfb.picks.result` has no "void" value), and forces the week to `graded` so it stops showing as due. Gated behind a `window.confirm` naming the week.
  - An inline result/error line per week for whichever action last ran
- Empty state if no weeks were seeded

**Design notes:**
- Same card language as `CfbAdmin`'s pool list (`bg-white border border-[#EAD8C4] rounded-[14px]`).
- Slate freshness is no longer a per-week admin action — a game either has a line yet or it doesn't, and that's driven by CFBD's own posting schedule, not admin timing.
- Grade week / Finalize as-is only appear post-lock and pre-graded, so there's no way to grade a week whose picks are still open.

---

### 10f. CFB Pool Detail — `/cfb/pool/:id`

**Theme:** Sport-specific (CFB — "Varsity Navy": navy `#101C3D→#0A1229` gradient header,
brick `#D6291B` accent, green `#2E8F4F` cover/win, brick/cream/brick rib stripe under the
header. Constants in `src/theme/cfb.js`.)

**What it does:** CFB's pool leaderboard page — the CFB counterpart to TournamentDetail.
**Phase 1 (theme + shell + placeholder body) shipped 2026-08-13, PR #48. Phase 2 (the
real body) shipped 2026-08-13, PR #49** (`docs/CFB_BUILD_PLAN.md` PR7; design brief
`docs/CFB_UI_PLAN.md` §6/§6a). Linked from the Dashboard's `CfbPoolTile` (§6 above) and
from the CFB Join card once a locked/graded week routes back here — the Phase 4
sport-dispatch wiring (`docs/CFB_BUILD_PLAN.md` PR8).

**IA decision (locked):** the **season-cumulative standings are the hero and stay ranked
by season total** (`public.pool_standings`, written by `grade-cfb-week`). A **week
selector** (`CfbWeekSelector`, rendered inside the navy `PoolHeader` band) scopes the
scorecard-expand and the widget row to one chosen week — it does **not** re-rank the
season standings. Selection lives in a `?week=N` query param; on load it resolves to
that week if valid, else the first non-graded week, else the last.

**Data available** (`src/lib/cfb.js`, all read-only):
- `getCfbPool(poolId)` — pool row + `stake_amount`/`payout_structure` (added this PR so the Prize Pool widget can render)
- `getCfbPoolWeeks(eventId)` — the season's `cfb.weeks`
- `getCfbStandings(poolId)` — `public.pool_standings` rows (`user_id, rank, total`); empty until the first week is graded
- `getCfbParticipants(poolId)` — every pool member + `display_name`, so standings show everyone even pre-season
- `getCfbWeekGames(weekId)` — the selected week's `cfb.games`, including the live in-game blob and current score/status
- `getCfbWeekPicks(poolId, weekId)` — picks for the selected week; RLS returns only the viewer's own picks before that week locks, everyone's confirmed picks after

**What's on the page:**
- **Header** (`PoolHeader`, CFB theme): badge, pool name, `"{season} · College Football"`, player count, a round badge (`Week N · Live/Locked/Final/Open`), and — as the header's `children` — `CfbWeekSelector` (a horizontal segmented control of weeks) plus a "Live — scores update as games go final" line when any selected-week game is `in_progress`. Admins get a "Share invite" button that copies the join link.
- **Season Standings hero** (`CfbStandings`, inside `StandingsCard`): one row per participant — rank, name, "YOU" tag, season total (leader in the CFB accent), and a subtitle showing the selected week's state (`"+N this week"` / `"No card · Week N"` / hidden). Row expands (brick left-bar, the scorecard-expand pattern) into the selected week's 6 picks via the shared `CfbCardRows` (`src/components/cfb/CfbCardRows.jsx`, also used by the read-only Picks view — §10g): slot marker (1–5 ATS, ★ = double-down, 🐕 = underdog), the pick line (`"Michigan −7.5"`), a live/final/scheduled game line, a result pill (Cover/Push/Miss/Win/Loss), a double-down row's `DD → +4` effective-line chip, points, an `Auto` badge if auto-filled, and a `TOTAL · Week N` row. The page grades the selected week via the shared `shapeCard` transform (`src/utils/cfbCard.js`) off each game's live/final score — display-only; the server grader stays authoritative. Only `status === 'final'` games award points; an in-progress game shows its live score but stays ungraded so points don't flip-flop mid-game.
- **Widget row** (`CfbWidgets`, inside `WidgetGrid`): Prize Pool (reused `PrizePoolWidget`, shown first when `stake_amount` is set) → This Week's Slate (always visible: matchup, spread or live/final score, kickoff time) → Weekly Points, Most-Backed Teams, Underdog Board. **The last three are hidden until the selected week locks**, replaced by a "Weekly points, most-backed teams, and the underdog board reveal when Week N locks" note — before lock, RLS only returns the viewer's own picks, so those widgets would otherwise read as a 1-player pool (`agents/pm/DECISIONS.md`, 2026-08-13).

**States:**
- **Pre-season** (no `pool_standings` rows yet): standings still list every participant at 0, with a "Season kicks off Week N — standings fill in as weeks are graded" note.
- **No players joined yet:** "No players have joined yet."
- **Weeks not seeded yet:** "Weeks for this season haven't been set up yet."
- **Selected week has no card for a player:** "No card in for Week N." (own card, or after lock) vs. "Picks are hidden until Week N locks." (someone else's, before lock).
- **Loading** / **Pool not found** (non-CFB pool id, or bad id — `getCfbPool` returns `null`).

**Known trade-off (flagged in senior review, founder-confirmed, kept):** the season total
(server) and the weekly expand/Weekly-Points total (recomputed client-side) are two
independent code paths for the same math. They agree once the server's live poller
re-grades a just-finalized game (normally within one poll cycle), but for that short
window the weekly number can lead the season number. Deliberate trade for instant
"points as games go final" feedback instead of waiting on the cron; guarded against
silent drift by the JS/TS scoring parity test suite. See `agents/pm/DECISIONS.md`,
2026-08-13.

---

### 10g. CFB Weekly Picks — `/cfb/pool/:id/picks`

**Theme:** Sport-specific (CFB — Varsity Navy, same tokens as 10f)

**What it does:** CFB's weekly card-builder page — the CFB counterpart to Picks. Builds a
full 6-pick weekly card — 5 ATS picks on 5 distinct games, an optional double-down flagged
on one of them, and a mandatory underdog pick on a separate 6th game — with live validity,
then submits via `cfb.cfb_submit_week_picks` (the real gate; it validates the whole card
and freezes each pick's `locked_spread` server-side). Re-submittable until the week locks.
Once a week locks, the page instead renders a frozen **read-only card** (`CfbCardReadonly`,
`src/components/cfb/CfbCardReadonly.jsx`) for locked/submitted, locked/auto-filled, and
graded weeks — graded client-side off each game's score with the shared `shapeCard`
transform (`src/utils/cfbCard.js`), and rendered with the same `CfbCardRows` row renderer
CfbPoolDetail's scorecard-expand uses (§10f), so the two views can't drift. This read-only
view is reachable by direct/bookmarked URL; the Dashboard's `CfbPoolTile` and the pool page
route a locked/graded week to the pool-detail expand instead (kept as the primary card
surface). Also linked from a new joiner's CFB Join card ("Join & make picks →" CTA).

**Data available (`src/lib/cfb.js`):**
- `getCfbPool(poolId)` — pool + season year; `null` → "Pool not found."
- `getCfbPoolWeeks(eventId)` — this season's `cfb.weeks` (`week_number`, `label`,
  `lock_time`, `status`), used to resolve the target week
- `getCfbWeekGames(weekId)` — the target week's `cfb.games` (`home_team`/`away_team` +
  conferences, `kickoff_at`, `home_spread`, `underdog_team`, `underdog_spread`, and the
  live/final score used to grade the read-only card)
- `getCfbWeekPicks(poolId, weekId)` — RLS returns only the viewer's own picks before lock,
  everyone's confirmed picks after; filtered client-side to `user.id` to seed the builder
  (editing an existing submission) or grade the read-only card
- `submitCfbWeekPicks(poolId, weekId, picks)` — the only write path; throws the RPC's
  friendly message on rejection (surfaced as-is)

**Target-week resolution:** honors a locked `?week=N` deep-link (so a bookmarked link to a
past week still resolves there), else the earliest still-open week (the one to build), else
— with nothing open — the most recent locked/graded week (`weekIsLocked(w)` — status
`locked`/`graded`, or `lock_time` in the past — exported from `src/lib/cfb.js` and shared
with CfbPoolDetail so the two pages can't drift). `null` only when the pool has no weeks at
all.

**What's on the page (open/editable card):**
- `PicksHeader` (CFB theme, `showBadge={false}`) — eyebrow is the week label (e.g.
  `WEEK 4`), title "Build your card", subtitle `Locks {lock_time}` (via
  `formatLockLabel` in `src/utils/cfbFormat.js` — full date + local timezone, e.g.
  "Locks Sat, Sep 21, 12:00 PM PDT")
- The slate as a scrollable list of `CfbGameCard`s (one per game, kickoff-ordered): two
  ATS team chips (tap to pick who covers, tap again to clear), a ★ double-down toggle
  (visible only once this game is an ATS pick, showing the live sign-general bonus copy
  from `doubleDownWinBy` — "win by N+" for a favorite, "cover — lose by ≤N or win" for an
  underdog pick), and a 🐕 "Take {underdog_team} outright" action showing the tier payout
  from `underdogTier`. Mutual exclusion is enforced both in the UI (disabled
  chips/actions) and again in the page's handlers: a game already the underdog pick can't
  take an ATS pick and vice versa; once 5 ATS slots are full, other games' ATS chips
  disable.
- Sticky `CfbCardTracker` bar: `ATS n/5 · DD n/1 · Dog n/1` (turns `CFB_THEME.positive`
  when the card is valid), an active-violation warning (e.g. the same game used as both
  an ATS pick and the underdog), and the submit button ("Submit card →" / "Update card →"
  when editing an existing card, "Submitting…" while pending) — disabled until valid.
- Live validity is computed by the pure `cfbCardValidity`/`buildPicksPayload` helpers in
  `src/utils/cfbCard.js` (unit-tested, `src/utils/cfbCard.test.js`) — a client-side mirror
  of the RPC's whole-card rule, not a replacement for it.

**What's on the page (locked/read-only card):**
- Same `PicksHeader`, subtitle switches to "Locked" or "Final" (graded).
- A short notice above the card: `"Picks are locked for Week N."` / `"Week N is final."` /
  (auto-filled) `"You missed the deadline — a random card was filled in. No double-down
  this week."` — the auto-filled notice takes priority even on a graded week (a graded +
  auto-filled week's finality shows only via the "Final" subtitle, not the notice).
- `CfbCardReadonly`: brick left-bar card containing `CfbCardRows`' 6 pick rows + `TOTAL`
  row — slot marker, pick line, live/final/scheduled game line, result pill
  (Cover/Push/Miss/Win/Loss) once graded, a double-down row's `DD → +4` effective-line
  chip, an `Auto` badge if auto-filled, points.
- If the week locked and the player never got a card in (and none was auto-filled): a
  notice only ("You didn't get a card in this week.") — no `CfbCardReadonly`.
- "← Back to the pool" link.

**States:** loading · pool-not-found · no-weeks-yet ("The season schedule isn't up yet —
check back once Week 1 is posted.") · slate-not-posted ("This week's slate drops soon —
check back once the lines are posted.") · open-empty (fresh card) · open-editing (existing
card pre-filled from `getCfbWeekPicks`, "Your card's in — you can change it until it
locks.") · success-after-submit ("Your card is in for Week N." + link back to the pool) ·
submit error (RPC's thrown message shown inline, stays on the card) · locked/submitted ·
locked/auto-filled · graded · locked-with-no-card.

---

### 11. Demo Landing — `/demo`

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

### 12. Demo Tournament — `/demo/tournament`

**Theme:** Sport-specific (Golf), static data

**What it does:** The full leaderboard experience using static fixture data. The visitor's own picks (if submitted via Demo Picks) appear in the standings as "You."

**Data available:**
- All of `demoTournament` (name, course, pick_count, scores_to_keep, stake_amount, payout_structure)
- `demoParticipants` + visitor's in-memory picks (from DemoContext)
- `demoLeaderboardData` — frozen PGA leaderboard snapshot

**What must be on this page:**
- Same layout as TournamentDetail — renders through the shared `PoolHeader` / `StandingsCard` / `WidgetGrid` shells, so it tracks TournamentDetail automatically
- Pick CTA banner if visitor hasn't picked yet, or "Your card is in" + edit link if they have (banner is page-specific, not part of the shell)
- Full standings with visitor highlighted as "You"
- All four widgets (or three if no prize pool)

---

### 13. Demo Picks — `/demo/picks`

**Theme:** Sport-specific (Golf), static data

**What it does:** The pick selection experience using static tier/player data from the demo fixture. Selections are held in DemoContext (memory only, no DB).

**Data available:**
- `demoTournament` — name, pick_count
- `demoTiers` — static tiers with players and odds

**What must be on this page:**
- Same layout as Picks — renders through the shared `PicksHeader` / `PicksSubmitBar` shells, so it tracks Picks automatically
- TierPicker with demo players
- Submit drops visitor into the demo standings as "You"

---

## Shared Components

### Pool page shells — `src/components/pool/`

The full chrome of the leaderboard and picks pages is shared so the live pages and the
demo can't drift apart. Pages supply their own data source (Supabase vs `src/demo/`
fixture); the shells are identical. **When restyling a pool/picks page, edit the shell.**

`PoolHeader`, `PicksHeader`, `StandingsCard`, and `WidgetGrid` accept theme/content props
that default to golf's exact prior values, so golf renders byte-identically while CFB's
pages (§10f/§10g) pass their own.

| Shell | Props | Used by |
|---|---|---|
| `PoolHeader` | `backTo`, `backLabel`, `badgeConfig`, `subLabel`, `heroName`, `metaParts[]`, `roundBadge`, `updatedLabel`, `action`, `gradient` (default golf's fairway gradient), `accentColor` (default gold), `rib` (default null — segmented stripe under the header), `children` (default null) | TournamentDetail, DemoTournament, CfbPoolDetail |
| `PicksHeader` | `backTo`, `backLabel`, `badgeConfig`, `eyebrow`, `title`, `subtitle`, `gradient` (default fairway), `accentColor` (default gold), `rib` (default null), `showBadge` (default true), `children` (default null) | Picks, DemoPicks, CfbPicks |
| `PicksSubmitBar` | `selectedCount`, `totalCount`, `onSubmit`, `submitting`, `hasExistingPicks` | Picks, DemoPicks |
| `StandingsCard` | `children` (standings table or empty state), `label` (default `"Pick'em Standings"`) | TournamentDetail, DemoTournament |
| `WidgetGrid` | `leaderboardData`, `picks`, `stakeAmount`, `participantCount`, `payoutStructure`, `children` (when supplied, renders in place of golf's hardcoded widget set) | TournamentDetail, DemoTournament |

### `BottomNav` — `src/components/BottomNav.jsx`

The signed-in shell's sticky bottom nav (Pools · Board · You). Takes one prop, `active` (`'pools'` | `'you'`), and is rendered by Dashboard and Profile. "Board" is still a placeholder tab.

It also owns the **display-name nudge**: a small bubble that points at the "You" tab when `profiles.display_name_set_at` is NULL — meaning the user has never chosen a name and is still wearing the one derived from their email. It shows once, auto-hides after 9 seconds, and is suppressed for good once dismissed (`localStorage`) or once a name is saved (which stamps `display_name_set_at` via a DB trigger). The nudge lives here rather than at login because sessions persist — most users go straight to `/dashboard` and would never see a login-time prompt.

### `Footer` — `src/components/Footer.jsx`

Privacy · Terms · © line. Rendered on every page a user can land on: Login, Join, Welcome, Dashboard, Profile, and the legal pages themselves. Both sign-in-link forms (Login, Join) additionally carry a consent line above it — "By signing in you agree to our Terms and Privacy Policy" — so agreement attaches to an action, not just to a link in a footer.

### `SportBadge` — `src/components/SportBadge.jsx`

The tombstone/shield emblem that identifies the event. Rendered on the Dashboard pool tile (`md`), the Join page preview (`sm`), the Picks header (`pick`), and the leaderboard header (`lg`) — every page that shows a pool.

**Badge color is a system, not a constant.** Background and border are stored per tournament and encode **prestige + geography**: each major has a signature palette (The Open = navy `#162258` + gold `#C9A368`; the Masters = `#004F2D` + `#E8C872`), flagship/playoff events use dark grounds with prestige gold, and regular tour stops follow regional families (ocean, desert, southeast, midwest, international). The shape and the type never vary — only the two colors and the two words.

**Props:** `config` (the event's `badge_config`), `size` (`sm` | `md` | `pick` | `lg`).

**`badge_config` shape** — one object per event:

```json
{ "line1": "THE", "line2": "OPEN", "bg": "#162258", "border": "#C9A368" }
```

- Line 1 is the abbreviation (≤4 chars: sponsor initials, location code, or iconic short name) and **always renders cream**.
- Line 2 is the event/city code (`OPEN`, `CHP`, `INV`, `CLS`, `CUP`, or a 3-letter city) and **always renders in the badge's own border color**.
- **Font size is derived, not stored.** `SportBadge` scales line 1 by its character count (≤2 → full size, 3 → ×0.86, 4 → ×0.77, 5+ → ×0.64) so a long abbreviation can never overflow the shield.
- Absent config falls back to a generic green "GO / GOLF" badge. A legacy branch still renders the pre-2026-07 array shape, so a half-applied migration degrades rather than blanking out.

**Where the data comes from:** all 48 tournaments are seeded in `public.pga_event_badges`, keyed by Slash Golf `tourn_id`. `createGolfPool` **copies** the config onto `golf.event_details.badge_config` at pool creation — so editing the seed row afterward does *not* change an existing pool; update that event's `badge_config` directly. (This is also why `pga_event_badges` can't be dropped in migration Phase 5 — see BACKLOG F1.)

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

### CFB leaf components — `src/components/cfb/`

The CFB analogues of `Standings`/`Widgets` above, added 2026-08-13 (PR #49, CFB player UI
Phase 2). Presentational only — `CfbPoolDetail.jsx` does all the joining/grading and hands
each one a display-ready shape.

| Component | Props | Output |
|---|---|---|
| `CfbWeekSelector` | `weeks[]` (`id, week_number, label, status`), `selectedNumber`, `onSelect(week)` | Horizontal segmented week scroller, styled for the dark `PoolHeader` ground (rendered as the header's `children`) |
| `CfbStandings` | `entries[]` (`user_id, display_name, rank, total, week: {state, total, picks[]}`), `currentUserId`, `weekLabel` | Season-standings rows + the scorecard-expand (see §10f) — the expand's rows render via `CfbCardRows` |
| `CfbWidgets` | `games[]`, `weekPicks[]`, `weeklyPoints[]`, `weekLabel`, `locked`, `stakeAmount`, `participantCount`, `payoutStructure` | This Week's Slate, Weekly Points, Most-Backed Teams, Underdog Board, and the reused `PrizePoolWidget` — see §10f for the pre-lock hide rule |
| `CfbPoolTile` | `tile` (one row from `getMyCfbPools`) | The Dashboard's CFB pool tile — see §6 |
| `CfbCardRows` | `picks[]` (display-ready pick shape from `shapeCard`), `total`, `totalLabel` | The shared 6-pick-row + `TOTAL` renderer — slot marker, pick line, game line, result pill, `DD → +4` chip, points. Used by both `CfbStandings`' scorecard-expand and `CfbCardReadonly` so the two card views can't drift |
| `CfbCardReadonly` | `card` (`{total, picks[]}` from `shapeCard`), `notice`, `variant` (`'autofilled'` or `null`), `weekLabel` | The frozen read-only card on the Picks page once a week locks (§10g) — brick left-bar chrome around `CfbCardRows`, plus the notice line above it |

Display formatting shared by the picks page too: `src/utils/cfbFormat.js`
(`formatSpread`, `pickLine`, `formatKick`, `formatLockLabel`). Grading/shaping shared by
both card surfaces: `shapeCard` in `src/utils/cfbCard.js` (turns a user's stored picks +
the week's games into the display-ready graded shape `CfbCardRows` renders).

### Admin sport chrome — `src/components/admin/`

| Component | Props | Output |
|---|---|---|
| `AdminSportSwitcher` | `active` (`'golf'` \| `'cfb'`), `size` (`'sm'` default \| `'lg'`) | Golf\|CFB segmented control — the active segment links nowhere, the other links to that sport's admin panel (`/admin` or `/admin/cfb`). Rendered atop both `AdminDashboard` and `CfbAdmin` (`size="lg"`) so the two read as one admin area with a sport dimension. Adding a third sport is one row in its `SPORTS` array. |

### `src/lib/pools.js` — sport-neutral pool lookups

Added 2026-08-13 (CFB sport-dispatch layer). The first cross-sport seam: reads/writes
only `public.*` tables, never `golf()`/`cfb()`. Used by the two pages that must branch on
a pool's sport before they know which per-sport `lib` to hand off to.

| Function | Purpose |
|---|---|
| `getPoolByCode(code)` | Looks up a non-draft pool by join code and returns it with `sport_id` (joined from `public.events`), so `Join.jsx` can branch. `null` if no such pool. |
| `joinPool(poolId, userId)` | Idempotent upsert onto `public.pool_participants` (the "join self" RLS policy). Golf records membership implicitly at pick-submit; CFB's `cfb_submit_week_picks` RPC requires membership to already exist, so `Join.jsx`'s CFB branch calls this explicitly before routing to the picks page. |

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
