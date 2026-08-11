# College Football Pick'em — Format Spec

> **Status:** Decided 2026-08-11. This is the rules-of-record for Poold's CFB format — the
> spec the schema, the `cfb_submit_week_picks` RPC, the scoring engine, and its unit tests are
> all built against. The *how-we-build-it* sequencing lives in `docs/CFB_BUILD_PLAN.md`.
> Precedent for a focused, implementation-adjacent spec doc: `docs/NAME_MATCHING.md`.

CFB is Poold's second sport. Its format is **weekly against-the-spread (ATS), season-cumulative** —
structurally different from golf (one lock, scored once). A CFB *pool* runs a whole season; each
*week* is its own pick window with its own slate, lock time, and grading. Points accumulate all
season.

---

## The weekly card — 6 picks

Every week, each player submits exactly **6 picks** as one complete card:

1. **5 ATS picks** — pick the team you think covers the spread, in 5 **distinct** games, from
   the full **P4 + G5 (all-FBS)** slate for that week. Not commissioner-curated. **1 point per
   cover.**
2. **1 double-down** *(optional)* — flag exactly **one** of your 5 ATS picks as the double-down.
   It earns a **+1 bonus** (on top of its cover point) if it covers **by more than the buffer**
   (see below). A double-down that doesn't clear the buffer, or doesn't cover, earns **no bonus
   and no penalty** — pure upside.
3. **1 underdog pick** *(mandatory)* — pick an **underdog** in a game **separate from your 5 ATS
   games** (a 6th distinct game). Scored **only on an outright win** (the underdog wins the game
   straight up — covering doesn't matter), with points **tiered by the size of the spread**.

### Eligibility
A game is **pickable** only if it is **FBS-vs-FBS with a posted CFBD line**. Games without a line
are excluded from the slate entirely (not shown, not just unscored) — the underdog pick needs a
line to determine its tier, so a lineless game can't be used for any slot.

### The spread is frozen at submit time
The line can move between when you pick and when the game kicks off. Grading uses the
**`locked_spread` stored on each pick at submission** — never the current line. Source of record
is the **CollegeFootballData API's own lines** (one vendor for schedule, scores, and lines).

---

## Scoring

Throughout, define for a picked team:

```
locked_spread   = the spread from the PICKED team's perspective, frozen at submit
                  (negative if your pick is favored / laying points;
                   positive if your pick is the underdog / getting points)
actual_margin   = picked_team_score − opponent_score   (negative if your pick lost)
cover_margin    = actual_margin + locked_spread          (how much they beat the spread by)
```

### ATS picks (each of the 5)
| cover_margin | Result | Points |
|---|---|---|
| `> 0` | cover | **+1** |
| `= 0` | push (landed exactly on the line) | 0 |
| `< 0` | miss | 0 |

### Double-down (the one flagged ATS pick)
Buffer (an extra cushion beyond just covering):

```
buffer = max( |spread| × 0.5 , 4 )   then rounded to the nearest 0.5
         (quarter-point ties round UP)
```

- The flagged pick still scores its normal ATS point as above.
- **+1 bonus** if `cover_margin > buffer` (strictly greater — landing exactly on the buffer earns
  no bonus, mirroring how landing exactly on the spread is a push).
- No bonus and **no penalty** otherwise.

Because of the 4-point floor, any spread of 8 or less has a buffer of exactly 4. The buffer only
rises above 4 for spreads of 8.5+. The only fractional cases CFBD's half-point lines can produce
are exact quarter-point ties, which round up (e.g. `8.5 → 4.25 → 4.5`, `10.5 → 5.25 → 5.5`).

### Underdog pick (the mandatory 6th, on a separate game)
Scored **only on an outright win** (`actual_margin > 0`). Covering is irrelevant. Points by the
underdog's spread size:

| Underdog spread `|spread|` | Points on outright win |
|---|---|
| +1.5 to +6.5 | **1** |
| +7 to +13.5 | **2** |
| +14 or more | **3** |

A losing underdog scores 0 (even if it would have covered).

### Weekly and season totals
- **Week total** = sum of the 5 ATS points + the double-down bonus (0 or 1) + the underdog points.
- **Season standings** = cumulative sum of all weekly totals across every graded week. **Not**
  win percentage. Auto-filled picks (below) count toward score exactly like real picks.

---

## Worked examples

**ATS cover** — you pick a 7-point favorite; they win by 10. `cover_margin = 10 + (−7) = 3 > 0` →
cover, **+1**.

**Push** — 7-point favorite wins by exactly 7. `cover_margin = 7 − 7 = 0` → push, **0**.

**ATS miss** — 7-point favorite wins by only 3. `cover_margin = 3 − 7 = −4 < 0` → miss, **0**.

**Underdog ATS cover** — you pick a +6.5 underdog; they lose by 3. `cover_margin = −3 + 6.5 = 3.5 > 0`
→ cover, **+1**. (Just a normal ATS pick — the underdog *slot* is separate from this.)

**Double-down clears** — DD on a 3-point favorite (`buffer = max(1.5, 4) = 4`); they win by 8.
`cover_margin = 8 − 3 = 5 > 4` → cover (+1) **plus** bonus (+1) = **2**.

**Double-down covers but doesn't clear** — same 3-point favorite wins by 6. `cover_margin = 3`;
covers (**+1**) but `3 > 4` is false → no bonus. Total **1**.

**Double-down exactly on the buffer** — same favorite wins by 7. `cover_margin = 4`; `4 > 4` is
false → cover **+1**, no bonus.

**Double-down misses** — favorite wins by 2. `cover_margin = −1` → miss, **0**, no penalty.

**Buffer rounding** — a 9-point spread → `9 × 0.5 = 4.5` → buffer **4.5**. An 8.5-point spread →
`4.25` → ties up → **4.5**. A 10.5-point spread → `5.25` → ties up → **5.5**.

**Underdog tiers** — a +3 underdog wins outright → tier 1 → **1**. A +9 underdog wins → tier 2 →
**2**. A +17 underdog wins → tier 3 → **3**. A +9 underdog *loses* (even by a point) → **0**.

---

## Submission, deadlines, and auto-fill

- **All-or-nothing submission.** A card is submitted only as a complete, valid 6-pick set (5 ATS on
  5 distinct games + 1 underdog on a separate game, ≤1 double-down flagged). There is no partial
  submission — the client won't allow it and the `cfb_submit_week_picks` RPC rejects anything
  incomplete. So "3 of 6" never exists.
- **Miss the deadline → full auto-fill.** If a player has no complete card locked when the week
  locks, all **6** slots are auto-filled with random eligible picks (5 ATS on distinct games + 1
  underdog on a separate game). The picks are flagged `auto_filled` and **score normally**.
- **Auto-fill forfeits the double-down** for that week — an auto-filled card carries no double-down,
  so no bonus is possible that week.

---

## Season / join model (v1)

- A CFB pool spans one season of weekly windows.
- **Single join cutoff: you must join before Week 1 locks. No mid-season entry in v1.** This keeps
  every player on the same denominator of weeks and the standings query trivial.
- *Deferred (not v1):* mid-season joining with zeros for missed weeks. A real later feature; the
  "0 vs excluded" bookkeeping isn't worth it for the first season.

---

## Data & schema

- **Provider:** CollegeFootballData API (collegefootballdata.com) — schedule, scores, teams, and
  lines. Free with an API key; proxied server-side through a new `cfd-proxy` edge function (key
  never reaches the browser). *Real free-tier call limits to be confirmed when the proxy is built
  (PR3) — not yet sized.*
- **Schema sketch:** see `docs/CFB_BUILD_PLAN.md` § "The `cfb` schema" for the `cfb.event_details /
  weeks / games / picks` tables, grants, RLS, and the `cfb_submit_week_picks` RPC. The load-bearing
  columns for grading are `cfb.picks.locked_spread` (frozen at submit) and the per-game final
  scores on `cfb.games`.

---

## Deferred / out of scope for v1

- Mid-season joins (above).
- The full CFB visual theme + badge family — handled separately with the design system; the build
  only needs the shells prop-ified (with golf's values as defaults) so CFB can pass its own theme
  in later.
- The shared FormatEngine abstraction (BACKLOG F6) — not extracted at two formats; revisit at
  format #3.
