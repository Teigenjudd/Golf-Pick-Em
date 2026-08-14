# Senior review — chore/slim-pm-machinery

- **Reviewed:** 2026-08-13
- **Head:** 4213cde (`git rev-parse --short HEAD`)
- **Verdict:** APPROVE WITH QUESTIONS

## Summary
This PR trims the PR-merge machinery, not product code — no `src/`, `supabase/`,
`netlify/`, or `scripts/` touched. It de-changelogs the two always-loaded reference docs
(`CLAUDE.md` §Architecture, `PM.md` status board), collapses PM.md's 410-line status board
into a ~25-line current-state snapshot, rewrites the pm-sync write-set contract to "size the
sync to the diff" (CEO_REPORT + only docs the diff actually falsified + the guard's hard-rule
docs), scales senior-review effort to diff size, and splits `DECISIONS.md` into a live file +
`DECISIONS_ARCHIVE.md`. I verified the four things you asked about: the DECISIONS split is
clean (no entry lost or duplicated, boundary explicit), the slimmed CLAUDE.md CFB bullet's
named files/functions all exist, the reverse-pass bug-catcher survives intact in both the pm
agent and the pm-sync skill, and no load-bearing fact was dropped that isn't recoverable one
hop away. The design is sound and safe to merge. The findings below are all debt/nit — the
one worth your attention is a stale hint inside the merge-guard hook that still preaches the
exact behavior this PR is trying to kill.

## Findings
Ranked most-severe first.

**1. (debt) The merge-guard hook's printed hint still teaches the old "re-narrate into every
doc" behavior this PR removes.** `.claude/hooks/merge-guard.mjs` lines 108–112 print, when
pm-sync hasn't run:
> `Walk the ownership index in agents/pm/PM.md:`
> `  ROADMAP.md   — shipped something...? Add a status-log line.`
> `  PM.md        — shipped or blocked something on the status board?`
The new contract explicitly (a) drops "always add a ROADMAP status-log line," (b) tells the
agent *not* to walk all index rows ("size the write-set to the diff"), and (c) narrows when
PM.md's status board changes. So the hook — the on-ramp an agent reads when it's deciding what
to update — now contradicts the docs it points at. It's advisory text, not a gate (the hook
still only checks that *some* artifact landed under `agents/pm/`), so nothing breaks; the cost
is that every time pm-sync is skipped and this hint prints, it nudges the next agent back into
the pattern the PR spent its whole diff killing. The hook file was deliberately *not* in this
PR's edit set — hence it's a question, not a silent expectation (see Q1).

**2. (nit) `CLAUDE.md` §Architecture says "three CFB pollers" but names two pollers + a
proxy.** The slimmed bullet reads *"three CFB pollers (`poll-cfb-lines` ..., `poll-cfb-scores`
... — both talk to CFBD directly; `cfd-proxy` is the admin-JWT proxy)."* The actual CFB edge
functions are two pollers (`poll-cfb-lines`, `poll-cfb-scores`), one grader (`grade-cfb-week`,
described separately in the same bullet), and one proxy (`cfd-proxy`). Calling it "three
pollers" and then labelling one of the three a proxy in the same breath is an internal
miscount introduced by the slimming. Fix: "two CFB pollers ... plus `cfd-proxy`, the admin-JWT
proxy."

**3. (debt) The always-loaded `CLAUDE.md` no longer flags that CFB is built-but-not-deployed.**
The old bullet repeated "no function deployed, no cron armed — deferred to PR9" throughout;
the slimmed bullet lists the backend/grader/pollers/pages as things that "exist today" with no
caveat, and `CEO_REPORT.md` even reads as if the pollers are running ("it now keeps itself
current automatically"). The precise operational truth — *the CFB edge functions aren't
deployed and no cron is armed in prod yet* — does survive, but only in `CFB_BUILD_PLAN.md`
(lines 278, 425–426, 523), one hop away via the bullet's own pointer. That's acceptable for a
slim doc, but the single most consequential CFB fact for an engineer ("why isn't prod
updating? — because it was never deployed") is now absent from the file that auto-loads every
turn. Consider a five-word caveat in the CLAUDE.md bullet ("all in-repo, not yet deployed to
prod"). Not a lost fact; a discoverability downgrade.

**4. (nit) `CLAUDE.md` points at `CFB_BUILD_PLAN.md` for "shipped history," but the new
ownership rule tells pm-sync to stop putting shipped history there.** The bullet ends *"Build
sequence + shipped history: `docs/CFB_BUILD_PLAN.md` ..."* while the new PM.md index row for
that same doc says *"It's a plan, not a shipped-log — don't narrate each PR into it."* The
pointer is accurate *today* (the build plan still contains the per-PR narration this PR chose
not to retroactively clean), but the two will drift as the new rule takes effect. Minor;
resolve by pointing "shipped history" at git/PRs and keeping the build-plan pointer to
"sequence" only.

**5. (nit) The live `DECISIONS.md` header doesn't mention the archive exists.** The archive
points back to the live file ("new decisions go to the top of `DECISIONS.md`"), and the PM.md
index + pm agent + skill all say "grep spans both files" — so an agent following those will
search both. But an agent that opens only `DECISIONS.md` to grep for prior art has no in-file
signal that `DECISIONS_ARCHIVE.md` holds the pre-2026-08-11 half. A one-line footer ("older
entries: `DECISIONS_ARCHIVE.md` — grep both") would close it.

**What I verified clean (no finding):**
- **DECISIONS split integrity:** old file = 44 entries; live = 23, archive = 21; set-identical
  union, zero duplicates. Boundary is exact and stated — archive holds 2026-08-10 and earlier,
  live holds 2026-08-11 onward. Append-target is unambiguous (live file, top; archive says
  "do not append here").
- **Reverse pass intact:** the bug-catcher survives in both the pm agent (step 3, now
  emphasized "this is the pass that catches real bugs") and the pm-sync skill (lines 65–72,
  97). The whole slimmed contract's safety now rests on this one grep being run each time — it
  is retained and strengthened, so the design holds, but that is the single point of failure.
- **Slimmed CFB bullet facts:** every file/function it names exists (`lib/cfb.js`,
  `cfbScoring.js` + `_shared/cfbScoring.ts`, `grade-cfb-week`, `poll-cfb-lines`,
  `poll-cfb-scores`, `cfd-proxy`, `theme/cfb.js`, the two CFB pages, all four referenced docs).
- **No dangling section pointers:** PM.md's "status board below" still resolves (the board
  still exists, collapsed); PAGES.md §10f / CFB_UI_PLAN §6 references still resolve; the guard's
  PAGES.md hard rule is still both stated in the new write-set and enforced by the hook.

## Questions for the founder
Plain-English, framed as decisions.

**1. Do you want to also fix the merge-guard hook's hint (finding 1), or knowingly leave it?**
The "merge-guard hook" is the small script that blocks a merge until the review + doc-sync
artifacts exist, and prints a to-do list when they don't. That printed to-do list still tells
the next agent to "add a ROADMAP status-log line" and "walk the ownership index" — the very
habits this PR is removing. The hook file wasn't in your change set, so I didn't touch it. The
trade: updating it (a ~4-line copy edit in `.claude/hooks/merge-guard.mjs`) keeps the machinery
self-consistent, at the cost of one more machinery file in this PR; leaving it means the old
guidance keeps resurfacing whenever pm-sync is skipped, slowly undoing the slim. My
recommendation is to fix it in this PR since it's the same change of intent — but it's your
call whether it belongs here or in a follow-up.

**2. Are you comfortable that "is CFB deployed to prod yet?" now lives only in
`CFB_BUILD_PLAN.md`, not in the always-loaded `CLAUDE.md` (finding 3)?** Today an agent (or you,
mid-task) reading only CLAUDE.md would reasonably assume the CFB pollers are live, because the
bullet lists them as existing and CEO_REPORT says the pool "keeps itself current
automatically." The reality — nothing CFB is deployed or cron-armed in prod — is one pointer
away. That's a fine trade for a leaner top-level doc *if* you're confident the next person will
follow the pointer; if you'd rather never re-learn this the hard way, a five-word "in-repo, not
yet deployed" caveat in the bullet buys that back cheaply. Which do you prefer?
