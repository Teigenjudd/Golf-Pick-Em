# Codebase Audit — Follow-ups

> ⚠️ **SUPERSEDED (2026-07-09) by `docs/BACKLOG.md`.** This audit predates the
> multi-sport migration — its file paths and table names describe the old
> single-schema model, and some items are resolved. The C1–C4 resolution record
> below is still the historical reference; for anything open, use BACKLOG.md
> (its "Audit reconciliation" section maps every M/L item to a new ID).

Findings from the 2026-06-20 full-codebase audit. **C1–C4 (critical) are fixed**;
everything below the line is still open. File references point at the relevant
file + function — line numbers drift as the code evolves, so they're approximate.

Priority: 🔴 critical · 🟠 medium · 🟡 low

---

## ✅ Resolved — Critical (C1–C4)

- [x] **C1 — Pick integrity.** Picks had no server-side validation. Fixed in
  migration `20260620000000_security_hardening.sql`: `UNIQUE(tournament_id, user_id, tier_id)`
  + INSERT policy requiring the tier to belong to the tournament and the player
  to exist in `tier_players`.
- [x] **C2 — Pre-lock pick privacy.** "Anyone can read confirmed picks" replaced
  with a policy that only reveals others' picks after lock/lock_time.
- [x] **C3 — Email exposure.** `profiles` moved to column-level grants (no
  `SELECT` on `email` for anon/authenticated); admins read email via the
  `admin_list_users()` RPC. `AuthContext`/`AdminDashboard` updated to match.
- [x] **C4 — Committed cron secret.** Rotated `CRON_SECRET` (old value dead),
  cron jobs re-pointed, `cron-schedule.sql` placeholder-ized.

---

## 🟠 Medium — fix soon

- [ ] **M1 — Odds API key exposed in browser.** `src/lib/oddsApi.js` uses
  `VITE_ODDS_API_KEY`, which is bundled into client JS. Move it behind an edge
  function (same pattern as `slash-golf-proxy`). Do before any public/marketing push.
- [ ] **M2 — AuthCallback can dead-end on the spinner.** `src/pages/AuthCallback.jsx`
  gates navigation on `profile` being non-null; if the profile row isn't readable
  yet (new-signup trigger race) or errors, the user is stuck on "Signing you in…".
  Navigate on `user`, or handle the null-profile case.
- [ ] **M3 — Swallowed query errors → blank screens.** `TournamentDetail` `load()`
  only checks the tournament query error (picks/cache errors are ignored → empty
  leaderboard); `Dashboard` has no error branch at all. Surface a real error state.
- [ ] **M4 — Picks silently dropped on id/name mismatch.** `src/utils/scoring.js`
  `computeScores` matches by `player_id` then normalized name; an unmatched pick
  silently scores `null` (benched) with no signal. Flag unmatched picks instead.
- [ ] **M5 — Failed score refresh still burns an allowance.** `AdminDashboard`
  `refreshScores` doesn't check the `functions.invoke` result and always
  increments `manual_refresh_count`. Only count successful refreshes; surface
  failures. (Limit is also client-side only — admin-only, low risk.)
- [ ] **M6 — Scoring ignores DQ / DNS states.** `scoring.js` only special-cases
  `wd`/`cut` (+20). A DQ'd or never-started player with `total: '-'` falls through
  to `null` (benched) instead of being penalized. Decide intended handling.

---

## 🟡 Low — nice to have

- [ ] **L1 — AuthContext loading is fragile.** `src/context/AuthContext.jsx` relies
  on `onAuthStateChange(INITIAL_SESSION)` to clear `loading`, and runs
  `fetchProfile` twice on load (getSession + listener). Consolidate.
- [ ] **L2 — N+1 inserts on tournament creation.** `CreateTournament` `handleCreate`
  inserts tiers/players one at a time in an awaited loop (~16 round-trips for 8
  tiers), with no transaction. Batch inserts; consider an RPC for atomicity.
- [ ] **L3 — Non-atomic API usage counter.** `poll-leaderboard` and
  `slash-golf-proxy` read-then-write `api_usage.slash_golf_calls` (lost-update
  under concurrency) and use `.single()` (errors when the month row is absent →
  use `.maybeSingle()` or an atomic increment RPC).
- [ ] **L4 — Mobile: My Picks row overflows.** `Dashboard` packs name +
  "edit picks" + "leaderboard" + badge in one non-wrapping flex row; tight on
  ~360px screens. Stack actions or hide labels on small screens.
- [ ] **L5 — Mobile: tier drag-and-drop is rough on touch.** `CreateTournament`
  uses a 2-col `PointerSensor` DnD that conflicts with scroll on touch.
  Admin-only/desktop-likely, so low — revisit if admins use phones.
- [ ] **L6 — Dead code / cleanup.**
  - `src/pages/Pending.jsx` + the `/pending` route — approval was removed; nothing
    navigates there. The `profiles.status` column is likewise vestigial.
  - `@dnd-kit/utilities` in `package.json` — never imported.
  - Duplicated helpers: `parseScore` / `normalizeName` now live in `scoring.js`,
    `components/leaderboard/Widgets.jsx`, and `CreateTournament.jsx` (plus
    `unwrapNumber` in a couple of places). Consolidate into `utils/`.
  - `package.json` name is still `"golf-temp"`.
- [ ] **L7 — join_code readable for all tournaments.** RLS lets any authenticated
  user SELECT every non-draft tournament row incl. `join_code`. Minor (codes are
  the access gate, anyone can join), but worth scoping.

---

## Other follow-ups (not from the audit)

- [ ] **Demo: frozen leaderboard.** The `/demo` board is a static snapshot
  (`src/demo/demoData.js`) and won't move with a live tournament. Re-snapshot or
  wire a refresh if a "live" feel is wanted. Re-generation is scripted.
- [ ] **Demo: picks reset on refresh.** Demo selections live in memory
  (`DemoContext`); refreshing `/demo/tournament` after submitting drops the "You"
  card. Add `sessionStorage` persistence if desired.
