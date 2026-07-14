#!/usr/bin/env node
// PreToolUse guard: don't let a PR merge while the docs still describe the old world.
//
// Fires on any Bash command containing `gh pr merge`. If the branch changed code but no
// documentation, exit 2 — which blocks the tool call and feeds stderr back to Claude as
// instructions. Claude then runs /pm-sync and updates the docs into the same PR.
//
// Escape hatch (for refactors, test-only changes, dep bumps):
//   PM_SYNC_SKIP=1 gh pr merge <n> --merge --delete-branch
//
// Fails open: any error here allows the merge. A broken guard must never block work.

import { execSync } from 'node:child_process'

// The PM's own strategy docs. Touching one of these is our only observable proxy for
// "/pm-sync actually ran" — the hook can read a diff, but it can't see whether a skill
// executed. An earlier version of this guard accepted ANY .md as proof, and PR #22
// sailed through on CLAUDE.md + docs/PAGES.md while agents/pm/ went stale. Doc updates
// that happen to be adjacent to the code are not the same as the PM reconciling.
const PM_DOCS = /^agents\/pm\//

// Page/component changes must update the page inventory. Hard rule in CLAUDE.md.
const UI_CODE = /^src\/(pages|components)\//
const PAGES_DOC = 'docs/PAGES.md'

// Changes that never need a doc update, so a PR touching only these isn't suspicious.
const NO_DOC_NEEDED = /^(\.claude\/|\.github\/|package-lock\.json$|\.gitignore$|.*\.test\.[jt]sx?$)/

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
if (/PM_SYNC_SKIP=1/.test(cmd)) allow()

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

const problems = []

if (!changed.some(f => PM_DOCS.test(f))) {
  problems.push(`• agents/pm/ is untouched — no sign /pm-sync ran.
    Walk the ownership index in agents/pm/PM.md against the real diff:
      ROADMAP.md   — shipped something, or revealed a risk? Add a status-log line.
      DECISIONS.md — made a call future-us would re-litigate? Append an entry.
      PRODUCT.md   — changed what a user can see or do?
      PM.md        — shipped or blocked something on the status board?`)
}

if (substantive.some(f => UI_CODE.test(f)) && !changed.includes(PAGES_DOC)) {
  problems.push(`• ${PAGES_DOC} is untouched, but this PR changes pages/components.
    CLAUDE.md makes this a hard rule: page data, layout, or functionality changes
    update the page inventory in the same PR.`)
}

if (problems.length === 0) allow()

block(
  `BLOCKED by pm-sync-guard: this PR changes ${substantive.length} file(s), but the docs
that own those changes were not updated.

${problems.join('\n\n')}

Changed:
${substantive.slice(0, 12).map(f => `  ${f}`).join('\n')}${substantive.length > 12 ? `\n  …and ${substantive.length - 12} more` : ''}

Docs must ride in the same PR as the change they describe — syncing after the merge costs
a second PR and a second deploy, and leaves the docs briefly lying.

Run the /pm-sync skill now, then commit onto this branch and retry the merge.

If nothing above genuinely applies, that is a legitimate outcome — but make it a claim,
not an oversight. Say out loud what you checked and why it doesn't apply, then:
  PM_SYNC_SKIP=1 ${cmd}
`
)
