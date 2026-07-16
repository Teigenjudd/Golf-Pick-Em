# Senior review — chore/pr-review-and-pm-subagents

- **Reviewed:** 2026-07-15
- **Head:** b89eec8 (`git rev-parse --short HEAD`)
- **Verdict:** APPROVE WITH QUESTIONS

## Summary
Config-only branch (no product source touched). It stands up the very merge flow this
review runs under: two `.claude` subagents — `senior-dev` (Opus, advisory code review)
and `pm` (Sonnet, doc reconcile) — each backed by a skill as the "single source of truth,"
plus a `/senior-review` skill, and a rewired `PreToolUse` guard renamed
`pm-sync-guard.mjs` → `merge-guard.mjs`. The guard now demands a committed review
artifact (only when code changed) *and* an `agents/pm/` touch, with `SENIOR_REVIEW_SKIP` /
`PM_SYNC_SKIP` escape hatches, and keeps the standing `docs/PAGES.md` rule. I traced the
guard's control flow end-to-end: the logic is correct and fails open on every error path,
the two agents are coherent and non-conflicting, and the artifact-as-proof pattern is the
right call (a hook can't observe an agent running, so it verifies a committed file). No
correctness bug or blocker. Findings are tech-debt and consistency items, plus one design
trade worth a conscious decision.

## Findings
Ranked most-severe first.

### 1. debt / design — the guard cannot gate changes to itself (`.claude/hooks/merge-guard.mjs:31`, the `NO_DOC_NEEDED` regex)
`NO_DOC_NEEDED` excludes everything under `.claude/`, and `CODE` only matches
`src|supabase|netlify|scripts`. So any branch that touches *only* `.claude/` files —
hooks, agents, skills — produces `substantive.length === 0` and hits the early
`allow()` at line 88. Concretely: a branch whose sole change is a bad regex edit to
`merge-guard.mjs` merges with **zero** checks — no senior review, no pm-sync — and could
silently weaken or disable the gate for every future PR, with nothing to catch it. This
branch is itself an instance (it merges clean because it happens to also touch
`agents/pm/PM.md`, not because the hook change was reviewed). A hook fundamentally can't
review its own change at merge time, so this isn't fixable in code — but it's a real
blind spot now that the hook carries branching logic. The mitigation is process: treat
`.claude/` edits as deserving manual review anyway (this dogfood run is exactly that).
See Question 1.

### 2. debt / coherence — stale `pm-sync-guard` references survive the rename
The hook was renamed to `merge-guard.mjs`, but two live references to the old filename
remain:
- `.claude/skills/pm-sync/SKILL.md:3` — the skill description still says "when the
  pm-sync-guard hook blocks a merge." This is config in scope for this branch and wasn't
  updated. Cosmetic (a description string; the skill still functions) but now wrong.
- `agents/pm/DECISIONS.md:274` — "Enforced by `.claude/hooks/pm-sync-guard.mjs`" now
  points at a deleted file. (The 2026-07-13 entry title at line 169 is historical and
  fine to leave.) This doc is pm-owned — pm-sync should fix the live pointer on the next
  pass, not me.
Cost: small, but the whole point of this branch is that docs/config match reality; a
dangling filename undercuts that on day one.

### 3. nit — agent files duplicate their skill's substance
`senior-dev.md` restates the four review axes verbatim from `senior-review/SKILL.md`, and
`pm.md` restates the pm-sync steps, even though both agents declare the skill is the
"single source of truth." That's two places to keep in sync; a future edit to the axes in
one will drift from the other. Acceptable as fast-orientation context for the agent, but
worth knowing it's a maintenance seam, not a DRY setup.

### 4. nit — test-only branches never trigger a senior review
`NO_DOC_NEEDED` matches `.*\.test\.[jt]sx?$` and test files don't match `CODE`, so a PR
that adds *only* tests produces no `codeChanged` and skips the review gate. Probably the
intended trade (tests are low-risk), but it means new test logic ships un-reviewed by
this flow. Flagging so it's a choice, not an accident. See Question 2.

## Questions for the founder
Plain-English, framed as trades.

**1. The gate can't guard its own wiring — is that trade acceptable, and how do we cover it?**
The "merge-guard" is a small script that blocks a merge until the review and doc steps
have run. Because it deliberately ignores changes under `.claude/` (where it, the agents,
and the skills all live), a branch that edits *only* that machinery slips through with no
checks at all — including a branch that breaks the guard itself. There's no clean way for
a guard to review its own change (it's the thing being changed), so this is inherent, not
a bug. The question is process: are you comfortable that edits to the review/merge
machinery get no automated gate, and do you want a lightweight convention — e.g. "any
`.claude/` hook change gets a manual `/senior-review` before merge" — so a silently broken
gate can't ride in unnoticed? Today's dogfood run is that convention working; the
question is whether to make it a standing habit.

**2. Should test-only PRs skip the senior review?**
As built, a branch that changes only test files merges without a senior-dev review (tests
are treated as low-risk, like config). That keeps small test PRs fast, but it also means
new test *logic* ships without a second set of eyes from this flow. Is "tests are cheap,
skip the review" the trade you want, or would you rather tests count as code worth a quick
look? Either is defensible — just confirm which you intended.

Neither question blocks the merge. The flow is sound and safe to ship; these are calls to
make deliberately, and the two stale `pm-sync-guard` references (Finding 2) are worth a
cleanup pass — the skill description here, and the pointer in `DECISIONS.md` on pm-sync's
next run.
