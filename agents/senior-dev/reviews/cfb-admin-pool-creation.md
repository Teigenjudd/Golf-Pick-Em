# Senior review — cfb-admin-pool-creation

- **Reviewed:** 2026-08-13
- **Head:** eea2ea0
- **Verdict:** CHANGES NEEDED

## Summary
This PR builds the first CFB *frontend*: an admin can create a season pool
(`CreateCfbPool`), see all CFB pools (`CfbAdmin`), and run a season week-by-week
(`CfbPoolOps` — edit locks, import the CFBD slate, watch the API meter). The three pages
are clean, well-scoped, additive (only `App.jsx` routes + one `AdminDashboard` link touch
shared files — golf is untouched), and the React/state/effect patterns are correct. The
plumbing is faithful to the `lib/cfb.js` seam, the datetime round-trip is timezone-safe,
and the week-seeding math is correct across month/DST boundaries. Build passes, 159 tests
green.

The problem is one level up: `createCfbPool` mints a brand-new `public.events` row for
**every** pool, mirroring golf. But CFB's recorded architecture (PR1 decision + build
plan) is the opposite — **one season = one shared event, and many pools hang off it.**
That contradiction isn't cosmetic: because `cfb.games.cfbd_game_id` is globally unique and
`importWeekSlate` upserts on it, the moment a *second* CFB pool imports an overlapping
week, it silently reassigns the first pool's game rows to itself — the first pool's slate
vanishes (or the import errors once picks exist). A single test pool works fine today, so
this doesn't block "make one operable pool," but it's a design-contract violation with a
data-corruption failure mode that must be decided before a second pool is created or player
screens are built on top of it.

## Findings

### 1. [Blocker / decision] `createCfbPool` mints a per-pool event; CFB is specced as one shared event per season
`src/lib/cfb.js` `createCfbPool` (lines ~77-137). It unconditionally
`INSERT`s a new `public.events` row (+ `cfb.event_details` + a fresh set of `cfb.weeks`)
on every call, with no "does this season already have an event?" lookup. The commit
message even says this is intentional ("mirroring createGolfPool").

That directly contradicts the recorded design:
- `agents/pm/DECISIONS.md:409-412` (PR1): *"A CFB event is one season shared by every pool
  on it (unlike golf, which mints a fresh event per pool), so … a second pool created
  against the same season could otherwise double-insert Week 5."*
- `docs/CFB_BUILD_PLAN.md:84-88` / the schema sketch: *"CFB's event_id = one season, with
  weeks/games hanging off it and shared by every pool on that season (reuses the D3
  multiple-pools-per-event hinge)."*

Concrete failure (multi-pool):
- Pool A (event A, week A1 = Week 1 2025) imports → ~48 `cfb.games` rows with
  `week_id = A1`, `cfbd_game_id = g1…g48`.
- Pool B (event B, week B1 = Week 1 2025) imports → `importWeekSlate` upserts
  `onConflict: 'cfbd_game_id'`. g1…g48 already exist, so the upsert **updates** them,
  setting `week_id = B1`. Pool A's week now has **zero** games; A's slate is silently
  gone. If A already has picks, the composite FK `cfb.picks (game_id, week_id)` blocks the
  `week_id` change and B's import errors instead — either way, broken.
- The `UNIQUE (event_id, week_number)` guard added in PR1 specifically to catch "a second
  pool on the same season" never even fires, because each pool now has a *different*
  `event_id`.
- Secondary cost: each pool re-imports the whole season's slate against its own event,
  multiplying CFBD API calls per-pool instead of per-season — the same trap documented for
  golf's per-pool-per-event polling, but here it also corrupts.

Fix direction — two honest options, and this is a founder decision:
- **(a) Honor the spec:** `createCfbPool` should find-or-create *one* event per
  `(sport='cfb', season_year)` — reuse the existing season event (and its weeks) if it
  exists, and only ever insert a new `public.pools` row pointing at it. Slate import then
  happens once per season and every pool sees it. This is the smaller change and matches
  every downstream assumption already in the DB.
- **(b) Formally reverse the PR1 decision** (CFB mints per-pool like golf). Then the
  games model must change too: `cfbd_game_id` global-unique + upsert-on-conflict has to
  become per-week (e.g. `UNIQUE (week_id, cfbd_game_id)` and upsert on that), or imports
  keep colliding. That's a migration on the `cfb.games` table.

Either way, the current code is unsafe for 2+ CFB pools. It's fine to ship a single test
pool first, but this needs a conscious call before anything is built on it.

### 2. [Debt / needs verification] Browser writes to `cfb.*` depend on more than the "Exposed Schemas" toggle
The create/ops flow writes to `cfb.event_details`, `cfb.weeks`, and `cfb.games` directly
from the browser via `.schema('cfb')`. The RLS side is fine — the `admin manage …`
policies are `FOR ALL USING (is_admin())`, and for a `FOR ALL` policy the INSERT
`WITH CHECK` defaults to the `USING` expression, so admin inserts/updates/deletes are
permitted; the SQL `GRANT`s to `authenticated` are in place from PR1. **But** reaching a
table through Supabase's Data API needs the *schema* exposed AND the individual tables
exposed AND the grants (three layers). The commit assumes flipping the schema toggle is
enough. If the `cfb` tables aren't also API-visible, every `createCfbPool` call will fail
at the first `cfb.*` write — the rollback then deletes the event, so it fails *cleanly*
(no corruption), but CFB simply won't work. Verify the full round-trip (create a pool,
confirm rows land in `cfb.event_details`/`cfb.weeks`) right after flipping exposure, not
just that the toggle is on.

### 3. [Nit / decision] A pool can be created with a blank Week-1 lock → no join cutoff and never-locking weeks
`CreateCfbPool` `canSubmit = name.trim() && seasonYear && weeksValid` — `firstLockTime` is
not required. If left blank, `pool.lock_time` and every seeded week's `lock_time` are
`null`. Per `cfb_submit_week_picks`, a null `lock_time` with status `scheduled` means the
week never locks and the season has no join cutoff, until an admin sets each lock by hand
on the ops page. It's recoverable, but easy to ship a "picks never lock" pool by accident.
Consider requiring the Week-1 lock at creation (or a visible warning when it's empty).

### 4. [Nit] CFBD cap `30000` is now a third hardcoded copy of the same magic number
`getCfbdUsage` returns `cap: 30000`, matching `MONTHLY_CAP` in `cfd-proxy/index.ts` — whose
comment already says "keep this value in sync with grade-cfb-week and poll-cfb-scores." Now
the frontend meter is a fourth place that drifts if Tier changes. Not wrong today; consider
sourcing the cap from one place (e.g. return it from the proxy or a shared const).

### 5. [Nit] `getCfbPoolWeeks` fetches every game row just to count them
It pulls all `cfb.games` for the pool's weeks into the browser and counts in JS. For a full
season (~15 weeks × ~50 games ≈ 750 rows) that's wasteful, and it risks the default
PostgREST 1000-row ceiling silently undercounting a large season. Fine for now; a grouped
`head:true` count per week would be leaner if this ever feels slow.

### 6. [Low] Rollback delete return value is unchecked
`createCfbPool`'s `catch` does `supabase.from('events').delete().eq('id', event.id)` and
ignores its error before re-throwing. If that delete itself fails (transient network), the
orphan event+pool persist. This mirrors `createGolfPool` exactly, so it's pre-existing
pattern debt, not new — noting for completeness, not asking for a fix here.

## Questions for the founder

1. **CFB pools sharing a season (the big one).** Your own build notes say a CFB "event" is
   one season that *many* pools share — like one shared scoreboard everyone's pool reads
   from. But the create function you're merging makes a brand-new season (new event, new
   weeks, new slate) every time someone makes a pool — the golf way, which the docs
   explicitly say CFB should *not* do. With the way the games table is keyed, the second
   pool that imports the same week will quietly steal the first pool's games. One test pool
   is safe today. Before a second pool exists, which world do you want: **(a)** the second
   pool *joins* the same season and shares its slate (matches the spec, smaller code
   change), or **(b)** CFB really is per-pool like golf — in which case we also owe a small
   database change to the games table so imports stop colliding? This is a real fork worth
   deciding now, not after player screens are built on it.

2. **Turning `cfb` on.** Making these admin screens actually write to the database needs
   more than the one "Exposed Schemas" switch — Supabase needs the schema *and* each `cfb`
   table marked visible to the API (the grants are already done). Can you confirm, by
   actually creating one pool and checking the rows appear, that the whole switch-on is
   complete? If it's half-done, pool creation will fail (cleanly — nothing corrupts — but
   nothing works either).

3. **Blank lock time.** Right now an admin can create a CFB pool without setting the Week-1
   lock, which produces a season with no join cutoff and weeks that never lock until fixed
   by hand. Do you want the form to require a lock at creation, or is "set it later on the
   ops page" the intended workflow?
