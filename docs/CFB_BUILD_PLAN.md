# College Football (Sport #2) — Build Plan

> **Status:** Planning, execution in progress (PR5 of ~10 shipped, plus one inserted
> live-scores PR ahead of PR6, plus the admin half of PR8/PR9 landed early, plus a
> slate-import automation PR — see below). Written 2026-08-11 from a dedicated planning
> pass, grounded in a full read of the golf implementation as the template. This is the
> *how-we-build-it* sequencing doc; the *what-the-game-is* rules live in
> `docs/CFB_FORMAT.md` (PR0). Supersedes nothing — it's net-new work. See
> `docs/MULTI_SPORT_MIGRATION.md` for the per-schema architecture this sits on, and
> BACKLOG **F1** (`pool_standings`) / **F6** (format contract) for the debt this interacts
> with. **PR1 (`cfb` schema scaffold) shipped 2026-08-11, PR #40; PR2 (RLS +
> `cfb_submit_week_picks` RPC) shipped 2026-08-11, PR #41; PR3 (`cfd-proxy` + slate
> import) shipped 2026-08-12; PR4 (`cfbScoring.js` grading engine + first unit tests)
> shipped 2026-08-12, PR #43; PR5 (`grade-cfb-week` grading job + `pool_standings` +
> the JS/TS drift guard) shipped 2026-08-12, PR #44; CFB live in-game scores
> (data layer only, inserted between PR5 and PR6) shipped 2026-08-13; CFB admin —
> pool creation + weekly slate-import ops (the admin half of PR8/PR9, landed early)
> shipped 2026-08-13, PR #46; slate import automated (hourly `poll-cfb-lines` poller +
> `cfb.spread_history`, replacing PR3's manual per-week import) shipped 2026-08-13,
> PR #47; CFB player UI Phase 1 — the locked "Varsity Navy" theme, backward-compatible
> prop-ification of the shared pool shells (Finding 1, resolved), and two placeholder
> player routes (`/cfb/pool/:id`, `/cfb/pool/:id/picks`) — shipped 2026-08-13, PR #48**
> — see the PR sequence table below; the schema sketch reflects what actually
> shipped, including four integrity constraints senior review added beyond this doc's
> original sketch in PR1, plus PR3's `underdog_spread` CHECK, plus PR #46's
> per-pool-events correction (`cfb.games` re-keyed `UNIQUE(week_id, cfbd_game_id)` — see
> `agents/pm/DECISIONS.md`, 2026-08-13), plus PR #47's `cfb.spread_history` addition (same
> date, separate decision entry).

CFB is Poold's second sport: a new `cfb` Postgres schema and a genuinely new **format**
(weekly against-the-spread, season-cumulative). The full rules are in `docs/CFB_FORMAT.md`.

---

## Settled architecture decisions

These are decided — build within them.

1. **Full siloing of the sport layer.** CFB owns its Postgres `cfb` schema, its `src/lib/cfb.js`
   seam (the only file that calls `supabase.schema('cfb')`), its scoring engine, picks UI,
   theme + badge, and data-provider proxy. **CFB code never imports golf and vice versa;
   neither sport schema references the other.**
2. **Shared neutral `public` core** (profiles, sports, events, pools, pool_participants,
   pool_standings), auth, hosting, dashboard shell, and the pool shells in
   `src/components/pool/`. `public` references no sport schema; sport schemas reference
   `public` only.
3. **The one shared shape is the standings *output*.** Silo the scoring engines completely
   (golf's best-N-relative-to-par fold and CFB's weekly ATS grading share zero logic), BUT
   both emit the same normalized `{ rank, total, display }` projection into
   `public.pool_standings`, so the shared dashboard renders a golf pool and a CFB pool with
   **zero sport-specific branches**. Each engine writes that row shape independently — it is
   not an engine coupling. This finally wires up `pool_standings` (unused since Phase 1).
4. **No full FormatEngine abstraction now (F6).** Two dissimilar formats is too few to
   extract the right interface. Only the standings-output contract (#3) is shared. Revisit
   F6 at format #3.
5. **A thin neutral sport-dispatch layer** reads `events.sport_id` and routes to the golf or
   CFB module. It holds no sport logic — it just dispatches (see Finding 3).

---

## Three findings from reading the golf code (these shape the sequencing)

**Finding 1 — the "shared" pool shells are not actually sport-agnostic today.**
`src/components/pool/PoolHeader.jsx` and `PicksHeader.jsx` hardcode golf's fairway-green
gradient inline (not as a prop); `WidgetGrid.jsx` hardcodes an import of golf's widgets;
`StandingsCard.jsx` hardcodes the label "Pick'em Standings." Fine at one sport; a blocker
the moment CFB needs its own register. Fix = small, backward-compatible prop-ification
(golf's current values become the defaults), which also puts the unused
`public.sports.theme` column to work. Must land before CFB reuses the shells.
**Resolved 2026-08-13, PR #48** — `PoolHeader`/`PicksHeader` take `gradient`/
`accentColor`/`rib`/`children` (+ `showBadge` on the picks header), `StandingsCard`
takes `label`, `WidgetGrid` renders `children` in place of golf's hardcoded widgets when
supplied. Golf passes none of the new props, so it renders byte-identically (verified in
senior review — see `agents/senior-dev/reviews/cfb-ui-phase1-foundation.md`). The
`public.sports.theme` column itself is still unused; CFB's theme is a plain JS constants
module (`src/theme/cfb.js`), not driven from that column yet.

**Finding 2 — golf's row-by-row pick RLS can't enforce CFB's whole-card rules.**
Golf's `golf.picks` policies validate one row at a time (one pick = one tier, independently
checkable). CFB's rules are a **set constraint across the 6 rows of one week's card**
(exactly 5 ATS on 5 distinct games, 1 underdog on a 6th distinct game, ≤1 double-down).
Postgres RLS is row-level and cannot express that. So CFB's submit path must be a
`SECURITY DEFINER` RPC — `cfb_submit_week_picks(pool_id, week_id, picks jsonb)` — that
validates the full set and writes it in one transaction. (This also avoids the non-atomic
delete-then-insert bug BACKLOG B5 flags for golf; for CFB it's load-bearing, not optional.)
This RPC lives entirely in the `cfb` schema and touches only `cfb` tables — it is not a
cross-sport concern.

**Finding 3 — `Join.jsx` is the real forcing function for sport-dispatch.**
`Join.jsx` looks a pool up by join code alone, hardcodes golf copy, and navigates to the
golf picks route. A join code doesn't reveal the sport — so this is the one screen that
*must* branch on `sport_id` before it knows which page/copy to render. The clean way: a
thin neutral `src/lib/pools.js` that reads only `public.*` to learn each pool's `sport_id`,
so `Join.jsx`/`Dashboard.jsx` never import both sport libs. Dashboard has the same need one
level down (it already knows each pool's sport from its query).

---

## The `cfb` schema (sketch)

Mirrors golf's per-schema pattern. **`event_id` = one pool's season instance** — each CFB pool
gets its own `public.events` row, `cfb.event_details`, `cfb.weeks`, and `cfb.games`, the same
per-pool pattern golf's `createGolfPool` already uses (the D3 hinge, applied per pool rather than
per real-world event). **This corrects the doc's original sketch**, which assumed one `event_id`
shared by every pool on a season; that never shipped in working form and was formally superseded
2026-08-13 (see `agents/pm/DECISIONS.md`) once a founder requirement — two pools on the same real
season starting at different weeks with different lock schedules — proved a shared season-level
event couldn't represent that. `cfb.games.cfbd_game_id` is therefore unique **per week**
(`UNIQUE (week_id, cfbd_game_id)`, migration `20260813000000_cfb_games_per_week_unique.sql`, PR
`cfb-admin-pool-creation`), not globally — the same real CFBD game legitimately gets one row per
pool's week. Admin slate imports scale with `(pools × weeks)`; grading/live-score CFBD calls still
dedupe by the real `(season, week_number)` across events, so that cost is unaffected.

**Shipped as of PR1 (2026-08-11, PR #40)** — the block below is what actually landed in
`supabase/migrations/20260811000000_cfb_phase1_scaffold.sql`. Four integrity constraints
were added beyond this doc's original sketch, all flagged by senior review as cheap now /
expensive once data exists: `weeks(event_id, week_number)` uniqueness, a composite FK
guaranteeing a pick's game belongs to its week, `CHECK`s on the remaining enum columns,
and `season_year NOT NULL`. Tables are empty (no CFB data has been imported yet); RLS
policies and the `cfb_submit_week_picks` RPC shipped in PR2, 2026-08-11, PR #41 — see the
"RLS" bullet below. **`games.cfbd_game_id` was re-keyed from globally UNIQUE to
`UNIQUE (week_id, cfbd_game_id)` on 2026-08-13** — see the per-pool-events correction above.

```
cfb  (FKs point within cfb or cfb → public, never → golf)
├── event_details   event_id → public.events (1:1), season_year int NOT NULL
├── weeks           id, event_id → public.events, week_number int, label,
│                    lock_time timestamptz, status ('scheduled'|'open'|'locked'|'graded') CHECK
│                    -- per-pool: event_id is this pool's own event, so its weeks are its own
│                    UNIQUE (event_id, week_number)  -- makes "Week 5 of this pool's season" a single row
├── games           id, week_id → cfb.weeks, cfbd_game_id text,
│                    home_team, away_team, home_conference, away_conference, kickoff_at,
│                    home_spread numeric NOT NULL,      -- signed vs home; away = -home_spread
│                    is_fbs_vs_fbs boolean NOT NULL,
│                    status ('scheduled'|'in_progress'|'final') CHECK, home_score int, away_score int,
│                    underdog_team text, underdog_spread numeric,  -- denormalized for the picks UI
│                    UNIQUE (id, week_id)  -- lets picks reference (game_id, week_id) as a composite FK
│                    UNIQUE (week_id, cfbd_game_id)  -- per-week, not global (2026-08-13) — the same
│                    -- real CFBD game legitimately appears once per pool's week
├── picks           id, pool_id → public.pools, week_id → cfb.weeks, user_id → public.profiles,
│                    game_id → cfb.games, pick_type CHECK IN ('ats','underdog'),
│                    selected_team text NOT NULL, is_double_down boolean DEFAULT false,
│                    locked_spread numeric NOT NULL,   -- frozen at submit time, for grading
│                    auto_filled boolean DEFAULT false, status text DEFAULT 'confirmed',
│                    result text CHECK IN ('cover','push','miss','win','loss'),  -- NULL until graded
│                    base_points numeric, bonus_points numeric, created_at timestamptz,
│                    UNIQUE (pool_id, user_id, week_id, game_id),
│                    FOREIGN KEY (game_id, week_id) REFERENCES cfb.games (id, week_id)
│                    -- structurally guarantees a pick's game belongs to its week, not just RPC-checked
```

**Grants** — copy `20260624120000_multisport_phase1_scaffold.sql` line-for-line for `cfb`
(`GRANT USAGE ON SCHEMA cfb`, per-table privileges, `ALTER DEFAULT PRIVILEGES` for
`authenticated` + `service_role`). Skipping this = "permission denied" *before RLS runs* —
the migration doc's #1 cross-schema foot-gun.

**RLS — shipped as of PR2 (2026-08-11, PR #41), and it deviates from this doc's original
sketch on purpose.** `weeks`/`games`/`event_details` mirror golf's
`tiers`/`tier_players`/`event_details` (authenticated read-all, admin manages).
`cfb.picks`: read-own anytime; read-others'-confirmed-picks only after **that week's**
lock (`cfb.weeks.lock_time`/`status`, per-week not per-pool); admin read/update/delete;
`service_role` writes (auto-fill, grading). **There is deliberately NO client
insert/update/delete policy on `cfb.picks`** — this doc originally sketched row-level
write policies "for defense-in-depth," but senior review on PR2 concluded that would
REOPEN Finding 2's hole: a per-row policy can't express "these 6 rows together are a
legal card," so a row-policy client write could pass every per-row check while still
corrupting a card (6 ATS picks, two double-downs, etc.). The `cfb_submit_week_picks` RPC
is the *only* write path, not just the "real" one — see
`agents/pm/DECISIONS.md`, 2026-08-11.

---

## Data layer — CFD proxy, slate import (superseded), automated poller, grading

**Slate import is now automated (PR #47, 2026-08-13) — the manual `importWeekSlate()` flow
described below (PR3) is superseded, not deleted from history.** See the "Automated slate +
spread poller" subsection further down for what actually runs today.

**Shipped as of PR3 (2026-08-12)** — `supabase/functions/cfd-proxy/index.ts`,
`src/lib/cfbd.js`, `src/lib/cfb.js`, and migration
`20260812000000_cfb_phase3_slate_import_support.sql`. Details below reflect what actually
landed; see `agents/senior-dev/reviews/cfb-pr3-slate-import.md` (APPROVE WITH QUESTIONS)
and `agents/pm/DECISIONS.md`, 2026-08-12, for the two founder calls it prompted.
**`cfd-proxy` stays deployed but is no longer called from the browser as of PR #47** — the
automated poller talks to CFBD directly with its own service-role key. `importWeekSlate()`
and the transform it called (`buildGameRows`/`chooseLine`/`favoriteFromFormattedSpread`)
were removed from `src/lib/cfb.js` and moved server-side; the sign cross-check and week
guard described below both live on in the new poller/transform, unchanged in spirit.

- **`supabase/functions/cfd-proxy/index.ts`** — mirrors `slash-golf-proxy`: admin-JWT gated
  (checks `profiles.role = 'admin'`, not a cron secret — there's no scheduled caller yet),
  `CFBD_API_KEY` as a Supabase secret (never browser-exposed, set and deployed), usage guard
  against `public.api_usage.cfbd_calls` (new column, mirrors `slash_golf_calls` exactly).
  Endpoint allowlist: `games`, `lines`, `teams/fbs` — no arbitrary path passthrough. **CFBD's
  free tier is confirmed at 1000 calls/month** (`MONTHLY_CAP = 1000`, not golf's `1800`
  placeholder — open question #4 below is resolved; see DECISIONS).
- **`src/lib/cfbd.js`** — thin browser client mirroring `slashGolf.js`: `getGames`,
  `getLines`, `getFbsTeams`.
- **Slate import** (`src/lib/cfb.js`, the only file that calls `supabase.schema('cfb')`) —
  `importWeekSlate({ weekId, seasonYear, weekNumber })` fetches a week's games + lines + the
  FBS team set through the proxy, and the pure, unit-testable `buildGameRows()` shapes them:
  filters to FBS-vs-FBS games with a posted line (no line → excluded, not just unscored),
  freezes `home_spread` signed from the home team's perspective, and derives
  `underdog_team`/`underdog_spread` (positive, non-NULL) from the sign — exactly the
  contract PR2's RPC trusts verbatim. Upserts on `cfbd_game_id` so a re-import as lines move
  just refreshes rows (already-submitted picks are unaffected — they carry a frozen
  `locked_spread`). The three proxy calls run sequentially on purpose (each increments the
  shared `api_usage.cfbd_calls` counter via read-then-write; parallel calls would
  under-count against the cap). **Two safety additions beyond the original sketch, both
  founder-decided in-branch (DECISIONS, 2026-08-12):**
  1. **Sign cross-check** — `chooseLine()` also returns CFBD's own `formattedSpread` text
     label (e.g. `"Michigan -17.5"`, which names the favorite in words);
     `favoriteFromFormattedSpread()` parses it, and `buildGameRows` compares it against the
     favorite implied by the numeric sign. On disagreement (a CFBD sign-convention drift),
     the game is **skipped and a warning logged** rather than silently freezing a wrong
     underdog — CFB has only one data provider, unlike golf's two-source corroboration, so
     this is a self-consistency check, not real corroboration.
  2. **Week guard** — before fetching anything, `importWeekSlate` reads the target
     `cfb.weeks` row's `week_number` (and season via `event_details`, split query) and
     throws if either disagrees with the `seasonYear`/`weekNumber` passed in — cheap
     insurance against a future admin-UI wiring slip importing one week's games under
     another week's id.
  - **Data contract this file honors** (flagged in PR2 senior review, confirmed correct in
    PR3 review): `cfb_submit_week_picks` (PR2) trusts `cfb.games` verbatim for the underdog
    slot — it freezes `locked_spread` as `g.underdog_spread` and validates the pick against
    `g.underdog_team` with no defensive check. `underdog_spread IS NULL OR > 0` is also now
    a DB `CHECK` on `cfb.games` (belt-and-suspenders on top of the importer's `abs()`).
  - **Known debt, deliberately deferred (senior review Findings 4–5, not blocking):**
    re-import doesn't prune games that drop out of the CFBD slate (stale rows can linger in
    the pickable list; grading of submitted picks is unaffected since `locked_spread` is
    frozen); `is_fbs_vs_fbs` is always written `true` (informational only, harmless).
  - Verified against real 2025 Week 1 data end-to-end (48 of 96 games eligible, sign mapping
    correct on every row) plus 25 pure-transform fixtures (not committed at the time; see below).

**Automated slate + spread poller — shipped 2026-08-13, PR #47 (`cfb-auto-lines-poller`).**
Replaces PR3's manual per-week admin import. Real 2025 data showed betting lines only post
~1-2 weeks before kickoff (Week 1 = 51 games with a line, Week 3 = 0), so a season's slate
can't be imported upfront the way golf imports a field once — an hourly poller keeps every
pool's slate current instead. See `agents/pm/DECISIONS.md`, 2026-08-13, for the full call.

- **`supabase/functions/_shared/cfbSlate.ts`** — the CFBD→`cfb.games` transform
  (`chooseLine`, `favoriteFromFormattedSpread`, `buildGameRows`), moved server-side from
  `src/lib/cfb.js` now that import is server-only. Pure, unit-tested for the first time as
  *committed* tests (`src/utils/cfbSlate.test.js`, vitest importing the `.ts` directly —
  the PR3 "25 fixtures" were never committed). The tests caught a real latent bug: a
  provider row with no spread field was read as a phantom pick'em `0`
  (`Number(null) === 0`) instead of "no line" — fixed. 173 tests pass repo-wide.
- **`supabase/functions/poll-cfb-lines/index.ts`** — the hourly poller (cron-secret-or
  admin-JWT gated, service role, 30k cap shared with `cfd-proxy`/`grade-cfb-week`/
  `poll-cfb-scores`). Per active season: ONE season-wide CFBD fetch set (`/games`+
  `/lines`+`/teams/fbs`), shaped by `buildGameRows`, then fanned onto **every pool's**
  `cfb.weeks` row for that `(season, week_number)` — all pools on a season see the same
  numbers, deduped the same way grading/live-scores already dedupe. Only writes games
  where `now < kickoff_at`; once a game kicks off its `home_spread` is left alone, so it
  freezes at the last pre-kickoff value (the closing line, the number shown forever
  after) and the poller can never clobber `poll-cfb-scores`, which owns status/scores/live
  once a game starts. Per-pick grading is unaffected — it always uses each player's own
  frozen `locked_spread` from submit time. Logs a `cfb.spread_history` snapshot only when
  a game's spread actually changed since the last poll. Senior review
  (`agents/senior-dev/reviews/cfb-auto-lines-poller.md`, APPROVE WITH QUESTIONS) caught one
  scale bug pre-merge: change-detection now reads one representative
  `cfb.event_details` row per season (all pools on a season share the same real
  games/spreads) rather than every pool's own game copies, which would have multiplied
  with pool count and risked truncating past PostgREST's row cap around ~20 pools.
- **Migration `20260813010000_cfb_spread_history.sql`** — `cfb.spread_history` (keyed by
  the real `cfbd_game_id` + `captured_at`, not a per-pool `cfb.games` row — all pools
  share the same real line), a line-movement log for a future "opened → closed" UI.
  Authenticated-read; service role (poller) + admin write. `getSpreadHistory()` in
  `src/lib/cfb.js` reads it (no UI consumer yet).
- **`CfbPoolOps.jsx`** — dropped the per-week "Import slate"/"Re-import slate" button;
  now shows an auto-slate status banner ("updates hourly / lines post ~1-2 wks out /
  spread freezes at kickoff") plus a single "Refresh slates now" override
  (`refreshCfbSlates()` in `src/lib/cfb.js`, invokes `poll-cfb-lines`). See
  `docs/PAGES.md` §10e.
- **Not yet done:** the `spread_history` migration isn't applied to prod, `poll-cfb-lines`
  isn't deployed, and no cron is armed — all deferred to PR9, same CFB prod-as-dev pattern
  as every prior CFB PR. PR9 now arms **three** CFB crons: hourly slate/lines
  (`poll-cfb-lines`), ~1-minute live scores (`poll-cfb-scores`), and weekly grading
  (`grade-cfb-week`).

- **Grading** (not just caching, unlike golf) — because standings are cumulative across
  weeks, a `grade-cfb-week` job runs after a week's games go final: fetch final scores,
  update `cfb.games`, grade every pick, write the shared `pool_standings` projection. Same
  "cron + admin manual-refresh" shape as golf's poller, with a grading step added.
  **Shipped 2026-08-12, PR #44 — see the Grading section below.**

---

## Scoring engine — `src/utils/cfbScoring.js`

**Shipped 2026-08-12, PR #43.** Pure module, no imports (same discipline as
`src/utils/scoring.js`): `doubleDownBuffer(spread)` → `max(|spread|*0.5, 4)` rounded to
nearest 0.5, quarter-ties up; `doubleDownWinBy(lockedSpread)` → the UI's margin-threshold
helper, documented as **sign-general** (not favorite-only) — see the double-down note below;
`gradeAtsPick(...)` → cover/push/miss + points (push = exact margin = 0);
`gradeDoubleDown(...)` → +1 if margin clears the buffer, else 0 (never negative);
`underdogTier(spread)` → 1|2|3 at the documented boundaries; `gradeUnderdogPick(...)` →
outright win/loss, tiered on win; `gradeWeekCard(...)`; `projectSeasonStandings(...)` → the
cumulative fold returning the shared `{ rank, total, display }` shape (with a pre-rendered
subtitle like `"142 pts · Week 9"` so the shared UI never needs CFB scoring knowledge).

**Unit tests (the repo's first — starts closing BACKLOG F4).** `vitest` + a `test`/`test:watch`
script landed in `package.json`; `cfbScoring.test.js` covers every boundary case from
`CFB_FORMAT.md` verbatim (buffer rounding at 8.5/9/10.5, DD exactly-on-buffer, underdog tier
edges 6.5/7/13.5/14, push, ties-share-rank, plus the underdog-DD boundary). Senior review
(`agents/senior-dev/reviews/cfb-pr4-scoring-engine.md`, APPROVE WITH QUESTIONS)
traced every rule against the code and confirmed the math is sound on every axis it flagged
as risky (float-safe buffer rounding, strict half-point thresholds, underdog tiers, standings
rank order).

**`effectiveDoubleDownLine(lockedSpread)` — shipped 2026-08-12, PR #44.** Returns the
buffer-adjusted line a double-down actually has to clear, in the picked team's own sign
convention (favorite `-1.5` → `-5.5`; `+7` underdog → `+3`). Pure arithmetic
(`lockedSpread - doubleDownBuffer(lockedSpread)`); no scoring rule changed. Added so PR6's
picks UI can state the real bar instead of leaving players to compute the buffer themselves.
A minimum-eligible-line rule was considered and declined — the buffer floor already prevents
a small-favorite double-down from being a free bonus (see `agents/pm/DECISIONS.md`,
2026-08-12).

**Client↔edge duplication — resolved 2026-08-12, PR #44.** Authoritative grading runs
server-side (service role) so users can't grade their own picks. Deno edge functions can't
import `src/` cleanly, so `supabase/functions/_shared/cfbScoring.ts` is a hand-kept TS mirror
of `cfbScoring.js`. The drift-guard directive from PR4 shipped with it: `src/utils/
cfbScoring.fixtures.js` holds the shared worked-example cases (buffer rounding boundaries, DD
thresholds, underdog tier edges, the underdog-DD case, `effectiveDoubleDownLine`), and both
`cfbScoring.test.js` (JS engine) and the new `cfbScoring.parity.test.js` (TS mirror) run
against them, asserting identical output — **152 tests pass**, the repo's first server/client
parity suite. A drift between the two languages now fails a test, not just a code-review
glance at a "keep these in sync" comment.

---

## Grading — `grade-cfb-week`

**Shipped 2026-08-12, PR #44.** `supabase/functions/grade-cfb-week/index.ts` is the
authoritative CFB grader — a service-role edge function gated cron-secret-or-admin-JWT, the
same shape as golf's `poll-leaderboard`. Two modes: grade one week (`{ week_id }`, for PR9's
future admin button) or scan every week whose `lock_time` has passed and isn't yet `graded`
(cron mode). CFBD's `/games` endpoint is deduped by the real `(season, week_number)` — one
fetch fanned out to every event's games sharing it, mirroring the golf poller's per-tournament
dedup (D3) — and counted against `public.api_usage.cfbd_calls` under the shared 1000/mo cap.
For each due week it writes final scores onto `cfb.games`, grades every pick with the shared
scoring engine, sets the week's status to `graded` (or leaves it `locked` if any game isn't
yet `completed`), and recomputes each affected pool's season-cumulative
`public.pool_standings` via `projectSeasonStandings` — **the first code in the repo that
writes `pool_standings`** (closes the CFB half of BACKLOG F1; golf's half, F1's other loose
end, is still open). Only `completed` games are graded, and re-running is idempotent.
`src/lib/cfb.js` adds `gradeCfbWeek(weekId)` as the thin client-side invoker for PR9's admin
"Grade week" button; grading itself never runs client-side. No migration — every table the
function touches already exists, and the service role bypasses RLS. No app screen consumes
`pool_standings` yet (CFB's leaderboard is PR7); no cron or admin UI calls this function yet
(PR9), so nothing live is affected by the two gaps below.

Senior review (`agents/senior-dev/reviews/cfb-pr5-grading.md`, APPROVE WITH QUESTIONS) traced
the sign conventions, the grader→engine wiring, the cap accounting, and the standings
recompute, and found the happy path correct with no blockers. It surfaced two founder
decisions, both resolved by deferring to **PR9** (`agents/pm/DECISIONS.md`, 2026-08-12):

- **Stuck-week finalization.** A week with a cancelled/postponed/rescheduled game never
  reports every game `completed`, so it can never reach `graded` — and scan mode re-fetches
  CFBD for it on every cron run, indefinitely, against the shared cap. **PR9 must-do:** an
  admin "finalize week as-is" override, plus treating a game the provider stops returning as
  a no-contest.
- **Manual grade-by-id lock guard.** The `{ week_id }` path doesn't check `lock_time` (only
  scan mode does), so a future admin "Grade week" button could grade a week still open for
  picks. **PR9 must-do:** add the one-line `lock_time` guard when that button is built (no
  caller exists today, so it was deferred rather than built speculatively).

Three lower-severity nits (a `.single()` vs `.maybeSingle()` on the first `api_usage` row of a
new month, a `throughWeek` subtitle that can look stale if weeks grade out of order, and
`pool_standings` rows not being pruned for a departed participant) were left as-is — see the
review for detail.

**Now shared:** `gradeWeek`/`recomputeStandings` were extracted verbatim out of this function into
`supabase/functions/_shared/cfbGrading.ts` when live scores shipped (below), so both graders run
one implementation. `grade-cfb-week` is behavior-identical — see the Live scores section.

---

## Live scores — `poll-cfb-scores` (data layer only)

**Shipped 2026-08-13, inserted between PR5 and PR6.** Founder-requested: a player should be able
to watch their pick's live score/clock/possession inside Poold. Enabled by a CFBD **Tier 2**
upgrade (30k calls/mo, unlocking the `/scoreboard` endpoint) — `MONTHLY_CAP` raised 1000→30000
across `cfd-proxy`, `grade-cfb-week`, and the new function (all three share
`public.api_usage.cfbd_calls`). This PR is data-layer only, no UI; see `agents/pm/DECISIONS.md`,
2026-08-13, for the four decisions behind it.

- **Migration `20260812120000_cfb_live_scores.sql`** — additive, nullable `cfb.games.live jsonb`:
  an ephemeral in-game blob (`period`/`clock`/`possession`/`situation`/`last_play`). The
  authoritative score/status stay in the existing typed columns (`home_score`/`away_score`/
  `status`), which the poller also mirrors live so the UI has one place to read "current score."
  No new grants/RLS — rides on `cfb.games`' existing table-level SELECT grant.
- **`supabase/functions/poll-cfb-scores/index.ts`** — the live poller (cron-secret-or-admin-JWT
  gated, service role). CFBD's `/scoreboard` returns the whole live FBS slate in ONE call, so a
  poll costs one API call regardless of games/pools/players. **Self-regulating:** it first runs a
  cheap DB-only gate ("any game in the live window right now?" — `kickoff_at` within
  `[now−6h, now+30min]`, not yet `final`) and returns with **zero API spend** when nothing's live,
  so a future ~1-minute cron (armed in PR9) costs only real game hours. When a game flips final it
  calls the shared `gradeWeek`/`recomputeStandings` so standings move live as games end;
  `grade-cfb-week` remains the manual/backfill grader.
- **`supabase/functions/_shared/cfbGrading.ts`** (new) — `gradeWeek` + `recomputeStandings`
  extracted from `grade-cfb-week`, now imported by both graders. `gradeWeek` gained one added
  branch: trust a game already `status='final'` in the DB when the live poller's partial
  `/scoreboard` map doesn't include it (a game that finalized on an earlier poll drops off later
  ones), so a multi-game week can't get un-finalized mid-slate. `grade-cfb-week`'s normal path is
  behavior-identical (senior-reviewed, confirmed verbatim except this branch).
- **`supabase/functions/_shared/cfbLive.ts`** (new) — pure `/scoreboard` → `cfb.games` transform,
  reads fields defensively and never throws on an unexpected shape. Unit-tested
  (`src/utils/cfbLive.test.js`, 7 tests — **159 tests pass repo-wide**). Exact CFBD live-field
  names are unconfirmed against a real Tier-2 response — verify when PR6/7's UI leans on them.
- **`src/lib/cfb.js`** adds `refreshCfbScores()` — a thin invoker for PR9's admin "Refresh scores"
  button; the poller itself never runs client-side.

Senior review (`agents/senior-dev/reviews/cfb-live-scores.md`, APPROVE WITH QUESTIONS) confirmed
the correctness holds end-to-end (mid-game scores never grade, already-final games can't
re-trigger grading, `grade-cfb-week` unaffected) and flagged one live decision: the poller's
initial 18h look-ahead risked burning idle API calls for most of a game day against the 30k cap.
**Tightened in-branch to 30 minutes** (`agents/pm/DECISIONS.md`, 2026-08-13) — a PM judgment call
that still needs founder confirmation. The broader question — a windowed cron schedule (golf's
Thu–Sun business-hours pattern) vs. year-round every-minute, and whether 30 min is the right
number — is an explicit **PR9 must-settle-before-arming-the-cron** item (added to PR9's row
below). No migration applied to prod, no function deployed, no cron armed — all deferred to PR9
per the CFB prod-as-dev pattern.

---

## Picks UI + theme

- **`src/pages/cfb/CfbPicks.jsx` + `src/components/picks/CfbWeekPicker.jsx`** — CFB's own pick
  UI (not a modification of golf's `TierPicker`). Weekly slate (pre-filtered to
  FBS-vs-FBS-with-a-line at import), pick 5 ATS on distinct games, flag one double-down, pick
  one underdog on a sixth distinct game. Client-side validation mirrors the RPC rules (live
  counters, disabled submit, collision warning) — UX only; the RPC is the real enforcement.
- **Reuses the shared shells** after the Finding-1 prop-ification (**shipped 2026-08-13,
  PR #48**): `PoolHeader`/`PicksHeader` take `gradient`/`accentColor`/`rib`/`children` props
  (golf's values as defaults), `StandingsCard` takes a `label` prop, `WidgetGrid` renders
  widgets passed as `children` in place of golf's hardcoded set. Build CFB's own
  `src/components/leaderboard/CfbWidgets.jsx` ("This Week's Slate," "Weekly Points" — not
  golf's "PGA Leaders") — not built yet, lands with the real pool-detail body (Phase 2).
- **Badge** — `SportBadge` is already sport-agnostic (renders whatever `badge_config` it's
  handed). CFB just needs its own `badge_config` values — a single static CFB badge for v1
  (not 130 team-specific arts; that's a scope trap).

---

## Design direction & the two sport pages

Both CFB sport pages are **functionally new**, not reskins of golf — size PR6/7 accordingly:
- **Picks page** — a full rebuild (no `TierPicker` reuse): a weekly slate builder with 5 ATS
  selections, a double-down flag, and a separate-game underdog, with live validity.
- **Pool detail / leaderboard** — reuses the shell + the scorecard-expand *pattern*, but adds a
  **week dimension golf never had** (week selector, cumulative-across-weeks scoring, all-new
  widgets), and the expand shows 6 typed picks with per-pick points, not tiers.

**Week vs season IA (decided):** the season-cumulative standings are the hero and stay ranked by
season total; the **week selector scopes the expand + widgets to a chosen week** — it does NOT
re-rank the standings to that week's points. A "Live — scores update as games go final" line sets
the in-progress expectation.

**Visual direction — "Varsity Navy," locked 2026-08-13 (PR #48):** navy `#101C3D→#0A1229`
header gradient + brick `#D6291B` accent + green `#2E8F4F` cover/win, over the existing
warm-cream neutrals; golf's scorecard-expand carried over with a brick bar in place of gold.
Reads collegiate-Saturday, distinct from fairway green, coherent with the Poold system.
Constants live in `src/theme/cfb.js` (`CFB_THEME`, `cfbBadge()`); applied so far only to the
two Phase-1 placeholder shells (real bodies land Phases 2–3). Two fixes carried into the
real build:
1. Use a neutral sample pool name in mocks — avoid "Warpath"-style Native American war imagery.
2. Double-down copy must reflect the **strict** rule: "cover by more than N · win by X+" — the
   buffer is a strictly-greater threshold, so an inclusive "N+" is wrong for spreads whose buffer
   lands on a half-point (e.g. an 8.5 line → 4.5 buffer, which a 13-point win lands exactly on).
   The buffer→threshold helper (`doubleDownWinBy`) shipped in PR4, unit-tested. **Founder decision
   (2026-08-12, see DECISIONS):** a double-down IS allowed on an underdog ATS pick (e.g. a +10
   pick clearing the buffer by covering) — the engine already scores this correctly.
   `doubleDownWinBy` therefore returns a **sign-general** margin threshold (negative for
   underdogs, e.g. a +10 pick with buffer 5 returns −4), not a literal "win by" number. PR6's
   picks UI must phrase the bonus condition generally ("cover by more than N") rather than
   favorite-only "win by X+", branching on the sign to render "win by X+" (favorite) vs. "keep it
   within N / cover by more than N" (underdog).

---

## Sport-dispatch wiring + CFB pool creation

- **`src/lib/pools.js`** (new, neutral) — sport-agnostic reads that only touch `public.*`:
  "which pools is this user in and what `sport_id` each," "look up a pool by join code + get
  its `sport_id`." Lets `Join.jsx`/`Dashboard.jsx` learn the sport before choosing a module,
  without importing both sport libs.
- **`Join.jsx`** branches on `sport_id` (golf copy + `/tournament/:id/picks`; cfb copy + a
  `/cfb/...` route). **`Dashboard.jsx`** rewritten against `lib/pools.js`, links each card to
  the right sport route (real surgery — its own PR; it currently computes golf scores inline).
- **`App.jsx`** gets CFB's own `/cfb/*` routes; **leave golf's `/tournament/*` untouched**
  (avoid churning live bookmarked URLs for zero gain; more consistent with siloing).
- **Admin CFB pool creation** (`src/pages/admin/cfb/CreateCfbPool.jsx`) — pick a season, set a
  recurring lock rule, create `public.events` (`sport_id:'cfb'`) → `public.pools` →
  `cfb.event_details` → seed `cfb.weeks`. Unlike golf, **not create-once-and-done**; weekly
  slate ops are a new recurring admin surface. **Shipped 2026-08-13, PR #46** — see PR 8a above.

**Config/grants foot-guns to check off explicitly:**
1. `supabase/config.toml` → add `cfb` to `[api] schemas` in **PR1** (so local dev works day one).
2. **Prod dashboard → Settings → API → Exposed Schemas must add `cfb` manually** — not in any
   migration; was the highest-likelihood cutover foot-gun. **Done, 2026-08-13** — the founder
   flipped the prod toggle (all schemas/tables/functions exposed) ahead of PR #46, so admin CFB
   writes now round-trip through the real Data API instead of only via `.schema('cfb')` bypassing
   exposure with elevated privileges.
3. Edge functions touching `cfb` must call `.schema('cfb')` (service role bypasses RLS, not
   schema-qualification).
4. `SECURITY DEFINER` functions need `SET search_path` pinned (like `is_admin()`).
5. Local/CI parity: `supabase db reset` + seed scripts must know about `cfb`.

---

## PR sequence

| # | PR | Goal | Key risk |
|---|---|---|---|
| 0 | `docs/CFB_FORMAT.md` | Rules + worked examples + schema sketch, reviewed before code | ambiguity found mid-build instead of now |
| 1 | `cfb` schema scaffold — **shipped 2026-08-11, PR #40** | Additive tables, grants, RLS-deny-all, seed `public.sports` row; add `cfb` to config.toml | grants forgotten → silent "permission denied" (mitigated; grant block mirrors golf's, confirmed in senior review) |
| 2 | RLS + `cfb_submit_week_picks` RPC — **shipped 2026-08-11, PR #41** | Row policies mirroring golf + the atomic whole-card submit (Finding 2) | RLS alone can't enforce the 6-pick set — resolved by giving the RPC the *only* write path on `cfb.picks` (no client insert/update/delete policy at all, not just a defense-in-depth layer) |
| 3 | `cfd-proxy` + slate import — **shipped 2026-08-12; manual import superseded 2026-08-13, PR #47** | Server-side CFBD access; `src/lib/cfb.js` import | lineless games excluded at import (done); underdog sign/team stored correctly (done, plus a CFBD-label cross-check the founder added — see DECISIONS) |
| 5d | Slate import automated (hourly `poll-cfb-lines` poller + `cfb.spread_history`, replaces PR3's manual import) — **shipped 2026-08-13, PR #47 (`cfb-auto-lines-poller`)** | Lines post ~1-2 wks out, so upfront season import doesn't work; hourly poll keeps every pool's slate current; spread freezes at kickoff | change-detection read could multiply with pool count past PostgREST's row cap — fixed pre-merge (one representative event per season, senior review); not yet deployed/armed, deferred to PR9 |
| 4 | `cfbScoring.js` + tests — **shipped 2026-08-12, PR #43** | Pure grading engine + the repo's first unit tests (F4), 44/44 passing | double-down rounding + underdog tier boundaries (verified sound in senior review; underdog-DD copy resolved — see DECISIONS) |
| 5 | `grade-cfb-week` → `pool_standings` — **shipped 2026-08-12, PR #44** | Weekly grading writes the shared projection (CFB half of F1); JS/TS drift guard via shared fixtures (152/152 tests) | mirror/source drift — resolved via shared fixtures, not a comment |
| 5b | *(optional)* wire `pool_standings` for golf | Closes F1's other half; not required to ship CFB | none blocking — keep it from gating CFB |
| 5c | CFB live in-game scores (data layer only) — **shipped 2026-08-13, inserted between PR5 and PR6** | `poll-cfb-scores` + `cfb.games.live`; CFBD Tier 2 (30k/mo) unlocks `/scoreboard`; shared `_shared/cfbGrading.ts` | poller's look-ahead window vs. cron cadence governs whether the season fits the 30k cap — tightened to 30min in-branch, full tuning + arming still a PR9 founder call |
| 8a | **CFB admin: pool creation + weekly slate-import ops — shipped 2026-08-13, PR #46 (the admin half of PR8/PR9, landed early, out of sequence).** `createCfbPool()` (event(cfb) → pool → `cfb.event_details` → seed `cfb.weeks` on a weekly lock cadence from a now-required first-week lock); `CfbAdmin`/`CreateCfbPool`/`CfbPoolOps` admin pages (`/admin/cfb`, `/admin/cfb/create-pool`, `/admin/cfb/pool/:id` — general admin register, no sport colorway); per-week lock edit + slate import + CFBD usage meter. Surfaced the founder requirement that forced the per-pool-events correction above (`agents/pm/DECISIONS.md`, 2026-08-13) — `cfb.games` re-keyed `UNIQUE(week_id, cfbd_game_id)`, migration `20260813000000_cfb_games_per_week_unique.sql`. | per-pool events means admin slate imports scale with (pools × weeks) — accepted trade-off, see DECISIONS; still no sport-dispatch (`Join`/`Dashboard` don't branch on `sport_id` yet), so a real pool exists but only an admin can reach it via a direct `/admin/cfb/pool/:id` link — not through the normal join flow |
| 6 | Weekly picks UI + shell theme-props — **Phase 1 (theme + shells + route scaffold) shipped 2026-08-13, PR #48**; Phase 3 (the real `CfbPicks`/`CfbWeekPicker` builder) still open | `CfbPicks`/`CfbWeekPicker`; prop-ify the shells (Finding 1) | shell changes must not visually change golf (defaults) — verified in senior review, PR #48 |
| 7 | CFB pool detail / leaderboard — **Phase 1 placeholder shipped 2026-08-13, PR #48** (`/cfb/pool/:id` renders the Varsity Navy header + a "coming soon" card); Phase 2 (real standings/widgets) still open | `CfbPoolDetail`, `CfbWidgets`; `WidgetGrid` → render-prop | first page reading `pool_standings` — validates Decision #3; also first UI reader of `cfb.games.live` |
| 8 | Sport-dispatch + remaining CFB pool-creation surgery | `lib/pools.js`; `Join`/`Dashboard` branch on sport; CFB routes for player-facing pages. **Admin pool creation itself already shipped as 8a above** — what's left here is making a created pool reachable through the normal join-code flow instead of only a direct admin link. | Dashboard surgery — golf must be byte-identical after |
| 9 | Remaining weekly admin ops + cron | Grade-week button (import is now automated per 5d; lock-edit already shipped in 8a). Then pg_cron (golf's pattern) — **arms THREE CFB crons**: hourly slate/lines (`poll-cfb-lines`), ~1-minute live scores (`poll-cfb-scores`), weekly grading (`grade-cfb-week`). **Must also close three deferred items** (`agents/pm/DECISIONS.md`, 2026-08-12 and 2026-08-13): two PR5 grader gaps (an admin "finalize week as-is" override for a stuck week, and a `lock_time` guard on the manual "Grade week" button), plus the live-scores cron-cadence tuning (confirm the 30-min look-ahead, decide windowed-vs-year-round schedule, deploy `poll-cfb-scores` + arm the cron). Also deploys `poll-cfb-lines` + applies the `spread_history` migration (5d). | a stuck week burns CFBD calls every cron run until the override ships; an unarmed live poller means no live scores until this PR; an unarmed slate poller means no NEW games/spreads land until this PR (existing slates from PR3-era manual imports still work) |
| 10 | Auto-fill on missed deadline | Random fill of missing slots, DD forfeiture, `auto_filled` flag | partial-card semantics (see CFB_FORMAT open questions) |
| — | **Prod cutover checklist** — **Exposed Schemas flip done 2026-08-13**, ahead of PR #46 | Flipped Exposed Schemas to include `cfb` (and all other schemas/tables/functions) in the Supabase dashboard | resolved — was silent 404s on every `cfb` query if forgotten |

---

## Open questions for the founder (feed into `docs/CFB_FORMAT.md`)

Ranked. Load-bearing ones must be answered before the PR that depends on them.

1. ~~**Double-down buffer rounding**~~ — **Resolved** (in `docs/CFB_FORMAT.md` ahead of PR4):
   round to the nearest 0.5, quarter-point ties up. `cfbScoring.js`'s `doubleDownBuffer` and its
   PR4 tests pin this exactly (`8.5→4.5`, `10.5→5.5`).
2. **Partial-submission auto-fill** — submit 3 of 6 then miss the deadline: top up only the
   missing 3 (keep real picks + DD), or wipe the whole card to random? Does a *partial* miss
   forfeit the DD?
3. **Mid-season joins** — single cutoff before week 1, or join mid-season (and if so, 0 for
   missed weeks)? Affects the standings query.
4. ~~**CFBD API tier/limits**~~ — **Resolved, PR3 (2026-08-12):** confirmed 1000 calls/month;
   `cfd-proxy`'s `MONTHLY_CAP` is sized to it. See DECISIONS.
5. **Route shape** — OK to give CFB its own `/cfb/*` namespace, golf's untouched? (Recommended.)
6. **Theme scope** — minimal prop-based fix now vs. the fuller "sport pack" theming system
   (BRAINSTORM MS-9/10). Plan defers the big version deliberately; confirm that's intended.
