# Senior review — cfb-admin-pool-creation

- **Reviewed:** 2026-08-13 (re-review; first pass same day)
- **Head:** 1e7de95
- **Verdict:** APPROVE

## Re-review summary (2026-08-13)

The one blocker from the first pass is **resolved**, correctly, via the founder's chosen
path (b): CFB keeps **per-pool events** (like golf's D3 hinge) on purpose, and the
`cfb.games` table is re-keyed so that decision is safe. The reasoning behind (b) holds up
against the actual code — grading and the live poller never depended on a game's
`cfbd_game_id` being globally unique, so letting the same real CFBD game exist once per
pool's week does not break anything downstream. Migration `20260813000000` is correct,
idempotent, and safe on the empty prod table. `npm test` green (159), build passes, lint
clean. Shipping this is fine.

The original PR1 "one shared event per season" note is now formally superseded — that
contradiction (my first-pass blocker) is closed by a real decision + migration, not
papered over. Docs still say the old thing in a couple of places; that's pm-sync's job,
not a merge blocker.

### 1. Blocker — RESOLVED. The re-key is correct and downstream is clean.

**Migration (`20260813000000_cfb_games_per_week_unique.sql`).** Verified:

- **Drop is reliable.** It resolves the column's `attnum`, then finds the unique
  constraint whose `conkey` is exactly `ARRAY[that_attnum]` (a single-column unique on
  `cfbd_game_id`). PR1 declared `cfbd_game_id text UNIQUE` inline, which Postgres
  materializes as a real `pg_constraint` row (contype `'u'`), so the lookup finds it. The
  exact-array match means it can **not** accidentally catch the two composite uniques on
  this table (`cfb_games_id_week (id, week_id)` — 2-element conkey; the new
  `(week_id, cfbd_game_id)` — 2-element conkey); neither equals the 1-element array. No FK
  references `cfbd_game_id` (the picks FK points at `(id, week_id)`), so the drop has no
  dependents and succeeds.
- **New key does the job.** `UNIQUE (week_id, cfbd_game_id)` makes the same real game
  repeatable across different pools' weeks but unique within one week — exactly what stops
  Pool B's import from stealing Pool A's rows. `importWeekSlate` upserts
  `onConflict: 'week_id,cfbd_game_id'` and every row it writes carries `week_id` (stamped
  in `.map(r => ({ ...r, week_id: weekId }))`), so the upsert resolves against the real
  constraint and a re-import of the *same* pool's week still refreshes-in-place as before.
- **Idempotent for repeated `db push`.** Second run: the single-column unique is already
  gone, so the drop lookup returns NULL and is skipped; the composite add is name-guarded
  (`cfb_games_week_cfbd_unique`) and skipped. `'cfb.games'::regclass` is schema-qualified,
  so it resolves regardless of `search_path`. Safe on the empty table (no dup risk).

**Downstream re-confirmed to not depend on global uniqueness:**

- **Grading (`_shared/cfbGrading.ts` `gradeWeek`).** Selects games with
  `.eq('week_id', week.id)` (scoped to one week), looks up the final score by
  `cfbd_game_id` *value* in a map, and writes back by `.eq('id', g.id)` — the primary key.
  It never assumes one global row per `cfbd_game_id`; it happily updates whichever
  per-week row it's iterating. Correct under the new key.
- **Live poller (`poll-cfb-scores/index.ts`).** Same shape: selects candidate games in the
  live window, indexes the `/scoreboard` payload by `cfbd_game_id` value, then updates each
  candidate by `.eq('id', g.id)`. Multiple pool rows sharing one `cfbd_game_id` each get
  the identical score fanned in — this is the intended "dedup by real (season, week), fan
  the payload across events" behavior, and it works precisely *because* the DB row is
  addressed by `id`, not by `cfbd_game_id`.
- **Composite FK intact.** `cfb_games_id_week UNIQUE (id, week_id)` and the picks
  `FOREIGN KEY (game_id, week_id) → cfb.games(id, week_id)` are untouched by the migration.
  Pick integrity (game-belongs-to-week) still holds.

### 2. Per-pool model delivers the requirement — confirmed.

`createCfbPool` seeds `cfb.weeks` for `wn = startWeek..endWeek` only, each with its own
`lock_time` stepped +7 days from the first-week lock (`7 * (wn - first)`, so the first
seeded week gets exactly `firstLockTime`). A pool with `startWeek=4` seeds weeks 4..end and
nothing earlier, with its own lock schedule. Its week-4 slate import writes rows keyed
`(that pool's week-4 id, cfbd_game_id)`, which cannot collide with another pool's week-4
rows (different `week_id`). `importWeekSlate`'s week guard (asserts the stored
`week_number` and `season_year` match the CFBD week being pulled) is consistent with this —
it prevents storing one week's games under another week's id, orthogonal to the uniqueness
fix. The two guards compose cleanly.

### 3. Required Week-1 lock — good call, correctly wired.

`canSubmit` now includes `firstLockTime`, the error copy lists it, and the label reads
"required". This closes the first-pass nit #3 (no more "picks never lock" pool by
accident). The pool's `lock_time` (= season join cutoff) and every seeded week's lock are
now always populated at creation.

### 4. Previously-clean parts unaffected — confirmed.

The rollback cascade (`events.delete()` → cascades to pool/details/weeks/games), the RLS
admin-write path (`FOR ALL USING (is_admin())` grants from PR1/PR2), and the three pages
(`CreateCfbPool`, `CfbAdmin`, `CfbPoolOps`) are untouched by the rework beyond the
`canSubmit` line. No golf code touched.

## Carried-forward items (intentionally deferred — not re-litigated)

- **#4 CFBD cap `30000` now in a 4th spot** — still a drift risk if Tier changes; acceptable
  to leave, as agreed.
- **#5 `getCfbPoolWeeks` counts by full fetch** — fine at season scale; acceptable.
- **#6 Rollback ignores its own delete error** — mirrors `createGolfPool`; pre-existing
  pattern debt, acceptable.
- **#2 `cfb` API exposure round-trip** — was "verify by creating a real pool after flipping
  the Exposed Schemas toggle." Still worth doing before relying on the screens, but it fails
  *cleanly* (rollback deletes the event) if exposure is half-done, so it's not a merge
  blocker. Not a code issue.

## New (low) observation

- **Low / cosmetic.** The lock field is labeled "Week 1 Lock" but for a pool that starts at,
  say, Week 4, it actually sets the **Week 4** lock (the first *seeded* week). Behavior is
  correct (it's the first-week lock = join cutoff); only the label is literal. Consider
  "First-week lock" if start weeks other than 1 will be common. Not blocking.

## Questions for the founder

None blocking. One worth a moment's thought, not a gate:

1. **Per-pool slate imports cost a little more CFBD budget.** With per-pool events, each pool
   imports its own copy of a week's games — so two pools on the 2025 season both spend a few
   admin API calls importing Week 6, instead of sharing one import. Live *scoring* is
   unaffected (still one `/scoreboard` call fanned out). At your expected pool counts this is
   comfortably inside the 1000/mo cap, and it's the price of the per-pool flexibility you
   chose. Just confirming you're happy that admin-side import calls scale with (pools ×
   weeks), not (seasons × weeks) — same shape as golf's per-pool polling, and fine unless CFB
   pools proliferate faster than expected.
