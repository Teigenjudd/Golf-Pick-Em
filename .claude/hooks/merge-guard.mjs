#!/usr/bin/env node
// PreToolUse guard on `gh pr merge`: two agents ride with every merge, and neither may be
// skipped silently.
//
//   1. senior-dev (code review) → commits agents/senior-dev/reviews/<branch>.md
//   2. pm-sync    (doc reconcile) → commits agents/pm/**
//
// plus the standing hard rule: page/component changes must update docs/PAGES.md.
//
// The hook can't watch an agent run — a committed file in the branch diff is the only
// proof it can verify. That's why senior-dev writes an artifact even when it has nothing
// to flag: an APPROVE with zero questions still leaves the file, so "looks good, ship it"
// satisfies the gate and hands straight to pm-sync.
//
// The review is only demanded when there is actual CODE to review. A docs-only or
// config-only branch skips it (nothing for a senior engineer to look at).
//
// Ordering the block message asks Claude to follow:
//   dispatch senior-dev  →  founder resolves any questions  →  dispatch pm  →  merge
//
// Escape hatches — state your reasoning out loud first, then merge:
//   SENIOR_REVIEW_SKIP=1  gh pr merge …   (skip the review-artifact check)
//   PM_SYNC_SKIP=1        gh pr merge …   (skip the pm-docs check)
// Both can ride on one command. Fails open on any internal error — a broken guard must
// never block work.

import { execSync } from 'node:child_process'

// A committed senior-dev review for this branch (README.md is the dir's docs, not a review).
const REVIEW_ARTIFACT = /^agents\/senior-dev\/reviews\/(?!README\.md$).+\.md$/
// The PM's own strategy docs — our only observable proxy that /pm-sync actually ran.
const PM_DOCS = /^agents\/pm\//
// Actual source a senior engineer reviews. Only these make the review mandatory.
const CODE = /^(src|supabase|netlify|scripts)\//
// Page/component changes must update the page inventory. Hard rule in CLAUDE.md.
const UI_CODE = /^src\/(pages|components)\//
const PAGES_DOC = 'docs/PAGES.md'
// Changes that never need a doc update, so a PR touching only these isn't suspicious.
const NO_DOC_NEEDED = /^(\.claude\/|\.github\/|agents\/senior-dev\/|package-lock\.json$|\.gitignore$|.*\.test\.[jt]sx?$)/

function read () {
  return new Promise(resolve => {
    let raw = ''
    process.stdin.on('data', c => (raw += c))
    process.stdin.on('end', () => resolve(raw))
    setTimeout(() => resolve(raw), 3000).unref?.()
  })
}

const allow = () => process.exit(0)

const block = msg => {
  process.stderr.write(msg)
  process.exit(2)
}

const raw = await read()

let payload
try {
  payload = JSON.parse(raw)
} catch {
  allow()
}

if (payload?.tool_name !== 'Bash') allow()

const cmd = payload?.tool_input?.command ?? ''

if (!/\bgh\s+pr\s+merge\b/.test(cmd)) allow()

const skipReview = /SENIOR_REVIEW_SKIP=1/.test(cmd)
const skipPm = /PM_SYNC_SKIP=1/.test(cmd)

let changed
try {
  execSync('git fetch -q origin main', { stdio: 'ignore' })
  changed = execSync('git diff --name-only origin/main...HEAD', { encoding: 'utf8' })
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
} catch {
  allow() // can't tell — never block on a git failure
}

if (changed.length === 0) allow()

const substantive = changed.filter(f => !NO_DOC_NEEDED.test(f))
if (substantive.length === 0) allow()

const codeChanged = substantive.some(f => CODE.test(f))

const problems = []

// 1. Senior-dev review — required only when there's real code to review.
if (!skipReview && codeChanged && !changed.some(f => REVIEW_ARTIFACT.test(f))) {
  problems.push(`• No senior-dev review on this branch — nothing in agents/senior-dev/reviews/.
    This branch changes code, so it needs a review before it merges.
    Dispatch the senior-dev agent (Task tool, subagent_type: "senior-dev") — it runs on
    Opus, reviews the diff, and writes/commits the review artifact. An APPROVE with no
    questions is fine and still satisfies this. Or run /senior-review inline.`)
}

// 2. PM doc sync — required whenever anything substantive changed (as before).
if (!skipPm && !changed.some(f => PM_DOCS.test(f))) {
  problems.push(`• agents/pm/ is untouched — no sign pm-sync ran.
    Dispatch the pm agent (Task tool, subagent_type: "pm") — it runs on Sonnet and won't
    stall the merge — or run /pm-sync. Walk the ownership index in agents/pm/PM.md:
      ROADMAP.md   — shipped something, or revealed a risk? Add a status-log line.
      DECISIONS.md — made a call future-us would re-litigate? Append an entry.
      PRODUCT.md   — changed what a user can see or do?
      PM.md        — shipped or blocked something on the status board?`)
}

// 3. Page inventory — standing hard rule.
if (substantive.some(f => UI_CODE.test(f)) && !changed.includes(PAGES_DOC)) {
  problems.push(`• ${PAGES_DOC} is untouched, but this PR changes pages/components.
    CLAUDE.md makes this a hard rule: page data, layout, or functionality changes
    update the page inventory in the same PR.`)
}

if (problems.length === 0) allow()

block(
  `BLOCKED by merge-guard: this PR changes ${substantive.length} file(s), but the agents
that ride with a merge haven't all run.

The merge flow is:  senior-dev review  →  you resolve any questions  →  pm-sync docs  →  merge

${problems.join('\n\n')}

Changed:
${substantive.slice(0, 12).map(f => `  ${f}`).join('\n')}${substantive.length > 12 ? `\n  …and ${substantive.length - 12} more` : ''}

Run the missing step(s), commit onto this branch, and retry the merge.

If a step genuinely doesn't apply — a pure refactor, a docs-only change — that's a
legitimate outcome, but make it a claim, not an oversight. Say what you checked and why,
then add the matching escape hatch(es) to the command:
  SENIOR_REVIEW_SKIP=1  (skip review)   PM_SYNC_SKIP=1  (skip docs)
  e.g.  SENIOR_REVIEW_SKIP=1 PM_SYNC_SKIP=1 ${cmd}
`
)
