# Senior review — feat/cfb-sport-dispatch

- **Reviewed:** 2026-08-13
- **Head:** 6670fe9
- **Verdict:** APPROVE WITH QUESTIONS

## Summary
This branch makes a CFB pool reachable through the normal Dashboard + Join flow (previously
golf-only). It adds a sport-neutral seam (`src/lib/pools.js`: `getPoolByCode` resolves a
join code → sport; `joinPool` writes the `pool_participants` membership row that CFB's
submit RPC requires up front), a `getMyCfbPools(userId)` feed, a `CfbPoolTile`, and
sport-branching in `Dashboard.jsx` and `Join.jsx`. I traced all four of the architect's
risk areas. The golf path is untouched in practice, the CFB join writes membership before
navigating (the exact failure this layer exists to prevent is handled correctly), and the
dashboard feed is well-batched with no N+1 and no golf leakage. No blockers. The open items
are two deliberate spec deviations and one latent fail-open that's currently guarded at the
form — all decisions to confirm, not bugs to fix.

## Findings

Ranked most-severe first.

**1. (debt / latent) The "joining closed" gate fails *open* if a CFB pool ever has a null
`lock_time`.** `Join.jsx:194` — `joinClosed = cfbPool.lock_time && new Date(cfbPool.lock_time) <= new Date()`.
If `lock_time` is null, `joinClosed` is falsy, so joining stays **open forever** rather than
closed. Today this is unreachable: `CreateCfbPool.jsx` gates submit on `firstLockTime`
(`canSubmit`), and `createCfbPool` copies it to `pools.lock_time`; there's no code path that
nulls a pool's lock_time afterward (`updateWeekLockTime` only edits *week* rows). So this is
a latent trap, not a live bug — the whole gate rests on a single client-side form check. Fix
direction (optional): treat a null cutoff as closed, or better, don't let the season-cutoff
be null server-side. Low priority given the form guard.

**2. (nit) `getPoolByCode` adds a `.neq('status','draft')` filter the old golf path didn't
have.** `pools.js:12`. The pre-branch golf flow called `getPoolViewByCode` directly, which
selects by `join_code` with **no** draft filter. Now every join first passes through
`getPoolByCode`, so a *draft* golf pool's join link would show "Invalid code" instead of the
invite card. In practice this is unreachable — `createGolfPool` always inserts status
`'open'` and nothing sets a golf pool to `'draft'` — so it's not a real regression, and
arguably the safer behavior. Flagging only because the ask was to confirm the golf path is
byte-for-byte prior behavior; this one filter is the single semantic difference (plus one
extra round-trip of latency, covered by the existing "Looking up tournament…" state).

**3. (nit) CFB tile has no "· Live" state — a locked-in-progress week looks identical to a
locked-between-games week.** `CfbPoolTile.jsx:39`. Builder-flagged and documented as
deferred. Note the asymmetry: the *golf* dashboard tile does show a pulsing "Live" dot while
a round is in progress (`Dashboard.jsx:170`), so golf and CFB tiles now differ on this. A
true live check needs per-game state at the tile level (more queries), so deferring is
reasonable — just confirm we're OK with the two sports looking different here for now.

**4. (nit) Invented CFB copy not yet in the brand/copy guide.** Eyebrow words
(`PRESEASON`/`NEEDS PICKS`/`CARD IN`/`LOCKED`/`GRADED`, and `JOIN OPEN` / `SEASON IN
PROGRESS` on the invite strip) are new strings. They read fine and on-voice; pm-sync may
want to fold the CFB set into the copy guidelines. Not a code issue.

Adjudication of the other builder flags: **route-to-picks** — see Question 1 (deliberate
deviation). **No consent line on the CFB invite card** — correct: this card only renders to
an already-authenticated user, and the consent line lives on the earlier unauthenticated
sign-in form (unchanged, `Join.jsx:147`), same as golf's authenticated card. **Cutoff is
`lock_time`-only, not also a status check like golf** — fine: no CFB pool-status ever closes
joining (there's no CFB "close pool" op), so `lock_time` is the only real cutoff. **Batched
participant count** — good pattern, no concern.

### What checked out clean (the architect's worry list)
- **Golf regression (Dashboard):** with `cfbPools` empty (the golf-only user), every touched
  condition reduces to prior behavior — section label (`||` a falsy term), empty state
  (`&& cfbPools.length === 0`, which is `&& true`), closed toggle and admin section
  untouched. `getMyCfbPools` returns `[]` for a golf-only user and never throws (it only
  destructures `data`), so the golf-only dashboard is unchanged.
- **Golf regression (Join):** the golf branch calls the same `getPoolViewByCode` and renders
  the same card via the same `/tournament/:id/picks` route with the same `isLocked` logic;
  the new CFB return block sits *before* `if (!tournament) return null`, and for golf
  `cfbPool` is null so control falls straight through to the untouched golf card.
- **CFB join works end-to-end:** `joinPool` is `await`ed before `navigate` in `handleCfbJoin`;
  on error, `joinError` is set and navigation does **not** run. The upsert is byte-identical
  to golf's proven implicit-membership write (`{pool_id,user_id}`, same `onConflict`,
  `ignoreDuplicates`), so membership is committed before the user reaches the picks
  page/RPC. No race, idempotent on re-join.
- **`getMyCfbPools` correctness:** ~7 batched queries total regardless of pool count (no
  N+1); golf pools are filtered out via `events.sport_id === 'cfb'`; picks are read
  `.eq('user_id', userId)` (own only); `card-in` triggers at `>= 6` picks, which equals the
  RPC-enforced exact-6, so it can't false-positive; current-week resolution (first
  not-locked, else last) is sound.
- **Join cutoff uses the right clock:** the gate reads the **pool's** `lock_time` (the season
  join cutoff), via `getCfbPool` selecting `pools.lock_time` — not a week's lock.

## Questions for the founder

**1. Where should a brand-new CFB joiner land — the picks builder or the pool overview?**
Your UI plan (`docs/CFB_UI_PLAN.md §5`) said the join CTA routes to `/cfb/pool/:id` (the pool
overview / standings). The builder instead routes to `/cfb/pool/:id/picks` (straight into the
weekly picks builder), which matches the CTA copy "Join & make picks →". Both are safe
(membership is written first either way). It's a product call: drop them into the *action*
(make picks now) or the *overview* (see the pool, then pick)? The picks-first choice is a
reasonable improvement over the plan — just confirm it's the one you want, since it diverges
from what you wrote.

**2. Are you comfortable that the "season already started, joining closed" gate is enforced
only in the browser?** It's driven entirely by the pool's cutoff time. Today the admin
create-pool form *forces* you to set that time, so a pool without one can't exist — but if
that ever changed, the join page would silently stay open forever instead of closing. Fine to
rely on the form, or do you want a server-side backstop so a missing cutoff fails *closed*?
(Low priority — no action needed to merge.)

**3. Ship the CFB dashboard tile without a "Live" indicator for now?** Golf tiles show a
pulsing "Live" dot while a round is in progress; the CFB tile just says "Locked" whether the
week's games are live or finished-and-waiting-to-grade. Adding a true live state costs extra
per-game queries, so the builder deferred it. OK for the two sports to look different here
until a later polish, or is the live hook worth pulling forward for CFB?
