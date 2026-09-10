# Senior review — pwa-and-copy-picks

- **Reviewed:** 2026-09-09
- **Head:** 5dbcfcc (`git rev-parse --short HEAD`)
- **Verdict:** APPROVE WITH QUESTIONS

## Summary
Two unrelated features in one commit. (1) PWA installability: `vite-plugin-pwa` manifest +
service worker that precaches only the built app shell (no runtime caching, so every
Supabase call stays network-only — the right call, and clearly documented), a headless-
Chrome icon-gen script (`scripts/pwa/build-icons.mjs`, downscaling 512→192 with `sharp`),
a public `/install` how-to page linked from the Footer, and trimmed OG copy. (2) CFB
"copy picks from another pool": `getCopyableCfbCards()` finds the user's full 6-pick cards
in their *other* open CFB pools on the same real week and offers to carry the team choices
into the current builder, matched by real-world `cfbd_game_id`, re-validating underdog
eligibility against this pool's own live line and skipping anything that can't carry over.

Overall this is solid, well-commented work. The rebase over PR #68 is clean — no conflict
markers, `adminLockWeek`/`adminUnlockWeek` (from #68) and the new `getCopyableCfbCards` all
appear exactly once in `src/lib/cfb.js`, and #68's functions are not re-added by this
branch's diff. Build passes (SW + manifest generated, 9 precache entries / ~800 KiB, shell
only), all 192 tests pass. I traced the copy mapping carefully: `cfb.games.id` is a uuid
(string), so every `atsPicks`/`startedGameIds` key comparison is string-to-string and
consistent — the one place I worried about a number/string mismatch (`Object.entries(prev)`
vs the `startedGameIds` set) is fine. Findings below are low-severity polish plus two design
confirmations, not blockers.

## Findings
Ranked most-severe first.

1. **(debt/nit) Copy can build a 6-ATS "over-full" card with a falsely-reassuring notice.**
   `src/pages/cfb/CfbPicks.jsx:274-290` (`handleCopyFromPool`). The merge takes the up-to-5
   ATS picks from the source card, then re-adds any *already-kicked-off* pick from the
   current builder state. If the target pool already has a started game with a pick on file
   **and** that game isn't one of the 5 copied games, the result is 6 ATS picks. This is
   caught downstream (`cfbCardValidity` line 51 flags `atsCount > 5`, submit is disabled,
   and the tracker shows a "too many picks" warning) and the RPC would reject it too — so
   **no bad data can be written.** The wrinkle is only UX: `skipped` is 0 in this path, so
   the copy notice shows the happy-path "double-check the lines below" text instead of
   telling the player they now have an extra pick to remove. Narrow (needs a started+picked
   game in the target that the source didn't pick). Fix direction: if the post-merge ATS
   count exceeds 5, adjust the notice to say a slot needs clearing — or don't re-add a
   started pick that pushes the count over 5.

2. **(nit) The trickiest new logic ships untested.** The cross-pool mapping
   (`getCopyableCfbCards` in `src/lib/cfb.js`, `handleCopyFromPool` in `CfbPicks.jsx`) is
   pure-ish transform logic — exactly the kind the CFB scoring engine covers with fixtures —
   but has no unit test. It's DB/UI-bound so this matches how other UI wiring is (un)tested
   in the repo; noting it because the `cfbd_game_id` remap + underdog re-validation is where
   a future regression would hide silently.

3. **(nit, process) Two unrelated features in one commit.** PWA and copy-picks share nothing.
   Fine to merge as-is, but it makes a future `git revert`/bisect of one feature drag the
   other along. Worth splitting next time; not worth re-cutting now.

Not findings, checked and clear: no conflict markers or duplicate defs from the #68 rebase;
`/install` page's `rounded-2xl` + hardcoded hex match the existing general-register Profile
styling (consistent, not a token violation); `CfbCopyPicks` uses `CFB_THEME` tokens
correctly; PWA has no runtime caching so Supabase data can't go stale; the newly-added
`setCopySources([])` (CfbPicks.jsx:190) trips `react-hooks/set-state-in-effect`, but that
rule already fires 861× repo-wide and this line uses the identical idiom as the two effects
beside it — consistent with convention, not a regression.

## Questions for the founder

1. **Should "copy from another pool" ever offer an *auto-filled* card as a source?**
   Plain terms: when a CFB week's deadline passes, the system drops a *random* legal card
   into anyone who didn't submit ("autofill"). The copy button lists source pools by
   `status = 'open'`, not by whether *you* actually built that card. Normally this can't
   collide, because the same real week locks at the same time across every pool — so if the
   pool you're picking in is still open, the source pool's same week is open too and hasn't
   been auto-filled. But PR #68 (which just merged) lets an admin manually lock one pool's
   week early. In that narrow case, the early-locked pool gets auto-filled, and copy would
   happily offer you that random card as "your picks from Pool X." Is that acceptable (rare,
   and you still review the lines before submitting), or do you want sources limited to
   cards you genuinely submitted? Distinguishing the two is non-trivial (autofill writes
   real pick rows with no "submitted by a human" flag today), so if you want it excluded
   that's a small follow-up, not a one-liner.

2. **Precache size — worth trimming?** The service worker precaches every PNG in the build,
   which includes the OG link-preview card and the email header image (used only by
   crawlers / email, never by the running app). It's ~800 KiB total and harmless, just a
   slightly larger install download. Leave it (simplest) or scope the precache to the app's
   own assets? Your call — I'd leave it.
