# Senior review — fix/cfb-week-premature-lock

- **Reviewed:** 2026-09-18
- **Head:** 6e92147
- **Verdict:** APPROVE

## Summary
One-file fix to `supabase/functions/_shared/cfbGrading.ts`. The shared `gradeWeek` routine
used to set a week's `status='locked'` any time it ran on a not-yet-fully-final week —
and `poll-cfb-scores` runs it the moment *any single game* in a week goes final. Since
`cfb_submit_week_picks` gates submission on `status IN ('locked','graded')`, a Thursday
game finishing would lock the whole Saturday slate hours/days before its real `lock_time`.
The fix flips to `'locked'` only once `lock_time` has actually passed; otherwise it leaves
`status` unchanged. The `'graded'` (all games final) and `finalize` (admin escape-hatch)
branches are untouched, and the per-game kickoff lock is correctly left alone. This is the
right, minimal fix and it restores the intended design: a week stays open until its
deadline, with the per-game `kickoff_at` lock handling already-started games individually.

## Findings

- **(no blockers, no debt)** — Traced the full control flow and every adjacent lock path;
  the change is correct and consistent:
  - Both callers select `lock_time` (`poll-cfb-scores/index.ts:165`,
    `grade-cfb-week/index.ts:97`), so the new `week.lock_time` read is always populated —
    no path silently stops locking.
  - The nested ternary is correct. Null `lock_time` → `lockTimePassed=false` → status
    left as-is, which matches `process_locked_weeks` (it only touches
    `lock_time IS NOT NULL` weeks). Consistent behavior for an unset deadline.
  - **No autofill gap.** When `gradeWeek` (via `poll-cfb-scores`) flips a post-deadline
    week straight to `'locked'`, missed cards still get filled: `process_locked_weeks`'s
    fill loop selects on `lock_time <= now() AND status <> 'graded'` (not on
    `status='scheduled'`), and `grade-cfb-week` also runs `autofill_week` as a backstop
    before grading.
  - **More consistent with admin unlock, not less.** `admin_unlock_week`
    (`20260904000000_…sql`) deliberately re-opens by setting `status='scheduled'` without
    touching `lock_time`, accepting that `process_locked_weeks` will re-lock if the
    deadline is still in the past. After this fix `gradeWeek` follows the exact same
    `lock_time`-gated rule; *before* it, `gradeWeek` would re-lock even with a deadline in
    the future, actively fighting a legitimate unlock. The fix improves this.
  - **Manual early lock respected.** If an admin `admin_lock_week`s a week before its
    deadline (`status='locked'`, `lock_time` future), a subsequent partial-final poll
    computes `lockTimePassed=false → nextStatus=week.status='locked'` → no change. Good.

- **nit (optional):** No automated test guards this status-transition logic. The parity
  test covers `cfbScoring`, not `gradeWeek`'s week-status branch — which is exactly where
  the prod incident lived. A tiny table-style unit test over the four cases
  (`finalize` / `allFinal` / `lockTimePassed` / neither) would make this class of
  regression impossible to reintroduce silently. Not merge-blocking.

## Questions for the founder
One thing to confirm, framed as a decision — not a blocker:

- **Week label during live Thursday/Friday play.** With this fix, a week now correctly
  stays labelled `'scheduled'` right up until its real deadline, even while an early game
  in it has already kicked off, finished, and had its picks graded into the live
  standings. ("`status`" here is just the week's state label — `scheduled` / `locked` /
  `graded` — that the app reads to decide whether the whole week is open for picks.) That
  is the correct trade for the submission gate (the whole point of the fix), and the
  per-game kickoff lock still stops anyone editing the game that already played. The only
  side effect is cosmetic: on the admin ops page a week can read `scheduled` while one of
  its games is visibly final. Are you happy leaving the label as-is until `lock_time`, or
  do you eventually want an in-between "in progress" label so the ops view isn't
  momentarily misleading? Fine to defer — flagging so it's a choice, not a surprise.
