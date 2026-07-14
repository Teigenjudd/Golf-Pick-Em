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

const DOC_RE = /\.md$/i

// Paths that are docs-adjacent but don't count as "the docs were updated".
const NOT_REAL_DOCS = /^(docs\/design_prototype\/|node_modules\/)/

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

const docs = changed.filter(f => DOC_RE.test(f) && !NOT_REAL_DOCS.test(f))
if (docs.length > 0) allow()

const substantive = changed.filter(f => !NO_DOC_NEEDED.test(f))
if (substantive.length === 0) allow()

block(
  `BLOCKED by pm-sync-guard: this PR changes ${substantive.length} file(s) but updates no documentation.

Changed:
${substantive.slice(0, 12).map(f => `  ${f}`).join('\n')}${substantive.length > 12 ? `\n  …and ${substantive.length - 12} more` : ''}

Docs must ride in the same PR as the change they describe — syncing after the merge costs
a second PR and a second deploy, and leaves the docs briefly lying.

Run the /pm-sync skill now: read this branch's real diff, walk the ownership index in
agents/pm/PM.md, update every doc the change made untrue (and grep for claims it
falsified), then commit onto this branch and retry the merge.

If no doc genuinely needs updating, say so explicitly, name what you checked, and merge
with the escape hatch:
  PM_SYNC_SKIP=1 ${cmd}
`
)
