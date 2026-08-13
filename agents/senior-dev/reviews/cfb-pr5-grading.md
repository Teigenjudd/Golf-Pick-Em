# Senior review — cfb-pr5-grading

- **Reviewed:** 2026-08-12
- **Head:** 6dc30d1
- **Verdict:** APPROVE WITH QUESTIONS

## Summary
PR5 adds `grade-cfb-week` — the authoritative, service-role CFB grader — plus the shared
`cfbScoring.ts` mirror, a JS/TS drift-guard parity test, and the `effectiveDoubleDownLine`
helper. It grades only truly-final games, is idempotent on re-run, dedupes CFBD by real
`(season, week)` exactly like the golf poller, counts against the shared `cfbd_calls` cap,
and is the first writer of `public.pool_standings`. I traced the sign conventions, the
grader→engine wiring, the cap accounting, the upsert keys, and the standings recompute:
the happy path is correct and the code is consistent with the golf/`lib/cfb.js` patterns.
`npm test` passes (152/152, including the new parity fixtures). No blockers. The one thing
worth a founder decision is what happens to a week that can never fully finalize (a
cancelled/postponed/rescheduled game) — the rest are nits. Clean to merge once you've read
the questions below.

## Findings
Ranked most-severe first.

### 1. (debt / design) A week with a cancelled or rescheduled game never reaches `graded`, and re-polls CFBD forever — `grade-cfb-week/index.ts:244–264, 301–306, 110`
`gradeWeek` only marks a game `final` when CFBD returns `completed === true` with both
scores. If any game in the week is cancelled, postponed to a later week, or otherwise never
comes back `completed`, `allFinal` stays false, the week is set to `locked` (never
`graded`), and its picks on that game stay ungraded (NULL → 0 pts). Because scan mode
selects every past-lock week that isn't `graded` (`neq('status','graded')`), that week is
re-fetched from CFBD on **every** cron run, indefinitely. In normal weeks this is harmless
(they grade within a day and drop out of the scan), but one genuinely-stuck week keeps
costing one CFBD call per run against the 1000/mo cap — a frequent grading cron could burn
a large share of the budget on a single stuck week, and there is no admin "finalize this
week anyway" escape hatch (the `week_id` target path still requires all games `completed`
to reach `graded`). Not a merge blocker — grading is correct — but it's a real operational
gap. Fix direction is a founder decision (see Q1).

### 2. (nit) Manual `{week_id}` grading skips the `lock_time` gate — `grade-cfb-week/index.ts:107–108`
The scan path gates on `lock_time <= now`; the targeted path only does `.eq('id', ...)`.
So an admin (PR9's "Grade week" button) could grade a week that's still open for picks and
freeze results while users can still edit. Idempotent re-grading later corrects it, and
it's an admin-only action, so this is low-severity — but a one-line guard (refuse to grade
a week whose `lock_time` is null or in the future) would remove the footgun.

### 3. (nit) `.single()` on `api_usage` errors on the first call of a new month — `grade-cfb-week/index.ts:143`
When no `api_usage` row exists yet for the month, `.single()` returns an error (handled via
`usage?.cfbd_calls ?? 0`, so behavior is correct). This mirrors the golf poller, so it's
consistent, but `.maybeSingle()` is the cleaner intent and avoids the noisy error log.

### 4. (nit) `throughWeek` can mislead if weeks are graded out of order — `grade-cfb-week/index.ts:326–327`
`throughWeek` is `max(graded week numbers)`. If week 2 grades before week 1 (e.g. week 1
has a stuck game per Finding 1), the subtitle reads "· Week 2" while week 1's points are
still missing from the total. Only occurs in non-sequential grading; cosmetic (subtitle
only). Worth knowing it exists.

### 5. (nit) Stale `pool_standings` rows aren't pruned — `grade-cfb-week/index.ts:352–363`
The recompute upserts rows for current `pool_participants` but never deletes rows for users
who left the pool, so a removed participant lingers in standings. Participants rarely get
removed, so low priority; a delete-not-in-set would close it if it ever matters.

Non-issues I checked and cleared: sign conventions (`pickMargin` picked-team perspective →
`gradeAtsPick`/`gradeDoubleDown`/`gradeUnderdogPick` all consume `locked_spread` correctly);
`is_double_down` is correctly ignored on `underdog` pick_type; idempotency (game/pick/week
updates and the standings upsert all re-run cleanly); dedup + cap accounting match the golf
poller and only the `cfbd_calls` column is touched on upsert (golf's `slash_golf_calls`
untouched); `onConflict:'pool_id,user_id'` matches the table PK; participants with zero
graded picks correctly appear at 0; `cfbd_game_id` lookup matches the importer's game set
(both `seasonType:'regular'`, `classification:'fbs'`); no hoisting/undefined-var bugs; no
golf or shared-component impact.

## Questions for the founder

**1. What should happen to a CFB week that can never fully finalize?**
Plain version: the grader only "closes out" a week once *every* game in it is marked
finished by the data provider. If one game gets cancelled or bumped to a later week, that
week never closes — its picks stay at 0 points, and the grader keeps phoning the data
provider about it on every scheduled run, which slowly eats the monthly call budget (you're
capped at 1000 calls/month). Today there's no admin "just finalize it as-is" button. Is that
acceptable to punt to PR9 (when you wire up the cron and the admin grading UI, add a
"finalize week" override there), or do you want a guard now — e.g. treat a game the provider
stops returning as a no-contest/skip so the week can still reach `graded`? This is a "how do
we want to handle the messy real-world week" call, not a bug in the math.

**2. Should the manual "Grade week" path refuse a week that's still open for picks?**
Right now, grading a specific week by id skips the check that the pick deadline has passed
(the automatic scan does check it). That means a future admin button could accidentally
grade a week people are still editing. It self-corrects on the next run, and only an admin
can trigger it — so this is a "nice guardrail" question, not urgent. Want me to note it as a
one-line guard for PR9, or leave the manual path fully unrestricted on purpose (so you *can*
force an early grade if you ever need to)?

Everything else is nit-level and safe to merge as-is.
