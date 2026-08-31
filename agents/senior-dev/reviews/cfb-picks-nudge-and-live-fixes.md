# Senior review — cfb-picks-nudge-and-live-fixes

- **Reviewed:** 2026-08-31
- **Head:** e86a30d
- **Verdict:** APPROVE WITH QUESTIONS

## Summary
Three small, unrelated CFB UI changes bundled into one PR: (1) a picks-status banner on
the CFB pool-detail page mirroring golf's leaderboard banner, (2) a `min-w-0` flexbox
truncation fix on the CFB scorecard-expand and read-only card, and (3) a live
down/distance/possession/clock line on the slate page. Changes 2 and 3 are clean and
correct — textbook fixes reading fields that already exist. The banner (change 1) works,
but a reused guard (`!preSeason`) suppresses it during exactly the window it's built for:
the open, not-yet-graded first week. That's the one thing worth a decision before merge;
everything else is nits or approve-as-is.

## Findings
Ranked most-severe first.

### 1. (debt / design gap) The picks nudge is hidden during the open first week — its main use case
`src/pages/cfb/CfbPoolDetail.jsx:230` gates the banner on `selectedWeek && derived && !preSeason`.
`preSeason` (line 190) is `derived && !derived.hasStandings`, and `hasStandings` (line 115)
is `standings.length > 0`. Per CLAUDE.md, `public.pool_standings` has no rows until the
grader writes the first one — which happens only *after* Week 1's games go final and are
graded. So for the entire first week of a season (pool open, players joined, Week 1
pickable, nothing graded yet), `preSeason` is `true` and the banner does **not** render.
A brand-new joiner who hasn't submitted a Week 1 card sees no "Make picks →" prompt at
all; the nudge first appears in Week 2.

That's the primary scenario the feature is for. Note the golf banner it mirrors
(`TournamentDetail.jsx:189`) gates only on `!isDraft` — it shows during an open,
ungraded pool. The `!preSeason` gate is a CFB-only divergence that switches the nudge off
precisely when it matters most. Nothing crashes and `derived`/`myWeek` compute fine
during preseason, so this is a display suppression, not a null-safety guard — dropping
`!preSeason` from the banner condition (keeping it on the standings "Season kicks off…"
copy) is the likely fix. See Question 1.

### 2. (nit) A non-participant viewing the pool sees a "Make picks" prompt that can't succeed
`CfbPoolDetail.jsx:162` — `myWeek` is `null` when the current user isn't in
`participants` (e.g. an admin opening `/cfb/pool/:id` by direct URL; the route is
Protected, not participant-gated). With `myWeek` null the banner falls to the
"You haven't made your picks… / Make picks →" branch, and the link lands on the picks
builder where `cfb_submit_week_picks` would reject the write (no `pool_participants` row).
This mirrors golf's existing behavior, so it's not a regression — just flagging that the
mirror carried the same rough edge. Low priority.

### 3. (nit) An auto-filled card reads as "Your picks are locked in."
Once a week locks, `cfb.autofill_week` drops a random valid card into every empty
participant's week. After that, `myWeek.state === 'card'` and the banner says "Your picks
are locked in." — indistinguishable from a card the player actually built. The read-only
card surfaces elsewhere do label auto-fill; the banner doesn't. Minor wording nuance, not
worth blocking.

### Not issues (checked)
- **`min-w-0` fix** (`CfbCardReadonly.jsx:36`, `CfbStandings.jsx:108`): correct, standard
  flexbox fix — a `flex-1` child defaults to `min-width:auto` and won't shrink below its
  content, so long "… · Final" text overflowed instead of truncating. Two identical
  one-liners, right root cause.
- **`LiveDetail`** (`CfbSlate.jsx`): field names (`period`, `clock`, `possession`,
  `situation`) match the `live` jsonb written by `buildLiveState` in
  `supabase/functions/_shared/cfbLive.ts:42-48`, and the slate query selects `live`
  (`src/lib/cfb.js:276`). Guards are sound: renders only when `status === 'in_progress'`,
  bails on missing `live`, resolves possession by team and drops unknown values via
  `filter(Boolean)`. Clean.
- Pre-existing eslint `react-hooks/set-state-in-effect` in `CfbSlate.jsx` predates this
  branch (confirmed by the dispatcher via `git stash`) — not introduced here. Still open,
  but not this PR's to fix.

## Questions for the founder
1. **The Week-1 nudge gap (Finding 1).** The new "make your picks" banner is switched off
   until the pool has graded at least one week — meaning it doesn't show during the very
   first week, when a new player most needs the reminder to submit their first card. That
   came from reusing the `preSeason` flag (which just means "no standings yet"). Was that
   deliberate — e.g. to avoid clutter next to the "Season kicks off Week 1…" message — or
   should the banner show during an open, ungraded first week the way golf's does? If you
   want it visible in Week 1, the fix is to stop gating the banner on `preSeason` (leave
   that gate only on the standings copy). This is the one call worth making before merge;
   the rest is fine to ship as-is.
