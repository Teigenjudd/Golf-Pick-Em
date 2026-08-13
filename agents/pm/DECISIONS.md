# Poold — Decision Log

> **What this file is:** *Why* we chose what we chose. Append-only — a decision that
> gets reversed is not deleted, it gets a new entry that supersedes it, because the
> reasoning behind a reversal is usually more valuable than the reversal itself.
>
> **Write an entry when a call would otherwise be re-litigated later** — an architecture
> fork, a scope guard, a "we deliberately did NOT do X." Don't log routine
> implementation choices; the code shows those.
>
> Newest first. Each entry: what we decided, why, what we gave up, and what would make
> us revisit it.

---

## 2026-08-13 — CFB: per-pool events, not one shared event per season (supersedes PR1's original note)

**Decision:** CFB pools use **per-pool `public.events` rows** — each pool gets its own event,
`cfb.event_details`, `cfb.weeks`, and `cfb.games`, exactly like golf's per-pool event pattern
(`createGolfPool`/D3). This **supersedes** the assumption written into `docs/CFB_BUILD_PLAN.md`'s
original schema sketch (and echoed in `agents/pm/PM.md`/`agents/senior-dev/reviews/
cfb-pr1-schema-scaffold.md`) that "CFB's `event_id` = one season, shared by every pool on that
season." That assumption never shipped in working form and is now formally wrong — fixed in this
PR's doc-sync, not just noted.

**Why:** A founder requirement surfaced while building CFB admin pool creation (PR #46): two pools
on the same real season need to be able to start at different weeks and carry different lock
schedules, and each pool's admin should only see that pool's own weeks. A single shared
season-level event can't represent "pool A starts Week 1, pool B starts Week 4" — there's only one
`cfb.weeks` row per `(event, week_number)`. Per-pool events fix this the same way `createGolfPool`
already solves "multiple pools, each with its own settings" for golf. The grading and live-score
functions (`grade-cfb-week`, `poll-cfb-scores`, `_shared/cfbGrading.ts`) already dedupe CFBD calls
by the *real* `(season, week_number)` across events rather than assuming one DB row per real game —
so they needed zero changes to keep working under per-pool events.

**What shipped to make it safe:** `cfb.games` was re-keyed from a **global**
`UNIQUE (cfbd_game_id)` (PR1's original constraint) to `UNIQUE (week_id, cfbd_game_id)` — migration
`20260813000000_cfb_games_per_week_unique.sql`. Under the old global key, a second pool importing
an overlapping week would silently steal the first pool's game rows via the upsert's `onConflict`.
`importWeekSlate`'s upsert now targets `onConflict: 'week_id,cfbd_game_id'` to match. Caught by
senior review's first pass (CHANGES NEEDED) on this PR; the re-key + re-review (APPROVE) both
landed in-branch same day. `docs/CFB_BUILD_PLAN.md`'s schema sketch, PR sequence, and status
header are corrected in this doc-sync rather than left to silently contradict the code.

**Gave up:** Admin slate imports now scale with `(pools × weeks)` instead of `(seasons × weeks)` —
two pools on the same real season each spend their own CFBD import calls for an overlapping week,
rather than sharing one import. Live-score cost is unchanged (`poll-cfb-scores`'s `/scoreboard`
call is already global-per-tick, independent of pool count). Founder-accepted as the price of
per-pool flexibility, same shape as golf's per-pool leaderboard polling (see
`per_pool_per_event_polling` in project memory).

**Revisit if:** CFB pool counts per season grow large enough that redundant per-pool imports
meaningfully approach the CFBD monthly cap (30k/mo at Tier 2) — at that point a shared-import-cache
layer (import once per real `(season, week)`, fan into every pool's `cfb.games` rows) would be
worth building, but is not needed at expected pool counts today.

---

## 2026-08-13 — CFB: live in-game scores added to the build (scope insert between PR5 and PR6)

**Decision:** Founder requested in-app live scores for CFB — a player should be able to watch
their pick's score/clock/possession inside Poold instead of switching tabs. Approved and built
immediately as a data-layer-only PR inserted between `docs/CFB_BUILD_PLAN.md` PR5 (grading) and
PR6 (picks UI), rather than folded into PR6/7 or pushed to the end of the sequence. What shipped:
migration `20260812120000_cfb_live_scores.sql` (additive `cfb.games.live jsonb`),
`supabase/functions/poll-cfb-scores/index.ts` (the live poller), and the `MONTHLY_CAP` bump
1000→30000 across `cfd-proxy`/`grade-cfb-week`/`poll-cfb-scores`. UI consumption is still PR6/7;
cron arming and the prod deploy are still PR9.

**Why:** A CFBD **Tier 2** upgrade (30k calls/mo, unlocking the `/scoreboard` endpoint) makes this
cheap: `/scoreboard` returns the entire live FBS slate in ONE call, so live polling costs one API
call per tick regardless of games/pools/players — the same economics that make golf's
per-tournament leaderboard dedup affordable. Shipping the data layer now (schema + poller +
shared grading) rather than bundling it into the picks/leaderboard UI PRs keeps each PR
single-purpose and lets PR6/7 consume `cfb.games.live` as a plain column instead of building the
ingestion path themselves.

**Gave up:** Nothing structural — this is additive and reversible (drop the column, delete the
function). The PR sequence in `docs/CFB_BUILD_PLAN.md` grows by one inserted step; nothing already
shipped had to be redone.

**Revisit if:** live scores turn out not to be worth the Tier-2 spend once real usage data exists
(unlikely — Tier 2 is now load-bearing for the whole CFB build, not just this feature).

---

## 2026-08-13 — CFB: live poller triggers grading on final (confirmed), shared via `_shared/cfbGrading.ts`

**Decision:** Confirms an earlier founder call: when the live poller (`poll-cfb-scores`) sees a
game flip to final, it grades that week and recomputes standings immediately, so standings move
live as games end rather than waiting for `grade-cfb-week`'s scan. `grade-cfb-week` remains the
manual/backfill grader (targeted `{week_id}` or "scan everything due"). To avoid two grading
implementations that can drift, the grading logic (`gradeWeek`, `recomputeStandings`) was
extracted verbatim out of `grade-cfb-week` into `supabase/functions/_shared/cfbGrading.ts`, which
both functions now import — `grade-cfb-week`'s behavior is unchanged (senior-reviewed, confirmed
byte-for-byte equivalent on its normal path).

**Why:** "Standings move live" is the whole point of the feature; deferring grading to a separate
scheduled scan would make the live poller update scores but not points, which is a confusing half
of the feature. Sharing one grading module rather than duplicating the logic in the poller removes
the risk of the two graders silently disagreeing on a scoring edge case.

**Gave up:** Nothing — `gradeWeek` gained one additional branch (trust an already-`final`-in-DB
game when the live poller's partial `/scoreboard` map doesn't include it, so a multi-game week
doesn't get un-finalized mid-slate); it's inert for `grade-cfb-week`'s full-week `/games` map,
which always includes every game.

**Revisit if:** a future format wants grading to happen only on an explicit admin action (not
automatically on final) — would need a flag to disable the poller's grade-on-final path.

---

## 2026-08-13 — CFB: live-poller look-ahead tightened to 30 minutes (judgment call, PR9 must confirm)

**Decision:** The live poller's "is anything worth polling right now" gate originally used an 18h
look-ahead (any non-final game with `kickoff_at` within the next 18 hours counted as "live
window," alongside a 6h after-kickoff tail). Senior review found this would spend one CFBD call
per cron tick for most of a game day *before* any game had actually started — idle spend with no
score to show for it, risking the 30k/mo Tier-2 cap over a full season. Tightened in-branch to 30
minutes: still enough to catch any kickoff within one future ~1-minute cron tick (PR9), but
eliminates hours of pre-game dead-air polling.

**Why:** My (PM) judgment call to unblock this PR rather than leave the finding open — 30 minutes
is a defensible number (cron cadence + margin) but it's a guess, not a founder-confirmed value.

**Gave up:** Nothing functional; a real edge case (an early/moved kickoff outside the 30-min
window) would be caught on the very next poll once `kickoff_at` enters the window, so the cost is
a few minutes of delay on the very first live update for that game, not a missed game.

**Revisit if / must-do:** **flagging for PR9 explicitly** — the founder needs to confirm (a) the
30-minute figure, and (b) the broader cron-cadence question the senior review raised: a windowed
schedule like golf's `poll-thursday..sunday` (business hours only) vs. year-round every-minute.
Both numbers together determine whether the live-scores feature survives a full season on the 30k
cap. Not a merge blocker for this data-layer PR (the cron isn't armed here) — but PR9 must not
arm the cron without settling this.

---

## 2026-08-13 — CFB: live-scores deploy steps deliberately deferred to PR9

**Decision:** This PR does not push the migration to prod, does not deploy `poll-cfb-scores` or
the updated `grade-cfb-week`/`cfd-proxy`, does not set any new secrets or `verify_jwt` config, and
does not arm any cron job. All of that is deferred to PR9, matching the CFB "prod-as-dev, defer
the deploy" pattern already used for PR1–PR5.

**Why:** Consistent with every prior CFB PR — while there are no real users, prod doubles as the
CFB dev DB, and deploy/cron-arming is batched into PR9 (the dedicated admin-ops PR) rather than
spread across every data-layer PR. Also: the exact CFBD `/scoreboard` field names
(`period`/`clock`/`possession`/`situation`/`last_play`) are read defensively but unconfirmed
against a real Tier-2 response — worth verifying once, at UI-wiring time, rather than deploying
speculatively now.

**Gave up:** Nothing — this is sequencing, not a scope cut. The migration is additive and
reversible whenever it does land.

**Revisit if:** PR9 slips significantly and live scores become blocking for a launch — could pull
just the migration + function deploy forward without waiting for the rest of PR9's admin-ops
scope.

---

## 2026-08-12 — CFB PR5: double-down minimum-line rule declined; `effectiveDoubleDownLine` added instead

**Decision:** Considered requiring a minimum spread (e.g. 5.5) for a pick to be double-down
eligible, to stop a bettor from "farming" a bonus point off a coin-flip favorite. **Declined** —
the existing 4-point buffer floor (`doubleDownBuffer`) already blocks that: a small favorite like
Georgia `-1.5` earns the cover point on any win but needs to win by 6+ to also clear the buffer
and earn the double-down bonus, so there's no free bonus to farm. Instead of a gating rule, added
a pure helper, `effectiveDoubleDownLine(lockedSpread) = lockedSpread - doubleDownBuffer(lockedSpread)`,
returning the buffer-adjusted line in the picked team's own sign convention (favorite `-1.5` →
`-5.5`; `+7` underdog → `+3`). It doesn't change any scoring rule; it exists so PR6's picks UI can
render the real bar a double-down has to clear ("this pick is really `-5.5`") instead of leaving
players to infer the buffer math themselves.

**Why:** A minimum-line gate would be a second, redundant floor on top of one that already works,
adding a rule surface with no scoring benefit. The buffer already does the job; the gap was
communication, not rules, so the fix is a UI-facing helper, not a new constraint.

**Gave up:** Nothing — no scoring behavior changed. `effectiveDoubleDownLine` is additive (JS
engine + TS mirror, covered by the shared fixtures/parity test).

**Directive for PR6:** surface `effectiveDoubleDownLine`'s output in the double-down copy, not
just the raw locked spread.

**Revisit if:** live play shows the buffer floor isn't actually deterring farming in practice
(unlikely — it's the same arithmetic already unit-tested in PR4).

---

## 2026-08-12 — CFB PR5: stuck-week finalization deferred to PR9

**Decision:** `grade-cfb-week` only marks a week `graded` once every game in it reports
`completed: true` from CFBD. A cancelled, postponed, or rescheduled game leaves the week stuck at
`locked` forever, and scan mode re-fetches CFBD for that week on every cron run (one call against
the 1000/mo cap, per run, indefinitely) since it stays outside `status = 'graded'`. Senior review
(`agents/senior-dev/reviews/cfb-pr5-grading.md`, Finding 1 / Question 1) flagged this. **Decision:
punt to PR9** — when the admin grading UI and cron wiring land, add both an admin "finalize week
as-is" override and treat a game the provider stops returning as a no-contest so the week can
still reach `graded`. Safe to defer because nothing auto-triggers the grader yet (no cron, no
admin button) — PR5 ships as pure library/edge-function code with zero live callers.

**Why:** A truly stuck game is rare (most weeks fully finalize within a day) and the fix requires
UI (an admin decision point), which doesn't exist until PR9 anyway. Building the override now
would be speculative — no caller could reach it.

**Gave up:** Some near-term cap-safety margin — a single genuinely stuck week between now and PR9
would burn one CFBD call per cron run if the cron were live. Not a live risk today since PR9 is
what wires up the cron.

**Revisit if:** PR9 is delayed and a manual/interim cron gets wired up before then — the override
would need to land first.

**MUST be handled in PR9** — tracked in `docs/CFB_BUILD_PLAN.md`'s PR9 row.

---

## 2026-08-12 — CFB PR5: manual grade-by-id lock guard deferred to PR9

**Decision:** The scan path in `grade-cfb-week` only grades weeks whose `lock_time` has passed;
the targeted `{week_id}` path (built for PR9's future "Grade week" admin button) has no such
check today, so an admin could in principle grade a week that's still open for picks. Senior
review (`agents/senior-dev/reviews/cfb-pr5-grading.md`, Question 2) flagged it. **Decision: defer
the guard to PR9**, when that admin button actually gets a caller — it's a one-line addition
(`lock_time IS NOT NULL AND lock_time <= now()`) and there is no live caller of the by-id path
today (PR5 ships `gradeCfbWeek(weekId)` in `src/lib/cfb.js` as an unused invoker; no UI wires it
until PR9).

**Why:** No code path can trigger this today, so adding the guard now is speculative work ahead
of its consumer. It's cheap enough to land alongside PR9's admin button with full context.

**Gave up:** Nothing live — idempotent re-grading after the true lock also self-corrects any
early manual grade, so the risk window is small even once PR9 ships.

**MUST be handled in PR9** — tracked in `docs/CFB_BUILD_PLAN.md`'s PR9 row.

---

## 2026-08-12 — CFB PR4: double-down is legal on an underdog ATS pick; UI copy must phrase it generally

**Decision:** A double-down flag may be placed on any of the 5 ATS picks, including one where
the picked team is the underdog getting points (e.g. a `+10` pick, buffer `5`, which clears by
losing by 4 or fewer, or winning outright). Senior review on PR4
(`agents/senior-dev/reviews/cfb-pr4-scoring-engine.md`, Question 2) flagged that `cfbScoring.js`'s
`gradeDoubleDown` already scores this case correctly, but the UI copy helper
(`doubleDownWinBy`) was documented as if the flagged pick were always a favorite, returning a
negative, nonsensical "win by −4" for a dog. The founder chose to **allow** the underdog
double-down (the alternative — restrict double-downs to favorites and enforce it at submit —
was also on the table and rejected) and fix the *documentation/consumption* contract instead of
the rule: `doubleDownWinBy` now returns a **sign-general** margin threshold (positive for
favorites, negative for underdogs) and its header comment spells out both readings. No scoring
logic changed — the arithmetic was already correct; only the doc comment and two new tests
(pinning the underdog case) landed in this PR.

**Why:** Restricting double-downs to favorites would be an arbitrary rule with no basis in
`docs/CFB_FORMAT.md` (which never says the DD must be a favorite pick) and would remove a
legitimate, students-of-the-game strategic choice — flagging a live underdog is a real, exciting
decision, not an edge case to design away. The engine handles it for free; the only real cost is
that PR6's picks-UI copy layer must branch on sign ("win by X+" for favorites vs. "cover by more
than N" / "keep it within N" for underdogs) instead of using one static string template.

**Gave up:** A simpler picks-UI copy layer (one string template, no sign branching) — not worth
it for removing a real strategic option from players.

**Revisit if:** PR6 finds the sign-branching copy genuinely can't read naturally in the UI
(unlikely — it's two template strings selected on `doubleDownWinBy`'s sign, not a formula in the
UI). See `docs/CFB_BUILD_PLAN.md`'s design-direction section for the concrete phrasing note.

---

## 2026-08-12 — CFB PR4→PR5: guard JS/TS scoring-engine drift with shared fixtures, not a comment

**Decision:** PR5 will add the authoritative, server-side grader as a hand-kept TypeScript
mirror of `src/utils/cfbScoring.js` (`supabase/functions/_shared/cfbScoring.ts`), because Deno
edge functions can't cleanly import from `src/`. Senior review on PR4
(`agents/senior-dev/reviews/cfb-pr4-scoring-engine.md`, Question 1) flagged that this means the
load-bearing scoring math will exist in two languages, edited by hand, with only the JS side
under test — the TS grader could silently diverge from the tested arithmetic and nothing would
catch it. The founder decided: **when PR5 lands, extract the worked-example cases (the buffer
rounding boundaries, DD thresholds, underdog tier edges, the underdog-DD case from the entry
above) into a shared fixtures file that both the existing JS test suite and a new TS-grader test
consume.** A drift between the two implementations then fails a test, not just a code-review
glance at a "keep these in sync" comment.

**Why:** Server-authoritative grading (so users can't grade their own picks) is the right
integrity call and isn't being revisited — but "keep two files in sync by hand" is exactly the
kind of promise that erodes silently over a season of edits. A shared fixtures file makes the
sync requirement mechanically enforced instead of a documentation convention, for close to zero
extra cost (the fixtures already exist as worked examples in `docs/CFB_FORMAT.md` and PR4's test
file — this is packaging them for reuse, not writing new cases).

**Gave up:** Nothing real — this is additive scaffolding for PR5, not a scope cut. The
alternative (a manual "keep in sync" comment only) was rejected as insufficient.

**Revisit if:** PR5's shared-fixtures approach turns out to be awkward across the JS/TS
boundary (e.g. fixture format needs per-language transforms) — fall back to a documented manual
sync with a stronger comment, but treat that as a downgrade to flag, not the default.

---

## 2026-08-12 — CFB PR3: cross-check CFBD's spread sign against its own text label; skip and warn on disagreement

**Decision:** `src/lib/cfb.js` computes the underdog purely from the sign of CFBD's
numeric `home_spread` — the entire ATS/underdog contract rests on that one number, with no
second data source to corroborate it (golf, by contrast, joins Slash Golf + The Odds API
and refuses an ambiguous match rather than guess). Senior review on PR3
(`agents/senior-dev/reviews/cfb-pr3-slate-import.md`, Finding 1 / Question 1) flagged this
as a silent-failure risk: if CFBD ever flips its sign convention, every underdog would be
computed backwards with no error. The founder chose a code-level tripwire over "re-run the
smoke test each season": `buildGameRows` now also reads CFBD's own `formattedSpread` text
label (e.g. `"Michigan -17.5"`, which names the favorite in words) via the new
`favoriteFromFormattedSpread()` helper, and compares it against the favorite implied by the
numeric sign. On disagreement, the game is skipped entirely (excluded from that week's
importable slate) and a `console.warn` is logged — not silently imported with a guessed
side.

**Why:** A wrong underdog freezes into `locked_spread` at submit time and grades wrong with
no downstream signal — the exact "confidently wrong beats silently missing" failure this
whole app tries to avoid elsewhere (see the 2026-07-13 player-name-matching decision, same
principle). CFBD already ships both snake_case and camelCase field names across versions,
so a sign-convention drift isn't a hypothetical. The text label is redundant information
CFBD already sends on every line — reading it costs nothing extra and turns a silent
mis-grade into a loud, recoverable gap (one missing game from the week's slate) instead.

**Gave up:** A game gets excluded (not corrected) when the two disagree — there's no "trust
the label over the number" fallback, because we don't know which one drifted. Also gave up
on a second independent data source (golf's approach); CFBD stays the sole provider for
CFB, this is a self-consistency check on one provider, not real corroboration.

**Revisit if:** the warn-and-skip starts firing in real seasons (would mean CFBD's
convention or label format actually changed) — at that point, add real alerting instead of
a console log an admin has to be watching for, and re-derive the sign mapping fresh rather
than patching around it.

---

## 2026-08-12 — CFB PR3: `importWeekSlate` asserts the target week's number/season match the CFBD week being pulled

**Decision:** `importWeekSlate({ weekId, seasonYear, weekNumber })` takes the stored
`cfb.weeks` row to write into (`weekId`) and the CFBD slate to fetch (`seasonYear` +
`weekNumber`) as separate arguments with nothing previously checking they refer to the same
week. Senior review on PR3 (Finding 3 / Question 2) flagged this as a silent-miswire risk
once an admin UI wires the two together (PR9). The founder chose to add the guard now
rather than defer it: before fetching anything, the function reads the stored week's
`week_number` (and its season via `event_details`, split-query per the public/`cfb`
boundary discipline) and throws if either disagrees with what was passed.

**Why:** Cheap now (one extra read, pure function, no new schema) versus a real production
failure mode later — a wrong week wiring in the eventual admin UI would silently store one
week's games under another week's id with no DB-level error, and nobody would notice until
players saw the wrong slate. Fixing it while the only caller is `importWeekSlate` itself
(no admin UI yet, PR9) means the guard ships before the risk exists, not after.

**Gave up:** Nothing meaningful — one extra query per import call, which already makes
three sequential CFBD fetches, so the added latency is negligible.

**Revisit if:** never — this is a permanent input-validation guard, not a stopgap.

---

## 2026-08-12 — CFB PR3: CFBD monthly call cap confirmed at 1000, not reused from golf's placeholder

**Decision:** `docs/CFB_BUILD_PLAN.md`'s original sketch flagged golf's `1800`
(`slash_golf_calls`) cap as a placeholder not to reuse for CFBD without checking real
limits (open question #4). The founder confirmed CollegeFootballData's free tier is
**1000 calls/month**; `cfd-proxy`'s `MONTHLY_CAP` is set to `1000` and `api_usage
.cfbd_calls` (mirroring `slash_golf_calls`) tracks it with the same read-then-write
per-call pattern golf uses (BACKLOG B4's lost-update race — "Non-atomic monthly API
counter" — applies equally here; note the senior review artifact cites this as "B5," which
is actually the unrelated `submitPicks`-atomicity item, but the described bug matches B4
exactly. Not re-flagged as new since PR3's three fetches already run sequentially by
design).

**Why:** Sizing the cap to the vendor's actual limit, not a copy-pasted number from a
different API, is the whole point of tracking usage at all — an oversized cap risks a
mid-season 429 lockout during live import, and reusing golf's number was never anything
more than a placeholder to unblock scaffolding.

**Gave up:** Nothing — this just closes an open question, it doesn't trade anything away.

**Revisit if:** CFBD's account is upgraded to a paid tier, or usage patterns (weekly slate
import across many weeks/pools) approach the cap in practice.

---

## 2026-08-11 — CFB PR2: `cfb.picks` gets NO client write policy at all — the submit RPC is the only door, not a defense-in-depth layer

**Decision:** `docs/CFB_BUILD_PLAN.md`'s original RLS sketch called for row-level
insert/delete policies on `cfb.picks` "mirroring golf's, for defense-in-depth," on top of
the `cfb_submit_week_picks()` RPC being the "real" enforcement. PR2 (`agents/senior-dev/
reviews/cfb-pr2-rls-and-submit-rpc.md`) shipped without that row-level layer: there is no
client insert/update/delete policy on `cfb.picks` at all. RLS-on plus no matching policy
means a normal authenticated user's direct write is denied outright; the only way onto
the table is the `SECURITY DEFINER` RPC.

**Why:** Golf's picks RLS can validate row-by-row because one golf pick is independently
legal (one tier, one player). A CFB weekly card is a **set constraint across 6 rows** —
exactly 5 ATS on 5 distinct games, 1 underdog on a 6th, ≤1 double-down only on an ATS
pick. Postgres RLS evaluates one row at a time and cannot express "these 6 rows together
are a legal card." A permissive per-row write policy sitting *next to* the RPC wouldn't
be extra safety — it would be a second door that a crafted API call could walk through to
insert e.g. 6 ATS picks or two double-downs, each individually passing a per-row check
while corrupting the card. Removing that door entirely, rather than writing one that
"defends in depth," is what actually closes Finding 2 (`docs/CFB_BUILD_PLAN.md`).

**Gave up:** The row-level policies golf-style defense-in-depth would have provided
against a bug *inside* the RPC itself (e.g. a future edit to the function that
accidentally skips a check) — there's now exactly one code path guarding card integrity,
not two. Accepted because a second, weaker guard that permits partial/invalid writes is
worse than no guard, not safer.

**Revisit if:** a future requirement needs a legitimate direct-row write on `cfb.picks`
(e.g. a per-pick admin correction tool) — that should get its own narrow `SECURITY
DEFINER` RPC re-validating the whole card, not a raw RLS policy.

---

## 2026-08-11 — CFB PR2: a week is "open" once its slate exists and `lock_time` hasn't passed — not gated on the `status` label

**Decision:** `cfb_submit_week_picks()` rejects a submission only when
`weeks.status IN ('locked','graded')` or `weeks.lock_time <= now()`. It does **not**
require `weeks.status = 'open'` first — a week seeded `'scheduled'` is already pickable
as soon as its games are imported and the lock time is still in the future. Raised as
senior-review Question 3 on PR2; the founder confirmed this is the intended behavior, not
an oversight.

**Why:** `lock_time` is the actual deadline players see and the actual moment picks stop
counting — it's the one date that has to be correct. Requiring a separate `'open'` flip
would just be a second manual step admins could forget, with no player-facing benefit: a
player literally cannot build a legal 6-pick card until the week's games are imported
regardless of the status label (the RPC's "game must belong to this week" check fails on
an empty slate). So the status label is informational for admin tooling; `lock_time` plus
"do games exist yet" is what actually governs pickability. This mirrors golf's permissive
style (picks open as soon as the tournament/field exists, not behind a second toggle).

**Gave up:** No admin "soft off" switch to pause picks on a week whose slate is imported
but not yet meant to be pickable (e.g. lines still being finalized) — the only lever is
`lock_time` and whether games exist. If that gap matters in practice, add an explicit
`status = 'open'` gate to the RPC then; it's a one-line change.

**Revisit if:** slate import (PR3) ever needs to stage partial/unconfirmed lines before a
week should be pickable — right now "games exist" and "week is pickable" are the same
moment, and that would need to split.

---

## 2026-08-11 — CFB PR1: schema enforces game∈week and week uniqueness at the database level, not just in the future RPC

**Decision:** Senior review of the `cfb` schema scaffold (PR1, PR #40) raised four
foundation-shape questions before any data existed in the new tables — cheap to fix then,
expensive after. All four were accepted and shipped in the same migration:

1. **`UNIQUE (event_id, week_number)` on `cfb.weeks`.** A CFB event is one season shared
   by every pool on it (unlike golf, which mints a fresh event per pool), so a re-run of
   season setup — or a second pool created against the same season — could otherwise
   double-insert "Week 5" with no way to tell which row a game belongs to.
2. **A composite FK, `cfb.picks (game_id, week_id) → cfb.games (id, week_id)`.** The plan
   (`docs/CFB_BUILD_PLAN.md`) always intended the PR2 `cfb_submit_week_picks` RPC to be
   the enforcement point for "this pick's game is actually in this pick's week." We chose
   to *also* make it structurally impossible at the schema level, for near-zero cost while
   the tables are empty, rather than trusting one code path alone. Belt-and-suspenders,
   not a replacement for the RPC — PR2 still validates the whole weekly card as a set,
   which no FK can express.
3. **`CHECK` constraints on the remaining enum-shaped text columns** (`weeks.status`,
   `games.status`, `picks.result`) — `picks.pick_type` already had one; the others didn't,
   which was an inconsistency the review caught. A future typo in server code now fails
   loudly at write time instead of silently writing a bad value that would poison grading
   or standings later.
4. **`cfb.event_details.season_year` is `NOT NULL`.** It's always known at event creation
   and is the defining attribute of a CFB event; nullable was only ever an artifact of the
   scaffold being unpopulated.

**Why now, not later:** all four are one-line additions on tables with zero rows. Once
real weeks/games/picks exist, adding a uniqueness constraint or a composite FK means
dedup­ing live data first — a materially more expensive and riskier change.

**What we gave up:** nothing functional — these are pure guardrails, not scope. The
schema is marginally less "minimal" than the original `docs/CFB_BUILD_PLAN.md` sketch,
which is now updated to match what shipped.

**What would make us revisit:** if a legitimate write path needs a week status or pick
result value outside the current enums, the fix is widening the `CHECK`, not removing it.

---

## 2026-08-11 — CFB chosen as sport #2, against the docs' own recommendation; full sport-layer siloing; FormatEngine still deferred

**Decision:** Six calls, made in one planning pass (PR0, PR #39, `docs/CFB_FORMAT.md` +
`docs/CFB_BUILD_PLAN.md`, both docs-only — no code shipped):

1. **College football is sport #2**, format = weekly against-the-spread, season-cumulative
   (5 ATS picks + 1 optional double-down + 1 mandatory tiered underdog, all-or-nothing
   submission, full random auto-fill on a missed deadline, single join cutoff before Week 1).
2. **Full siloing of the sport layer** — CFB gets its own `cfb` Postgres schema, its own
   `src/lib/cfb.js` seam, its own scoring engine, picks UI, theme/badge, and data-provider
   proxy. CFB code never imports golf and vice versa. The one shared shape is the standings
   **output**: both sports write the normalized `{ rank, total, display }` projection into
   `public.pool_standings`, so the dashboard renders either sport with zero sport-specific
   branches. This finally puts `pool_standings` to work — scaffolded but unused since Phase 1
   (BACKLOG F1).
3. **No FormatEngine abstraction (BACKLOG F6) extracted now**, even though F6's own stated
   trigger — "the moment format #2 is being designed" — has technically fired. Two dissimilar
   formats (golf's best-N-relative-to-par vs. CFB's weekly ATS grading, sharing zero logic) is
   judged too few examples to derive the right interface from; extracting now risks the
   wrong-abstraction-from-too-few-examples failure mode. Revisit at format #3.
4. **Single data vendor:** the CollegeFootballData API supplies schedule, scores, *and*
   lines — The Odds API is not used for CFB. Spreads are frozen per pick (`locked_spread`)
   at submission for grading, since the line can move before kickoff.
5. **Three findings from reading the golf code, adopted as build constraints:** (a) the
   "shared" pool shells (`PoolHeader`, `PicksHeader`, `WidgetGrid`, `StandingsCard`) hardcode
   golf styling today and must be prop-ified before CFB can reuse them; (b) golf's row-by-row
   `golf.picks` RLS can validate one pick at a time but cannot express CFB's whole-card set
   constraint (5 distinct ATS games + 1 distinct underdog game + ≤1 double-down), so CFB's
   submit path is a `SECURITY DEFINER` RPC, `cfb_submit_week_picks`, not row policies; (c)
   `Join.jsx` — which looks a pool up by join code alone and hardcodes golf's copy/route
   today — is the real forcing function for sport-dispatch, resolved via a new thin neutral
   `src/lib/pools.js` that reads only `public.*` to learn a pool's `sport_id` before either
   sport module is imported.
6. **Structural note:** a CFB pool spans a season of weekly pick windows with cumulative
   scoring — golf's one-lock-per-pool model has no week concept, so `cfb.weeks`/a per-week
   pick-window model is genuinely net-new, not a golf pattern reused.

**Why:** Every strategy doc that has weighed in on sport #2 — `docs/BRAINSTORM.md`
(Obs.1/§A: "NFL is the second sport" is backwards; team sports are the *most expensive*
second sport and reuse zero lines of golf) and `docs/MULTI_SPORT_MIGRATION.md` (D1: team
sports "won't reuse the golf shape") — recommends a golf-shaped sport first (F1, UFC, the
Derby, awards shows) specifically because it's cheap: same tiered-pick shape, same schema
pattern, same scoring family. CFB is the opposite of that recommendation on every axis: new
schema, new format, new data provider, new theme, zero golf reuse. **The founder is
proceeding with CFB anyway.** This entry exists so that choice reads as a deliberate,
eyes-open call — not a case of the docs' own advice being missed.

**What we gave up:** The cheap-second-sport path (F1/UFC/Derby/awards) that would have
validated multi-sport for a fraction of the cost and proved the schema seam before taking on
a genuinely new contest shape. Also: F6's extraction is deferred a second time, at the exact
moment its own trigger condition says not to — a conscious bet that two data points still
isn't enough to abstract from, weighed against the forensic-untangling cost F6 warns about if
deferred past 3+ formats.

**Revisit if:** CFB's build reveals the golf/CFB scoring engines share more structure than
expected (then F6 might be worth doing at 2 formats after all, not 3) — or if the schema/UI
work turns out cheaper or more expensive than the ~11-PR estimate, which should feed back into
whether "expensive team sport first" was the right call for future retrospective honesty.

---

## 2026-08-10 — A7 interim: publish the LLC Gmail, not the founder's personal one; decline to build permanent inbound mail now

**Decision:** The legal-page contact (`Privacy.jsx` data-deletion line + Contact
section, `Terms.jsx` Contact section — text and `mailto:` hrefs both) now points at
`tljvllc@gmail.com`, a monitored business/LLC mailbox — not `juddteigen@gmail.com`,
the founder's personal address that BACKLOG A7's original interim plan (and `PM.md`)
had named. Separately, the permanent fix (real inbound mail for
`privacy@getpoold.app` via an ImprovMX/ForwardEmail MX forwarder, or a Resend-inbound
webhook) was considered and **not** built. PR #38.

**Why:** `tljvllc@gmail.com` is the better address to put on a Privacy/Terms page as
the legal contact of record — it reads as the business, not a founder's personal
inbox, and it's monitored, which is the actual bar (an advertised contact that bounces
is worse than an unbranded one that's read). On the permanent fix: both routes on the
table (a third-party forwarding vendor, or a bespoke inbound-webhook integration)
add a standing dependency — an 8th vendor, or code to build and maintain — for a
low-traffic legal-contact mailbox. Not worth it yet.

**What we gave up:** A branded `@getpoold.app` address on the legal pages, in favor of
a working raw Gmail one — a small professionalism hit the senior review flagged and
accepted as an explicit interim trade-off, not a defect.

**Revisit if:** contact volume grows enough to justify inbound infra, or the raw-Gmail
look becomes a credibility problem worth ~5 minutes of DNS + a forwarder vendor to fix
(BACKLOG A7 keeps the permanent-fix path documented).

---

## 2026-07-17 — Auth email footer lives in the card table, not a trailing table

**Decision:** In `supabase/templates/magic_link.html`, the brand footer (POOLD ·
getpoold.app · address line) is now the final `<tr>` of the same card `<table>` the
body content sits in, set off by a `border-top` divider, instead of a second
`<table class="container">` positioned below the card. PR #37, a same-day follow-up to
PR #36.

**Why:** Gmail-app and Outlook-mobile were reading the detached trailing table as a
signature/quoted-content block and collapsing it behind a "…" expander, leaving a stray
ellipsis and an oddly separate box under the message — a second, independent rendering
bug from the PR #36 dark-mode fix below, caught after that PR's dashboard paste was
already live. Folding the footer into the card as its last row removes the thing mail
clients pattern-match on; there is no visual loss since the divider already implied a
section break.

**What we gave up:** Nothing — this also removed a duplicated `class="container"`
responsive-width table, so the footer now inherits the card's mobile width for free.

**What would make us revisit:** If the auth email template is ever restructured again,
keep the footer as the card table's last row, not a separate trailing table — that shape
is what mail clients collapse. `supabase/templates/magic_link.html` is the versioned
source; the live copy is pasted into the Supabase dashboard by hand and was confirmed on
a real mobile client in dark mode before this PR's resync.

---

## 2026-07-17 — Sign-in email header baked as PNG; user copy renamed "magic link" → "sign-in link"

**Decision:** Two calls in PR #36. (1) The auth email's fairway header band is now a
baked PNG (`public/email-header.png`, served from `getpoold.app/email-header.png`,
rendered by `npm run og:email` → `scripts/og/build-email-header.mjs` +
`scripts/og/email-header.html`, cloned from the existing OG-card toolchain) instead of
live HTML text. (2) All user-facing copy that named this flow ("Send Magic Link" button,
Login/Join subtext, the Privacy collection bullet) is renamed to "sign-in link."
Supabase's own dashboard template category stays labeled "Magic Link" — that's their
fixed, admin-only internal name and is out of our control; it is never shown to a player.

**Why:** (1) Gmail-app and Outlook-mobile force-invert colors in dark mode and ignore
the template's `color-scheme` meta tags, flipping the fairway header to light mint and
the cream wordmark to dark — a real, industry-standard workaround, since image pixels
aren't recolored by that inversion. (2) "Magic link" is Supabase's marketing term, not
ours, and it was starting to collide with "invite" in casual usage; "sign-in link" is
plainer and leaves "invite" free to mean only the pool join-code flow.

**What we gave up:** (1) The header is now pixels, not text — any future tagline or
brand-color change requires re-running `npm run og:email`, re-committing the PNG, and
re-verifying `getpoold.app/email-header.png` resolves *before* the updated template is
pasted into the Supabase dashboard (pasting first 404s the header for every email sent
in the gap; deploy-order note lives in
`agents/senior-dev/reviews/feat-email-dark-mode-header-and-copy.md`). It's also slightly
less accessible to screen readers than live text (mitigated by alt text on the `<img>`).
(2) The primary sign-in button is intentionally left as real HTML (a tappable link, not
an image map) — it can still flip under the same forced dark-mode inversion the header
fix defends against; that's accepted as cosmetic-only since the button stays functional
either way.

**What would make us revisit:** If Gmail/Outlook stop force-inverting dark mode (drops
the reason for the PNG), or if the brand header needs to change often enough that
"regenerate + recommit + reverify" becomes a real workflow tax — at that point live HTML
text plus better dark-mode-safe CSS would be worth another look.

---

## 2026-07-17 — Design-sync gets shims, not source changes

**Decision:** Wiring Poold's 15 shared UI components into a claude.ai/design project
(`.design-sync/`, PR #35) required two preview-only shims — a stub for
`src/lib/supabase.js` (the real client throws at import with no env in the bundle) and an
ASCII-safe shadow of `src/utils/scoring.js` (the real file writes regex character classes
with literal non-ASCII characters, which crashes if the design-sync bundler ever loads it
as non-UTF-8). Both are swapped in only via `.design-sync/tsconfig.ds.json` path remaps —
the app's own `vite.config.js` never reads that file, so the shims cannot affect
`npm run build`/`npm run dev` (verified in senior review). We chose to **add the shims and
leave `src/` untouched**, rather than fix `scoring.js`'s regexes (a real, cheap, harmless
fix — see BACKLOG F7) as part of this PR.

**Why:** This PR's stated boundary was zero `src/` changes — a pure tooling/scaffolding
PR should not be the vehicle for an unrelated source edit, even a trivial one, because it
blurs what the PR did and what it touched. The scoring.js bug is real but cannot reach
production (ES modules are always UTF-8-decoded by the browser, regardless of server
headers) — so there was no urgency forcing the two together.

**What we gave up:** `.design-sync/scoring-preview.js` now has to be kept behaviorally in
sync with `src/utils/scoring.js` by hand (NOTES.md documents this as a re-sync risk). If
`computeScores`'s public behavior changes and the shadow isn't updated, design previews
could silently drift from real scoring — cosmetic risk only, previews don't feed anything
back into the app.

**Revisit if:** `src/utils/scoring.js` ever gets touched for an unrelated reason — fold
the `\u`-escape fix (BACKLOG F7) into that PR and delete the shadow, since the two-line
change is free once the file is already open. Don't open a PR solely for this.

---

## 2026-07-14 — The crawler gets an RPC, not a service-role key

**Decision:** Link previews are rendered by a Netlify **edge function** that rewrites the
OG tags in the served HTML. To read pool data it calls `public.pool_preview(code)` — a
`SECURITY DEFINER` RPC with a fixed, five-field projection, granted to `anon`. We
explicitly **did not** give the edge function a Supabase service-role key.

**Why an edge function at all (and not React):** crawlers — iMessage, WhatsApp, Slack,
Discord, Signal, Twitter — fetch the URL and read `<head>` **without running JavaScript**.
We are an SPA: every route serves the same `index.html` and React paints afterwards, long
after the crawler has gone. Meta tags set from React are *structurally* invisible to the
thing that needs them. This is not a preference; it is the only place the fix can live.

**Why not the service-role key:** it is the obvious way to let an anonymous request read a
row that RLS protects, and it would have taken ten minutes. It also bypasses RLS on *every
table in the database*, and it would have been sitting in Netlify's environment — reachable
by any future build script, any dependency in the build, anyone with dashboard access — in
order to serve a preview card. The blast radius of losing that key is the entire database;
the value it was buying is a nicer link. That trade is not close.

**What the RPC gives up instead:** it discloses pool name, organizer display name, course,
pick count, lock time, and badge to anyone holding a **valid join code**. That is not a new
leak — holding the code already lets you join the pool and see all of it, and then some.

**The pattern, stated generally:** when something *outside* the app needs to read something
*inside* it, give it a narrow function, not a wide key. Same instinct as `admin_list_users()`
and `admin_set_role()`; same reasoning as the column-GRANT entry below.

**Revisit if:** a preview ever needs data that can't live behind a safe projection — at
which point the answer is still not the service-role key, it's a signed request.

---

## 2026-07-14 — Nobody plays under a name derived from their email

**Decision:** `profiles.display_name` is chosen by the user, never generated from their
email. New accounts are created with it NULL and are **blocked** at `/welcome` until they
pick one — a wall, not a prompt. Existing users are **not** forced to rename; they get a
short-lived nudge pointing at the "You" tab and change it when they feel like it.

**Why:** The signup trigger had been writing `split_part(email, '@', 1)` into
`display_name` since 2026-06-16. That column is the one piece of identity other players
are *supposed* to read about each other, so it is exempt from the column-GRANT lockdown
that hides `email` — which means we were publishing the local part of every user's email
address to everyone else in their pool, on every leaderboard, for two months. The fix is
not a stronger grant; the column was never the problem. The data we put in it was.

**Why a wall for new users but only a nudge for existing ones:** an account with no name
renders as "Participant" on a leaderboard, which is worse than a bad name — so new
accounts have to clear the bar. Existing accounts already have *a* name; forcing a rename
would interrupt everyone to fix something they may not care about. And a login-time prompt
would have missed them anyway: Supabase keeps sessions alive, so most users never see the
login screen — they go straight to `/dashboard`. That is why the nudge lives in the bottom
nav, not in the auth flow. (Founder's read, and it's correct.)

**What we gave up:** one extra step in the signup funnel — on the invite path, which is
the growth loop, so it is not free. Mitigated by carrying the join code through `?next=`
so the invite still lands in the pool it was for. Also: email-derived names persist on
leaderboards until each user acts, so the leak closes gradually, not at once.

**Mechanism worth knowing:** `display_name_set_at` distinguishes "a human chose this" from
"the old trigger wrote this." It is stamped by a `BEFORE UPDATE` trigger, never sent by the
client, so it cannot be faked to dodge the nudge — and it kept the write path on the plain
`GRANT UPDATE (display_name)` from A1 rather than inventing a second one.

**Revisit if:** the extra step measurably hurts invite conversion (then: let people in and
nudge them instead, accepting "Participant" rows), or if we ever want handles to be unique
(they are not — two Mikes in one pool is currently allowed and fine).

---

## 2026-07-14 — The legal pages say exactly what the code does about money

**Decision:** Shipped public `/privacy` and `/terms`. The load-bearing clause is that
**Poold never processes, holds, escrows, collects, or transfers money** — stakes and
payouts are described as a *convenience calculator* over numbers the commissioner typed
in, settling happens between participants off-platform, and we disclaim any dispute about
who owes what. Utah governing law, 18+, as-is warranty, and an explicit note that
third-party score data can be wrong and the commissioner has the final say on results.

**Why:** The no-money-on-platform rule has been a standing constraint since June (see the
2026-06 entry) and is the legal moat, but it existed only as a *product* principle — there
was no document anywhere telling a user, or a regulator, that this is what the app does.
The prize-pool feature (`stake_amount`, `payout_structure`) makes the app *look* like it
might touch money. Saying plainly that it doesn't is the cheapest protection available, and
it costs nothing precisely because it is true.

**The coupling to remember:** the Terms now describe the code. If a future feature ever
does touch money — Stripe, escrow, payouts, anything — **the Terms must change before it
ships**, and at that point the legal moat is gone and this is a different company. That
constraint is the point of the document, not a footnote to it.

**What we gave up:** consent friction (a line under both magic-link forms), and a small
maintenance burden — the documents are now something that can go stale.

**Known and accepted:** the contact address the documents name, `privacy@getpoold.app`,
**does not exist** — `getpoold.app` has no MX records, so mail to it bounces. The privacy
policy promises deletion on request, so the one channel we advertise for that right is
currently a dead drop. Founder chose to ship anyway rather than block on DNS; tracked as
**A7** in `docs/BACKLOG.md` (🟠) with the ~5-minute forwarding fix and a one-line fallback
(point the docs at the Gmail that does receive mail). This is the weakest line in either
document.

**Revisit if:** we take payments (see above), incorporate somewhere other than Utah, or
the user base stops being "friends of friends" — at which point these want a real lawyer,
not a first draft.

---

## 2026-07-14 — Column access is a GRANT problem, not an RLS problem

**Decision:** Privileged *columns* on `public.profiles` are protected by column-level
GRANTs, and every privileged operation on them goes through a `SECURITY DEFINER` RPC that
re-checks `is_admin()` itself. `anon`/`authenticated` can SELECT only
`(id, display_name, role, status, created_at)` and UPDATE only `(display_name)`.
`admin_list_users()` reads email; `admin_set_role()` writes role. Fixing A1 (PR #24).

**Why:** The instinct on seeing "any user can set `role='admin'`" is to fix the *policy* —
add a `WITH CHECK` that pins `role` to its current value. **That cannot work: Postgres RLS
is row-level and has no column granularity.** A policy can say *which rows* you may touch
and *what the resulting row must look like*, but it cannot say *which columns you may
write*, and expressing "role must not change" inside a policy means either an
`OLD`-referencing check RLS doesn't give you, or a `BEFORE UPDATE` trigger — i.e. a second
mechanism, in a second place, that the next person won't know to look for.

Column GRANTs are the mechanism Postgres actually provides for this, and they're *stronger*
than a policy: **privileges are checked before any policy runs**, so a revoked column is
unreachable regardless of what any current or future policy says. It's the same move C3
made for reads (2026-06-20) — this just applies it symmetrically to writes, so `profiles`
is now locked in both directions by one consistent mechanism.

**Consequence to know:** a plain `supabase.from('profiles').update({ role })` **will fail,
by design.** That is not a bug to route around — it's the fix. Privileged writes get an RPC.

**`admin_set_role()` also refuses a self-role-change.** The admin UI already hid the toggle
on your own row, but that was a UI convention, not an invariant. A sole admin demoting
themselves leaves nobody able to promote anyone, and recovery needs raw SQL. We have locked
ourselves out of admin once already (the coupled-migration incident); once is enough.

**Gave up:** Self-service display-name editing is the only profile write a user can make,
and any *new* self-editable field now needs an explicit `GRANT UPDATE (col)` — a small,
deliberate friction. That's the intended cost: adding a user-writable column to `profiles`
should be a decision, not a default.

**Watch for:** Someone hitting the failed `.update({ role })`, concluding the RLS policy is
"too strict," and re-granting table-level UPDATE to make it work. That silently reopens A1.
The grant is the gate; the policy is belt-and-braces.

**Revisit if:** Postgres ever gains column-level RLS, at which point the two mechanisms
could collapse into one.

---

## 2026-07-13 — The merge guard checks `agents/pm/`, not "any .md"

**Decision:** `merge-guard.mjs` (renamed from `pm-sync-guard.mjs` 2026-07-15) now blocks `gh pr merge` when a substantive diff leaves
`agents/pm/` untouched (and separately, when `src/pages|components` changes without
`docs/PAGES.md`). It previously allowed the merge if **any** `.md` file had changed.
Supersedes the enforcement half of *"Doc sync runs before the merge"* (same date); the
principle there is unchanged.

**Why:** The old check was a proxy that PR #22 walked straight through. That PR updated
`CLAUDE.md`, `docs/PAGES.md`, and added `docs/NAME_MATCHING.md` — three docs, so the
guard saw a well-documented branch and allowed it. But `/pm-sync` never ran, and the PM
docs went stale: two genuinely re-litigable decisions went unlogged and the ROADMAP
status log missed a ship. **Docs written *alongside* the code are not the same as the PM
reconciling the strategy docs against it**, and only the second one is what this hook
exists to force. It failed silently, which is the worst way to fail.

**Gave up:** More merges will now be gated, including small ones where nothing in
`agents/pm/` genuinely applies. That is the intended cost — it converts "no PM docs
needed" from an accident into a claim you have to make out loud via `PM_SYNC_SKIP=1`.

**Known false positive (accepted):** the guard matches the *string* `gh pr merge`
anywhere in a Bash command, so a command that merely mentions it (a test harness, an
echoed payload) is also gated. Deliberately conservative — a spurious block is
recoverable in seconds, a spurious allow is how we got here.

**Revisit if:** The escape hatch starts getting used routinely. That would mean the rule
is miscalibrated and is training us to bypass it, which is worse than no rule at all.

---

## 2026-07-13 — An ambiguous player-name match is refused, not guessed

**Decision:** When joining bookmaker odds onto the Slash Golf field, a fallback match
(same surname + same first initial) is only accepted when **exactly one** candidate
matches. If two players collide, we decline the match and the player shows `N/A` rather
than receiving a best-guess price. `src/utils/playerMatch.js`.

**Why:** The two failure modes are not symmetric. A **missing** price is loud and
cheap — the admin sees `N/A` in the tier builder and drags the player where he belongs.
A **wrong** price is silent: it flows into `impliedProbability` in `tierBuilder.js`,
mis-sorts the player into the wrong tier, and nobody ever finds out. We would rather
under-match and be corrected by a human than over-match and be quietly wrong.

**Gave up:** 100% automatic coverage. Some fields will always have a residual `N/A`, and
that is the intended resting state, not a bug to chase.

**Watch for:** Someone seeing an `N/A` and "fixing" it by loosening the match rule.
That trades a visible gap for an invisible error. If coverage needs improving, add an
alias (`src/utils/nameAliases.js`) — a fact — rather than weakening the rule.

**Revisit if:** We ever get a shared player ID across the two APIs, at which point all
name matching becomes unnecessary.

---

## 2026-07-13 — No LLM for cross-source name resolution

**Decision:** Player names are reconciled between Slash Golf and The Odds API by a
deterministic three-layer resolver — normalize/transliterate → surname + first-initial
fallback → hand-maintained alias table. We considered and **rejected** an LLM fallback
for the names the rules can't reach.

**Why:** The idea is genuinely appealing — the residue is exactly "arbitrary world
knowledge" (Tom Kim is legally Joohyung Kim), which is what an LLM is good at, and the
join runs once per pool creation so cost and latency would be irrelevant. What killed it
was the measurement: after the first two layers, **exactly one name in the entire Open
field still needed help.** Standing up an edge function (the key can't go in the browser
— see A2), plus prompt, schema, and a hallucination-guard for a one-row problem, is not
a trade worth making. A table with one entry beats a model call.

**Gave up:** Automatic coverage of future unknown names. New aliases are manual — that's
a per-season chore, documented in `docs/NAME_MATCHING.md`.

**Revisit if:** The alias table grows past roughly 30 entries, or a season opens with a
double-digit residual after layers 1–2. That would mean the rules stopped generalizing,
and the economics flip.

---

## 2026-07-13 — Docs live where their readers look; PM owns them centrally

**Decision:** PM owns every doc in the repo, but only strategy artifacts (`PM.md`,
`PRODUCT.md`, `ROADMAP.md`, `DECISIONS.md`) physically live in `agents/pm/`. Engineering
references (`docs/PAGES.md`, `BACKLOG.md`, `DESIGN_SPEC.md`, `MULTI_SPORT_MIGRATION.md`)
stay in `docs/`, and `CLAUDE.md` stays at the repo root.

**Why:** The instinct was to consolidate everything under `agents/pm/`. But ownership
and location solve different problems. A dev agent building a feature looks in `docs/`;
filing `PAGES.md` under `agents/pm/` re-frames it as the PM's private notes and it gets
missed by exactly the readers who need it. `CLAUDE.md` is worse — Claude Code auto-loads
it *from the repo root*, so moving it breaks the one doc guaranteed to be read.
Consolidation is achieved by the **ownership index** in `PM.md` (which the `/pm-sync`
skill runs on), not by moving files.

**Gave up:** A single tidy folder. Docs remain spread across three locations.

**Revisit if:** The index in `PM.md` stops being maintained — at that point the
directory layout is the least of the problems.

---

## 2026-07-13 — Doc sync runs *before* the merge, in the same PR

**Decision:** The `/pm-sync` skill runs while a PR is still open, so doc updates ride in
the same PR as the change that caused them. A `PreToolUse` hook blocks `gh pr merge`
until it has run. Enforced by `.claude/hooks/merge-guard.mjs` (renamed from
`pm-sync-guard.mjs` 2026-07-15).

**Why:** The obvious design was to sync *after* merging. But that spawns a second
docs-only PR for every change — forever — and each PR costs a Netlify build. Syncing
pre-merge means one PR, one deploy, and docs are never even briefly stale. It also means
the doc update is reviewed alongside the code it describes.

**Gave up:** Merges are now gated. If a PR genuinely needs no doc change, you must say
so explicitly (`PM_SYNC_SKIP=1 gh pr merge …`) rather than merging silently. That
friction is the point — it makes "no docs needed" a deliberate claim rather than an
oversight.

**Related:** `netlify.toml` now skips builds for doc-only changes, so documentation is
free regardless.

**Revisit if:** Merges start happening outside Claude Code (github.com UI, mobile). The
hook can't see those — that's when this graduates to a GitHub Action.

---

## 2026-07-13 — Badge color is a system, not a constant

**Decision:** Tournament badge background + border are stored per event in
`badge_config` and encode prestige + geography. Implemented from the Claude Design
"Tournament Badges" prototype; all 48 tournaments seeded.

**Why:** It reads as pure polish, but it lands on our #1 differentiator. Every
competitor (Splash, RunYourPool, Majors Challenge) is functionally complete and
aesthetically dated. Friend groups choose with vibes, not feature matrices — "this looks
like something made, not generated" is a real moat, and a per-event badge is a cheap,
high-visibility way to buy it.

**Gave up:** `badge_config` changed shape (array of styled lines → one object), a
breaking change requiring a coupled frontend + DB deploy. Mitigated with a legacy branch
in `SportBadge` so a half-applied migration degrades instead of blanking.

**Note:** We kept The Open as big-`THE` / small-`OPEN` because that's how the designer
drew it, despite a PM suggestion to flip it. Design intent wins over PM instinct on
design calls.

---

## 2026-07-13 — Supabase auto-pause is a P0, not an annoyance

**Decision:** Added ROADMAP **P0.5** — either upgrade to Supabase Pro or run a
year-round heartbeat, before any growth push.

**Why:** The free tier paused the project after ~7 days idle, pulled its DNS, and took
getpoold.app down with an opaque "load failed" at sign-in. The failure mode is what
makes it P0: cron polling is only scheduled on tournament weekends *by design*, so every
quiet week between events is long enough to trip the timer. Our entire growth loop is
"commissioner shares a link" — an app that can be *asleep* when the link is opened
undermines the one motion that matters.

**Revisit if:** Never — this is a floor, not a preference.

---

## 2026-07-10 — Self-serve pool creation is the real P0 feature

**Decision:** Ranked self-serve pool creation (P0.2) above every other feature.

**Why:** The stated strategy is "win the commissioner — they bring the group." But pool
creation is gated behind the global admin role, so **nobody except the founder can start
a pool.** There is no acquisition motion at all until this changes; every other growth
idea is downstream of it. This was not obvious from the code — it only surfaced when the
product inventory was written against the strategy.

**Gave up:** Nothing yet — not started.

---

## 2026-06 — No money moves through the platform (standing constraint)

**Decision:** Poold never collects, holds, or pays out money. Commissioners *may* declare
a per-player stake and payout split, and the leaderboard displays the pot — settlement
happens offline between friends.

**Why:** This is the legal moat. Splash Sports is a regulated real-money operator and
carries state restrictions, KYC, and rake as a result. Display-only stakes give us the
social stakes ("something on the line") with none of the regulatory weight, and let us
be free where competitors must charge.

**Gave up:** The most obvious monetization path. Revenue will have to come from the club
/ brand channel instead (see ROADMAP 3.5).

**Revisit if:** Never, without legal counsel. Flag any feature that edges toward it.

---

## 2026-06 — Per-sport Postgres schemas; team sports won't reuse the golf shape

**Decision:** Thin sport-agnostic core in `public` (events, pools, participants); each
sport owns its contest structure in its own schema (`golf`). A future NFL models
`weeks → games → picks(spread)` independently rather than being forced into golf's
`picks → tier → competitor` shape.

**Why:** Golf's tiered-athlete format is *golf's* contest shape, not a generic one.
Generalizing it would produce a worse abstraction for both sports. Per-schema costs some
boilerplate (grants, RLS duplication) but buys full modeling freedom per sport and keeps
adding a sport **additive work, not a refactor**.

**Gave up:** Referential tightness (`public.pools` has no FK to golf's detail row) and
some out-of-band config risk (PostgREST "exposed schemas" is a dashboard setting, not a
migration).

**Status:** Phases 0–4 shipped. Phase 5 (drop legacy tables) pending —
`public.pga_event_badges` is the one legacy table that is NOT droppable.

---

## 2026-07-15 — Share leaderboard polls by tournament; don't merge pools into one event

**Decision:** Fix the "N pools on one tournament = N Slash Golf calls" waste at the *poll*
layer — `poll-leaderboard` groups active events by `slash_golf_tournament_id`, fetches
once per tournament, and writes the payload to every event's cache row. We did **not** take
the "purer" route of making `createGolfPool` reuse one shared event across pools.

**Why:** Sharing the API call is all the problem needs. Merging pools onto one event would
also force them to share the field (tiers/players), the odds frozen at creation, and the
scoring params (`pick_count`/`scores_to_keep`) — but pools on the same tournament are created
at different times, at different odds, and may want different rules. The poll-layer fix keeps
each pool's frozen odds/field intact (odds live in `golf.tier_players`, never touched by the
poll) while decoupling API spend from pool count: one isolated edge-function change, no data
model surgery, no create-flow change. Verified live: The Open, 7 pools → 1 call, 7 cache rows.

**Gave up:** The single-event-per-tournament model stays unrealized (still one event per
pool). The "many pools share one event" capability (D3 / BACKLOG G3) remains wired-but-unused;
if a real product need appears (e.g. a commissioner-managed shared field), that's the larger
Option-B build, tracked separately.

**Revisit if:** we want commissioners to attach pools to a shared, admin-managed tournament
field — then the event-merge refactor earns its cost.

**Related:** the admin polling toggle in the same PR is gated on `is_admin()`, not a hardcoded
owner email, on purpose — a future commissioner is a different role, so `is_admin()` already
excludes it at the server and the split only needs to hide the UI card.

---

## 2026-07-15 — Merge flow splits into two subagents; the guard can't gate its own edits, and test-only PRs skip review on purpose

**Decision:** The pre-merge flow is now two agents, not one. `senior-dev` (Opus) reviews
the branch diff for correctness/tech-debt/design and commits
`agents/senior-dev/reviews/<branch>.md` with plain-English questions for the founder;
`pm` (Sonnet, this doc-sync) runs second and cheap so it stops holding the merge up. The
hook (renamed `pm-sync-guard.mjs` → `merge-guard.mjs`) now requires **both** artifacts —
a review when code changed, and an `agents/pm/` touch — reading committed files as proof,
since a hook can't observe an agent running. Two narrower calls came with it:

- **The guard cannot gate changes to itself.** Everything under `.claude/` (the hook, the
  agents, the skills) is excluded from what counts as "substantive," so a branch touching
  only that machinery — including one that breaks the guard — merges with zero checks. A
  hook reviewing its own edit is structurally circular, so this isn't a bug to fix in code;
  it's handled as a **convention**: any PR touching `.claude/hooks|agents|skills` gets a
  manual `/senior-review` before merging (this branch is the dogfood case — see
  `agents/senior-dev/reviews/chore-pr-review-and-pm-subagents.md`, Finding 1).
- **Test-only PRs intentionally skip the senior-dev review.** The guard's `CODE` pattern
  doesn't match `*.test.[jt]sx?`, so a branch that adds only tests produces no
  `codeChanged` and merges without a review pass. Treated as an acceptable trade (tests
  are low-risk, and reviewing test logic wasn't the point of this flow) rather than an
  oversight — flagged explicitly so it reads as a choice if revisited.

**Why:** The single-agent flow was blocking merges on judgment work (a real code review)
using the same fast pass meant for keeping docs current. Splitting them lets the
expensive model do the one thing worth paying for — catching a bad design call before
it ships — while the doc sync stays fast and never holds the PR hostage.

**Gave up:** A `.claude/`-only edit gets no automatic backstop, and neither does a
test-only one; both rely on a human doing the right thing rather than a hook enforcing it.

**Revisit if:** the `.claude/` convention gets skipped in practice (that's a sign it needs
to become a GitHub Action or a separate check outside the repo's own hook), or a test-only
PR ships a real logic bug that a review would have caught.

---

## 2026-07-16 — Course geocoding stays direct-to-Nominatim, town-level fallback over precision

**Decision:** `CreateTournament` now geocodes courses via Nominatim's free-text search
instead of Open-Meteo's name-only match (BACKLOG F3), called directly from the browser —
same pattern as the geocoder it replaces — rather than routed through an edge-function
proxy. The query tries the specific `courseName, city, state` string first (pins the
actual course), and falls back to a town-level `city, state` query if that misses, so a
course name that doesn't fuzzy-match OpenStreetMap's data still resolves to roughly the
right weather. Requests carry Nominatim's policy-compliant `email=` identifier param
(the browser can't set a custom `User-Agent`).

**Why:** Weather only needs to be regionally right, not GPS-precise, so a resolvable
town-level fallback is worth more than a precise query that can silently return nothing —
the senior-dev review flagged this as the one real regression risk (a course string that
doesn't match OSM would have gone from "geocodes the town" under the old Open-Meteo query
to "resolves nothing" under a courseName-only Nominatim query). On proxying: this is one
lookup at tournament-creation time against a free public endpoint with no API key to
protect, unlike Slash Golf/Odds (`slash-golf-proxy`, `odds-proxy`) where a leaked key was
the actual risk being defended against — so a proxy would add infra with no matching
threat. The `email=` param is the cheap, correct way to be a good citizen of that public
endpoint instead.

**Gave up:** No fallback ladder finer than "specific query, then town" — a course whose
*town* also fails to geocode (unlikely, but possible for very small towns) still gets no
weather, same as before. Geocoding also stays inline in `CreateTournament.jsx` rather than
factored into a `src/lib/` helper like the other third-party calls — flagged as a nit, not
worth a refactor for one call site.

**Revisit if:** Nominatim's public server starts rate-limiting or blocking Poold's traffic
(the `email=` param is the mitigation, not a guarantee), or a second geocoding call site
appears and the inline-vs-helper tradeoff changes.
