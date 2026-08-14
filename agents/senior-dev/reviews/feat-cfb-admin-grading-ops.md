# Senior review — feat/cfb-admin-grading-ops

- **Reviewed:** 2026-08-13
- **Head:** 364b09d (`git rev-parse --short HEAD`)
- **Verdict:** APPROVE WITH QUESTIONS

## Summary
PR9a adds the admin controls to grade a CFB week and closes the two review-deferred gaps
from PR5. `gradeWeek` (shared by the manual grader and the live poller) gains an
`opts.finalize` override; `grade-cfb-week` parses `finalize` and adds a lock-time guard on
the targeted `{week_id}` path; `src/lib/cfb.js` adds `finalizeCfbWeek`; `CfbPoolOps.jsx`
grows per-week "Grade week" / "Finalize as-is" buttons plus a "Refresh scores" button.
I traced all five of your worry-list items plus the four builder flags. **The core design
is implemented correctly — no correctness blockers.** The default (non-finalize) path is
genuinely byte-identical, so live scoring is unaffected; finalize does the right thing;
the lock guard and the `'push'` value both hold. The one thing worth fixing in-branch is a
latent (currently unreachable) footgun in how `finalize` is parsed. The rest are
low-stakes rules/UX questions for you, not code defects.

## Findings
Ranked most-severe first.

### 1. `finalize` is parsed independent of `week_id` — a body-only footgun (debt; recommend the one-line fix)
`grade-cfb-week/index.ts:71` sets `finalize = body?.finalize === true` **before** it's
known whether a `week_id` was given, and line 193 threads that same `finalize` into
*every* week in scan mode. So a call of `{ "finalize": true }` with **no** `week_id` would
run scan mode and force-finalize **every due week across every pool at once** — voiding all
their not-yet-final picks as pushes and stamping each week `graded`. That is a large,
hard-to-undo blast radius.

**Is it reachable today? No.** `finalizeCfbWeek` always sends a `week_id`, and the cron
sends no body, so nothing in the shipped app can trigger it. It only becomes reachable via
a future "finalize all due" button or a hand-rolled admin call. But the fix is one line and
removes the sharp edge permanently — ignore/reject `finalize` unless a `week_id` is present,
e.g. `finalize = body?.finalize === true && targetWeekId != null` (or return a 400 for
`finalize` without `week_id`). The builder already flagged this (their flag #4); I agree it's
worth doing now. **Not a merge blocker** given it's unreachable, but cheap insurance against
a foot-gun that only shows up under a future change.

### 2. Finalize is a blunt, one-way instrument through the UI (nit / operational note)
Once `finalize` stamps a week `graded`, both per-week buttons disappear (`CfbPoolOps.jsx:280`
gates on `w.status !== 'graded'`) and scan mode skips graded weeks
(`index.ts:100`, `.neq('status','graded')`). So if an admin clicks "Finalize as-is" too early
— before a game that *was* going to finish reports final — those picks are voided to
push/0 and there's no in-app path to re-grade them; recovery needs raw SQL to flip the week
back to `locked`. It's guarded by a `window.confirm` naming the week, which is reasonable for
a rare escape hatch, so this is a caution, not a bug. Flagging so you know the semantics:
finalize is intended to be irreversible-via-UI.

### 3. Response `final: false` on a finalized (graded) week (nit — inert)
Builder flag #2. In finalize mode the returned payload still carries `final: result.allFinal`,
which can be `false` even though the week is now `graded`. Harmless: the finalize handler
never reads `final` (it prints "Week is now graded"), and scan-mode re-polling keys off
`status`, not this field. No fix needed; noting it's intentional so a future reader isn't
confused.

### 4. `picks_graded` counts voided pushes (nit — non-issue)
Builder flag #1. In finalize, each voided pick does `picksGraded++`, so the count mixes
real-graded and no-contest picks. The UI copy already says "N picks scored (unfinished games
marked no-contest)," which is honest. Fine as-is.

## What checked out clean (traced, no action)
- **Default path byte-identical (worry #1).** `poll-cfb-scores` calls
  `gradeWeek(supabase, w, finalScoreMap)` with no `opts` (`poll-cfb-scores/index.ts:177`), so
  `finalize` is `false`. The `!g` branch then falls straight through to `continue` exactly as
  before, and `nextStatus` reduces to `allFinal ? 'graded' : 'locked'`. Live scoring and
  normal grading are unaffected.
- **Finalize correctness + idempotency (worry #2).** Only games absent from `finalById`
  (i.e. not final) get `result:'push', base:0, bonus:0`; real-final games still grade through
  the scoring engine (`cfbGrading.ts:100-137`). Week is forced `graded` (line 144). Re-running
  finalize re-writes the same push (no-op); a voided pick contributes `0+0` to
  `recomputeStandings` (line 180), so standings are correct.
- **Lock guard fires for both grade AND finalize, scan untouched (worry #4).**
  `index.ts:108-113` runs only when `targetWeekId` is set, refusing a null-or-future
  `lock_time`, and it sits *before* the grade loop — so it blocks the finalize path too. The
  scan path (`targetWeekId` null) skips the guard and keeps its existing
  `lte('lock_time', nowIso)` gate.
- **`'push'` satisfies the CHECK for all three pick types (worry #5).** The constraint is
  column-level — `result text CHECK (result IN ('cover','push','miss','win','loss'))`
  (`20260811000000_cfb_phase1_scaffold.sql:89`) — not conditional on `pick_type`, so
  `'push'` is legal for ATS, double-down, and underdog picks alike. No runtime throw.
- **Scope.** Diff touches only CFB files + `docs/PAGES.md`; no golf code, no migration, no
  deploy. Consistent with the `lib/cfb.js` seam, the invoker pattern, and the design-token
  danger-button style (`border-birdie/30 text-birdie`).

## Questions for the founder
Plain-English, decisions only — nothing here blocks merge.

1. **Double-down on a cancelled game — is push/0 the rule you want?** (Builder flag #3.)
   When you "Finalize as-is" a stuck week, a player who spent their once-per-week
   double-down on the cancelled game just gets 0, and there's no "give them their
   double-down back on another game." In a no-money pool where finalize is a rare
   escape hatch, "everyone whose game got cancelled scores 0 on it" is simple and
   symmetric — I think it's fine. Confirming you're happy with *no slot refund* rather
   than any make-good, so it's a decision on record, not an oversight.

2. **The one-line footgun guard (finding #1) — want it in this PR?** Short version:
   the grading function currently *could* be told "finalize everything that's due" in one
   shot if some future code called it wrong. Nothing today does that, so it's safe to
   ship as-is, but a one-line guard makes that mistake impossible for good. My
   recommendation is to add it now while it's fresh; your call whether to fold it into
   this PR or leave a note for later.

3. **Finalize is deliberately one-way through the admin UI (finding #2).** Once you
   finalize a week, the Grade/Finalize buttons vanish and it won't re-grade itself —
   undoing it needs a database edit. That's the intended "un-stick it and move on"
   behavior, and it's behind a confirm dialog. Just confirming that's the trade you
   want (blunt but final), versus keeping a way to re-open a finalized week from the UI.
