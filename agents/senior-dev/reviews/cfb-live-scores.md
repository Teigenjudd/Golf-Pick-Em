# Senior review — cfb-live-scores

- **Reviewed:** 2026-08-13
- **Head:** b15fa0a (`git rev-parse --short HEAD`)
- **Verdict:** APPROVE WITH QUESTIONS

## Summary
CFB live in-game scores, data layer only (no UI). Adds an additive `cfb.games.live jsonb`
column, a new `poll-cfb-scores` edge function that gates on a cheap DB query ("any game in
a live window right now?") and — only then — makes one CFBD `/scoreboard` call for the
whole FBS slate, mirrors current score/status onto the typed columns plus the `live` blob,
and grades + recomputes standings when a game flips final. Grading logic is extracted
verbatim into `_shared/cfbGrading.ts` and shared with `grade-cfb-week`, with one added
branch so a partial scoreboard can't un-finalize a week. The transform is pure and unit
tested. I traced the control flow end-to-end: the correctness story holds — mid-game
scores are never graded, already-final games don't re-trigger grading, and the refactor
leaves `grade-cfb-week`'s normal path byte-for-byte equivalent. 159 tests pass. The one
thing worth a decision before this feature goes live is how wide the "wake up" window is
versus how often the cron ticks — that governs whether the monthly API budget survives a
full season. Deploy steps (prod migration push, function deploy + secrets, cron arming)
are deliberately deferred to PR9 and are correctly **not** in this PR.

## Findings
Ranked most-severe first.

### 1. (debt / design) The 18h live-window look-ahead + every-minute cron can exhaust the season's API budget — `poll-cfb-scores/index.ts:30-33, 84-95`
The gate treats a game as "live" from **6h before** kickoff... no — from kickoff until 6h
after, **and** from **18h before** kickoff. Crucially it does *not* require the game to be
in progress — any non-final game with `kickoff_at` in `[now−6h, now+18h]` keeps the poller
"awake." During CFB season there is a game most days (Thu/Fri/Sat/Sun), so with an 18h
look-ahead the window is effectively open nearly around the clock on game weekends. Paired
with the documented "~1-minute pg_cron … fire every minute" intent, that's ~1,440 calls per
game-day, the vast majority of them spent polling games that **haven't kicked off yet** and
carry no useful score. Across a ~15-week season this approaches or breaches the 30,000/mo
Tier-2 cap. The cap check (`:102-104`) prevents actual overspend, but the failure mode is
that the poller starts returning 429 mid-season and the live-scores feature silently
freezes for the rest of the month (standings still catch up via the separate `grade-cfb-week`
scan grader, so it degrades rather than breaks).

The 6h-*after* bound does correctly answer the "stuck/cancelled game re-polled forever"
question — a game that never finalizes drops out of the window 6h after its scheduled
kickoff. That part is sound. The issue is purely the **18h ahead** figure: a much smaller
look-ahead (roughly the cron cadence plus a margin, e.g. 30–60 min) still catches a
kickoff within one poll, while eliminating the ~17h/day of idle pre-game polling. You need
*some* look-ahead (a just-kicked game is `in_progress` at CFBD but still `scheduled` in our
DB, so a strict "in-progress only" gate would never wake to catch the flip) — but not 18h.
Fix direction: shrink `LIVE_WINDOW_AHEAD_MS` and/or have PR9's cron use a windowed schedule
like golf's (`poll-thursday..sunday`, business-hours) rather than every-minute year-round.
Not a merge blocker for a data-layer PR (the cron isn't armed here), but the window sizing
is the load-bearing decision for whether the feature is affordable, and now is the moment
to set the intent.

### 2. (verified — no action) The `gradeWeek` "already-final in DB" branch is correct and leaves `grade-cfb-week` unaffected — `_shared/cfbGrading.ts:71-76`
I confirmed the extraction is verbatim against `origin/main`'s inline version except this
one added `else if` branch. It fires only when the fresh score map lacks a game **and** that
game is already `status='final'` with both scores stored — it then trusts the stored final
rather than dropping the week back to not-final. For the live poller this is load-bearing:
in a multi-game week, game A finalizes at poll N and drops off `/scoreboard`, so at poll M
(when game B finalizes) A is absent from the partial map and this branch keeps A final so
the week can reach `graded`. For `grade-cfb-week` (full `/games` map): a completed game is
always present in the map, so the first branch handles it and this new branch is never
reached — behavior identical. The branch can't wrongly mark a game final, because DB
`status='final'` is only ever written from a CFBD `completed` report (never from a mid-game
read). Solid.

### 3. (verified — no action) Grade-on-final is per-transition, not per-poll — `poll-cfb-scores/index.ts:150`
`newlyFinalWeekIds` only adds a week when a **candidate** game flips completed, and
candidates are filtered `status != 'final'`, so a game already final in the DB is excluded
and cannot re-trigger grading or a standings recompute on subsequent polls. `gradeWeek`
itself is idempotent, so even a redundant call would be a no-op — but it won't happen every
minute. No correctness or cost problem here. (Side note: `g.status !== 'final'` in that line
is always true for a candidate and is therefore redundant, but harmless defensive code.)

### 4. (verified — no action) Mid-game scores are never graded — data integrity holds
The poller writes live (non-final) scores into `home_score`/`away_score` on every update,
but `gradeWeek` only pulls a game into `finalById` when it is `completed` in the map **or**
already `status='final'` in the DB. An in-progress game is neither, so its picks are left
ungraded and its mid-game score is never scored. This is the correct separation.

### 5. (nit) Non-atomic `cfbd_calls` increment — `poll-cfb-scores/index.ts:99-121`
`cfbd_calls` is read, then written as `currentCount + 1` (read-modify-write). Two
overlapping invocations would lose an increment and undercount usage. This mirrors the
existing pattern in `grade-cfb-week` and `cfd-proxy`, so it's pre-existing convention, not
new debt, and the risk is low with a single cron. Flagging only so it's on the record; if
you ever want an exact counter, an atomic SQL `increment` RPC would be the fix. Same note
applies to `.single()` on `api_usage` when no monthly row exists yet — the "no rows" error
is discarded and null-coalesced to 0, which is fine and matches the other functions;
`.maybeSingle()` would be marginally cleaner.

### 6. (nit) Poller grades newly-final weeks even for events with no live pool — `poll-cfb-scores/index.ts:158-178`
`grade-cfb-week` filters weeks down to those whose event has a non-draft pool before
grading; the poller doesn't (it grades every `newlyFinalWeekIds` week, then recomputes
standings only for pools that exist). Harmless — a pool-less event has no picks, so
`gradeWeek` grades 0 picks and just finalizes game/week status — but it's a small
inconsistency between the two graders. Not worth changing unless you're tidying.

### Deferred (expected, not findings)
Prod `supabase db push` of the migration, the edge-function deploy + `CFBD_API_KEY`/
`CRON_SECRET` secrets + `verify_jwt`, and pg_cron arming are all deliberately deferred to
PR9. That matches the CFB "prod-as-dev, defer the deploy" pattern and is the right call for
a data-layer slice. Migration is additive and reversible; grants are table-level so the new
`live` column is readable without a grant change (verified against PR1's scaffold).

## Questions for the founder
1. **How wide should the poller's "wake-up" window be, and how often should it tick?**
   Right now the function considers a game "worth polling" from **18 hours before** kickoff
   until 6 hours after, and the plan is to run it **every minute** during the season. The
   18-hour head-start means that on a typical game weekend the poller is spending one API
   call every minute for most of the day even before any game has started — and those
   pre-game calls tell us nothing (no scores yet). Over a full season that idle spending can
   eat through the 30,000-calls/month Tier-2 budget; when it runs out, live scores quietly
   stop updating until the next month. The trade: a **short** head-start (say 30–60 min) plus
   a game-hours-only cron spends almost nothing on idle time and still catches a kickoff
   within a minute or two, at the cost of a slightly less "instant" first update; the current
   **18-hour** window guarantees the smoothest possible transition but pays for a lot of
   dead air. Which way do you want it tuned — and is the cron truly every-minute year-round,
   or a windowed schedule like the golf poller (only Thu–Sun, business hours)? This is a PR9
   decision, but it's the one number that decides whether the feature is affordable, so it's
   worth settling now. (Nothing else in this PR needs a decision — the correctness is clean.)
