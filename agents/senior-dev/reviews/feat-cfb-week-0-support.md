# Senior review — feat/cfb-week-0-support

- **Reviewed:** 2026-08-17
- **Head:** f20bf56
- **Verdict:** APPROVE

## Summary
Small, well-targeted change that lets a CFB pool start at Week 0 (CFBD's real
pre-Labor-Day slate). It drops the admin form's "First Week"/"Last Week" floor from 1 to
0, and fixes the latent bug that raising the floor exposes: four pages that read `?week=N`
from the URL used `Number(searchParams.get('week'))`, which turns a *missing* param into
`0` — harmless while no Week 0 existed, but the moment a pool has one, landing on a page
with no `?week` param would silently jump to Week 0 instead of the intended default
(current/open week). I traced all four sites and the surrounding week plumbing (the week
selector, the deep-link generation, the pool-creation loop, and the CFBD-facing server
code) — the fix is correct and complete, and I found no other place that treats a
week number as a boolean. One minor validation edge is noted below; it's not a blocker.

## Findings

**1. (nit) An empty "First Week" field now silently means Week 0 — `CreateCfbPool.jsx:39`.**
The validity check changed from `Number(startWeek) >= 1` to `>= 0`. `Number('')` is `0`,
so with the old `>= 1` an empty First Week field was incidentally rejected; now
`0 >= 0` is true, so if an admin clears the First Week box (the default is `'1'`, so this
only happens on a deliberate clear), the form stays valid and `createCfbPool` seeds the
pool starting at Week 0 rather than showing the "valid week range" error. Cost is low —
it's an admin-only page, the field defaults to a real value, and the resulting pool is
still coherent (a Week 0 pool) — but the check no longer distinguishes "unset" from
"intentionally 0". If you want to be strict, gate on the raw string being non-empty
before coercing (e.g. `startWeek !== '' && Number(startWeek) >= 0`). Pre-existing and
unchanged by this PR: the `max={20}` cap is a browser hint only, not enforced in
`weeksValid`, so a typed `25` would also pass — same class of gap, worth knowing but out
of scope here.

## Questions for the founder
None that block merge. One optional call, framed as a trade: the four `?week=` fixes now
honor an explicit `?week=0` as a real deep-link (good — that's the point). That means any
old bookmark or shared link that happened to carry `?week=0` will now resolve to a Week 0
card instead of falling through to the current week. Given Week 0 didn't exist before this
branch, no such links can exist yet, so there's nothing to migrate — just confirming you
want `?week=0` to be a first-class, linkable week (it now is). If yes, this is clean to
merge as-is.
