# Poold — Comprehensive Backlog & Improvement Inventory

> Full-codebase scan on **2026-07-09**, post multi-sport migration (Phase 4 shipped).
> Ranked most-important → least within each category. This supersedes the medium/low
> sections of `docs/AUDIT.md` (that audit predates the multi-sport cutover — several of
> its items are now resolved).
>
> Severity: 🔴 critical · 🟠 high · 🟡 medium · ⚪ low
> Each item points at a file + symbol; line numbers drift, names are stable.
> **Resolved items are archived in the "Closed" section at the bottom**, not deleted.

---

## A. Security

- [ ] 🟠 **A3 — Manual-refresh limit is client-side only.**
  `AdminDashboard.refreshScores` + `golf.bumpRefreshCount` enforce the 3/tournament
  cap in JS and via a counter the client increments. `poll-leaderboard` itself only
  checks the *monthly* cap, not the per-event manual limit, and any admin can call
  `functions.invoke('poll-leaderboard', { body: { event_id } })` directly in a loop.
  Admin-only, so lower blast radius — but it directly spends the paid Slash Golf quota.
  **Fix:** enforce/increment the per-event count inside the edge function under the
  service role, not in the browser.

- [ ] 🟡 **A4 — Edge functions allow all origins.**
  All three functions (`slash-golf-proxy`, `poll-leaderboard`, and now `odds-proxy`)
  set `Access-Control-Allow-Origin: '*'`. Combined with admin-JWT checks the risk is
  low, but any site can invoke them with a victim's token if it leaks. **Fix:** reflect
  an allowlist (`getpoold.app`, localhost) instead of `*`. `odds-proxy` (2026-07-14)
  deliberately matched the existing `*` rather than diverging — fix all three together.

- [ ] 🟡 **A5 — `join_code` readable for every non-draft pool.**
  RLS `"read non-draft pools"` lets any authenticated user `SELECT *` on `public.pools`,
  including `join_code` for pools they're not in. Codes are the access gate and anyone
  can join anyway, so this is minor — but a user can enumerate every pool's invite.
  **Fix:** scope the SELECT to pools the user participates in, or drop `join_code`
  from the readable column set for non-members. (AUDIT L7.)

- [ ] 🟡 **A7 — `privacy@getpoold.app` has no inbound MX; permanent forwarder not built.**
  `/privacy` and `/terms` (shipped 2026-07-14) originally named it as the contact and
  data-deletion address, and the privacy policy promises deletion on request — so the
  channel advertised for exercising that right was a dead drop. **The advertised-address
  half of this is now fixed (see interim mitigation below); what's open is standing up
  real inbound mail for the branded `privacy@getpoold.app` address itself.** Downgraded
  from 🟠 now that the bounce risk to end users is closed.
  **Interim mitigation — shipped 2026-08-10 (PR #38).** The data-deletion line and
  Contact sections in `Privacy.jsx` and `Terms.jsx` (both text and `mailto:` hrefs)
  now point at `tljvllc@gmail.com` — a monitored business/LLC mailbox, not the
  founder's personal `juddteigen@gmail.com` this item originally proposed as the
  fallback — so the advertised channel reaches a live inbox today.
  `privacy@getpoold.app` is unchanged and still has no inbound MX; only the
  published contact moved.
  **Permanent fix — still open, deliberately not built.** Real inbound mail for
  `privacy@getpoold.app` (ImprovMX/ForwardEmail MX + SPF TXT to Netlify DNS, or a
  Resend-inbound webhook) was considered and rejected for now — a standing 8th
  vendor or a bespoke webhook isn't worth it for a low-traffic legal-contact address.
  Revisit if volume or professionalism ever makes a raw Gmail contact untenable. See
  `agents/pm/DECISIONS.md`, 2026-08-10.

- [ ] ⚪ **A8 — `odds-proxy` doesn't meter the Odds API quota.**
  `api_usage.slash_golf_calls` counts Slash Golf calls; nothing counts The Odds API.
  The proxy is admin-only and odds are fetched once per pool creation, so the spend is
  tiny — but the quota is now invisible, where before it at least failed loudly in the
  browser. **Fix:** add an `odds_api_calls` column and increment it in `odds-proxy`
  (fold into B4's atomic-counter fix rather than duplicating the read-then-write bug).
  *(Was labelled A7; renumbered 2026-07-15 to resolve an ID collision with the
  `privacy@` item above.)*

- [ ] ⚪ **A9 — Privacy policy's service-provider list is now stale (new 2026-07-16).**
  `src/pages/legal/Privacy.jsx` lists only Supabase and Netlify as service providers.
  Since C7 (closed below), auth emails also pass through **Resend** (custom SMTP,
  `smtp.resend.com`) — a third party that now handles player email addresses in
  transit. **Fix:** add a one-line Resend entry alongside Supabase/Netlify. Source
  file, not a doc — flagged here per the ownership index, not fixed in this PR.

- [ ] ⚪ **A10 — CFB's join-season cutoff is enforced client-side only.**
  `Join.jsx`'s `joinClosed` check (the "season already started" gate) reads
  `cfbPool.lock_time` in the browser; there's no RLS/RPC backstop preventing a
  `pool_participants` insert after the cutoff. Fails *closed* if `lock_time` is ever
  null (hardened in `feat/cfb-sport-dispatch`), so the immediate trap is closed, but the
  gate itself is still trust-the-client. Accepted for launch — consistent with A5's
  posture on over-readable join codes. **Fix (if ever prioritized):** move the cutoff
  check into a `SECURITY DEFINER` join RPC alongside `joinPool`.

---

## B. Correctness & Data Integrity

- [ ] 🟠 **B1 — Picks silently score as "benched" on an id/name mismatch.**
  `src/utils/scoring.js` `computeScores` matches a pick to the leaderboard by
  `player_id`, falling back to normalized name. An unmatched pick gets `score: null`
  and is quietly dropped from the total with no signal — a scoring bug that looks
  like a valid low score. Slash Golf ids vs the field-import ids are the likely
  drift source. **Fix:** surface unmatched picks (badge them "no data") instead of
  silently benching, and log a count. (AUDIT M4.)
  **Update 2026-07-13 (PR #22, not a fix):** `normalizeName` now transliterates atomic
  letters (`ø`, `æ`, `ð`, …) that the old `[^a-z]` strip deleted outright, so
  `Højgaard` no longer normalizes to `hjgaard`. That removes one drift source here, but
  B1 stands: the silent-bench behaviour is untouched. Note the **asymmetry it created** —
  the odds join now resolves names through the layered matcher in `playerMatch.js`
  (`resolvePlayer`), while `computeScores` still does a raw `normalizeName` lookup. Both
  sides of the scoring join are Slash Golf, so this is not currently a live bug; if that
  ever stops being true, route `computeScores` through `resolvePlayer` too rather than
  reinventing the fallback. See `docs/NAME_MATCHING.md`.

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
  (AUDIT L3.) **Now shared by three CFBD functions:** `cfd-proxy` (CFB PR3,
  2026-08-12), `grade-cfb-week` (CFB PR5, 2026-08-12), and `poll-cfb-scores`
  (live-scores PR, 2026-08-13) all read-then-write the same `api_usage.cfbd_calls`
  counter (senior review flagged this again on `poll-cfb-scores`, same pre-existing
  pattern, not new debt). Not made materially worse — none of the three CFBD callers
  run concurrently by design today — but the fix, when it lands, should cover all
  counters (`slash_golf_calls` + `cfbd_calls`) in one pass. **CFBD's cap is now
  30,000/month** (Tier 2 upgrade, live-scores PR) — up from the 1,000/month noted when
  this item was first written.

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

- [ ] ⚪ **C6 — Magic-link login is fragile in in-app browsers; consider OTP-code login.**
  `signInWithOtp` sends a click-through magic link. When a join link is opened in an
  in-app browser (Instagram, TikTok, Facebook, etc.), the email link often opens in a
  *different* browser than the one that started the login, so the session/verifier
  doesn't carry across and the sign-in silently fails or dead-ends. This is a live cost
  of the invite→magic-link funnel: the first thing a brand-new invitee does is exactly
  the path most exposed to it. **C1's fix (PR #27) removed the infinite-spinner
  symptom**, but not the underlying fragility. **Fix (durable):** offer a **6-digit OTP
  code** the user types (Supabase `verifyOtp` with `type: 'email'`) instead of / alongside
  the link — the code works in whatever browser they're already in, so there's no
  cross-browser handoff. Bigger change (new verify UI + flow), hence low priority; pull
  it forward if signup drop-off shows up on social channels. See the ROADMAP status log
  (2026-07-15) and the C1 Closed entry.

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
  - **`public.pool_standings` — CFB half now writes it (2026-08-12, PR #44), and now
    updates live (2026-08-13, live-scores PR).** `supabase/functions/grade-cfb-week/
    index.ts` was the first code in the repo to write this table: after grading a week
    it recomputes each affected pool's season-cumulative standings via
    `projectSeasonStandings` and upserts `pool_standings`. As of the live-scores PR, the
    new `poll-cfb-scores` function does the same thing whenever a game flips final
    (both call the same shared `supabase/functions/_shared/cfbGrading.ts`), so standings
    can now move mid-slate, not just on `grade-cfb-week`'s scan. **`CfbPoolDetail.jsx` is
    now the first app screen to read `pool_standings`** (Phase 2, 2026-08-13, PR #49 —
    the season-standings hero ranks off `standings.total`), closing the "no reader" half
    of the complaint too. **Golf's half is still open:** `submitPicks` writes
    `pool_participants` but nothing on the golf side writes `pool_standings`, and D3's
    client-side `computeScores` recompute is unchanged. Wiring golf
    (`docs/CFB_BUILD_PLAN.md` PR5b, optional, not required to ship CFB) would close D3
    too.

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

- [x] 🟡 **F3 — Geocoding switched from Open-Meteo to Nominatim.** *(Done 2026-07-16,
  PR #31.)* `CreateTournament.handleNext` now geocodes via Nominatim free-text search:
  `courseName, city, state` first, falling back to a town-level `city, state` query if
  the specific query misses, with an `email=` param per Nominatim's usage policy.
  Fixes the root cause — Open-Meteo geocoded on `name` only and returned null lat/lon
  for UK links courses (The Open @ Royal Birkdale), leaving the weather widget blank.
  Royal Birkdale's `event_details` rows were backfilled by hand (53.6217, -3.0325)
  outside this PR; new tournaments now resolve automatically. C4 (silent geocode
  failure) is unrelated and still open.

- [ ] ⚪ **F4 — No test coverage anywhere.**
  Zero unit/integration tests. The highest-value targets are pure and easy to cover:
  `scoring.js` (`computeScores`, WD/CUT penalty, best-N, tie ranks), `tierBuilder.js`
  (odds→prob calibration, wildcard split), `format.js`. **Fix:** add Vitest + a
  handful of `scoring`/`tierBuilder` tests; they'd have caught B1/B3 regressions.
  **Partially closed 2026-08-12, PR #43:** `vitest` + a `test`/`test:watch` script landed,
  and `src/utils/cfbScoring.js` (CFB's scoring engine, not golf's) got the repo's first 44
  unit tests, all passing. **Further closed 2026-08-13, PR #47:** the CFBD→`cfb.games`
  slate transform (`buildGameRows`/`chooseLine`/`favoriteFromFormattedSpread`, moved
  server-side to `supabase/functions/_shared/cfbSlate.ts`) got its first *committed* tests
  (`src/utils/cfbSlate.test.js`, vitest importing the `.ts` directly) — the tests caught a
  real latent bug (a lineless provider row read as a phantom pick'em `0` via `Number(null)
  === 0` instead of "no line"), now fixed. 173 tests pass repo-wide. Golf's
  `scoring.js`/`tierBuilder.js`/`format.js` are still uncovered — this item stays open for
  those.

- [ ] ⚪ **F5 — `MONTHLY_CAP = 1800` duplicated across both edge functions.**
  And `SLASH_GOLF_BASE`. Small, but they can drift. **Fix:** shared constant module
  (`supabase/functions/_shared/`).

- [ ] 🟡 **F6 — No shared "format" contract; extract one before format #2, not before sport #2.**
  `src/utils/scoring.js` (`computeScores`) and `src/utils/tierBuilder.js` currently encode
  "golf" and "pick'em-style scoring" as one inseparable unit — there's no boundary between
  "this is golf" and "this is the pick'em scoring rule." Correct call at 1 sport × 1 format
  (all Poold runs today); the per-schema split (`public`/`golf`) already handles a second
  *sport* cleanly (additive, see `docs/MULTI_SPORT_MIGRATION.md`). The gap is a second
  *format* — survivor, season-long, props, even a second golf-scoring variant — which today
  would get built by copy-pasting and tweaking those two files, since nothing defines a
  shared shape to plug a new format into. At 2–3 sports × 3–4 formats that's 6–12 hand-copied
  scoring implementations that will silently drift from each other — exactly the shape of
  Poold's existing worst debt class (silent failures — see B1, C2), just multiplied.

  **Trigger: the moment format #2 is being designed** (even a second golf format, before a
  second sport exists) — not tied to pool count, user count, or traction. Do NOT wait for
  "we have scale," wait for "we have a second format on the roadmap."

  **Fix (sized down — days, not months):** extract a minimal contract out of
  `scoring.js`/`tierBuilder.js`, roughly `{ dataContract, validatePick, reduce (the fold),
  projectStandings }` — see `docs/ENTERPRISE_ARCHITECTURE_PROPOSAL.md` §3.1 for the reference
  shape (a 4-method `FormatEngine` interface). Goal: one seam a new format implements, not a
  second copy of two files. Deferring this until 3+ formats have already diverged turns it
  into forensic untangling under pressure instead of a deliberate days-long extraction.

  **Update (2026-08-11):** the trigger fired — CFB (`docs/CFB_BUILD_PLAN.md`) is format #2
  being designed — and the founder consciously deferred the extraction instead of doing it
  now: two dissimilar formats (golf's best-N-relative-to-par vs. CFB's weekly ATS grading)
  is judged too few examples to derive the right interface from. Revisit at format #3, not
  this one. See `agents/pm/DECISIONS.md`, 2026-08-11.

  **Explicitly out of scope even at that point** (per the same review — see
  `docs/ENTERPRISE_ARCHITECTURE_PROPOSAL.md`, "What should NOT be built now"): a fact ledger,
  idempotency/versioned facts, a provider capability registry, correction/supersession
  semantics, watchdog/failover, Redis, object storage, an event queue. All real and correct
  at platform scale (many providers, many sports, real corrections); none earned by Poold's
  traffic today or at "1000 pools." Revisit only if concrete scale signals appear (multiple
  live providers per sport, recurring real score corrections, or measured — not
  hypothetical — fan-out strain).

  **Related:** B1 and C2 (silent-failure debt) get *more* expensive with user growth
  independent of this item — a swallowed error today means the founder sees a blank
  dashboard; at traction it means a paying stranger's group sees a silently blank leaderboard
  with no log to check. Fix priority on B1/C2 should track user growth; fix priority on F6
  should track format count. Full context: `docs/ENTERPRISE_ARCHITECTURE_PROPOSAL.md`
  (reviewed 2026-07-15).

- [ ] ⚪ **F7 — `scoring.js` writes regexes with literal non-ASCII characters (new
  2026-07-17, found by the design-sync tooling PR #35).** `src/utils/scoring.js`
  (`ATOMIC_CODES`/`ATOMIC_VALUES`, the combining-mark range, punctuation/dash classes,
  ~lines 25-32) writes its character classes with literal accented characters instead of
  `\u` escapes. Confirmed (senior review, PR #35): under a non-UTF-8 decode (e.g.
  Windows-1252) the combining-mark range mojibakes into a "Range out of order"
  `SyntaxError` at parse time. **Cannot reach production** — the deployed app is loaded
  as ES modules, which browsers must decode as UTF-8 regardless of server headers — so
  this only bites a tool that loads the file outside that guarantee. It already bit one:
  the design-sync bundler (`.design-sync/`) hits it and works around it with an
  ASCII-safe shadow, `.design-sync/scoring-preview.js` (rebuilds identical regexes via
  `String.fromCharCode`). **Fix:** rewrite the literal characters in `scoring.js` as `\u`
  escapes (2-line, behavior identical) — then the shadow can be deleted. Deliberately not
  fixed in PR #35, which touches zero `src/` by design (see DECISIONS, 2026-07-17).

---

## G. Product / Feature Gaps

- [ ] 🟡 **G1 — Tier format is hardcoded.**
  `src/utils/tierBuilder.js` fixes `REGULAR_TIER_SIZE=6`, `WILDCARD_TIER_COUNT=2`,
  `WILDCARD_POOL_SIZE=64`. Commissioners can't adjust field size/shape. **Fix:**
  surface these on Create-Tournament Step 1. Constants to expose: `REGULAR_TIER_SIZE`,
  `WILDCARD_TIER_COUNT`, `WILDCARD_POOL_SIZE` — add inputs alongside the existing pick
  count / scores-to-keep fields.

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

- [ ] ⚪ **G5 — CFB dashboard tile has no "Live" state.**
  Golf's dashboard tile shows a pulsing "Live" dot while a round is in progress;
  `CfbPoolTile` (`src/lib/cfb.js`'s `getMyCfbPools`) shows the same "Locked" chip for a
  locked-mid-game week and a locked-between-games week. A true live check needs
  per-game status at the tile level, which `getMyCfbPools` deliberately doesn't fetch
  (would add a query per pool to a list endpoint). Deferred, not a bug — see
  `docs/CFB_UI_PLAN.md` §4.

---

## H. Documentation

- [ ] ⚪ **H5 — Link-preview polish: per-event card image + a branded favicon.**
  Split out of H3, which shipped everything else. Two leftovers:
  (a) the preview image is one shared card for every pool; the badge colors for all 48
  tournaments already exist in `public.pga_event_badges`, so a loop over
  `scripts/og/build-og.mjs` could pre-render one PNG per event and the edge function
  would pick it by `tourn_id` — the Masters invite would arrive in Augusta green.
  (b) `public/favicon.svg` is still the stock purple Vite logo.

---

## Closed (shipped / resolved)

Archived here rather than deleted — the resolution detail is the point. Newest first.
Historical audit-ID mapping (M2→C1, M3→C2, …) is preserved inline on each still-open
item as an `(AUDIT Mx)` tag.

- [x] 🟡 **C7 — Auth emails now send from `@getpoold.app` via custom SMTP.**
  *(Done 2026-07-16, PR #34.)* Resend is verified on `getpoold.app` (SPF/DKIM/DMARC
  all green) and wired into Supabase as custom SMTP — auth mail now sends from
  `login@getpoold.app` (host `smtp.resend.com`, user `resend`) instead of the
  rate-limited default `…@mail.supabase.io` sender. Custom SMTP also unlocked
  dashboard template editing, so the branded Magic Link template (fairway/cream/gold,
  "Make it interesting.") is live and tested end-to-end (send + sign-in); its
  versioned source stays at `supabase/templates/magic_link.html`, kept in sync with
  the dashboard by hand (this PR's only code change was that copy sync — "You're one
  tap in." → "Tap in."). Poold only ever calls `signInWithOtp` (`Login.jsx`,
  `Join.jsx`) — no signUp/reset/reauth/invite/email-change — so the Magic Link
  template is the only one of Supabase's six auth templates that's ever sent; the
  other five are dead weight in the dashboard. **A7 (inbound `privacy@` forwarder) is
  separate and still open** — this closed outbound mail only, not inbound MX.

- [x] 🟠 **C1 — AuthCallback dead-ended on the "Signing you in…" spinner.** *(Fixed 2026-07-15, PR #27.)*
  `AuthCallback` only navigated once `profile` was non-null, so the new-signup trigger
  race (profile row not yet readable) stranded users forever. `AuthContext.fetchProfile`
  now retries through the trigger gap (5× 400ms, `maybeSingle`); `AuthCallback` advances
  on `user` (not `profile`) and shows a "Back to sign in" fallback after 8s.
  `ProtectedRoute` still enforces the display-name gate once the row loads. (AUDIT M2.)

- [x] 🔴 **A1 — Privilege escalation: any user could make themselves admin.** *(Fixed 2026-07-14, PR #24 — `20260714000000_a1_lock_profile_role.sql`.)*
  `profiles` is now column-locked via GRANTs (`REVOKE UPDATE … ; GRANT UPDATE (display_name)`)
  — column privileges run before RLS, so `role` is unreachable from the Data API. Role
  changes go through `admin_set_role()`, a SECURITY DEFINER RPC that re-checks `is_admin()`
  and refuses a self-role-change. Also added the missing `WITH CHECK` to the self-update
  policy and pinned `search_path` on `is_admin()`. Highest-priority item of this scan.

- [x] 🟠 **A2 — Odds API key shipped in the browser bundle.** *(Fixed 2026-07-14, PR #24.)*
  `VITE_ODDS_API_KEY` was inlined into client JS. Moved behind
  `supabase/functions/odds-proxy/` (admin-JWT gate, key from the `ODDS_API_KEY` secret);
  `getGolfOdds` now calls `functions.invoke('odds-proxy')`. ⚠️ The old key was public for
  the life of the project — **assume burned**; rotating it + removing `VITE_ODDS_API_KEY`
  from `.env`/Netlify is a deploy step. (Was M1 in AUDIT.) Opened **A8** (odds-quota
  metering) as the follow-up.

- [x] 🟠 **H3 — `index.html` said "Golf Pick'Em"; invite links unfurled bare.** *(Done 2026-07-14, PR #26.)*
  Title is now "Poold — Make it interesting." with full OG/Twitter tags; `/join/*` renders
  a real preview card via the `join-preview` edge function reading `public.pool_preview(code)`.
  Leftover (per-event card image + favicon) tracked as **H5**.

- [x] 🟠 **H1 — `docs/AUDIT.md` stale post-migration.** *(Done 2026-07-10.)*
  Superseded banner added pointing at this file.

- [x] 🟡 **H2 — CLAUDE.md / README described the pre-migration data model.** *(Done 2026-07-10.)*
  Added the "Data model (post multi-sport)" section pointing at `lib/golf.js` and the
  schema boundary; fixed the geocoder line and table names; updated README.

- [x] ⚪ **H4 — `MULTI_SPORT_MIGRATION.md` said "Planning / not yet executed."** *(Done 2026-07-10.)*
  Header updated to "Phases 1–4 shipped; Phase 5 cleanup pending" (ties to F1).
