# Senior review — feat/cfb-week-0-cfbd-mapping

- **Reviewed:** 2026-08-18
- **Head:** 7e59ba0
- **Verdict:** APPROVE WITH QUESTIONS

## Summary
Follow-up to PR #62. That PR let a CFB pool start at "Week 0" (the pre-Labor-Day slate,
e.g. TCU/UNC) by allowing a `cfb.weeks.week_number = 0` row, but nothing ever populated
it: CFBD doesn't give that slate its own week number — it lumps those games in with the
following weekend's real Week 1 under the same raw `week: 1` (founder confirmed against
live data). This PR teaches the two CFBD-facing edge functions to interpret that: a new
`WEEK_ZERO_CFBD_WEEK = 1` constant, a manual per-season UTC date window, `isWeekZeroGame`
(date-based split), and `ourWeekToCfbdWeek` (0 → 1, everything else unchanged). The poller
uses the date window to route a `week: 1` game to our week 0 vs 1; the grader groups by the
resolved CFBD week so weeks 0 and 1 share one `/games?week=1` call. I traced the control
flow in both functions plus the two paths this PR *didn't* touch — the fix is correct and
complete, and the failure mode for an unconfigured season is safe (inert, not broken). The
only things worth your attention are a future-season operational footgun and a small
robustness nit; neither blocks merge.

## Findings

### 1. Correctness — the fix is correct; no missed match sites (not a finding, the answer to your three questions)
- **Lexicographic ISO comparison is safe here.** `isWeekZeroGame` string-compares the
  kickoff against the window bounds. This is only valid because every string involved is
  UTC, `Z`-suffixed, and zero-padded (`YYYY-MM-DDTHH:MM:SS…Z`) — for that exact format,
  alphabetical order *is* chronological order. CFBD's `startDate` is that format (the line
  two above, `Date.parse(row.kickoff_at)`, already relies on it being parseable ISO). The
  window is also deliberately loose: a 2-day UTC span for a slate that plays one Saturday,
  with a ~5-day gap to the next slate (real Week 1 opens Thu 9/3/2026). So there's enormous
  margin — the string comparison cannot realistically land on the wrong side. See finding 3
  for the one way it could theoretically drift.
- **The grade-cfb-week dedup does not risk ungraded/double-graded weeks.** Collapsing
  `week_number` 0 and 1 into one `season::1` group only shares the *CFBD fetch*
  (`scoreByGameId`). Inside the group, each week row is still graded individually via
  `gradeWeek(supabase, w, …)`, driven by that week's own `cfb.games` rows (matched to the
  score map by `cfbd_game_id`), not by iterating the CFBD payload. A week appears in exactly
  one group's `rows` exactly once. The realistic case — one event that has *both* a week-0
  and a week-1 row, both due — is exactly this scenario and is handled correctly: one call,
  each week graded off its own frozen games. No cross-contamination.
- **No other place matches CFB weeks to CFBD by raw week number.** I checked the two paths
  this PR leaves alone. `poll-cfb-scores` pulls the whole live slate from `/scoreboard` and
  matches by `cfbd_game_id` against our already-stamped `week_id`, so it inherits the correct
  week assignment the poller made — immune by construction. `_shared/cfbGrading.ts` uses
  `week_number` only for internal standings display, never in a CFBD query. This PR covers
  the complete set of CFBD-week-facing code.

### 2. Debt (low) — an unconfigured future season is a silent, hard-to-diagnose dead pool
`WEEK_ZERO_WINDOW` only has 2026. The code comment frames a missing season as "inert, not
broken," which is true *for the poller* — but trace it forward for a real Week-0 pool created
in an unconfigured season (say 2027): `isWeekZeroGame` returns false, so no game ever routes
to that pool's `week_number = 0`, so `cfb.games` for that week stays **empty**. An empty week
means players see no slate to pick, and `autofill_week` can't drop a valid card (it needs 6
distinct games). The pool's opening week is quietly broken with no error surfaced anywhere.
The safe-fail story holds only if someone remembers to update the map *before* creating such
a pool. Cost: a future season's Week-0 pool silently doesn't work, and the symptom (empty
week) points nowhere near the cause (a missing entry in a Deno shared file). Fix direction is
a founder call — see the question below.

### 3. Nit — string comparison relies on an undocumented CFBD format invariant; epoch-ms compare would be strictly safer
Two lines above `isWeekZeroGame`'s call, the poller already does
`Date.parse(row.kickoff_at)`. `isWeekZeroGame` could take that parsed millisecond value and
compare it numerically against `Date.parse(start)` / `Date.parse(end)`. That removes *all*
dependence on CFBD's string format — if CFBD ever emitted an offset form like `+00:00`
instead of `Z`, or dropped zero-padding, numeric comparison stays correct where lexicographic
comparison could silently misorder. Today it works and is well-tested, so this is polish, not
a bug — but it's a cheap way to delete a latent assumption and it matches the `koMs` pattern
right next to it. (Minor: `const window` inside the function shadows the `window` global —
harmless in Deno, just slightly smelly.)

### 4. Consistency — good
Uses the shared `_shared/cfbSlate.ts` seam, a named constant with a genuinely useful comment
explaining *why* (the CFBD lumping), and vitest coverage that imports the `.ts` directly
(same pattern as `cfbLive`/`cfbScoring`). Test cases are well-chosen: in-window, late-night
UTC rollover, following-weekend rejection, unconfigured season, null kickoff. No new pattern
forked. This is clean, idiomatic work.

## Questions for the founder

1. **The manual per-season date window is a yearly maintenance item with a quiet failure
   mode — do you want a guard rail, or is "remember to update it" fine for now?**
   Plain version: the code that decides "is this game part of Week 0?" has the 2026 dates
   hard-coded in one spot (`WEEK_ZERO_WINDOW`). If a future season isn't added there and
   someone still creates a Week-0 pool for it, that pool's first week comes up completely
   empty — no games to pick, autofill can't fill it — and nothing anywhere throws an error,
   so it'd be a real head-scratcher to debug months from now. The trade: leaving it as-is
   keeps this PR tiny and it's genuinely fine while there are no real users, but it banks a
   trap for future-you. A cheap mitigation later would be to have CFB pool creation refuse
   (or warn) when someone picks Week 0 for a season that isn't configured. Not a merge
   blocker — more a "put it on the list for before the 2027 season" decision. Do you want
   that as a backlog item, or are you comfortable owning the yearly edit by hand?
