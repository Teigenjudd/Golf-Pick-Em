# Senior review — cfb-ui-phase2-pool-detail

- **Reviewed:** 2026-08-13
- **Head:** 4729f9c
- **Verdict:** APPROVE WITH QUESTIONS

## Summary
Phase 2 builds the real body of `/cfb/pool/:id`: a season-cumulative standings hero
(ranked off the server-written `public.pool_standings`), a week selector that scopes a
scorecard-expand + widget row to a chosen week without re-ranking the season, and a
CFB widget set. It reuses the shared pool shells (`PoolHeader`, `StandingsCard`,
`WidgetGrid`) and the golf `PrizePoolWidget`, and mirrors golf's scorecard-expand in
the Varsity Navy theme. All four new `lib/cfb.js` reads are read-only; the expand is
graded client-side off game scores via the shared `gradeWeekCard`/`pickMargin` (server
grading stays authoritative). I traced the RLS-visibility states, the week resolution,
the client grade, and the tie/rank handling — the correctness is sound, no leaks, and
golf is untouched. The findings below are one design decision to confirm, one UX call,
and small nits; none block merge.

## Findings

### 1. Two point numbers on one screen come from two different sources (debt / design — confirm)
`CfbStandings` shows each player's **season total** (the big number) straight from the
server's `pool_standings.total`, but the **weekly expand total** and the **Weekly Points
widget** are recomputed *live in the browser* from game scores (`shapeCard` →
`gradeWeekCard`). These are two independent code paths for the same math. They agree
once the server's live poller re-grades (usually within a poll cycle of a game going
final), but in the gap between a game finalizing and the poller running, the expand can
read "+15 this week" while the season number above it hasn't moved yet.

This is a deliberate trade — client re-grade gives instant "points as games go final"
feedback without waiting on the cron — and logic drift is guarded (the JS engine the
page uses and the TS engine the server uses share a parity test). So it's a *timing*
gap, not a *wrong-answer* gap, and it self-heals. Flagging it because it's the one
place the page trusts its own computation over the server's, and it's worth a conscious
sign-off. Fix direction if you dislike the gap: gate the weekly total/points on
`week.status === 'graded'` (show live game scores, but no points, until the server has
blessed them) — simpler and never contradicts the hero, at the cost of a short delay
before weekly points appear.

### 2. Pre-lock, the widgets show only *your own* picks (debt / UX — confirm)
Before a week locks, RLS returns only the viewer's own picks (correct, no leak). The
page builds the widget inputs from visible cards only, so pre-lock the "Most-Backed
Teams", "Weekly Points", and "Underdog Board" widgets are populated by a single player —
you. "Most-Backed" will read e.g. "Alabama 1/1", which is technically true but reads
oddly (looks like a 12-person pool where one team got one vote). Not a bug and not a
leak — just a thin, slightly confusing pre-lock state. Options: leave as-is, hide those
three widgets until the week locks, or show a "picks reveal when Week N locks" placeholder.

### 3. Client `locked` flag vs. server lock boundary can mislabel "No card" transiently (nit / correctness edge)
`weekIsLocked()` (CfbPoolDetail.jsx:24) decides, for a player with no returned picks,
whether to render "No card in" (`nocard`) vs "hidden until lock" — using the *browser's*
clock against `lock_time`. The actual pick data comes from server RLS (the *server's*
clock). If the two disagree by a few seconds around lock time (client ahead), a player
who *did* submit but whose picks RLS hasn't released yet is shown as "No card in for
Week N" — i.e. it briefly implies they skipped the week. No data leaks (the client can
only show picks RLS handed it); it self-corrects the moment both clocks pass `lock_time`.
Low severity — noting it so it isn't mistaken for a bug later.

### 4. Client grade assumes `selected_team` string-matches the game's team names (nit / assumption)
`pickMargin` (via `shapeCard`) resolves the picked side by exact string equality of
`selected_team` against `home_team`/`away_team`. If those ever differ (rename, alias),
the pick silently never grades and shows "—" forever after final. This is the same
assumption the server grader makes and `selected_team` is written from the game's own
team strings by the submit RPC, so it holds today — just recording the coupling.

### 5. Small dead/stale code (nits)
- `scoreLine` in `src/utils/cfbFormat.js` is exported but used nowhere (likely staged
  for Phase 3 picks — fine to keep, just noting it's currently dead).
- `formatSpread` has a no-op ternary: `Number.isInteger(abs) ? String(abs) : String(abs)`
  — both branches identical; collapse to `String(abs)`.
- `CfbStandings.jsx` prop-doc comment (lines 18–19) lists `possession` and `bonusPoints`
  fields the page never passes; harmless doc drift.
- `getCfbStandings` selects `display` but the page uses `participants`' names instead —
  the `display` column is fetched and ignored. Not wrong, just an unused read.

## Questions for the founder

1. **Two point numbers, two sources.** The big season number per player comes from the
   server; the "+N this week" in the expand (and the Weekly Points widget) is recomputed
   in the browser off game scores so it can update the instant a game goes final. They
   line up once the server re-grades (seconds-to-a-minute later), but for that short
   window the weekly number can be ahead of the season number. That's the trade: instant
   weekly feedback vs. one always-consistent source of truth. **Keep the instant client
   recompute, or only show weekly points once the server marks the week graded?** Either
   is fine — I want the choice to be deliberate, since this is the one spot the page
   trusts its own math over the server's.

2. **Sparse widgets before a week locks.** Everyone's picks are hidden from each other
   until the week's lock time (by design — nobody sees your card early). A side effect:
   before lock, the "Most-Backed Teams" / "Weekly Points" / "Underdog Board" widgets can
   only show *you*, so "Most-Backed" reads like "Alabama 1/1". **Is showing your own
   picks there pre-lock what you want, or would you rather those three widgets sit hidden
   (or say "reveals when Week N locks") until everyone's cards open?** Purely presentation
   — no correctness or privacy angle.
