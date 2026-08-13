# Senior review — cfb-auto-lines-poller

- **Reviewed:** 2026-08-13
- **Head:** cc36dd8 (`git rev-parse --short HEAD`)
- **Verdict:** APPROVE WITH QUESTIONS

## Summary
Replaces CFB's manual per-week slate import with an hourly `poll-cfb-lines` edge function
and adds a `cfb.spread_history` movement log. The CFBD→`cfb.games` transform moves
verbatim server-side into `_shared/cfbSlate.ts` (now the single source of truth, and unit
tested for the first time), with two intended changes: `buildGameRows` now also emits the
CFBD `week` number for the poller's fan-out, and `chooseLine` no longer treats a
line-less provider as a phantom `0`. The poller does one season-wide fetch, shapes it,
fans each pre-kickoff game onto every pool's matching week, and logs a `spread_history`
row only when a line moves. `lib/cfb.js` drops the transform + `importWeekSlate` and gains
thin `refreshCfbSlates()` / `getSpreadHistory()` wrappers; `CfbPoolOps` drops manual
import for auto-status + a single "Refresh slates now" + lock editing.

Overall this is a clean, well-reasoned branch. I traced the freeze/ownership boundary,
the fan-out key, and the change-detection logic and they hold up. The transform move is
faithful, the bug fix is correct (a real posted `0`/pick'em is still kept), nothing else
in the browser references the removed exports, golf is untouched, and all 172 tests pass
(I re-ran them). The findings below are scale/edge caveats, not blockers — none corrupts
data at today's scale (a handful of pools).

## Findings
Ranked most-severe first.

### 1. `existing`-spread snapshot query can be truncated at scale → spurious history rows (debt / latent correctness)
`poll-cfb-lines/index.ts:100-102` builds the "what spread do we currently have" map with
`.schema('cfb').from('games').select('cfbd_game_id, home_spread').in('week_id', allWeekIds)`.
Because CFB uses **per-pool events**, the same real game is stored once per pool, so this
query returns roughly `pools × games-per-week` rows for only `games-per-week` *distinct*
games — it over-fetches by the pool count. Supabase/PostgREST caps a select at ~1000 rows
by default. Once truncated, the games past row 1000 are missing from `currentSpread`, so
their `prev` reads as `undefined`, which the code treats as "new spread" and **appends a
`spread_history` row every hour even though nothing moved**. Impact is bounded — it bloats
the movement log and makes "opened → closed" charts wrong; it does **not** corrupt the
slate (the `games` upsert always writes). At ~50 games/week this bites around ~20 pools on
one week. Fix direction: snapshot distinct games only (e.g. select the games for the
weeks actually being written, or de-dup server-side), or paginate. Cheap to do now while
`cfb.games` is empty.

### 2. Null/unparseable `kickoff_at` is treated as "not yet kicked off" (nit / acceptable)
`index.ts:141-142`: `const koMs = row.kickoff_at ? Date.parse(...) : NaN; if
(Number.isFinite(koMs) && koMs <= nowMs) continue`. A game with a missing `kickoff_at`
(the transform emits `kickoff_at: ... || null`) yields `NaN`, which is not finite, so the
game is **not** skipped — the poller keeps writing it. I checked the blast radius and it's
benign: `poll-cfb-scores` only ever touches games with a non-null `kickoff_at`
(`.not('kickoff_at','is',null)`), so a null-kickoff game is never live-tracked and there
is nothing for this poller to clobber. The only degenerate case is a game CFBD reports as
in-progress *with no start date at all* — it would keep showing a `scheduled` spread and
never get live scores — but CFBD virtually always ships `startDate`, so this is a
tail-risk, not a real hazard. Noting it so the choice is explicit (see Q1).

### 3. `api_usage` increment is a non-atomic read-modify-write (nit)
`index.ts:107` reads `currentCount`, `:181-183` writes `currentCount + calls`. Two
overlapping runs (or another CFBD function in the same minute) could lose an increment.
Hourly cadence makes a collision unlikely, and this matches the existing golf/poll
pattern, so it's consistent rather than new debt — just be aware the monthly counter can
under-count under concurrency. Not worth changing for this PR.

### 4. `chooseLine` bug fix has no "real 0 is kept" test (nit)
The fix is correct — a missing `spread` field is excluded, a present `0` is kept (verified
by reading `buildGameRows`, which emits a pick'em game with `home_spread: 0` and null
underdog). The new tests cover the *excluded* case (`{provider:'A'}` → null spread) but
not the *kept* case (a genuine `spread: 0`). One-line test would lock the fix's intent in.

## Questions for the founder
Plain-English decisions to confirm before merge.

1. **Spurious line-movement history at scale (Finding 1).** The poller decides "did the
   spread move?" by first reading every game row it already has. Because each pool stores
   its own copy of the same game, that read grows with the number of pools, and the
   database quietly returns at most ~1000 rows per read. Past that limit, the poller
   *thinks* those games are brand-new and writes a "line moved" entry every hour even
   when nothing changed — polluting the future "opened −6.5 → closed −7.5" chart (it does
   **not** damage the actual game slate or anyone's picks). We won't hit the limit at a
   handful of pools, but we will as this grows. Do you want the small fix now (read each
   real game once instead of once-per-pool), or ship as-is and revisit before CFB gets
   real traffic? My lean: fix now — it's a few lines while the table is empty.

2. **The "spread freezes at kickoff" behavior depends on the game having a kickoff time
   (Finding 2).** The whole freeze design keys off comparing "now" to the game's kickoff
   time. If a game arrives from the data provider with *no* kickoff time (rare — they
   almost always include it), the poller keeps treating it as upcoming forever. It can't
   corrupt anything and the live-score poller ignores such games too, so the only visible
   effect would be a stuck "scheduled" spread on a game that never appears to start. I'm
   comfortable leaving it, since it can't happen with normal data — just confirming you're
   OK accepting that edge rather than adding a guard.

Nothing else — the transform move is faithful, the removed code has no other callers, and
golf is untouched.
