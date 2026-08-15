# Senior review — feat/admin-refresh

- **Reviewed:** 2026-08-15
- **Head:** aee4873
- **Verdict:** APPROVE WITH QUESTIONS

## Summary
A large but well-factored "admin refresh" + dashboard/nav overhaul. It unifies the golf
and CFB admin panels behind a shared `AdminShell` (nav + sport switcher + a "Users &
Settings" link), pulls role management out into a sport-agnostic `/admin/users` page,
deletes the app-wide `BottomNav` in favor of a header avatar (a `ProfileMenu` dropdown for
admins), adds a generic `BottomSheet` for the join/add-pool flows, extracts a `PoolCard`
component that fixes three real closed-pools bugs on the dashboard, and does a broad
user-facing "tournament" → "pool" copy cleanup (routes/filenames deliberately untouched).
I traced the interactive control flow — the sheet state machine, the `PoolCard` open-vs-
closed split, the count pills, the admin/non-admin avatar branch, and the null-sport case
on the Users page — and found **no correctness bugs and no blockers**. The three claimed
closed-pools fixes check out. Findings below are tech debt, a couple of nits, and a
process gap (nothing was click-tested). The questions are design confirmations, not defects.

## Findings

Ranked most-severe first.

1. **debt — Deleting the "Participants" tab removes a real admin capability, not just
   dead weight.** `src/pages/admin/AdminDashboard.jsx` (removed `ParticipantsTab`). That
   tab was the only in-app way for a commissioner to (a) see *every* participant's
   submitted card in a golf pool, including unconfirmed picks before lock, and (b) remove
   a participant's picks from a pool (`removePoolParticipant`). Viewing cards is largely
   redundant with the public post-lock leaderboard, but "remove a participant" is a
   genuine unique power (kick a duplicate/mistaken/bad-actor account). It's recoverable —
   the backing function still exists — but there is now no UI for it. Fix direction:
   confirm it's intentionally out of scope for now (see Q1); if so, fine to defer.

2. **debt (nit) — Two now-dead exports in `src/lib/golf.js`.** `getAllPools`
   (`golf.js:117`) and `removePoolParticipant` (`golf.js:301`) have no remaining callers
   after this branch (both only lived in the deleted Participants tab / the old dashboard
   admin list). Harmless, but they'll read as "supported" to the next person. Fix
   direction: delete them, or leave a one-line comment that they're kept for the
   soon-to-return participants UI.

3. **debt (nit) — Misleading empty-state text when all pools are closed.**
   `src/pages/admin/cfb/CfbAdmin.jsx` and the pre-existing `TournamentsTab` in
   `AdminDashboard.jsx`. When pools exist but are *all* complete and the "Show closed (N)"
   toggle is collapsed, the page shows both a "Show closed (2)" button *and* "No CFB pools
   yet. Create one to seed a season…" — which is false and contradictory. This mirrors
   golf's existing behavior (a deliberate consistency choice, not a new bug), so it's low
   priority. Fix direction (both sports, one line each): when `pools.length > 0 &&
   visible.length === 0`, show "All pools are closed — use the toggle to view" instead of
   the "create one" copy. See Q2.

4. **nit — Stale BottomNav comments left in dev tooling.**
   `.design-sync/ds-entry.js:39`, `.design-sync/NOTES.md`, `.design-sync/supabase-stub.js`
   still mention BottomNav after its deletion. Dev-tooling only, no broken code (the
   config/export entries were correctly removed, and I confirmed no product file imports
   BottomNav). NOTES.md even notes it was deleted, so this is cosmetic. (docs/PAGES.md and
   CLAUDE.md still document BottomNav — that's pm-sync's job, not this review's.)

5. **process gap — Nothing was click-tested.** This branch introduces several new
   *interactive* pieces: a modal `BottomSheet` (backdrop + Escape close), a `ProfileMenu`
   dropdown (outside-click scrim + Escape), the add→join sheet swap, and the collapsible
   closed-pools row. Only build + lint were verified; there's no browser-automation tool
   here. The code reads correct, but modal focus/scroll behavior and the sheet transition
   are exactly the kind of thing that looks right and feels wrong. Recommend one manual
   mobile click-through of: header "+" (as admin and as non-admin), the dashed card, the
   avatar dropdown, and expand/collapse of closed pools, before merge.

Pre-existing `react-hooks/set-state-in-effect` lint: the `useEffect(() => { load() },
[load])` pattern moved from the old `UsersTab` into the new `AdminUsers.jsx` — relocated,
not worsened, and the deleted `ParticipantsTab`'s effect went away, so the net count is
flat-to-down. Not flagging as new.

## Questions for the founder

1. **Losing the "remove a participant" admin control — intended?** The old admin
   "Participants" tab was the only screen where you could see everyone's picks in a golf
   pool *and* remove someone from it. This branch deletes it as unused. Viewing picks is
   mostly covered by the public leaderboard once picks lock, but *removing* a participant
   (e.g. a duplicate signup or someone who joined the wrong pool) now has no button
   anywhere — you'd need a developer to do it by hand. The underlying function still
   exists, so it's easy to bring back later. Trade: a cleaner admin area now vs. no
   self-serve way to kick someone until it's rebuilt. Are you comfortable shipping without
   it?

2. **The "No pools yet" message when everything's closed — worth a quick fix?** On both
   the golf and CFB admin lists, if every pool you've made is finished ("closed") and the
   closed-pools toggle is collapsed, the page says "No pools yet. Create one…" right next
   to a "Show closed (2)" button — which contradicts itself. It's a one-line copy fix on
   each page. Want it fixed now (it's cheap), or is it fine as-is since it mirrors how golf
   already behaved?

3. **(confirm only) Bottom nav is gone — profile lives in the top-right avatar now.** On
   phones, a bottom tab bar is the easiest thing to reach with a thumb; you've moved
   Profile/Admin up to the top-right corner instead (matching the design-tool mockups).
   That's a deliberate look, and there were only two tabs, so this is likely fine — just
   confirming the thumb-reach tradeoff on mobile is the one you want.
