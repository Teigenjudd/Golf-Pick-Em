# Senior review — cfb-pr2-rls-and-submit-rpc

- **Reviewed:** 2026-08-11
- **Head:** ea2bf78 (`git rev-parse --short HEAD`)
- **Verdict:** APPROVE WITH QUESTIONS

## Summary
One migration: RLS policies for the four `cfb` tables plus the `cfb.cfb_submit_week_picks`
SECURITY DEFINER RPC that is the only write path for a weekly card. I traced the whole-card
validation against every bad payload in the brief and the security properties one by one.
**It is correct.** Every malformed card is rejected in the right order, the write uses
`auth.uid()` (no user spoofing), pool membership and week-belongs-to-pool are genuinely
enforced, `search_path` is pinned, direct client writes to `cfb.picks` are RLS-denied so the
RPC really is the only door, and `locked_spread` is frozen server-side with the correct sign
convention. The delete+insert is atomic (one function body = one txn), closing the golf B5 gap
on purpose. This is careful, security-conscious work that faithfully mirrors the golf
templates. My questions are confirmations of an implicit contract this RPC hands to PR3 and
two small robustness choices — none are blockers.

## Findings

### Bad-card trace (all correctly rejected)
Confirmed each payload from the brief is caught, in this order (`migration:210-236`):
malformed(missing field) → total≠6 → bad pick_type → not 5-ATS/1-dog → not-6-distinct-games →
game-not-in-week → >1 double-down → double-down-not-on-ATS → bad team / dog-slot-not-the-dog.
- 6 ATS + 0 underdog → "5 ATS and 1 underdog" ✓
- 2 double-downs → ">1 double-down" ✓
- double-down on the underdog → "double-down must be an ATS pick" ✓
- same game for an ATS pick and the underdog → "each pick on a different game" (5 distinct) ✓
- pick on a game from another week → LEFT JOIN yields `g_id IS NULL` → "must be a game in this week" ✓
- underdog slot pointing at the favorite → `selected_team <> underdog_team` → bad-team ✓
- 5 picks → total≠6 (message reports the count) ✓
- empty array → total 0 ≠ 6 ✓
- null / non-array → "Picks must be a list" (`line 162`) ✓
- ATS legally allowed on either side (`selected_team IN (home,away)`) and on the dog side ✓

### Security properties (all hold)
- `user_id` is `auth.uid()`, never from the payload; payload carries no user_id (`line 109, 252`).
- Membership checked against `public.pool_participants` (`131-136`); week must belong to the
  pool's event (`151-153`) — no cross-pool / cross-season write.
- `SET search_path = cfb, public` pinned (`line 106`); all table refs schema-qualified.
- No client insert/update/delete policy on `cfb.picks` + RLS on ⇒ a normal authenticated
  direct write is denied; only the SECURITY DEFINER RPC (runs as owner) can write. Verified the
  only INSERT-capable policy is `service manage picks` (`line 79`), gated to `service_role`.
- Read-after-lock privacy is correctly per-week (`61-70`) and symmetric with the write-lock
  check — a week reveals others' picks exactly when it stops accepting writes (both use
  `status IN ('locked','graded') OR lock_time <= now()`). Good.

### 1. Implicit PR3 contract on `underdog_team` / `underdog_spread` is undocumented — debt
`migration:262` freezes the dog slot's `locked_spread` as `g.underdog_spread` verbatim, and
validation (`201`) trusts `g.underdog_team` as the real underdog. PR2 has no data, so this is
correct *as written* — but it silently hands three assumptions to PR3's importer: (a)
`underdog_team` is the actual underdog, (b) `underdog_spread` is stored **positive** (the dog's
line, getting points), (c) it's non-NULL for any pickable game. If PR3 stores the favorite's
(negative) line or the wrong team, the RPC will faithfully freeze wrong values and mis-score,
with nothing here to catch it. The brief already flags the sign as a known forward dependency;
the ask is just to write the contract down where PR3 will see it (schema comment or the PR3
row of `CFB_BUILD_PLAN.md`) so it isn't rediscovered at import time.

### 2. RPC trusts the import for the dog slot rather than defending it — nit (design choice)
Cheap defensive option: reject an underdog pick when `underdog_spread IS NULL OR <= 0` (today a
NULL slips past validation and only dies at the `NOT NULL` insert with an ugly error; a
non-positive spread would freeze a wrong tier silently). Not required — eligibility guarantees a
posted line, and layering "denormalization correctness lives in the importer" is defensible —
but it's a one-line guard that turns a future data bug into a clean rejection. Founder's call.

### 3. Garbage (non-NULL) `game_id` / `is_double_down` throws a raw Postgres error — nit
The `v_malformed` count (`196`) gracefully catches *missing* fields, but a present-but-invalid
value — e.g. `game_id: "not-a-uuid"` or `is_double_down: "yes"` — errors at the `::uuid` /
`::boolean` cast inside the CTE (`172-175`) with a raw `22P02` before any friendly check runs.
Still a safe rejection (no bad write), just not the tidy `22023` message. The client mirrors
validation so real users won't hit it; matters only for a hand-crafted API call. Low priority.

### 4. Submit is allowed while a week is still `'scheduled'` — nit
The open-for-writes check (`156-157`) permits `'scheduled'` and `'open'` (rejects only
`'locked'`/`'graded'` or a passed `lock_time`). If a week is seeded `'scheduled'` with no games
imported yet, a card can't be built anyway (validation fails on "game in this week"), so this is
harmless and matches golf's permissive style. Flagging only so it's a conscious choice, not an
oversight — see Q3.

## Questions for the founder

1. **The dog-slot data contract (most important).** This RPC copies the game's stored
   "underdog" and its spread straight onto the pick as the frozen number used for scoring — it
   trusts that whoever fills the games table (PR3's import job) put the *actual* underdog there
   and stored its spread as a **positive** number. PR2 can't verify that (no data yet). Do you
   want that contract written into the schema/PR3 plan now (so import honors it), and/or a small
   guard added here that refuses a dog pick whose stored spread is missing or not positive? The
   trade: a one-line guard makes a future import bug fail loudly at submit instead of quietly
   mis-scoring weeks later — at the cost of the RPC "knowing" a rule the importer is meant to own.

2. **Malformed input politeness.** If a client sends an obviously broken value (a `game_id`
   that isn't a real ID), the player currently gets an ugly database error instead of a clean
   "that pick is invalid" message. It's always safely *rejected* — never written — so this is
   pure polish for a case your own app won't produce. Fine to leave as-is? (I'd leave it.)

3. **When does a week "open" for picks?** Right now a player can submit as soon as the week
   exists, even before you've flipped it to "open" — as long as its games are loaded and the
   lock time hasn't passed. In practice they can't build a card until the slate is imported, so
   this is harmless, but it means "open" is really governed by *the lock time and whether games
   exist*, not by the status label. Is that the behavior you want, or should submitting require
   the week to be explicitly set to `'open'`?
