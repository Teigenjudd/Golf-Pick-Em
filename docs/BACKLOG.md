# Poold — Comprehensive Backlog & Improvement Inventory

> Full-codebase scan on **2026-07-09**, post multi-sport migration (Phase 4 shipped).
> Ranked most-important → least within each category. This supersedes the medium/low
> sections of `docs/AUDIT.md` (that audit predates the multi-sport cutover — several of
> its items are now resolved; see the "Audit reconciliation" note at the bottom).
>
> Severity: 🔴 critical · 🟠 high · 🟡 medium · ⚪ low
> Each item points at a file + symbol; line numbers drift, names are stable.

---

## A. Security

- [ ] 🔴 **A1 — Privilege escalation: any user can make themselves admin.**
  `20260615000000_initial_schema.sql` — policy `"Users can update own profile"`
  is `FOR UPDATE USING (auth.uid() = id)` with **no `WITH CHECK` and no column
  restriction**, and it was never scoped by any later migration. `authenticated`
  holds a table-level UPDATE grant (proven — `AdminDashboard.toggleRole` updates
  `profiles.role` through a plain `.update()`). So a signed-in user can call
  `supabase.from('profiles').update({ role: 'admin' }).eq('id', myId)` and the
  USING check passes. `AdminRoute` + `is_admin()` gate on `role`, so this is a
  full account-takeover of the admin surface (create/lock tournaments, read all
  emails via `admin_list_users`, remove participants).
  **Fix:** split the policy — allow self-update only of safe columns. Postgres RLS
  can't restrict columns in a policy directly, so either (a) `REVOKE UPDATE` on
  `profiles` from `authenticated` and route `display_name` edits through a
  `SECURITY DEFINER` RPC, or (b) add a `WITH CHECK` that pins
  `role`/`status`/`email`/`id` to their current values via a `BEFORE UPDATE`
  trigger that rejects changes to privileged columns unless `is_admin()`. Verify
  in prod with a non-admin JWT before/after.

- [ ] 🟠 **A2 — Odds API key shipped in the browser bundle.**
  `src/lib/oddsApi.js` reads `import.meta.env.VITE_ODDS_API_KEY`, which Vite inlines
  into client JS (visible in DevTools/Netlify bundle). Anyone can lift it and burn
  the quota. **Fix:** proxy through an edge function (same pattern as
  `slash-golf-proxy`), then rotate the key in The Odds API dashboard and drop the
  `VITE_` var from `.env`/Netlify. (Tracked as M1 in AUDIT.md / TODO.md — still open.)

- [ ] 🟠 **A3 — Manual-refresh limit is client-side only.**
  `AdminDashboard.refreshScores` + `golf.bumpRefreshCount` enforce the 3/tournament
  cap in JS and via a counter the client increments. `poll-leaderboard` itself only
  checks the *monthly* cap, not the per-event manual limit, and any admin can call
  `functions.invoke('poll-leaderboard', { body: { event_id } })` directly in a loop.
  Admin-only, so lower blast radius — but it directly spends the paid Slash Golf quota.
  **Fix:** enforce/increment the per-event count inside the edge function under the
  service role, not in the browser.

- [ ] 🟡 **A4 — Edge functions allow all origins.**
  Both functions set `Access-Control-Allow-Origin: '*'`. Combined with admin-JWT
  checks the risk is low, but any site can invoke them with a victim's token if it
  leaks. **Fix:** reflect an allowlist (`getpoold.app`, localhost) instead of `*`.

- [ ] 🟡 **A5 — `join_code` readable for every non-draft pool.**
  RLS `"read non-draft pools"` lets any authenticated user `SELECT *` on `public.pools`,
  including `join_code` for pools they're not in. Codes are the access gate and anyone
  can join anyway, so this is minor — but a user can enumerate every pool's invite.
  **Fix:** scope the SELECT to pools the user participates in, or drop `join_code`
  from the readable column set for non-members. (AUDIT L7.)

- [ ] ⚪ **A6 — `.claude/settings.local.json` allows broad `cat .env*`.**
  Not a production issue, but the local agent permission list auto-allows reading
  `.env`, `.env.local`, `.env.production`. Fine for solo dev; revisit if the repo is
  shared. Confirm no real secret ever lands in a committed `.env.example`.

---

## B. Correctness & Data Integrity

- [ ] 🟠 **B1 — Picks silently score as "benched" on an id/name mismatch.**
  `src/utils/scoring.js` `computeScores` matches a pick to the leaderboard by
  `player_id`, falling back to normalized name. An unmatched pick gets `score: null`
  and is quietly dropped from the total with no signal — a scoring bug that looks
  like a valid low score. Slash Golf ids vs the field-import ids are the likely
  drift source. **Fix:** surface unmatched picks (badge them "no data") instead of
  silently benching, and log a count. (AUDIT M4.)

- [ ] 🟠 **B2 — Failed score refresh still consumes an allowance.**
  `AdminDashboard.refreshScores` awaits `functions.invoke(...)` but never inspects
  the returned `{ error }` (invoke does **not** throw on a 4xx/5xx from the function),
  then always calls `bumpRefreshCount`. A 401/429/500 burns one of the 3 refreshes
  and shows no error. **Fix:** destructure `{ data, error }`, only bump on success,
  and surface failures in the UI. (AUDIT M5.)

- [ ] 🟡 **B3 — Scoring ignores DQ / DNS states.**
  `computeScores` only special-cases `wd` and `cut` (+20). A disqualified or
  never-started player arriving as `total: '-'` falls through to `null` (benched)
  rather than penalized, which can *help* a bad pick. **Fix:** decide intended
  handling for `dq`/`dns` and encode it explicitly. (AUDIT M6.)

- [ ] 🟡 **B4 — Non-atomic monthly API counter (lost updates).**
  `poll-leaderboard` and `slash-golf-proxy` both read `api_usage.slash_golf_calls`
  then write `current + n`. Concurrent invocations (cron + manual refresh) can lose
  increments, under-counting against the cap. `slash-golf-proxy` also uses `.single()`
  which errors when the month row doesn't exist yet (first call of the month).
  **Fix:** atomic increment via an RPC (`update ... set calls = calls + n`) or a
  Postgres `on conflict do update` returning the new value; use `.maybeSingle()`.
  (AUDIT L3.)

- [ ] 🟡 **B5 — `submitPicks` is not atomic (delete-then-insert, no transaction).**
  `src/lib/golf.js` `submitPicks` deletes all of a user's picks, then inserts the new
  set, then upserts `pool_participants` — three separate round-trips. If the insert
  fails (e.g. RLS rejects one row, network drop) the user is left with **zero** picks
  and a success-less error. **Fix:** wrap in a `SECURITY DEFINER` RPC / single
  transaction, or at minimum re-fetch and warn on partial failure.

- [ ] ⚪ **B6 — Tie-rank labelling vs "rankOf" count.**
  `assignRanks` gives tied users the same rank (good), but Dashboard shows
  "Nth of {standings.length}", which counts benched (`total_score === null`) users in
  the denominator while they have no rank. Cosmetic, but "3rd of 10" can include
  players who never scored. Confirm intended denominator.

---

## C. Reliability & UX States

- [ ] 🟠 **C1 — AuthCallback can dead-end on the "Signing you in…" spinner.**
  `src/pages/AuthCallback.jsx` navigates only when `profile` is non-null. On the
  new-signup trigger race (profile row not readable yet) or any profile fetch error,
  the user is stuck forever. **Fix:** navigate on `user` (not `profile`), and handle
  the null-profile case with a retry/timeout. (AUDIT M2.)

- [ ] 🟠 **C2 — Swallowed query errors → silent blank screens.**
  `TournamentDetail.load` only error-checks the pool lookup; `getPoolPicks` /
  `getLatestLeaderboard` failures fall through to an empty leaderboard that looks
  like "no cards in yet." `Dashboard` has **no** error branch at all — a failed
  `getMyPickRows` renders an empty dashboard. Across `src/lib/golf.js`, most helpers
  discard the Supabase `{ error }` entirely (`const { data } = await ...`).
  **Fix:** thread errors up and show a real error state; stop dropping `error` in the
  golf seam. (AUDIT M3, broadened.)

- [ ] 🟡 **C3 — No catch-all / 404 route.**
  `src/App.jsx` has no `path="*"` route. An unknown URL renders a blank page.
  **Fix:** add a 404 element (and consider redirecting authed users to `/dashboard`).

- [ ] 🟡 **C4 — Weather/geocode failures are silent.**
  `TournamentDetail` weather fetch and `CreateTournament` geocode both `.catch(() => {})`.
  Fine for weather (optional), but a silent geocode failure at creation means no
  weather ever shows and the admin gets no hint. **Fix:** at least log/telemetry the
  geocode miss at creation time.

- [ ] ⚪ **C5 — Dashboard standings fetch is an unbounded fan-out.**
  The `useEffect` loops every locked/complete pool and fires `getPoolPicks` +
  `getLatestLeaderboard` per pool with no concurrency limit or cleanup on unmount
  (can `setState` after unmount). Fine at current scale (handful of pools); revisit
  if a user is in many.

---

## D. Performance

- [ ] 🟡 **D1 — N+1 inserts on tournament creation.**
  `src/lib/golf.js` `createGolfPool` inserts tiers one-by-one in an awaited loop
  (~1 insert per tier + 1 per tier's players = ~16 round-trips for 8 tiers). No
  transaction, so a mid-loop failure relies on the event-delete cascade to clean up.
  **Fix:** batch — insert all tiers in one call, collect ids, then bulk-insert all
  tier_players; ideally one `SECURITY DEFINER` RPC for atomicity. (AUDIT L2.)

- [ ] 🟡 **D2 — AuthContext fetches the profile twice on load.**
  `getSession()` and the `onAuthStateChange(INITIAL_SESSION)` listener both call
  `fetchProfile`, and `loading` is cleared from the listener path. Two profile reads
  per page load, plus a fragile dependence on `INITIAL_SESSION` firing. **Fix:**
  consolidate to a single fetch; clear `loading` deterministically. (AUDIT L1.)

- [ ] ⚪ **D3 — Repeated per-pool leaderboard compute on Dashboard.**
  `computeScores` runs client-side for every locked pool on each Dashboard mount.
  Cheap now; the generic `public.pool_standings` cache was scaffolded for exactly
  this (see F1) but is never written or read.

---

## E. Accessibility & Mobile

- [ ] 🟡 **E1 — Mobile: "My Picks" row overflows on narrow screens.**
  `Dashboard` packs name + actions + badge in one non-wrapping flex row; tight around
  360px. **Fix:** stack actions or hide labels below a breakpoint. (AUDIT L4.)

- [ ] 🟡 **E2 — Create-tournament tier drag-and-drop is rough on touch.**
  `CreateTournament` uses a `PointerSensor` 2-col DnD that fights page scroll on
  touch. Admin/desktop-likely, so low priority, but a mobile admin can't easily
  re-tier. **Fix:** add a touch-friendly move affordance (long-press handle or
  tap-to-move fallback). (AUDIT L5.)

- [ ] 🟡 **E3 — Interactive elements lean on color + tiny hardcoded pixel sizes.**
  Many controls are `<button>`/`<div>` with `text-[11px]`/`text-[9px]` and color-only
  state (e.g. score red/charcoal). Worth an a11y pass: focus-visible rings, aria-labels
  on icon-only buttons (the leaderboard/board SVG links have none), and a contrast
  check on `warm-300/400` text on cream. **Fix:** audit against WCAG AA; add labels.

- [ ] ⚪ **E4 — No reduced-motion guard on the live pulse.**
  The `liveDot` keyframe animation ignores `prefers-reduced-motion`. Minor. **Fix:**
  wrap in a media query.

---

## F. Architecture & Tech Debt

- [ ] 🟠 **F1 — Multi-sport migration is stuck mid-cutover (Phases 4½–5 unfinished).**
  Two loose ends from `docs/MULTI_SPORT_MIGRATION.md`:
  - **Legacy tables still live.** `public.tournaments / tiers / tier_players / picks /
    leaderboard_cache / pga_event_badges` still exist with their old RLS policies.
    Phase 5 cleanup (drop them) is not done — they're dead weight and a foot-gun
    (someone could write to the wrong `picks`).

    ⚠️ **Correction (2026-07-13): `public.pga_event_badges` is NOT dead — do not drop
    it blind.** An earlier version of this item claimed "nothing in `src/` reads them."
    That is true for five of the six tables, but **`createGolfPool` still reads
    `public.pga_event_badges`** (`src/lib/golf.js` — the one call in the golf seam that
    uses the plain `supabase` client instead of `golf()`), to copy `badge_config` onto
    `golf.event_details` at pool creation. It is the seed source for every tournament's
    badge art, keyed by Slash Golf `tourn_id`.

    Dropping it would **fail silently, not loudly**: that call discards its `{ error }`
    (`const { data: badgeRow } = await supabase...`), so `badgeRow` would just come back
    null, `badge_config` would be null, and every newly created pool would quietly fall
    back to the generic "GO/GOLF" badge — with no error anywhere. The other five tables
    are genuinely unreferenced and safe to drop.

    **Fix before Phase 5:** move the badge seed into the `golf` schema (e.g.
    `golf.event_badges`, or fold it into a lookup that `createGolfPool` reads via
    `golf()`), repoint `createGolfPool`, and stop discarding that call's error — *then*
    drop `pga_event_badges` with the rest. Tracked together with F1 rather than split
    out, since it's a precondition for the same cleanup.
  - **`public.pool_standings` is scaffolded but never used.** It was created to cache
    normalized standings so shared UI needn't compute; `submitPicks` writes
    `pool_participants` but nothing ever writes `pool_standings`, and no reader exists.
    Either wire it (removes D3's client compute) or drop it and note it as future work.

  **Fix:** resolve the `pga_event_badges` dependency above first, confirm zero
  references to the remaining legacy tables in prod (query `pg_stat_user_tables` for row
  activity), then run Phase 5. Decide `pool_standings`: populate-or-drop.

- [ ] 🟡 **F2 — Vestigial `profiles.status` column + `pga_name` duplication.**
  Approval was removed (`20260616000005`) but `status` still exists, defaults to
  `'approved'`, and is still `SELECT`ed in `AuthContext.fetchProfile` for no consumer.
  Related: `golf.event_details.pga_name` vs `events.name` vs `pools.name` carry
  overlapping tournament naming with unclear precedence (`createGolfPool` sets
  `events.name = pgaName || name`). **Fix:** drop `status`; document the name fields'
  intended roles in `mergePoolView`.

- [ ] 🟡 **F3 — Geocoding still on Open-Meteo, not Nominatim.**
  `CreateTournament.handleNext` geocodes via `geocoding-api.open-meteo.com`, but the
  documented plan (and a standing note) is to switch to Nominatim structured
  city/state search for accuracy (test case: Southampton NY ~lat 40.88). **Fix:**
  swap to Nominatim structured params; CLAUDE.md already lists Nominatim as the
  geocoder, so today's code and the docs disagree — see H2.

- [ ] ⚪ **F4 — No test coverage anywhere.**
  Zero unit/integration tests. The highest-value targets are pure and easy to cover:
  `scoring.js` (`computeScores`, WD/CUT penalty, best-N, tie ranks), `tierBuilder.js`
  (odds→prob calibration, wildcard split), `format.js`. **Fix:** add Vitest + a
  handful of `scoring`/`tierBuilder` tests; they'd have caught B1/B3 regressions.

- [ ] ⚪ **F5 — `MONTHLY_CAP = 1800` duplicated across both edge functions.**
  And `SLASH_GOLF_BASE`. Small, but they can drift. **Fix:** shared constant module
  (`supabase/functions/_shared/`).

---

## G. Product / Feature Gaps

- [ ] 🟡 **G1 — Tier format is hardcoded.**
  `src/utils/tierBuilder.js` fixes `REGULAR_TIER_SIZE=6`, `WILDCARD_TIER_COUNT=2`,
  `WILDCARD_POOL_SIZE=64`. Commissioners can't adjust field size/shape. **Fix:**
  surface these on Create-Tournament Step 1. (TODO.md.)

- [ ] 🟡 **G2 — Demo leaderboard is frozen + demo picks reset on refresh.**
  `/demo` runs off the static `src/demo/demoData.js` snapshot (won't move during a
  live event) and `DemoContext` holds picks in memory only (refresh drops the "You"
  card). **Fix (if a live feel is wanted):** re-snapshot script + `sessionStorage`
  persistence. (AUDIT "Other".)

- [ ] ⚪ **G3 — "Multiple pools per event" is wired but not surfaced.**
  The schema supports many pools per event (D3 in the migration doc), but the UI
  assumes one pool per event. Future feature; note it so it isn't mistaken for a bug.

- [ ] ⚪ **G4 — No "leave pool" / self-service participant management for players.**
  RLS allows `"leave self"` on `pool_participants`, but there's no UI. Minor.

---

## H. Documentation

- [x] 🟠 **H1 — `docs/AUDIT.md` is stale post-migration; reconcile or retire.** *(Done 2026-07-10 — superseded banner added pointing here.)*
  It still lists resolved items (L6 dead code — `Pending.jsx` gone, `golf-temp`
  renamed to `poold`, helpers consolidated) and references `public.picks`/
  `tournaments` file paths that the multi-sport cutover moved into the `golf` schema.
  **Fix:** mark AUDIT.md superseded by this file, or prune it to only-still-open items.

- [x] 🟡 **H2 — CLAUDE.md / README describe the pre-migration data model.** *(Done 2026-07-10 — data-model section added to CLAUDE.md; geocoder line, table names, and backlog pointer fixed; README updated. Note: `docs/PAGES.md` still uses some pre-migration field names.)*
  CLAUDE.md's "Architecture Summary" and Routes still talk in terms of `tournaments`,
  and says geocoding uses Nominatim while the code uses Open-Meteo (F3). The doc
  doesn't mention the `public`/`golf` schema split or `lib/golf.js` as the data seam
  — the single most important thing for an agent to know now. **Fix:** add a short
  "Data model (post multi-sport)" section pointing at `lib/golf.js` and the schema
  boundary; fix the geocoder line.

- [ ] 🟡 **H3 — `index.html` title/meta still says "Golf Pick'Em".**
  Brand is Poold. Also no favicon beyond the default Vite SVG, no OG tags for the
  join-link share (invites are the primary growth loop — a bare link with no preview
  card is a missed opportunity). **Fix:** set title/description/OG image; brand the
  favicon.

- [x] ⚪ **H4 — `MULTI_SPORT_MIGRATION.md` still says "Planning / not yet executed."** *(Done 2026-07-10 — status header updated.)*
  Phases 1–4 are done (per git history); the doc header hasn't been updated. **Fix:**
  update status to "Phases 1–4 shipped; Phase 5 cleanup pending" (ties to F1).

---

## Audit reconciliation (what changed since `docs/AUDIT.md`, 2026-06-20)

**Resolved since that audit:** L6 dead code (`Pending.jsx`/`/pending` removed,
`@dnd-kit/utilities` dropped, `parseScore`/`normalizeName`/`unwrapNumber` consolidated
into `utils/scoring.js`, `package.json` renamed `golf-temp` → `poold`). C1–C4 remain
fixed and were faithfully re-ported to the `golf` schema in Phase 3.

**Still open (carried forward, re-pathed to the new schema):** M1→A2, M2→C1, M3→C2,
M4→B1, M5→B2, M6→B3, L1→D2, L2→D1, L3→B4, L4→E1, L5→E2, L7→A5, plus the two Demo items→G2.

**New this scan:** A1 (profiles UPDATE privilege escalation — highest priority), A3/A4
(refresh + CORS), B5 (non-atomic pick submit), C3 (no 404), F1 (migration Phase 5 +
`pool_standings`), F2/F4/F5, G-series, H-series.
</content>
</invoke>
