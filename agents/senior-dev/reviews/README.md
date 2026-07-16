# Senior review log

One file per branch, written by the `senior-dev` agent (or `/senior-review`) before a PR
merges — `<branch-slug>.md`, e.g. `feat/admin-email` → `feat-admin-email.md`.

Each file records the review that ran before that branch merged: verdict, findings, and
the questions the founder answered to justify the design. The merge-guard hook
(`.claude/hooks/merge-guard.mjs`) requires a file here in the branch diff before it will
let `gh pr merge` through — so this directory doubles as the audit trail of every design
call we pressure-tested on the way in.

Procedure and artifact format: `.claude/skills/senior-review/SKILL.md`.
