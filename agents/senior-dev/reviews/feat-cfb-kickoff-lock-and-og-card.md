# Senior review — feat/cfb-kickoff-lock-and-og-card

- **Reviewed:** 2026-08-17
- **Head:** 530a66e (`git rev-parse --short HEAD`)
- **Verdict:** CHANGES NEEDED

## Summary
Two unrelated changes bundled in one PR. (1) A per-game kickoff lock: `cfb_submit_week_picks`
is replaced so a submitted card may not add, change, or drop a pick on a game whose
`kickoff_at` has passed — an unchanged carry-forward slot is still allowed, since the picks
page always resubmits the whole 6-pick card. Client mirror greys out started games. (2) A
cosmetic reskin of the default OG link-preview image (golf look → neutral general register,
two golf-major badges → one generic badge per sport).

The SQL itself is well-built and, taken in isolation, correct — the `v_started`/`v_dropped`
two-direction check is sound and the type-coercion worry the task flagged is a non-issue
(all columns are `text`/`uuid`/`boolean`, no enums, so every jsonb→column comparison is a
like-for-like match). The OG change is low-risk and fine. **But the server lock collides
with the one edit path the UI actually offers**: the "Edit picks" button always resets the
card to empty, and once any game has kicked off, an emptied-then-rebuilt card is guaranteed
to be rejected by the very lock this PR adds. That is the feature's primary use case, so it
can't merge as-is.

## Findings

### 1. BLOCKER — the "Edit picks" (reset) flow dead-ends the moment any game kicks off
`src/components/cfb/CfbPoolTile.jsx:64-66,129-136` · `src/pages/cfb/CfbPicks.jsx:150-153,256-270`
· `src/utils/cfbCard.js:67-84` · migration `v_dropped` at `...kickoff_lock.sql:183-199`

The whole point of this feature (per the migration header) is to let a week's `lock_time`
sit late — Friday evening — while Thursday/Friday games that have already kicked off become
un-pickable. So the intended live state is: **week still open, some games already started.**

In that exact state, walk the only edit path the UI gives a submitted card:
1. The tile's "Edit picks" button (the *sole* editor entry for a `card-in` week) always
   navigates to `?reset=1` and the confirm sheet promises "all your existing picks will be
   reset — you'll be offered only today's lines." There is no non-reset edit entry.
2. `?reset=1` clears the builder to empty (`CfbPicks.jsx:150-153`).
3. The started game is greyed out, so the player can't re-add it, and `buildPicksPayload`
   (`cfbCard.js:67-84`) builds the payload *only* from current builder state — it never
   re-injects the started game's on-file pick.
4. On submit, the RPC's `v_dropped` counter finds the still-on-file pick for the started
   game absent from the payload → raises *"One of those games has already kicked off — you
   can't add, drop, or change that pick."*

Net: once a single game in the week has kicked off, a player who already submitted **cannot
edit their card for the rest of the week** — every resubmit is rejected, with an error that
blames a game they never touched. This is not an edge case; it's the headline scenario the
feature creates. The lock logic is correct — the reset-based editor is what's incompatible
with it.

Fix direction: in reset mode, don't clear started games — pre-fill (and lock) the started
slots and clear only the not-yet-started ones, so the carry-forward the RPC requires is
actually present in the payload. (Note the reset flow's original rationale — "resubmit
re-locks every line to today's numbers" — no longer holds for started games anyway, since
their line *can't* change; pre-filling them is the more correct behavior now, not a
workaround.) Whatever the fix, the confirm-sheet copy at `CfbPoolTile.jsx:164-167` needs to
stop promising a full reset.

### 2. DEBT (minor) — `p_picks` is expanded three times in one RPC call
`...kickoff_lock.sql:96-146` (WITH `input`), `:183-195` (`v_dropped` subquery), `:231-239`
(INSERT source). Correct, and at 6 elements the cost is nil, but the `v_dropped` check
re-does the same jsonb-to-columns unpacking the `joined` CTE already computed
(`matches_existing`). The dropped-pick count could be derived in the same pass (e.g. a FULL
JOIN of existing↔input, or an anti-join count folded into the first `SELECT ... INTO`),
leaving one canonical expansion. Not blocking; note for whoever next touches this RPC.

### 3. NIT — NULL `kickoff_at` fails open
`...kickoff_lock.sql:142,188` and `cfbCard.js:71`. A game with no `kickoff_at` is treated as
"not started" and stays fully pickable. That's the opposite posture from the week-join
cutoff (which CLAUDE.md notes "fails closed if unset"). Almost certainly fine — CFBD always
supplies a kickoff and the week `lock_time` is the real backstop — but worth a conscious
nod. If a game ever lands with a null kickoff, this lock silently won't cover it.

### 4. NIT — OG badge values are hand-copied, not read from the source constants
`scripts/og/card.html:113-121`. The comment says the two badges mirror `DEFAULT_BADGE`
(SportBadge) and `CFB_BADGE` (`theme/cfb.js`), but the hex/lines are hard-typed into the
static HTML, so if those constants change the card won't. This is inherent to the
static-HTML→PNG toolchain (the PNG is regenerated by hand anyway), so it's acceptable — just
don't expect the card to track the constants automatically. Also cosmetic: the golf badge's
line-1 "GO" over line-2 "GOLF" reads a little oddly next to "CFB"/"26".

## Questions for the founder

1. **The edit-after-kickoff dead end (Finding 1) is the one real decision here.** The
   feature is designed to produce "week open, some games already started," and in that state
   the current "Edit picks" button leads to a guaranteed-failing submit. The clean fix is:
   when a player edits after a game has started, keep that started game's pick locked in
   place (pre-filled, greyed) instead of wiping the whole card — they edit only the games
   that haven't kicked off yet. Is that the behavior you want? (The alternative — telling a
   player "you can't edit any of your picks once the earliest game starts, even the Saturday
   ones" — is simpler to build but a worse deal for the player and not what the migration
   header describes.)

2. **Bundling.** The kickoff lock and the OG-card reskin are unrelated and the OG half is
   clean. If Finding 1 needs a round of work, do you want to split the OG change out so it
   can land now, or hold both together? Your call — just flagging that one half is ready and
   the other isn't.
