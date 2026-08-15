# Senior review — cfb-admin-close-and-picks-ux

- **Reviewed:** 2026-08-15
- **Head:** 120a7f4
- **Verdict:** APPROVE WITH QUESTIONS

## Summary
Adds a CFB admin "Close Pool" control (via `setPoolStatus` moved into the sport-agnostic
`src/lib/pools.js` seam), three real bugfixes (CFB polling-toggle job-name collision,
quarter-point spread rounding, closed-CFB-pools leaking into the Dashboard active list),
and a UX pass on the weekly picks builder (filter/sort toolbar, inline underdog chip,
double-down effective-line preview, "Card progress" tracker, week dropdown, and a
`?reset=1` "edit clears the card" flow), plus a new read-only `CfbSlate` page. Overall
this is a clean, well-reasoned branch. The bugfixes are correct and tightly scoped, dead
code was removed rather than left dangling, and the shared filter logic is factored out
so the two game lists can't drift. I traced the `?reset=1` flow specifically for the
"could this silently wipe a user's card" risk — it can't, because reset only clears
local builder state (the DB card is untouched until submit) and submit is gated on a
fully valid 6-slot card, so an empty/partial state can never be committed. No blocking
correctness issues. The questions below are one process gap and two design trades to
confirm, not defects.

## Findings

Ranked most-severe first.

### 1. Prod data hand-patched outside migration history (debt / process) — `supabase/functions/_shared/cfbSlate.ts`, prod `cfb.games` / `cfb.picks`
The spread-rounding fix is correct going forward (`roundToHalfPoint` applied
unconditionally; the two new tests confirm `-4.25 → -4` and `-6.75 → -6.5`). But the
38 existing `cfb.games` rows and 3 already-locked `cfb.picks` rows were corrected with a
one-time SQL statement run directly against prod that lives in **no migration file** —
only in the PR description. Concretely what that costs: if prod is ever rebuilt from the
migration folder (or a fresh dev DB is stood up from it), those rows come back with the
old quarter-point values, because nothing in version control reproduces the patch. The
locked `cfb.picks` rows are the sharper edge — `locked_spread` is a *frozen* value that
is never re-derived from CFBD, so once it's wrong in a row, only a manual fix (like the
one just done) corrects it. Severity is genuinely low **today** because prod doubles as
the CFB dev DB and there are no real users — but the pattern (correct the code in a
migration/function, correct the data by hand off-book) is the kind of thing that bites
later when there's a user whose locked pick silently disagrees with the rules. Fix
direction: either add a small idempotent data-backfill migration that re-applies the
rounding to any surviving quarter-point rows, or explicitly note in the CFB build docs
that this backfill was manual and is not reproducible from migrations.

### 2. `?reset=1` is sticky and its banner overstates what happened (nit / UX) — `src/pages/cfb/CfbPicks.jsx:124`, `:405`
No data-loss bug here (confirmed above), but two rough edges. (a) The banner reads *"Your
previous picks were reset"* — past tense, implying the saved card was already destroyed.
It hasn't been: nothing is deleted until the user builds a new valid card and submits.
A user who changes their mind and leaves still has their original card intact, but the
copy could make them think it's gone. (b) `reset=1` stays in the URL, and the load effect
is keyed on `resetRequested`, so a page reload or a browser back-then-forward re-clears
the builder and re-shows the "were reset" banner every time — even right after a
successful submit. Both are cosmetic/confidence issues, not corruption. Fix direction:
soften the copy to a "start fresh from today's lines" framing, and/or strip the `reset`
param from the URL after the first load so a reload doesn't re-trigger the empty state.

### 3. None (correctness) — the mechanical changes check out
`setPoolStatus` moved cleanly: golf.js no longer exports it, both admin panels import it
from `lib/pools.js`, no dangling references. `CfbWidgets` dropped the `games` prop and
`SlateWidget`, and `CfbPoolDetail` still legitimately uses `weekGames` (gamesById,
anyLive) — no unused-var debt. The polling migration scopes stop/status to the exact
three job names that `admin_start_cfb_polling` schedules (`cfb-lines`/`cfb-scores`/
`cfb-grade`), and re-arms `cfb-lock-autofill` with a schedule string identical to its
original migration — no drift. The double-down preview passes the picked team's spread
into `effectiveDoubleDownLine` and formats via `pickLine`, matching the read-only card's
"DD → line" convention. All good.

## Questions for the founder

1. **The spread fix was applied to live data by hand — do you want that captured
   anywhere?** Plain version: the code now rounds spreads correctly, but the ~41 rows
   that were already wrong in the live database were fixed by typing a SQL command
   straight into prod, not through the normal "migration file checked into git" path
   (migrations are the versioned, replayable record of every DB change). Today that's
   harmless — there are no real users and prod is also your dev database. The trade
   you're accepting: if that database ever gets rebuilt from the migration files, those
   rows come back wrong, because nothing in git remembers the hand-fix. Are you fine
   leaving it as a one-off (documented in the PR only), or do you want a tiny backfill
   migration so it's reproducible? (Low urgency — this is hygiene, not a live bug.)

2. **Editing a submitted card makes the player rebuild all six picks from scratch — is
   that the experience you want?** When someone hits "Edit picks," the builder comes up
   empty instead of pre-filled with their existing picks. The reasoning is honest: on
   resubmit the system re-locks every line to *today's* numbers, so showing their old
   picks pre-filled would be showing lines that may have quietly moved. The cost is
   friction — a player who just wants to flip one game has to re-enter the other five
   too. That's a deliberate "make the reset obvious" choice over a "let them tweak one
   thing" convenience. Confirm that's the trade you want, since it's the main behavior
   change players will feel.

3. **Double-down now shows only the tougher line (e.g. "Team -5.5") instead of spelling
   out the bonus condition.** The old UI said things like "Win by 14+ for the bonus";
   the new UI just shows the adjusted line number, matching how the locked/graded card
   displays it. It's more consistent with the rest of the app, but a first-time player
   may not infer "cover this harder line = bonus" from a bare number. Are you confident
   the mechanic reads clearly enough without the explanatory sentence, or is that
   something to watch in the manual click-through?
