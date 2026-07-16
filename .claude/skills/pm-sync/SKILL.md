---
name: pm-sync
description: Update Poold's documentation to reflect the current PR before it merges. Use when a PR is ready to merge, when the merge-guard hook blocks a merge, or when asked to "sync the docs" / "run the PM agent" / "update PM docs". Reads the PR's actual diff, maps it to the owned docs via the ownership index, and commits the updates into the same PR.
---

# PM doc sync

You are acting as Poold's PM agent. A PR is about to merge. Your job is to make the
documentation true again **in that same PR**, so docs never lag the code and no
follow-up PR (and no extra Netlify build) is needed.

Read `agents/pm/PM.md` first — it holds the **ownership index**, which is the contract
you run on. This skill is the procedure; that table is the data.

## 1. Read what actually changed

Don't work from the PR title or your memory of the conversation. Read the real diff:

```bash
git fetch -q origin main
git diff --stat origin/main...HEAD          # what files changed
git log origin/main..HEAD --format='%s%n%b' # what the commits claim
git diff origin/main...HEAD                 # the actual change, when the above is ambiguous
```

If a PR already exists, read its body too (`gh pr view --json title,body`) — it often
carries the *why*, which is what `DECISIONS.md` wants.

## 2. Map changes to owned docs

Walk the ownership index in `agents/pm/PM.md` and ask, for each row, whether this diff
made it untrue. Some reliable triggers:

| If the diff touched… | Then check |
|---|---|
| `src/pages/**` or `src/components/**` | `docs/PAGES.md` (**hard rule** — page/component changes update it in the same PR) |
| design tokens, colors, component styles | `DESIGN_SPEC.md`, and the design system section of `CLAUDE.md` |
| `supabase/migrations/**`, `src/lib/golf.js` | `CLAUDE.md` architecture summary, `docs/MULTI_SPORT_MIGRATION.md` |
| `src/App.jsx` (routes) | the Routes table in `CLAUDE.md` |
| anything a user can see or do | `agents/pm/PRODUCT.md` |
| a shipped roadmap item, or a newly-revealed risk | `agents/pm/ROADMAP.md` — **always add a status-log line** |
| a fixed / invalidated backlog item | `docs/BACKLOG.md` — check it off with a date, don't delete it |
| setup, stack, or a headline architecture call | `README.md` |

**Then do the reverse pass, which is the one that catches real bugs:** search the docs
for claims this PR just *falsified*. A doc that is confidently wrong is worse than one
that's merely stale, because the next agent trusts it. Grep for the names of things you
touched:

```bash
grep -rn "<table/component/flag you changed>" --include=*.md . | grep -v node_modules
```

This is how we caught `BACKLOG.md` claiming `pga_event_badges` was dead when
`createGolfPool` still reads it — a claim that would have caused a silent data loss in
Phase 5.

## 3. Log the decision, if there was one

If the PR made a call that future-us would otherwise re-litigate — an architecture fork,
a scope guard, a deliberate "we did NOT do X" — append an entry to
`agents/pm/DECISIONS.md`: what we decided, why, what we gave up, what would make us
revisit. **Append only; never rewrite history.** A reversed decision gets a new entry
that supersedes the old one.

Routine implementation choices don't need an entry. The bar: *would someone six months
from now waste an hour re-deriving this?*

## 4. Verify before you commit

- Every claim you wrote is checked against the code, not the PR description. PR bodies
  describe intent; code is what shipped.
- Re-grep for stale claims you may have introduced.
- Dates are absolute (`2026-07-13`), never "recently" or "last week."

## 5. Commit into the same PR

```bash
git add <the docs you changed>
git commit -m "Sync docs: <what changed>"
git push
```

Then update the PR body if the scope grew (`gh pr edit <n> --body ...`).

**Do not open a new PR.** The whole point is that docs ride with the change.

## If no docs need updating

That's a legitimate outcome — a pure refactor, a test-only change, a dependency bump.
But it must be a **deliberate claim, not an oversight**. Say so explicitly, name what you
checked, and merge with the escape hatch:

```bash
PM_SYNC_SKIP=1 gh pr merge <n> --merge --delete-branch
```

## Guardrails

- **Never fork a second backlog.** Engineering items → `docs/BACKLOG.md`.
  Product priorities → `ROADMAP.md`. Rationale → `DECISIONS.md`.
- **`CLAUDE.md` stays at the repo root.** Claude Code auto-loads it from there.
- **Don't recreate `TODO.md`.** It was deleted on 2026-07-13 as a stale duplicate of
  `BACKLOG.md`.
- Docs-only changes don't trigger a Netlify build (`netlify.toml` ignore rule), so
  thoroughness here is free.
