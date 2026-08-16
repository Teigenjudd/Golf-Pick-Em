# Senior review — cfb-underdog-scoring-and-team-logos

- **Reviewed:** 2026-08-15
- **Head:** 10fc4a0
- **Verdict:** APPROVE WITH QUESTIONS

## Summary
Two changes bundled: (1) the mandatory-underdog payout tiers move from 1/2/3 to 1/3/5
points (spread bands unchanged), and (2) team crest logos are attached to CFB games and
rendered on the picks builder + scorecard rows. The scoring change is clean, correct, and
well-covered — client and server mirror stay byte-for-byte in sync and every UI surface
that shows underdog points either was updated or derives from the function. The logo work
is a sensible, zero-extra-API-cost addition with a silent-fallback component. One real
(cosmetic) alignment inconsistency in the shared card renderer is worth a decision before
merge; nothing here is a correctness blocker.

## Findings
Ranked most-severe first.

### 1. (debt — cosmetic) `TeamCrest` collapses to nothing in a column that the TOTAL row reserves permanently → ragged rows when any logo is missing
`src/components/cfb/TeamCrest.jsx` returns `null` (no element at all) when the logo URL is
absent or 404s at load time. In `src/components/cfb/CfbCardRows.jsx` that component is used
as a **fixed-width alignment column** — a peer flex item between the slot marker and the
pick text (line 85) — and the TOTAL row now hard-reserves a matching `w-[20px]` spacer for
it (line 148–149). Because the crest self-collapses but the total-row spacer is permanent,
the two disagree: a pick row *with* a logo indents its text by ~30px (20px crest + 10px
gap); a pick row *without* one does not; the TOTAL row always assumes the crest is there.

Concrete failure: a single card that mixes logo-backfilled and text-only games (e.g. a
pre-migration final game, or one team CFBD returns no `logos` for), or a single crest URL
that 404s at runtime, renders with some rows shifted left of the others and out of line
with the TOTAL row. It's purely visual — no data/scoring impact — and today's blast radius
is small (logos are usually present, no real users yet). But it's the exact fragility the
question about the total-row spacer was pointing at: the spacer itself isn't wrong, it's
just the fixed half of an inconsistent pair.

Fix direction: make the crest reserve its box even when empty *in the row context* — e.g. a
`reserveSpace`/`placeholder` prop on `TeamCrest` (render an empty `w-[20px] flex-none` span
instead of `null`), or wrap the crest in a fixed-width span inside `CfbCardRows`. The
inline chip use in `CfbGameCard` (crest centered next to the team name) is correct as-is
and should keep collapsing — only the table-like row column needs a stable width.

### 2. (nit) `TeamCrest`'s `onError` failure flag never resets when `src` changes
`src/components/cfb/TeamCrest.jsx` tracks load failure in `useState`, which persists for the
life of the component instance. If React ever reuses a `TeamCrest` instance across a `src`
change, a URL that once 404'd stays hidden even after `src` becomes a valid logo. **Today
this is latent, not active** — every list that renders a crest is keyed by a stable id
(`CfbGameCard` by `game.id`, card rows are a stable 6-pick array) and the `src` for a given
position doesn't change under a stable instance, so no instance ever sees a new `src`. It's
a trap for a future caller that keys by index or swaps layouts. One-line hardening:
`key={src}` on the `<img>` (or reset `failed` in a `src`-change effect) so error state is
per-source.

### 3. (note, no action) Already-graded weeks won't be re-scored to 1/3/5
Grading is a one-time write of `base_points`/`bonus_points`; `grade-cfb-week` uses the
shared `underdogTier`, so all *future* grading uses the new tiers, but any week already
graded under 1/2/3 would keep its old points. Moot per the stated "no real users yet," and
the demo recomputes Week 1 in memory on load — flagging only so it's a conscious call, not
a surprise.

## What I verified as correct (no action)
- `underdogTier` is **byte-for-byte identical** between `src/utils/cfbScoring.js` and
  `supabase/functions/_shared/cfbScoring.ts` (diffed the function bodies directly).
- Boundary coverage is complete: fixtures + tests hit 1.5, 6.5 (T1), 7, 13.5 (now 3), 14,
  28 (now 5), and below-min (0), plus the `gradeUnderdogPick`/`gradeWeekCard` worked
  examples. No stale expected value left behind.
- **No missed point-value displays.** The only hardcoded UI copy (`CfbRulesButton`'s "How
  scoring works" modal) was updated; the underdog chip in `CfbGameCard` derives its
  "3 pts"/"5 pts" straight from `underdogTier`, and the underdog board in `CfbWidgets`
  reads graded `points` from data — both auto-track. The grader (`cfbGrading.ts`) pulls
  points from the shared function; no SQL hardcodes underdog point values.
- `selectedTeamLogo` derivation in `shapeCard` is correct: matches `selected_team` against
  `home_team`/`away_team`, falls to `null` on the `g = p.game ?? {}` guard (missing game or
  name mismatch → both comparisons false → null). Auto-filled picks carry a real
  `selected_team`, so they correctly *do* show a logo — that's intended, not a fallback.
- Migration `20260815010000_cfb_team_logos.sql` is additive, nullable, and idempotent
  (`ADD COLUMN IF NOT EXISTS`); `getCfbWeekGames` selects the new columns; demo backfill
  and its `buildGameRows` logo-mapping (missing/empty `logos` → null) are tested.

## Questions for the founder
One decision, not a blocker:

- **The crest column and the TOTAL row disagree about whether a logo is always there.** A
  team crest is a small logo image; the shared card renderer lines up each pick's crest,
  slot marker, and text into columns. Right now, if a game has no logo (a game imported
  before this change, a team CFBD gives no logo for, or an image that fails to load), that
  row's crest vanishes *and takes its column width with it* — so that row's text slides
  left and no longer lines up with the other rows or with the "Total" line, which always
  leaves room for a crest. You can either (a) always reserve the crest's slot so rows stay
  aligned whether or not a logo loads, or (b) accept occasionally-ragged rows for the
  simpler component. With logos backfilling going forward and no real users yet, (b) is a
  defensible "ship it" — but is that the trade you want, or would you rather spend the ~2
  lines now to keep the card visually clean regardless of which logos happen to be present?
