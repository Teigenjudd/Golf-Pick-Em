# Senior review — feat/cfb-picks-builder

- **Reviewed:** 2026-08-13
- **Head:** ec65584
- **Verdict:** APPROVE WITH QUESTIONS

## Summary
PR-A of the CFB Weekly Picks builder replaces the `/cfb/pool/:id/picks` placeholder with a
real interactive card builder: pick 5 ATS + 1 optional double-down + 1 mandatory underdog
on 6 distinct games, live validity, submit via `cfb.cfb_submit_week_picks`. New pure helper
`src/utils/cfbCard.js` (+test), two presentational components (`CfbGameCard`,
`CfbCardTracker`), the page rewrite, and `submitCfbWeekPicks` in `lib/cfb.js`.

I traced the two things that would actually hurt — the line-sign math and the UI-validity ↔
RPC parity — against `cfbScoring.js`, `cfbFormat.js`, and the real RPC migration
(`20260811000001_...sql`). **Both are correct.** The client can't build a card the RPC
would reject as malformed, wrong-count, wrong-type, non-distinct, or wrong-team; the
double-down bonus copy is signed from the picked team's line and never renders a raw
negative. No blockers. The findings below are one confirmed spec miss (minor) and two
low-severity debt notes. The RPC remains the real gate throughout — the UI is a faithful,
strict-subset preview of it.

### Architect's 6 worries — how they checked out
1. **Line-sign math — CLEAN.** `homeLine = formatSpread(home_spread)`, `awayLine =
   formatSpread(-home_spread)`; the DD copy is fed `home_spread` when the picked team is
   home else `-home_spread`. All three match the RPC's server-side freeze convention
   (away's `locked_spread = -home_spread`). Chips and DD copy use the *picked team's*
   correctly-signed line.
2. **UI-validity vs RPC parity — CLEAN.** `cfbCardValidity` accepts a strict subset of what
   the RPC accepts (5 ATS + 1 dog, 6 distinct, DD only on an ATS game). Crucially
   `buildPicksPayload` sets the underdog row's `selected_team` to
   `gamesById[underdogGameId].underdog_team` verbatim — the exact value the RPC's
   `v_badteam` check demands — so the underdog pick can't dead-end. Mutual exclusion
   (ATS↔dog) is enforced in both the handlers and the validity fn.
3. **`buildPicksPayload` shape — CLEAN.** Exactly 5 `ats` rows (`is_double_down` true only
   on the flagged game) + 1 `underdog` row (`is_double_down:false`), correct `selected_team`
   per row. Only called after `validity.valid`.
4. **Existing-card load — CLEAN.** Reads `getCfbWeekPicks`, filters to `user.id` (belt over
   RLS's own-picks-pre-lock), seeds `atsPicks`/`doubleDownGameId`/`underdogGameId`, sets
   `hasExistingCard`. Re-submit replaces via the RPC's atomic delete+insert. `active` flag
   guards the async race; switching weeks always re-seeds (no stale carryover).
5. **Double-down bonus copy — CLEAN.** `ddBonusCopy` reads `doubleDownWinBy`'s sign: `>0` →
   "Win by N+"; `n≤0` with zero cushion → "Win outright"; negative → "Cover — lose by ≤N or
   win". Verified against `doubleDownBuffer`/`doubleDownWinBy` for favorites (−8.5→"14+"),
   underdogs (+10→"lose by ≤4 or win"), and the n=0 boundary (+5/+4.5→"Win outright").
   Never renders a raw negative.
6. **Lock subtitle — SPEC MISS (see Finding 1).** Confirmed: built with `formatKick`
   (weekday + time), spec wants full date + TZ.

## Findings

**1. (nit / spec miss) Lock subtitle drops the date and timezone.**
`src/pages/cfb/CfbPicks.jsx` builds `subtitle = \`Locks ${formatKick(targetWeek.lock_time)}\``,
and `formatKick` (`src/utils/cfbFormat.js`) renders only `weekday, hour:minute` → e.g.
"Locks Sat 12:00 PM". `docs/CFB_UI_PLAN.md §7` line 288 specifies **"Locks Sat Sep 21,
12:00 PM ET"** — month/day and the ET label are both missing. Cost: a CFB season runs
Aug→Jan and every week's lock is "Sat"/"Sun", so "Locks Sat 12:00 PM" doesn't tell a player
*which* Saturday. Fix direction: a small date-carrying formatter (add `month:'short',
day:'numeric'` and a `timeZoneName`/hard-coded "ET") for this subtitle, rather than reusing
the compact kickoff formatter. Low severity — not wrong, just under-informative.

**2. (debt) `weekIsLocked` is now duplicated a third time.**
The same lock predicate lives in the RPC (`status IN ('locked','graded') OR lock_time <=
now()`), in `src/pages/cfb/CfbPoolDetail.jsx:24`, and now copied again into
`src/pages/cfb/CfbPicks.jsx`. The page comment even calls it "copied locally." If the lock
semantics ever change (e.g. a grace period, or a new status), that's three edits and the
client copies can silently drift from the server gate. Cost is small today. Fix direction:
lift the one client copy into `src/lib/cfb.js` (or `cfbFormat`/a small `cfbWeek` util) and
import it in both pages. Not blocking.

**3. (nit) Slate can move between load and submit; only a hard flip is surfaced.**
The hourly lines poller (`poll-cfb-lines`) can move a spread or flip a game's
`underdog_team` after the page loads but before the user submits. For a moved ATS line the
RPC silently freezes the *current* (correct) line — the user just gets a slightly different
number than the chip showed. For a flipped `underdog_team` the RPC rejects with
"…the underdog pick must be the underdog," which the page surfaces inline (good). This is
consistent with the accepted "spread freezes server-side" architecture, so it's not a bug —
flagged only so the founder can decide whether PR-A should also refetch/warn on a moved line
or leave it to the RPC message. See Question 2.

**4. (nit, informational) No re-edit path from the success screen.**
After a successful submit the page shows the "Card's in" notice with only a link back to the
pool; to edit again before lock the user must revisit the URL (which then pre-fills). Fine
for PR-A; noting so it's a conscious scope line, not an oversight.

## Questions for the founder

**1. The lock countdown says "Locks Sat 12:00 PM" — no date. Add the date back?**
Your spec asked for "Locks Sat Sep 21, 12:00 PM ET"; the build reused the compact kickoff
formatter, which prints only the weekday and time. Because every CFB week locks on a
Saturday/Sunday, "Locks Sat 12:00 PM" doesn't tell a player which weekend they're picking
for. It's a one-line formatting change to add the month/day (and an "ET" label). Do you want
the full date shown (matches spec, clearer), or is weekday-and-time deliberately enough for
the always-weekly cadence? (Recommend adding the date.)

**2. If a betting line moves after you open the page, what should the builder do?**
Plain version: the lines refresh in the background about once an hour, and the app freezes
the *real* line at the moment you hit submit — not the number that was on screen when you
started. So two things can happen: (a) a line nudges (say a team goes from −7 to −7.5) and
your pick still goes through, just frozen at the newer number; or (b) a game's designated
underdog actually flips to the other team, in which case the server refuses the card and
shows "…the underdog pick must be the underdog." Right now PR-A handles (b) by showing that
message and keeping you on the card. Is "server freezes the true line, and only a hard flip
gets a visible error" the behavior you want for launch, or do you want the page to actively
warn/refresh when a displayed line has moved? (This is the same freeze-at-submit trade
you already accepted elsewhere; PR-A just inherits it. No change needed unless you want the
extra warning.)
