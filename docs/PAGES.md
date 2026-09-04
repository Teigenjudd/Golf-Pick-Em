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

**What it does:** Entry point for new and returning users. A "Sign-in link" / "Password" pill toggle switches between the two sign-in methods; "Sign-in link" is the default tab and unchanged behavior ("Email me a sign-in link" — renamed from "Send Magic Link" 2026-07-17, PR #36; Supabase's own dashboard template is still labeled "Magic Link" internally). The "Password" tab signs in with email + password directly (no email round-trip) and carries a helper line pointing new/passwordless users back to the link tab, then to `/profile` to set one. `/` is gated by a `RootRoute` guard in `src/App.jsx`: while the session is resolving it renders nothing (avoids a login-form flash), an already-authenticated visitor is redirected straight to `/dashboard`, and everyone else sees the form below. (Fixed 2026-07-16 — previously `/` always rendered `<Login />`, even for signed-in visitors.)

**Data available:**
- None — pure form, no server data displayed.

**Data submitted:**
- Sign-in link tab: email address → `supabase.auth.signInWithOtp()`
- Password tab: email + password → `supabase.auth.signInWithPassword()` (success path relies on `AuthContext`/`RootRoute` to redirect — no navigation code on this page)

**What must be on this page:**
- Poold wordmark + tagline
- Sign-in link / Password mode toggle
- Sign-in link tab: email input + submit button, "Check your email" confirmation state after send
- Password tab: email input (`autoComplete="username"`) + password input (`autoComplete="current-password"`), submit button, and a line offering the link tab for anyone without a password set yet
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

### 5. Profile — `/profile`

**Theme:** General

**What it does:** Account settings — reached from the header avatar on Dashboard (there is no bottom nav; see Shared Components). Lets an existing user change their display name and set/replace their password; also the sign-out surface. Deliberately shows **no email address** — see the note under Dashboard.

**Data available:**
- `profiles.display_name`, `profiles.display_name_set_at`, `profiles.role`, `profiles.avatar_url`

**Data submitted:**
- New password + confirm → `savePassword()` (`src/lib/profile.js`, wraps `supabase.auth.updateUser({ password })`). No "current password" field — being signed in via either auth method is sufficient authorization; this doubles as the password-reset path (forgot it → sign in with a link → set a new one here).
- New avatar image → tap the avatar to open a file picker (jpeg/png/webp, 5MB cap client-checked by `validateAvatarFile` and again server-side by the bucket); picking a file opens `AvatarCropModal` (see Shared Components) for a circular crop before upload — `uploadAvatarForUser(user.id, blob)` uploads the cropped JPEG blob to Supabase Storage, then `saveAvatarUrl` writes `profiles.avatar_url` (`src/lib/profile.js`). "Uploading…" / inline error text while it runs.

**What must be on this page:**
- Avatar (photo if `avatar_url` is set, else initials — shared `Avatar` component) with a small tap-to-upload "+" badge, current display name, role label (Player / Admin)
- Display name field + Save (disabled until the value actually changes; "Saved." confirmation)
- Gold callout when `display_name_set_at` is NULL — i.e. the user still has the name that was auto-derived from their email before onboarding existed
- Password card: new-password + confirm-password fields (both `autoComplete="new-password"`), client-side min-length check (`PASSWORD_MIN = 8`) and match check before submit, "Saved." confirmation, save button disabled while empty/saving
- Sign out

---

### 6. Dashboard — `/dashboard`

**Theme:** General

**What it does:** Home base after login. Shows the user's active pools with pick status. No bottom nav — the header carries a "+" add-a-pool button and a `ProfileMenu` avatar. **CFB tile shipped 2026-08-13** (`docs/CFB_UI_PLAN.md` §4, part of the CFB sport-dispatch layer): golf pool tiles are unchanged; CFB pool tiles render after them in the same "Active Pools" list.

**Data available:**

*My Picks section (golf):*
- `tournaments.id`, `name`, `status` (open / locked / complete)
- `tournaments.lock_time`
- `picks.status` — whether picks are confirmed or pending for each tournament

*CFB tiles:* `getMyCfbPools(userId)` (`src/lib/cfb.js`) — one row per CFB pool the user belongs to, batched (no per-pool queries): pool name, `status`, `season_year`, the resolved **current week** (first not-`weekIsLocked` week, else the last), this user's card status for that week (`cfb.picks` count for `(pool_id, user_id, week_id)` — 6 → `card-in`, else `needs-picks`; no current week → `preseason`), this user's `public.pool_standings` rank/total, and a participant count.

**What must be on this page:**
- App wordmark; header "+" button (opens the Join sheet for a player, the Add-a-pool chooser sheet for an admin) and `ProfileMenu` avatar (shared `Avatar` component — the user's uploaded photo if `profiles.avatar_url` is set, else initials)
- "Active Pools" section label with an open-pool count pill — list of pools the user has joined, each rendered by the shared `PoolCard` (open/locked/complete state, pick status or rank+score, leaderboard/picks CTAs)
- **CFB pool tiles** (`CfbPoolTile`, `src/components/cfb/`), rendered after the golf tiles: CFB `SportBadge` (`md`) on a Varsity Navy sport strip, an eyebrow word for the tile's state (`COMPLETE` when the pool is closed), pool name (links to `/cfb/pool/:id`). Open states (needs-picks, card-in) now match golf's tile layout: a status row (colored dot + `"Week N card is in."` / `"Week N picks aren't in yet."` + `"Locks {formatLockLabel(lock_time)}"`) plus two CTA buttons — primary `"Leaderboard →"` to the pool detail page, secondary `"Edit picks"` (existing card) / `"Make picks"` (no card yet) to the picks page. `Week N · Locked` / `Week N · Graded` / `Season starts soon` states are unchanged (link to pool, or no link). A closed pool's tile dims (`opacity`) and shows `COMPLETE`, mirroring golf. Clicking "Edit picks" opens a confirm dialog (`"Your picks on games that haven't started will be reset... Anything already underway stays locked in as-is."`) before navigating to `/cfb/pool/:id/picks?reset=1` — see §10g.
- Dashed "+ Join another pool" card (player) / "+ Join or Create Pool" card (admin) — opens the same sheet as the header "+" button
- Empty state when no pools joined (gated on **both** `myTournaments` and `cfbPools` being empty)
- Closed pools: a `CollapsibleRow` ("Closed pools", count pill, chevron) — expanding renders each closed pool through the same `PoolCard`, directly below the row (not interleaved above it, so collapsing never requires scrolling)
- Sign out

**Design notes:**
- **No email addresses on this or any other player-facing page.** Display names used to be seeded from the email local-part, which published it to every pool member; the signup trigger no longer does that, and `/welcome` + the nudge exist to retire the names that were. `/admin/users` is the only screen that shows email, via the admin-gated `admin_list_users()` RPC.
- Dashboard pool tiles are the primary surface for **sport-specific theming**. A golf pool tile should look like golf; a football pool tile should look like football. The CFB tile is the first pool tile in a non-golf colorway.
- Each tile now carries the event's `SportBadge` (`md`, 40×46) in its per-tournament colors, so the tiles already read as *which* event, not just which sport — the Masters tile is green, The Open's is navy, CFB tiles are Varsity Navy. Extending that flavor to the rest of the row (score snapshot, sport-tinted chrome) is the remaining opportunity for golf tiles; CFB's already carries it end to end.
- No admin-only pool list on this page anymore — admins reach `/admin` and `/admin/create` via the header "+" sheet (Join with code / Create pool) and the `ProfileMenu` dropdown (Profile / Admin), not an always-visible admin section. This also removes the old `getAllPools()` call from Dashboard.
- "Closed pools" toggle covers both sports: `myTournaments`/`cfbPools` are each split into open/closed by `status`, and the collapsible section's count and rows merge both (a closed CFB pool renders via `CfbPoolTile`, dimmed, alongside golf's `PoolCard` rows). The Active-Pools count pill only counts open pools of both sports.
- **Known gap:** `docs/CFB_UI_PLAN.md` §4 specifies a `Week N · Locked · Live` chip variant while a locked week has an in-progress game. `getMyCfbPools` doesn't fetch per-game status (it would add a query per pool to a list endpoint), so the tile currently shows `Locked` for both the mid-game and between-games cases — a deliberate scope cut, not a bug.

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

**What it does:** Operational control panel for golf pools — now a single pools list, not a tab set (the old Participants and Users tabs are gone; see §9b for Users). Wrapped in the shared `AdminShell` (`src/components/admin/AdminShell.jsx`), which renders the sticky nav, an `AdminSportSwitcher` (Golf|CFB) linking to `/admin/cfb`, and a "Users & Settings →" link to `/admin/users` — the same shell CFB's admin index (§10c) uses, so the two read as one admin area with a sport dimension.

**Data available:**
- Golf tournaments only: `id`, `name`, `status`, `lock_time`, `join_code`, `created_at`, `manual_refresh_count`, `slash_golf_tournament_id` — `getAdminPools()` (`src/lib/golf.js`) filters out CFB pools (by presence of a `golf.event_details` row) so they don't leak into this list and link to `/tournament/:id`, which can't load a CFB pool
- Leaderboard polling on/off state — via the `admin_polling_status()` RPC

**What must be on this page:**
- **Leaderboard polling on/off** card (`PollingControl`) at the top — a global toggle that arms/disarms the four `poll-*` pg_cron jobs via `admin_start_leaderboard_polling()` / `admin_stop_leaderboard_polling()`, showing current state from `admin_polling_status()`. Shows a green dot + "On — pulling scores every 20 min, Thu–Sun" when armed. Any admin sees it today; a future commissioner role is refused server-side (the RPCs re-check `is_admin()`).
- Pool list with name, status badge, lock time
- Join link with copy button
- Lock / Re-open / Close Pool controls
- Manual score refresh button (3 uses per pool, requires `slash_golf_tournament_id`)
- Show/hide closed pools ("All pools are closed." when every pool is complete and the toggle is collapsed)
- Link to create new pool (`/admin/create`)

**Design notes:**
- Chrome (nav, sport switcher, "Users & Settings" link, `max-w-3xl` container) is owned by `AdminShell` now, not this page — edit the shell to restyle it, not `AdminDashboard.jsx`.
- Page background is `bg-sand`. Pool cards use `rounded-[14px]` with `border-[#EAD8C4]`.
- Join link field uses `bg-sand` display (not a `<code>` element), with a Copy button that turns green/fairway when copied.
- **Lost capability, not yet replaced:** there is no in-app way to view a golf pool's individual participant cards or remove a participant (the old Participants tab did both). `getPoolPicks`/`removePoolParticipant` (`src/lib/golf.js`) still exist for a future rebuild. See `agents/pm/DECISIONS.md` (2026-08-15).

---

### 9a. Create Pool (sport chooser) — `/admin/create`

**Theme:** General (admin utility)

**What it does:** The sport-agnostic entry point for creating a pool (`src/pages/admin/CreatePoolChooser.jsx`). The Dashboard's "+" sheet and the Admin Dashboard's "+ New Pool" link both route here instead of hardwiring golf, so adding a pool doesn't assume a sport. Each card leads into that sport's existing create flow — this page adds no new creation logic of its own.

**Data available:** None from the DB — a static list of two sports, each with its real `SportBadge` config (golf's fixed `{PGA / GOLF}` badge; CFB's `cfbBadge(currentYear)`).

**What must be on this page:**
- Sticky nav: `← Dashboard | POOLD New Pool`
- "Create a pool" heading + "Pick a sport to set one up." subtitle
- Two cards (Golf → `/admin/create-tournament`, CFB → `/admin/cfb/create-pool`), each showing the sport's `SportBadge`, a title, and a one-line blurb

**Design notes:**
- Same card language as the rest of general admin (`bg-white border border-[#EAD8C4] rounded-[16px]`).
- Adding a third sport is one more row in `CreatePoolChooser`'s `SPORTS` array plus its create route — no other change needed here.

---

### 9b. Admin Users — `/admin/users`

**Theme:** General

**What it does:** Sport-agnostic role management, pulled out of the golf-only Admin Dashboard so it isn't buried under a golf-specific tab (roles aren't scoped to a sport). Reached from either admin panel's "Users & Settings" link. Wrapped in `AdminShell` with `activeSport={null}` — both sport segments render unselected, and the shell shows "Users & Settings" as a plain label instead of a link to itself.

**Data available:**
- All users: `id`, `display_name`, `email`, `role` (player / admin), `avatar_url` — via `admin_list_users()` RPC

**What must be on this page:**
- User list: tap-to-upload avatar (photo or initials, shared `Avatar` component), name, email, role badge
- Toggle player ↔ admin role (cannot toggle yourself) — writes via the `admin_set_role(target_user, new_role)` RPC, **not** a direct `profiles` update: `profiles.role` is column-locked against the client (A1). The RPC re-checks `is_admin()` server-side and refuses a self-role-change, so "cannot toggle yourself" is an enforced invariant, not a UI convention.
- Per-row avatar upload — an admin can set **any** user's photo, not just their own: picking a file opens the same `AvatarCropModal` crop step as `/profile`, then `uploadAvatarForUser(userId, blob)` uploads the cropped JPEG to that user's Storage folder (the bucket's storage policies allow an admin to write any `{user_id}/` folder), then `admin_set_avatar_url(target_user, url)` RPC writes `profiles.avatar_url` (the plain column grant only allows self-writes)
- Inline error line if the role change or avatar upload is refused

**Design notes:**
- Same card language as the rest of general admin (`bg-white border border-[#EAD8C4] rounded-[13px]`).
- Room for future non-user settings under the same "Users & Settings" nav entry — the page/route name is deliberately broader than "Users" alone.

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
- Step 2: tier grid with draggable player cards, Back and "Create Golf Pool" buttons
- Error states throughout

**Design notes:**
- White sticky nav: `← Admin | POOLD New Golf Pool` on the left, step circle indicator + "of 2" on the right. 3px progress bar immediately below nav (50% at step 1, 100% at step 2). Field label is "Pool Name" (not "Tournament Name") to match CFB's create-pool wording.
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
and links to creating a new one. Kept as its own index (not folded into `AdminDashboard`'s pool
list) because CFB pools have a fundamentally different admin object — a season of weekly windows,
not a single lock. Wrapped in the shared `AdminShell` (same as `/admin` — see §9), which supplies
the sticky nav, the `AdminSportSwitcher` (`active="cfb"`), and the "Users & Settings" link.

**Data available:**
- All CFB pools via `getAdminCfbPools()` (`src/lib/cfb.js`): `id`, `name`, `status`, `lock_time`, `join_code`, `created_at`, `season_year` (joined from `cfb.event_details`)
- CFB polling on/off state — via the `admin_cfb_polling_status()` RPC

**What must be on this page:**
- **CFB polling on/off** card (`CfbPollingControl`) at the top of the page, above the pool list — the CFB analogue of `AdminDashboard`'s `PollingControl`. A global toggle that arms/disarms the three billable `cfb-*` pg_cron jobs via `admin_start_cfb_polling()` / `admin_stop_cfb_polling()` (`supabase/migrations/20260814000000_admin_cfb_polling_controls.sql`, rescoped by `supabase/migrations/20260815000000_fix_cfb_polling_toggle_scope.sql`), showing current state from `admin_cfb_polling_status()`. The three jobs, all windowed to the Aug–Jan season: `cfb-lines` (hourly slate/spread refresh via `poll-cfb-lines`), `cfb-scores` (every 2 min during game hours on every in-season day, not just Thu–Sun, so the Monday CFP championship and weekday bowls also get live scores — via `poll-cfb-scores`), and `cfb-grade` (twice-daily grading backstop via `grade-cfb-week`, catching any week the live poller didn't see go final). Shows a green dot + "On — slates, live scores, and grading are running on schedule" when armed. Same `is_admin()`-gated-RPC pattern as golf — the `cfb-*` job-name prefix used to (bug) collide this toggle with the always-on `cfb-lock-autofill` job; both RPCs now scope to the three billable job names by explicit list. All three jobs plus `cfb-lock-autofill` are armed and active in prod.
- "+ New Pool" link → `/admin/cfb/create-pool`
- Pool list: name, season year, join code, status badge (open/locked/complete/draft — same badge vocabulary as golf's pool list)
- Show/hide closed pools toggle ("Show closed (N)" / "Hide closed"), matching golf's `AdminDashboard` pattern — "All pools are closed." when every pool is complete and the toggle is collapsed
- Empty state: "No CFB pools yet. Create one to seed a season of weekly slates."
- Each row (name/season/join-code/status) links to `/admin/cfb/pool/:id`; below it, any not-yet-`complete` pool shows a "Close Pool" button (`setPoolStatus(id, 'complete')`, from the sport-neutral `src/lib/pools.js` seam) — a one-way flip, no re-open, mirroring golf's admin panel. Reloads the list on success.

**Design notes:**
- Chrome (nav, sport switcher, "Users & Settings" link) is owned by `AdminShell` now — edit the shell to restyle it, not this page. Reuses `AdminDashboard`'s badge color system (`bg-fairway/10 text-fairway` open, `bg-gold/20 text-gold` locked, `bg-warm-200 text-warm-400` complete/draft) and the `bg-sand`/`#EAD8C4`-border card language from `CreateTournament`.
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
- "First Week"/"Last Week" floor at 0, not 1 — CFBD has a real Week 0 (the pre-Labor-Day slate, e.g. TCU/UNC), and nothing in the `cfb.weeks` schema blocks it, so this form is the only gate. Validity checks the raw field isn't blank before coercing to a number (`startWeek !== '' && Number(startWeek) >= 0`), so an emptied field can't silently coerce to "Week 0" and pass.

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
- Manual **"Lock now" / "Unlock"** buttons next to "Save lock" (`adminLockWeek`/`adminUnlockWeek` → `cfb.admin_lock_week`/`cfb.admin_unlock_week` RPCs): a not-yet-`locked`/`graded` week shows "Lock now" (closes picks immediately regardless of `lock_time`, then auto-fills any missing cards, mirroring what the automatic cron does at the real deadline); a `locked` week shows "Unlock" (reopens it by resetting `status` back to `scheduled` — does not touch `lock_time` or existing picks). Both gated behind a `window.confirm`; "Unlock" additionally warns if `lock_time` is still in the past, since `cfb.process_locked_weeks()` will otherwise re-lock the week again on its next 10-minute pass. This is the escape hatch for a week stuck `locked` with a since-corrected, still-future `lock_time` — `status` only ever moves forward on its own (`updateWeekLockTime` never touches it), so without this an admin fixing the lock time couldn't reopen picks.
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
that week if valid, else the first non-graded week, else the last. A missing param is
distinguished from an explicit `?week=0` (checked via `!= null`, not truthiness) so it
doesn't coerce to Week 0 — a real, selectable week now that pools can start there.

**Data available** (`src/lib/cfb.js`, all read-only):
- `getCfbPool(poolId)` — pool row + `stake_amount`/`payout_structure` (added this PR so the Prize Pool widget can render)
- `getCfbPoolWeeks(eventId)` — the season's `cfb.weeks`
- `getCfbStandings(poolId)` — `public.pool_standings` rows (`user_id, rank, total`); empty until the first week is graded
- `getCfbParticipants(poolId)` — every pool member + `display_name`, so standings show everyone even pre-season
- `getCfbWeekGames(weekId)` — the selected week's `cfb.games`, including the live in-game blob and current score/status
- `getCfbWeekPicks(poolId, weekId)` — picks for the selected week; RLS returns only the viewer's own picks before that week locks, everyone's confirmed picks after

**What's on the page:**
- **Header** (`PoolHeader`, CFB theme): badge, pool name, `"{season} · College Football"`, player count, a round badge (`Week N · Live/Locked/Final/Open`), and — as the header's `children` — `CfbWeekSelector` (a week dropdown) plus a "Live — scores update as games go final" line when any selected-week game is `in_progress`. Admins get a "Share invite" button that copies the join link.
- **Picks-status banner**, between the header and Season Standings (mirrors golf's `TournamentDetail` banner): the viewer's own card state for the selected week — a checkmark + "Your card is in for {week}." / "Your picks are locked in." once submitted, or a dot + "You haven't made your picks for {week} yet." / "Picks are locked for this week." otherwise — with a "Make picks →" / "Edit picks →" link to `/cfb/pool/:id/picks?week=N` whenever the week isn't locked. Shows throughout an open pool, including an ungraded first week (no `preSeason` gate), same as golf.
- `StandingsCard`'s label row also hosts `CfbRulesButton` (via `StandingsCard`'s `action` prop) — a "How scoring works" trigger, hidden until clicked, opening a modal that explains the 3 pick types (ATS, double-down, mandatory underdog) with worked examples and the underdog tier/point table. Shared with §10g and both `/demo/cfb` pages so the copy can't drift.
- **Season Standings hero** (`CfbStandings`, inside `StandingsCard`): one row per participant — rank, name, "YOU" tag, season total (leader in the CFB accent), and a subtitle showing the selected week's state (`"+N this week"` / `"No card · Week N"` / hidden). Row expands (brick left-bar, the scorecard-expand pattern) into the selected week's 6 picks via the shared `CfbCardRows` (`src/components/cfb/CfbCardRows.jsx`, also used by the read-only Picks view — §10g): slot marker (1–5 ATS, ★ = double-down, 🐕 = underdog), the pick line (`"Michigan −7.5"`), a live/final/scheduled game line, a result pill (Cover/Push/Miss/Win/Loss), a double-down row's `DD → +4` effective-line chip, points, an `Auto` badge if auto-filled, and a `TOTAL · Week N` row. The page grades the selected week via the shared `shapeCard` transform (`src/utils/cfbCard.js`) off each game's live/final score — display-only; the server grader stays authoritative. Only `status === 'final'` games award points; an in-progress game shows its live score but stays ungraded so points don't flip-flop mid-game.
- **"This week's slate" link card**, between the standings and the widget row: pool-name-styled row → `/cfb/pool/:id/slate?week={selectedWeek}` ("See all games →"). Replaces the old always-visible slate widget below — the full game-by-game list is now its own page (§10h) so pool-detail stays standings-first.
- **Widget row** (`CfbWidgets`, inside `WidgetGrid`): Prize Pool (reused `PrizePoolWidget`, shown first when `stake_amount` is set) → Weekly Points, Most-Backed Teams, Underdog Board. **These three are hidden until the selected week locks**, replaced by a "Weekly points, most-backed teams, and the underdog board reveal when Week N locks" note — before lock, RLS only returns the viewer's own picks, so those widgets would otherwise read as a 1-player pool (`agents/pm/DECISIONS.md`, 2026-08-13).

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
  conferences, `home_team_logo`/`away_team_logo`, `kickoff_at`, `home_spread`,
  `underdog_team`, `underdog_spread`, and the live/final score used to grade the read-only
  card)
- `getCfbWeekPicks(poolId, weekId)` — RLS returns only the viewer's own picks before lock,
  everyone's confirmed picks after; filtered client-side to `user.id` to seed the builder
  (editing an existing submission) or grade the read-only card
- `submitCfbWeekPicks(poolId, weekId, picks)` — the only write path; throws the RPC's
  friendly message on rejection (surfaced as-is)

**Target-week resolution:** honors a locked `?week=N` deep-link (so a bookmarked link to a
past week still resolves there — a present-but-`0` param resolves to Week 0, distinguished
from a missing param via `!= null`, not truthiness), else the earliest still-open week (the
one to build), else — with nothing open — the most recent locked/graded week
(`weekIsLocked(w)` — status `locked`/`graded`, or `lock_time` in the past — exported from
`src/lib/cfb.js` and shared with CfbPoolDetail so the two pages can't drift). `null` only
when the pool has no weeks at all.

**Editing an existing card resets the not-yet-started part of it:** the Dashboard tile's
"Edit picks" button confirms first ("Your picks on games that haven't started will be
reset...") then navigates here with `?reset=1`, which clears the builder only for games
whose `kickoff_at` hasn't passed yet; a pick on a game that's already kicked off carries
forward pre-filled and locked (`CfbGameCard`'s `started` state — see below), same as the
non-reset path. Rationale: `cfb_submit_week_picks` re-freezes `locked_spread` from the
*current* game row for every pick in the resubmitted payload, not just the changed ones —
silently pre-filling old not-yet-started picks could look unchanged on screen while
actually re-locking them to a line that's since moved, so those are still cleared. But a
full wipe would be rejected outright by the RPC's per-game kickoff lock (added
`supabase/migrations/20260817000000_cfb_game_kickoff_lock.sql`) the moment any game in the
week had started — a started game's slot in a resubmit must exactly match what's on file
— so those slots are carried forward instead of cleared. The saved card in the DB is
untouched until a full valid card is resubmitted (`reset=1` only clears local builder
state). Direct navigation without the param still pre-fills the whole card, for a
first-time visit to an in-progress card. `startedGameIds` (`gameHasStarted` in
`src/utils/cfbCard.js`) is the client-side mirror of the RPC's kickoff-lock check.

**What's on the page (open/editable card):**
- `PicksHeader` (CFB theme, `showBadge={false}`) — eyebrow is the week label (e.g.
  `WEEK 4`), title "Build your card", subtitle `Locks {lock_time}` (via
  `formatLockLabel` in `src/utils/cfbFormat.js` — full date + local timezone, e.g.
  "Locks Sat, Sep 21, 12:00 PM PDT")
- `CfbRulesButton` — a "How scoring works" trigger, right-aligned above the filter bar (same shared component as §10f)
- `CfbGameFilterBar` (`src/components/cfb/CfbGameFilterBar.jsx`): search box (team name),
  conference filter chips, and a sort control (kickoff / spread) — **view-only**, applied
  on top of the full games list via `filterAndSortGames`/`conferencesInPlay`
  (`src/utils/cfbGameFilters.js`, shared with the Slate page, §10h) and never touches
  pick state or the submit payload, which stay keyed off the unfiltered game list. "No
  games match your filters." when the filtered list is empty.
- The (filtered/sorted) slate as a list of `CfbGameCard`s: two ATS team chips (each
  carrying its team's crest via `TeamCrest`, from `cfb.games.home_team_logo`/
  `away_team_logo` — silently omitted when a team has no logo on file) — tap to
  pick who covers, tap again to clear — plus, on any game with a real underdog side
  (`underdog_team` set — pick'em/spread-0 games are excluded, they have no underdog
  side), a third inline chip — dashed border, the underdog's crest (falls back to 🐕
  when it has no logo on file), team name + `"Underdog · {tier} pts"`
  (`"1 pt"` for tier 1) payout from `underdogTier`, points styled larger/bolder/green so
  it reads as points and not a spread — the same size/row as the two ATS chips, wrapping
  to its own line on a narrow card. Kickoff shows as `formatKickWithDate` (adds the MM/DD date,
  since a week's slate spans multiple days). A ★/☆ "Double-down" toggle appears once a
  game is an ATS pick, showing the **effective line** as a preview (`"Georgia -5.5"`, via
  `effectiveDoubleDownLine()` + `pickLine()`) whether or not it's flagged yet — not just
  after. Mutual exclusion is enforced both in the UI (disabled chips) and again in the
  page's handlers: a game already the underdog pick can't take an ATS pick and vice
  versa; once 5 ATS slots are full, other games' ATS chips disable. Once a game's
  kickoff has passed (`started` prop, from `startedGameIds`), all three of its chips and
  its double-down toggle disable and the kickoff label switches to "Started" — an
  already-selected chip stays visibly selected, just not clickable; the three pick
  handlers in `CfbPicks.jsx` also refuse a started game's `gameId` as a belt-and-suspenders
  guard against a stale click.
- `CfbCardTracker`, redesigned from a one-line stat string into a "Card progress" panel:
  a progress bar (`N of 6 set`) + three stat tiles (ATS Picks, Double Down, Underdog,
  each highlighting `CFB_THEME.positive` once complete), and the submit button
  ("Submit card →" / "Update card →" when editing, "Submitting…" while pending) below
  the panel — disabled until valid. An active-violation warning still renders above it.
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
locks.") · open-reset (`?reset=1` — not-yet-started games clear, started games carry
forward locked, "Your picks on games that haven't started were reset... Anything already
underway stays locked in as you had it." banner instead of the editing notice) ·
success-after-submit ("Your card is in for Week N." + link back to the pool) ·
submit error (RPC's thrown message shown inline, stays on the card) · locked/submitted ·
locked/auto-filled · graded · locked-with-no-card.

---

### 10h. CFB Slate — `/cfb/pool/:id/slate`

**Theme:** Sport-specific (CFB — Varsity Navy, same tokens as §10f/§10g)

**What it does:** Read-only "this week's slate" page — every game in the selected week,
its matchup, kickoff (`formatKickWithDate`), and spread or live/final score, with the
same search/conference/sort toolbar as the picks builder. Split out of the pool-detail
page's old always-visible slate widget (`SlateWidget`, now deleted from
`CfbWidgets.jsx`), which had gotten long enough to dominate that page; pool-detail now
links here via a small "This week's slate → See all games" row (§10f) instead of
inlining the list. No pick state — pure viewing, no writes.

**Data available (`src/lib/cfb.js`):**
- `getCfbPool(poolId)`, `getCfbPoolWeeks(eventId)` — pool + season's weeks
- `getCfbWeekGames(weekId)` — the selected week's `cfb.games`, including live/final score

**Week resolution:** honors `?week=N` if valid (missing vs. explicit `?week=0` disambiguated
the same way as `CfbPoolDetail`, since Week 0 is a real week now), else the first non-graded
week, else the last — same order as `CfbPoolDetail`'s `selectedWeek`. Has its own `CfbWeekSelector`
dropdown in the header (shared component, §Shared Components — used here and on
pool-detail).

**What's on the page:**
- `PicksHeader` (CFB theme, `showBadge={false}`), title "This Week's Slate", subtitle =
  pool name, `CfbWeekSelector` as the header's `children`
- `CfbGameFilterBar` (search / conference / sort — `src/utils/cfbGameFilters.js`, same
  module the picks page uses, §10g)
- One row per (filtered/sorted) game: away @ home conferences + kickoff, matchup, and
  either a "Live" badge + score (in-progress/final) or the favorite's line
  (`favoriteLine()`, `src/utils/cfbFormat.js`)
- **Live detail line** (`LiveDetail`, in-page component) on in-progress rows only: possession team + down/distance/spot (`live.situation`, already formatted by CFBD, e.g. "1st & 10 at UNLV 26") + a `Q{period} {clock}` label, reading `cfb.games.live` (populated by the `poll-cfb-scores` scoreboard poller). Silently omitted when a field is missing.

**States:** loading · pool-not-found · no-weeks-yet · slate-not-posted ("Lines for
{weekLabel} post soon.") · no-filter-matches ("No games match your filters.") · normal.

---

### 11. Demo Landing — `/demo`

**Theme:** General (a themed tile per sport — golf's fairway/gold, CFB's Varsity Navy)

**What it does:** Public, no-auth sport chooser. Two tiles, one per sport, each styled like its own player-facing pages so the choice previews what's on the other side. Lets visitors see the product before signing up.

**Data available:**
- Golf tile: static copy + `SportBadge` (no live fixture read — golf's demo detail lives at `/demo/tournament`)
- CFB tile: static copy + `SportBadge` via `cfbBadge(2026)`, themed with `CFB_THEME` from `src/theme/cfb.js`

**What must be on this page:**
- Poold wordmark
- "Pick a Sport to Demo" section label
- Golf card → "View golf demo →" to `/demo/tournament`
- CFB card → "View CFB demo →" to `/demo/cfb`

---

### 11a. Demo CFB Pool Detail — `/demo/cfb`

**Theme:** Sport-specific (CFB — Varsity Navy, same tokens as §10f)

**What it does:** CFB counterpart to Demo Tournament — the CFB leaderboard/pool-detail experience on static fixture data. Renders through the real `PoolHeader`/`StandingsCard`/`WidgetGrid` shells and the real `CfbWeekSelector`/`CfbStandings`/`CfbWidgets` leaf components (not reimplemented), so it tracks `CfbPoolDetail` (§10f) automatically.

**Data available (`src/demo/demoCfbData.js`):**
- `demoCfbPool`, `demoCfbWeeks` — Week 1 graded, Week 2 open
- `demoCfbParticipants`, `demoCfbSeasonStandings` — 8 fabricated players including "You"; Week 1 season standings computed via the real `projectSeasonStandings`/`shapeCard` scoring engine, not hand-typed
- `demoCfbWeek1Games`/`demoCfbWeek1Picks` (graded, visible to all — same as post-lock RLS), `demoCfbWeek2Games` (open; picks come from `DemoCfbContext`'s in-memory visitor card, hidden from other rows pre-lock, mirroring real RLS)

**What must be on this page:**
- Same layout as CfbPoolDetail: navy `PoolHeader` + week selector, a Week 2 action banner ("Make picks →" / "Edit picks →" to `/demo/cfb/picks`), `StandingsCard` (label "Season Standings", with `CfbRulesButton` as its `action`) wrapping `CfbStandings`, and `WidgetGrid`/`CfbWidgets`
- Week resolution: honors `?week=N` (missing vs. explicit `?week=0` disambiguated, matching
  `CfbPoolDetail`), else the earliest non-graded week, else the last

---

### 11b. Demo CFB Picks — `/demo/cfb/picks`

**Theme:** Sport-specific (CFB — Varsity Navy, same tokens as §10g)

**What it does:** CFB counterpart to Demo Picks — the weekly card-builder experience on static fixture data (always Week 2, the fixture's open week). Renders through the real `CfbGameCard`/`CfbGameFilterBar`/`CfbCardTracker` components and the real `cfbCardValidity`/`buildPicksPayload`/`shapeCard` helpers, so validity rules and scoring can't drift from the live builder (§10g). Selections are held in `DemoCfbContext` (memory only, no DB, no `cfb_submit_week_picks` call).

**Data available:** `demoCfbWeek2Games` (the open week's slate)

**What must be on this page:**
- Same layout as CfbPicks: `PicksHeader` + `CfbRulesButton`, filter bar, game cards, `CfbCardTracker`
- Submit drops the visitor's card into the Demo CFB Pool Detail standings as "You"

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
| `StandingsCard` | `children` (standings table or empty state), `label` (default `"Pick'em Standings"`), `action` (default null — optional right-aligned slot next to the label; CFB uses it for `CfbRulesButton`) | TournamentDetail, DemoTournament, CfbPoolDetail, DemoCfbPoolDetail |
| `WidgetGrid` | `leaderboardData`, `picks`, `stakeAmount`, `participantCount`, `payoutStructure`, `children` (when supplied, renders in place of golf's hardcoded widget set) | TournamentDetail, DemoTournament, CfbPoolDetail, DemoCfbPoolDetail |

### `BottomSheet` — `src/components/BottomSheet.jsx`

Generic bottom-sheet modal (backdrop scrim + slide-up panel with a drag handle, `title` header, `children` body). Closes on backdrop click or Escape. Not sport- or feature-specific — Dashboard uses it for two flows: "Join a pool" (join-code entry, submits to `/join/:code`) and, admin-only, "Add a pool" (Join with code / Create pool chooser).

**Removed:** `BottomNav` (`src/components/BottomNav.jsx`, Pools · Board · You) is deleted this PR — Dashboard and Profile no longer render a bottom tab bar; `BottomSheet` replaces it as the way Dashboard reaches pool-join actions. `/profile` is now reached via a header avatar (`ProfileMenu`, defined in `src/pages/Dashboard.jsx`: a plain link for players, a Profile/Admin dropdown for admins). The display-name nudge that used to live on `BottomNav`'s "You" tab (a bubble shown when `profiles.display_name_set_at` is NULL, auto-hiding after 9s, suppressed via `localStorage` or once a name is saved) is now a small gold dot badge on the avatar itself.

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

### `Avatar` — `src/components/Avatar.jsx`

Shared player-identity circle: renders the uploaded photo (`<img>`, `object-cover`, rounded-full) when `avatarUrl` is set, else falls back to the existing initials-on-a-flat-background circle (`getInitials(name)` — one background color per call site via the `bg`/`textColor` props, deliberately **not** a per-user color palette). Props: `name`, `avatarUrl`, `size` (px, default 36), `bg`, `textColor`, `className`. Used everywhere a player is identified: the Dashboard header `ProfileMenu`, `/profile`'s identity block (with a tap-to-upload "+" badge overlay), `/admin/users`' per-row upload, and both leaderboard rows (`Standings` at 56px, `CfbStandings` at 56px — see below). Demo fixtures carry no `avatar_url`, so demo pages render initials only — no photos, by design.

### `AvatarCropModal` — `src/components/AvatarCropModal.jsx`

The crop step between picking a photo and uploading it, opened by both `/profile` and `/admin/users` right after the native file picker returns a file. Wraps `react-easy-crop`: a fixed 1:1 circular crop guide, drag-to-reposition, and a zoom slider from 0.5x (lets a photo sit smaller than the guide, with white margin) up to 3x. `onCropped` hands the caller a ready-to-upload JPEG `Blob`, always downscaled to a maximum of 512x512 regardless of the source photo's resolution (a smaller crop is never upscaled) — avatars never render bigger than a few dozen px on screen, so this keeps every upload small and inside the `avatars` bucket's 5MB cap. The export is always JPEG even if the source was PNG/WebP; a later re-crop of a non-JPEG-era avatar can leave the old file (e.g. `avatar.png`) orphaned in Storage since upsert only overwrites the same key — known, low-severity, not fixed (no real users yet).

### `Standings` — `src/components/leaderboard/Standings.jsx`

The pick'em standings list with the signature scorecard-expand interaction. Presentational only — takes pre-computed `standings` array, `currentUserId`, `pickCount`. Each row is a plain numeric rank rail on the left edge, then an `Avatar` (photo or initials), then name/score — the rank number used to live inside the circle that now holds the avatar. Row dimensions (avatar/rail size, padding): `DESIGN_SPEC.md` §Pick'em Standings collapsed-row spec.

Per-row data: `user_id`, `display_name`, `avatar_url`, `rank`, `total_score`, `picks[]` (each with `player_name`, `score`, `used_in_total`, `withdrawn`, `cut`, `thru`).

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
| `CfbWeekSelector` | `weeks[]` (`id, week_number, label, status`), `selectedNumber`, `onSelect(week)` | Week dropdown (native `<select>`), styled to sit quietly on the dark `PoolHeader` ground — translucent cream-on-navy closed, explicit dark-on-white `<option>` list since options render on the OS's native popup, not the navy band. Rendered as the header's `children`; used by `CfbPoolDetail` (§10f) and `CfbSlate` (§10h) |
| `CfbStandings` | `entries[]` (`user_id, display_name, avatar_url, rank, total, week: {state, total, picks[]}`), `currentUserId`, `weekLabel` | Season-standings rows + the scorecard-expand (see §10f) — the expand's rows render via `CfbCardRows`. Row layout/dimensions match golf's `Standings` (see `DESIGN_SPEC.md` §Pick'em Standings collapsed-row spec): plain numeric rank rail, then `Avatar` (photo or initials) |
| `CfbWidgets` | `weekPicks[]`, `weeklyPoints[]`, `weekLabel`, `locked`, `stakeAmount`, `participantCount`, `payoutStructure` | Weekly Points, Most-Backed Teams, Underdog Board, and the reused `PrizePoolWidget` — see §10f for the pre-lock hide rule. No longer takes `games`/renders a slate widget — that moved to its own page, §10h |
| `CfbPoolTile` | `tile` (one row from `getMyCfbPools`, now including `status`) | The Dashboard's CFB pool tile — see §6 |
| `CfbGameFilterBar` | `search`, `onSearchChange`, `conferences[]`, `selectedConferences` (Set), `onToggleConference`, `sortBy`, `onSortChange` | Search box + conference filter chips + sort control. View-only toolbar shared by `CfbPicks` (§10g) and `CfbSlate` (§10h), backed by `src/utils/cfbGameFilters.js` (`filterAndSortGames`, `conferencesInPlay`) |
| `CfbCardRows` | `picks[]` (display-ready pick shape from `shapeCard`), `total`, `totalLabel` | The shared 6-pick-row + `TOTAL` renderer — slot marker, team crest (`TeamCrest`, `reserveSpace` on so rows stay aligned when a logo is missing/broken), pick line, game line, result pill, `DD → +4` chip, points. Used by both `CfbStandings`' scorecard-expand and `CfbCardReadonly` so the two card views can't drift |
| `CfbCardReadonly` | `card` (`{total, picks[]}` from `shapeCard`), `notice`, `variant` (`'autofilled'` or `null`), `weekLabel` | The frozen read-only card on the Picks page once a week locks (§10g) — brick left-bar chrome around `CfbCardRows`, plus the notice line above it |
| `CfbCardTracker` | `atsCount`, `ddCount`, `dogCount`, `valid`, `warning`, `submitting`, `hasExistingCard`, `onSubmit` | Sticky "Card progress" panel on the picks builder (§10g) — progress bar + 3 stat tiles + submit button |
| `CfbRulesButton` | none (owns its own open state) | "How scoring works" trigger button, fully hidden until clicked, then a modal explaining the 3 pick types (ATS, double-down, mandatory underdog) with worked examples and the underdog tier/point table. Shared by both live CFB pages (§10f, §10g) and both `/demo/cfb` pages so the copy can't drift |
| `TeamCrest` | `src`, `alt`, `size` (default 20), `reserveSpace` (bool) | Small team logo (`cfb.games.home_team_logo`/`away_team_logo`, from CFBD's `teams/fbs` endpoint), letterboxed square, no circular mask. Renders nothing on a null/missing/failed URL — `reserveSpace` swaps that to an empty same-size box so a fixed-width crest column still lines up. Shared by `CfbGameCard` (§10g) and `CfbCardRows` so sizing/fallback can't drift |

Display formatting shared by the picks page too: `src/utils/cfbFormat.js`
(`formatSpread`, `pickLine`, `formatKick`, `formatKickWithDate`, `favoriteLine`,
`formatLockLabel`). Grading/shaping shared by both card surfaces: `shapeCard` in
`src/utils/cfbCard.js` (turns a user's stored picks + the week's games into the
display-ready graded shape `CfbCardRows` renders).

### Admin sport chrome — `src/components/admin/`

| Component | Props | Output |
|---|---|---|
| `AdminShell` | `activeSport` (`'golf'` \| `'cfb'` \| `null`), `children` | Shared chrome for every admin surface — sticky nav (`← Dashboard \| POOLD Admin`, sign out), `AdminSportSwitcher`, and a "Users & Settings" link/label — so `/admin`, `/admin/cfb`, and `/admin/users` read as one admin area with a sport dimension instead of three disconnected panels. `activeSport={null}` (used only by `/admin/users`, a sport-agnostic page) renders both sport segments unselected and shows "Users & Settings" as a plain label instead of a self-link. One container width (`max-w-3xl`) across all three. |
| `AdminSportSwitcher` | `active` (`'golf'` \| `'cfb'` \| `null`), `size` (`'sm'` default \| `'lg'`) | Golf\|CFB segmented control — the active segment links nowhere, the other links to that sport's admin panel. Rendered inside `AdminShell` (`size="lg"`), not directly by the pages. Adding a third sport is one row in its `SPORTS` array. |

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
