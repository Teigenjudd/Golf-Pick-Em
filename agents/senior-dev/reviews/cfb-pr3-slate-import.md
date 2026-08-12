# Senior review — cfb-pr3-slate-import

- **Reviewed:** 2026-08-12
- **Head:** e388eed
- **Verdict:** APPROVE WITH QUESTIONS

## Summary
PR3 adds the CollegeFootballData (CFBD) read path for CFB: a `cfd-proxy` edge function
(admin-JWT gated, endpoint allowlist, 1000/mo cap) cloned faithfully from
`slash-golf-proxy`; a thin browser client `src/lib/cfbd.js` mirroring `slashGolf.js`; the
`cfb` seam `src/lib/cfb.js` with a pure `buildGameRows()` transform + `importWeekSlate()`
upsert; and an additive migration adding `api_usage.cfbd_calls` plus a
`underdog_spread IS NULL OR > 0` CHECK on `cfb.games`. The load-bearing contract holds:
`buildGameRows` sign mapping is correct in all three cases — `spread < 0` → away is the
dog, `spread > 0` → home is the dog, `spread === 0` (pick'em) → both underdog fields NULL
— and `underdogSpread = Math.abs(spread)` is always positive, which matches exactly the
perspective the PR2 RPC freezes into `locked_spread` and validates `selected_team` against.
Pick'em games are stored (valid for an ATS pick) but the RPC correctly refuses them as the
underdog slot (`underdog_team IS NULL` counts as bad-team). The proxy/client are consistent
with the golf templates. This is clean, well-scoped work. My questions are about the one
structural risk the design accepts — not any bug in this diff.

## Findings
Ranked most-severe first.

**1. (debt / design) The entire underdog contract rests on CFBD's spread-sign convention
with zero cross-check anywhere.** `src/lib/cfb.js` `buildGameRows` derives the underdog
purely from the sign of `home_spread`, and the PR2 RPC freezes/validates off that with no
defensive check (by design). Unlike golf — which joins two independent sources (Slash Golf
+ Odds API) and *refuses* an ambiguous match rather than guessing — CFB has a single source
of truth and no corroboration. If CFBD ever flips its sign convention (the code already
defends against them renaming fields camel↔snake across versions, so convention drift is a
real class of risk here), every underdog would be computed on the wrong team and frozen into
`locked_spread` **silently** — no error, no CHECK violation (abs() still yields positive),
just wrong grades. The current convention is confirmed by the live Wk1 smoke test, so this
is not a bug today. It's an accepted single-point-of-failure with a manual seasonal smoke
test as the only tripwire. See question 1.

**2. (nit / latent correctness) `startTimeTBD` does not belong in the `kickoff_at` field
chain.** `src/lib/cfb.js`, the `kickoff_at` line:
`field(g, 'startDate', 'start_date', 'startTimeTBD') || null`. `startTimeTBD` is a CFBD
*boolean* flag, not a date. `field()` returns the first non-null, so in the (unlikely) case
`startDate`/`start_date` are absent but `startTimeTBD` is present, this returns a boolean
into a `timestamptz` column — `true` survives the `|| null` and would fail the insert;
`false` collapses to null. `startDate` is effectively always present in CFBD `/games`, so
this is latent, but the flag has no business in a date fallback. Fix: drop `startTimeTBD`
from the chain.

**3. (debt) `importWeekSlate` trusts that `weekId` and `weekNumber` refer to the same week —
no assertion.** It takes `{ weekId, seasonYear, weekNumber }` separately: `weekNumber`
addresses the CFBD slate, `weekId` is stamped onto every row. Nothing checks that the
`cfb.weeks` row for `weekId` actually has `week_number = weekNumber`. A future admin-UI
wiring slip would silently import (say) Week 3's games under Week 2's id, with no DB error.
Cheap guard: look up the `weeks` row and assert `week_number` matches before writing.

**4. (debt) Re-import never reconciles stale rows.** `importWeekSlate` upserts on
`cfbd_game_id`; it only inserts/updates games currently in the slate. A game that was
imported and later drops out (line pulled → now excluded, or removed from the CFBD slate)
keeps its old row with a now-stale spread/underdog. Grading of already-submitted picks is
safe (frozen `locked_spread`), but the pickable slate can carry a game CFBD no longer lines.
Acceptable for PR3, but worth a deliberate "we don't prune" note or a later cleanup pass.

**5. (nit) `is_fbs_vs_fbs` is always written `true`.** `buildGameRows` filters to FBS-vs-FBS
before pushing, so every stored row has this column `true`. Harmless, but the column carries
no information as written. Fine to leave; flag only so it's a conscious choice.

Not re-flagged (as instructed): the `api_usage` read-then-write lost-update (BACKLOG B5).
PR3 clones the same per-call pattern for `cfbd_calls`; the three fetches in `importWeekSlate`
run sequentially on purpose, so this does **not** make B5 materially worse. The `cfd-proxy`
`Access-Control-Allow-Origin: '*'` matches golf's known-open state (BACKLOG A4), not new.

## Questions for the founder

**1. The underdog sign convention has one source and no safety net — is the seasonal smoke
test the guard you want, or do you want a cheap tripwire in code?**
Plain version: "who is the underdog and by how many points" is computed entirely from the
sign of one number CFBD gives you (`home_spread`), and nothing downstream double-checks it —
the pick-submit function freezes that number for grading and trusts it completely. Golf
avoids this by cross-checking two data providers and refusing anything ambiguous; CFB has
only CFBD. Today it's verified correct by your live Week-1 test. The trade: if CFBD ever
flips its sign convention (they've already changed field *names* between versions, so this
isn't paranoid), every underdog silently flips to the wrong team and grades wrong, with no
error to alert you. Do you want to accept "I'll re-run the smoke test each season" as the
control, or add a one-line sanity assertion at import time (e.g. flag if a heavy favorite by
record is being stored as the dog, or simply log the favorite/dog per game for a spot-check)?
This is a "how much do we trust the vendor" decision, not a bug.

**2. Should `importWeekSlate` refuse a week-id / week-number mismatch (finding 3)?**
Plain version: the importer is told both *which* week to pull from CFBD (a number) and
*which* stored week row to attach the games to (an id), as two separate arguments, and it
never checks they agree. If a later screen wires those up wrong, you'd import the wrong
week's games under a week with no visible error. Adding a one-line check ("does this week id
actually say it's week N?") is cheap insurance. Worth doing now, or fine to defer to when the
admin UI that calls this lands?
