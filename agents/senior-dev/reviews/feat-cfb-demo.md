# Senior review — feat/cfb-demo

- **Reviewed:** 2026-08-15
- **Head:** 122945e
- **Verdict:** APPROVE

## Summary
Adds a CFB demo (`/demo/cfb` + `/demo/cfb/picks`) mirroring the golf demo, turns
DemoLanding into a golf/CFB sport chooser, and adds a shared `CfbRulesButton` "How
scoring works" modal wired into both the live CFB pages and their demo counterparts. The
fixture simulates a season one week in: Week 1 is graded (totals run through the real
`shapeCard` engine, not hand-typed) and Week 2 is an open slate the visitor builds live
via a new in-memory `DemoCfbContext`. It's a clean, faithful copy of the existing golf-demo
pattern — the demo pages reuse the real CFB leaf components directly, contain zero backend
calls, and the two shared-component tweaks (`StandingsCard` `action` prop, `CfbGameCard`
chip) are backward-compatible. Build passes; worked examples in the rules modal are
computed from the real scoring engine and I verified each one by hand. No blockers.

## Findings

**Verified clean (the things the dispatch flagged to check):**
- **No prod/backend reachability from the demo.** The only `lib/` import across `src/demo`
  is `weekIsLocked` from `lib/cfb.js`, which is a pure date/status comparison — no
  Supabase call. Everything else is fixture data + pure util functions
  (`shapeCard`, `buildPicksPayload`, `cfbCardValidity`). Nothing touches the DB.
- **No golf regression from `StandingsCard`.** The new `action` prop defaults to `null`;
  golf callers pass nothing, so the header renders label-left exactly as before (the
  `flex justify-between` with an empty second child is a no-op visually).
- **`CfbGameCard` chip is an accuracy fix, not a regression.** `tier` is
  `underdogTier(underdog_spread)` (the point value 1/2/3), so "2 pts" is correct and the
  old "+2" genuinely read like a spread. Pure presentational change, shared by live + demo.
- **Rules modal math checks out.** ATS (−7, win by 10 → cover +1), double-down
  (buffer 4 → effective −11, win by 12 → +2), and underdog tiers (+1.5–6.5=1,
  +7–13.5=2, +14+=3, "+9 → 2 pts") all match `cfbScoring.js` exactly, and the
  double-down effective line is computed via `effectiveDoubleDownLine`, not hardcoded.
- **Week-1 fixture cards are all valid** — every card is 5 ATS on 5 distinct games + a
  double-down on one of those 5 + an underdog on a distinct 6th underdog-eligible game.

**nit — demo re-implements ranking instead of calling `projectSeasonStandings`.**
`src/demo/demoCfbData.js:105-110` hand-rolls competition ranking
(`arr.findIndex(x => x.total === e.total) + 1`). It's a faithful copy of the real
`projectSeasonStandings` (`src/utils/cfbScoring.js:181`) and produces identical ranks, so
there's no bug today — but it's a second copy of the same ranking rule, which is the exact
drift the "reuse the real code" philosophy of this PR is trying to avoid everywhere else.
Calling `projectSeasonStandings` would remove the duplication and hand back the `display`
subtitle for free. Cost is low (one derived array is one week's worth of static data);
leaving it is fine, just noting it.

## Questions for the founder
None — clean to merge. The nit above is a take-it-or-leave-it tidy, not a decision that
needs your input before this lands.
