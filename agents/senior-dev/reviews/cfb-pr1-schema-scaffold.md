# Senior review — cfb-pr1-schema-scaffold

- **Reviewed:** 2026-08-11
- **Head:** 5e30a14 (`git rev-parse --short HEAD`)
- **Verdict:** APPROVE WITH QUESTIONS

## Summary
PR1 is the additive `cfb` schema scaffold: a new migration
(`20260811000000_cfb_phase1_scaffold.sql`) that creates the `cfb` schema with four empty
tables (`event_details`, `weeks`, `games`, `picks`), seeds the `public.sports` row for CFB,
grants API roles, and turns on RLS deny-all; plus a one-line `config.toml` change adding
`cfb` to the exposed schemas. It touches nothing golf reads and is fully reversible by
dropping the new objects. Judged against PR1's stated scope (deny-all scaffold; policies,
RPC, import, scoring, UI all explicitly deferred), the migration is **correct and safe**.
The grant block, RLS coverage, index coverage, and FK directions all check out and mirror
the golf template line-for-line. My questions are all about *foundation shape* — a couple
of integrity constraints that are cheap to add now on an empty table and genuinely annoying
to add once weeks/games/picks data exists. None block merge; they're worth a decision first.

## Findings

### 1. No uniqueness guard on `cfb.weeks(event_id, week_number)` — debt (foundation)
`cfb.weeks` has no `UNIQUE (event_id, week_number)`. Weeks are event-level and — per the
build plan — a CFB event is *one season shared by every pool on it*, with ~15 weeks seeded
at season/pool creation. That's a different shape from golf: golf mints a fresh event per
pool and creates tiers once, so it never re-seeds a shared parent. For CFB, any retry of
season setup, or a second pool created against the same season/event, can double-insert
"Week 5", and then games/picks attach to an ambiguous duplicate. A unique constraint makes
the seed idempotent and makes "the Week 5 of this season" a single addressable row. It costs
one line now; after data exists you'd have to dedupe live rows to add it.
Fix: add `UNIQUE (event_id, week_number)` to `cfb.weeks`.

### 2. A pick's `game_id` and `week_id` can disagree — debt (defer-by-design, but flag it)
`cfb.picks` carries both `week_id` and `game_id` as independent foreign keys. Nothing at the
schema level stops a row from pointing at week 5 while its `game_id` is a game that lives in
week 3. The plan's answer is the PR2 `cfb_submit_week_picks` RPC, which validates the whole
card — so this is *intended* to be enforced one layer up, and I'm not calling it a blocker.
But the schema can also make it structurally impossible for near-zero cost: add
`UNIQUE (id, week_id)` on `cfb.games` and make `picks` reference `(game_id, week_id)` as a
composite FK. That guarantees game∈week regardless of whether the RPC (or a future manual/
service-role write) ever has a bug. Worth a deliberate decision: rely on the RPC alone, or
belt-and-suspenders it in the schema while the tables are empty.

### 3. Enum columns are free text with no CHECK — nit (low debt)
`weeks.status`, `games.status`, `picks.status`, and `picks.result` list their allowed values
in a comment but have no `CHECK` constraint — yet `picks.pick_type` right below them *does*
(`CHECK (pick_type IN ('ats','underdog'))`). So the migration is internally inconsistent
about it. On a brand-new schema the cheap win is to `CHECK` the enums too, so a later typo in
server code (`'in-progress'` vs `'in_progress'`, `'complete'` vs `'final'`) fails loudly at
write time instead of silently poisoning grading/standings. Golf left these loose, so
matching golf is defensible — but this is greenfield, and the constraint is free now.

### 4. `event_details.season_year` is nullable — nit
`season_year` is the defining attribute of a CFB event, but it's nullable. Fine for an empty
scaffold, and you can tighten it to `NOT NULL` later as long as no null rows exist — but
since it's always known at creation, `NOT NULL` now is the honest shape and one fewer
null-guard in every downstream query.

### Confirmed clean (checked, no action)
- **FK directions:** every FK points within `cfb` or `cfb → public` (`event_details`/`weeks`
  → `public.events`; `games` → `cfb.weeks`; `picks` → `public.pools`/`cfb.weeks`/
  `public.profiles`/`cfb.games`). None point `cfb → golf`. Siloing rule held.
- **Grant block:** mirrors the golf template exactly — `USAGE` on schema, per-table CRUD to
  `authenticated`, `ALL` to `service_role`, and `ALTER DEFAULT PRIVILEGES` for both so PR2+
  tables inherit. The documented #1 foot-gun ("permission denied before RLS runs") is
  covered.
- **RLS:** enabled on all four tables; no policies = deny-all for `authenticated` while empty,
  exactly the intended safe default. Service role bypasses as expected.
- **Indexes:** every FK that will be filtered/joined is indexed (`weeks.event_id`,
  `games.week_id`, all four `picks` FKs). Matches golf's discipline.
- **Migration naming/ordering:** `20260811000000…` sorts after the current latest
  (`20260716000000…`), so it applies last. Monotonic, no collision.
- **`config.toml`:** `cfb` added to `[api] schemas`; the prod-dashboard Exposed-Schemas flip
  is correctly deferred to the cutover checklist, not smuggled into a migration.
- **`sports` row:** `INSERT … ON CONFLICT DO NOTHING` is idempotent; `enabled` defaults to
  `true`, but nothing in `src` reads `sports.enabled` today, so the CFB row is inert (no
  premature UI exposure). Worth remembering when the dashboard eventually enumerates sports.
- **`games.cfbd_game_id UNIQUE`** gives the later slate importer a clean idempotent upsert
  target. Good call.

## Questions for the founder
Plain-English, and all four are "shape the foundation before data lands" decisions, not bugs:

1. **Should a season be allowed to have two "Week 5" rows?** (Finding 1.) Right now the
   database won't stop it. Because a CFB season is *one* shared record that many pools point
   at, if we ever re-run setup or add a second pool on the same season, we could silently get
   duplicate weeks and later not know which one a game belongs to. Adding a one-line "week
   number must be unique within a season" rule now prevents that forever, and it's a pain to
   add after real weeks exist. Any reason *not* to add it? (I'd add it.)

2. **Do you want the database itself to guarantee a pick's game is actually in that pick's
   week, or is it fine to trust the submit function to check that?** (Finding 2.) A pick row
   stores both "which week" and "which game" separately. Today nothing forces them to agree —
   the plan is for the PR2 submit function to enforce it. We *can* also make it structurally
   impossible at the database level for almost no cost while the tables are empty. Trade:
   belt-and-suspenders integrity vs. keeping the schema minimal and trusting one code path.
   Which do you want?

3. **Should the status/result text fields be locked to their known values now?** (Finding 3.)
   Columns like a week's status (`scheduled/open/locked/graded`) or a pick's result
   (`cover/push/miss/win/loss`) currently accept *any* text — only one similar field
   (`pick_type`) is locked down. Locking the rest means a typo in future code errors out
   immediately instead of quietly writing a bad value that breaks scoring. Cheap now; want it?

4. **Should `season_year` be required?** (Finding 4.) It's optional in the current schema, but
   a CFB event without a season year doesn't really mean anything. Making it required now is
   the cleaner foundation. Fine to require it?
