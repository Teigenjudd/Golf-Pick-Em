# Senior review — feat/cfb-autofill

- **Reviewed:** 2026-08-14
- **Head:** e3d3a47
- **Verdict:** CHANGES NEEDED

## Summary
This branch adds CFB "auto-fill on missed deadline": when a week's pick deadline passes,
any pool participant who never submitted gets a random legal card so they stay in the
season scoring pool. It ships as two pure-SQL migrations — `cfb.autofill_week(week_id)`
(SECURITY DEFINER, builds one random 6-pick card per missing participant) and
`cfb.process_locked_weeks()` (flips past-deadline weeks to `locked` and calls autofill,
armed as an always-on 10-minute in-season cron) — plus a best-effort call from the grader,
a `lib/cfb.js` invoker, and an admin "Auto-fill missing cards" button. The overall shape is
right and matches the golf/CFB patterns well: pure-DB so it spends no CFBD budget, idempotent
by `NOT EXISTS`, guarded to admins/service_role, and it correctly mirrors the submit RPC's
`locked_spread` freezing. But the random-card builder can construct an **illegal card that
violates a NOT NULL column** on a completely ordinary game type, and both automated call
paths swallow that failure silently — so the exact users this feature exists to protect can
be left out of scoring with no error surfaced. That's a blocker. There's also a genuine (if
narrow) concurrency race that can produce a corrupt 12-pick card, and the auth guard is
correct only by accident of NULL-logic. Details below.

## Findings

### 1. BLOCKER — a pick'em game (spread 0) in the underdog slot makes auto-fill fail, silently
`supabase/migrations/20260814010000_cfb_autofill_week.sql` (the INSERT ... SELECT, `rn = 6`
branch).

The builder takes 6 random games and forces the 6th into the underdog slot:
`selected_team := c.underdog_team`, `locked_spread := c.underdog_spread`. But **`cfb.games.underdog_team`
and `underdog_spread` are nullable**, and the slate importer deliberately sets both to NULL
for a **pick'em game** (spread exactly 0 — `_shared/cfbSlate.ts`: "A pick'em (spread 0) has no
underdog → both NULL"). A pick'em is still a fully pickable, in-slate game (it has a posted
line). Meanwhile `cfb.picks.selected_team` and `locked_spread` are both `NOT NULL`.

So the moment `row_number() OVER (ORDER BY random())` lands a pick'em game in slot 6 for **any**
user, that user's 6-row INSERT throws a NOT NULL violation. Because `random()` is re-rolled per
user, whether a call fails is **nondeterministic** and scales with participant count — one
pick'em game on the slate is near-certain to hit slot 6 for someone in a populated pool.

Failure behavior by path:
- **Admin button** — the whole `autofill_week` transaction rolls back (all users), admin sees a
  raw Postgres NOT NULL error; retrying may or may not repeat depending on the random draw.
- **Grader backstop** (`grade-cfb-week/index.ts`) — wrapped in `try/catch (_) {}`, so grading
  proceeds but **nobody** in that week got filled; no log, no signal.
- **Cron** (`process_locked_weeks`, `EXCEPTION WHEN OTHERS THEN NULL`) — swallowed, retried every
  10 minutes, failing forever, silently.

Net: on a week containing a single pick'em game, the missed-deadline players this feature is
built to protect silently get **no card at all** and drop out of the season scoring pool — the
precise outcome the feature is meant to prevent. Note the submit RPC already refuses this exact
case (`pick_type = 'underdog' AND underdog_team IS NULL` → bad-team error); auto-fill skipped
that guard.

**Fix direction:** choose the underdog slot only from games where `underdog_team IS NOT NULL`,
and fill the 5 ATS slots from the remaining games; add a precheck that the week has ≥1
underdog-eligible game and ≥5 other games (not just ≥6 total). The end-to-end verification
passed only because the test slate happened to have no pick'em.

### 2. BLOCKER (pairs with #1) — `EXCEPTION WHEN OTHERS THEN NULL` hides every real failure
`supabase/migrations/20260814020000_cfb_lock_autofill_cron.sql` (per-week loop) and the
`try/catch (_) {}` in `grade-cfb-week/index.ts`.

The per-week sub-block is the right *structure* (one bad week shouldn't stall the others), but
catching `OTHERS` and discarding to `NULL` with no log means the cron can fail to fill a week
every 10 minutes indefinitely and still return a success count for the other weeks. There is no
way to notice from the outside. This is what turns finding #1 from "an admin sees an error and
pings you" into "players silently vanish from scoring." At minimum, replace the bare `NULL` with
`RAISE WARNING 'autofill_week(%) failed: %', w.id, SQLERRM;` so it lands in the Postgres logs,
and have the grader's catch log too. Consider narrowing the catch so a data-shape bug (#1)
surfaces while a transient error is tolerated.

### 3. CORRECTNESS (medium, narrow window) — concurrent auto-fills can build a 12-pick card
`autofill_week` guards duplicates only with `NOT EXISTS (...)` plus the `UNIQUE(pool_id, user_id,
week_id, game_id)` constraint. But auto-fill now has **three** triggers that can fire on the same
week at once: the 10-minute cron, the grader backstop, and the admin button. Two concurrent calls
for the same missing user each independently pick 6 *random* games. Under READ COMMITTED neither
sees the other's uncommitted rows, so both pass `NOT EXISTS`. If their two random 6-game subsets
**overlap**, the unique constraint aborts one call (in the cron/grader that silently kills the
whole week's fill — see #2). If the subsets are **disjoint** (very possible on a 12+ game slate),
*both* commit and the user ends up with a 12-row card — 10 ATS + 2 underdog — which grades wrong.
There are no CHECK constraints enforcing "5 ATS + 1 underdog," so nothing else catches it. The
submit RPC avoids this because a user only submits for themselves, one call at a time; auto-fill
doesn't have that luxury. **Fix direction:** serialize per week — `SELECT ... FOR UPDATE` on the
`cfb.weeks` row (or `pg_advisory_xact_lock(hashtext(week_id::text))`) at the top of `autofill_week`
so concurrent calls queue instead of interleaving.

### 4. DEBT — the auth guard is correct only by accident of three-valued logic
`autofill_week`: `IF NOT public.is_admin() AND auth.role() <> 'service_role' THEN RAISE ...`.
`is_admin()` returns a real boolean (false when `auth.uid()` is null), but `auth.role()` is NULL
in the cron/superuser context. So for the cron path the guard evaluates to `NOT false AND (NULL <>
'service_role')` = `TRUE AND NULL` = NULL, the `IF` is not taken, and it proceeds. In other words
the guard **fails open on a NULL role**, and that fail-open is the *only* reason the cron is
allowed through. It happens to be safe today because the EXECUTE grant is limited to
`authenticated` + `service_role` (an authenticated non-admin has role `'authenticated'`, so the
`<>` is TRUE and they're correctly blocked) — the GRANT, not the guard, is doing the real work for
that role. This is fragile: anyone "cleaning up" the guard to `COALESCE(auth.role(),'') <>
'service_role'` would silently break the cron, and the intent (allow admin OR service_role OR
trusted DB job) isn't legible. **Fix direction:** write it as an explicit allow-list —
`IF public.is_admin() OR auth.role() = 'service_role' OR auth.role() IS NULL THEN ok ELSE raise`
— with a comment naming the NULL case as "runs from pg_cron / SECURITY DEFINER context."

### 5. NIT — the cron loop reprocesses all history every run, unbounded
`process_locked_weeks` loops **every** past-deadline, not-graded week across all seasons/events
every 10 minutes forever. Idempotent and cheap in isolation, but a single old ungraded week that
trips finding #1 will error on every cron tick indefinitely (and be swallowed by #2). Worth a
recency/`event` bound (e.g. only weeks locked within the last N days, or only weeks on non-draft
current-season pools) so the job's work is proportional to what's actually live.

### Non-issues verified
- **Late-submit race:** no real window — the submit RPC and auto-fill share `lock_time <= now()`
  as the gate, submit is rejected once locked, and auto-fill only fills users with no card. Fine.
- **ATS-slot NULLs:** the 5 ATS slots use `home_team`/`away_team` (NOT NULL) and
  `home_spread`/`-home_spread` (NOT NULL), so a pick'em in an ATS slot is harmless (locked_spread
  0). Only the underdog slot breaks.
- **`locked_spread` freezing / no double-down / auto_filled flag:** match the submit RPC and
  `docs/CFB_FORMAT.md`. Season window `8-12,1` covers Aug–Jan (incl. bowls/playoff). Good.

## Questions for the founder

1. **The pick'em hole (finding #1).** A "pick'em" is a game the bookmakers rate as a coin-flip —
   spread exactly 0, so there is no underdog. Your slate importer stores those games with an empty
   underdog, but the auto-fill always jams a random game into the mandatory "underdog" slot. When
   that random game is a pick'em, the database rejects the whole card and — in the automatic cron
   and the grader — it's rejected *silently*, so those players just quietly fall out of the
   scoring pool. Your end-to-end test passed only because the test slate had no pick'em game. Do
   you want to fix the builder to only put underdog-eligible games in the underdog slot before this
   merges? (I'd treat this as a must-fix, not a maybe.)

2. **Silent failures (findings #1 + #2).** The whole point of this feature is "no player gets left
   out." Right now, when a fill fails, both automatic paths throw the error away with no log entry
   at all — so the one failure mode that defeats the feature is also the one you'd never see. Are
   you OK adding a log line on failure (a one-line change) so a broken week shows up in the
   database logs instead of vanishing? Without it you have no way to know it happened.

3. **Two fillers at once (finding #3).** Three different things can now trigger auto-fill for the
   same week at the same moment — the every-10-minutes cron, the grader, and your admin button.
   Because each one picks 6 *random* games independently, if two run together they can hand one
   player a 12-pick card that scores wrong, and nothing in the database stops it. I'd add a
   one-line "take a lock on this week first" so the callers queue instead of colliding. Do you
   want that in before merge, or are you comfortable relying on never clicking Grade while the cron
   is mid-run? (I'd add the lock — it's cheap insurance.)

4. **The all-history cron (finding #5).** The auto-fill job walks *every* un-graded past week
   forever, every 10 minutes. It's cheap today, but a single old broken week will retry (and
   silently fail) on every tick for the rest of the season. Do you want to scope it to recent /
   current-season weeks so the job only touches what's actually live?
