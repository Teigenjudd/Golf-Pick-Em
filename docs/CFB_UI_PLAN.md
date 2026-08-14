# College Football (Sport #2) — UI Build Plan & Design Brief

> **Status:** Written 2026-08-12, after PR4 (scoring engine) merged. This is the
> **design-hand-off** doc: every CFB screen we'll load, every data element each one
> displays, and every state it can be in — structured so each screen section can be
> pasted into Claude Design as a self-contained brief while the backend PRs (PR5+)
> are built in parallel. The *rules* live in `docs/CFB_FORMAT.md`; the *build
> sequencing* in `docs/CFB_BUILD_PLAN.md`; the golf page inventory this mirrors in
> `docs/PAGES.md`. **Build status (updated 2026-08-13):** §2's shell prop-ification,
> §6/§6a (CFB Pool Detail + widgets), §7 (CFB Weekly Picks builder), and §4/§5
> (dashboard tile + join branch/sport-dispatch) are all now built — see `docs/PAGES.md`
> §10f/§10g and §6/§4/§5 for what actually shipped vs. this brief (two shipped
> deviations from §5's original spec: the join CTA routes straight to the picks page,
> not the pool overview; and the tile's "· Live" chip variant was deferred, so a
> locked-mid-game week and a locked-between-games week both just read "Locked"). §7's
> read-only locked/auto-filled/graded card view is now built too (PR-B, `docs/PAGES.md`
> §10g) — see that section for the shipped shape (a simpler live line than this brief's
> possession-dot/down-distance sketch; results + points are what shipped).

---

## 0. How to use this doc with Claude Design

- **Everything here is designable right now.** The data model and scoring outputs are
  final (PRs 1–4 shipped). No screen is blocked on backend work — design can run fully
  in parallel with PR5.
- Each **§ Screen** section is written as a standalone brief: purpose, data elements
  (with real column names), required elements, every state, and visual direction.
- **Two registers, same as golf** (see `CLAUDE.md` → Brand → Theme system):
  - *General* screens (Dashboard, Join, admin) stay **brand-level / sport-agnostic** —
    they get a small CFB *flavor* (badge + tile), not a full reskin.
  - *Sport-specific* screens (**CFB Picks** + **CFB Pool Detail**) get the full CFB
    theme. These two are where design effort concentrates.
- **Reuse, don't rebuild the chrome.** The pool page *shells* in `src/components/pool/`
  are shared with golf; CFB reuses them after a small prop-ification (see §2). Design
  the CFB screens as *fills* of those shells + new leaf components, not new page frames.

---

## 1. Theme

**The CFB sport-specific colorway is owned separately** (in progress with design) — this
doc **intentionally does not propose CFB theme colors**, so it can't compete with that
work. What it *does* pin down for the sport-specific screens is **structure and
behavior**, which the colorway then dresses:

- **Neutrals are shared with golf and do not change:** `cream` page background,
  `charcoal` body text/scores, `warm-100…600` for cards/borders/muted. Only the
  sport-specific *header/accent* colors come from the CFB colorway.
- **The scorecard-expand interaction carries over** — a colored left-bar running the
  full height of the expanded content, marker circles, tabular figures, a TOTAL row (the
  marker circles become the 6 pick slots). The bar/accent color is the colorway's.
- **Points are higher-is-better** (opposite of golf's low-score-wins) and never
  negative. Style them `font-display font-bold tabular-nums`; emphasize a leader / the
  accumulated total in the CFB accent, mute a zero / not-yet-graded week in `warm-400`.
- **Copy voice** (from `CLAUDE.md`): casual, confident, competitive — Saturday tailgate
  energy. Not a sportsbook. Spreads and "cover" language are fine (that's the game), but
  frame it as bragging-rights, not betting.

Wherever a section below says "the CFB accent" or "the CFB theme," it means *that
separate colorway* — not a color suggestion from this doc.

---

## 2. Shared shell changes required first (PR6, "Finding 1")

The `src/components/pool/` shells hardcode golf's look today. Before CFB can reuse them,
they need backward-compatible prop-ification (golf's current values become the
defaults, so **golf renders byte-identically**). Design should assume these props exist:

| Shell | New/used prop for CFB | CFB value |
|---|---|---|
| `PoolHeader` | `theme` (gradient) | CFB theme gradient (not fairway) |
| `PicksHeader` | `theme` (gradient) | CFB theme gradient |
| `StandingsCard` | `label` | "Season Standings" (golf default: "Pick'em Standings") |
| `WidgetGrid` | `children` / render-prop | CFB widgets instead of golf's |
| `PicksSubmitBar` | `label`, validity | "6 of 6 picks set" style, CFB validity rule |

The `SportBadge` is **already sport-agnostic** — it renders whatever `badge_config` it's
handed. CFB just needs one static config (see §9).

---

## 3. Route map (CFB gets its own `/cfb/*` namespace; golf untouched)

| Route | Screen | Access | Section |
|---|---|---|---|
| `/dashboard` | Dashboard (shared) — **CFB tile variant** | Protected | §4 |
| `/join/:code` | Join (shared) — **CFB branch** | Public | §5 |
| `/cfb/pool/:id` | CFB Pool Detail / Leaderboard | Protected | §6 |
| `/cfb/pool/:id/picks` | CFB Weekly Picks (resolves the open week) | Protected | §7 |
| `/admin/cfb/create-pool` | Create CFB Pool | Admin | §8 |
| `/admin/cfb/pool/:id` | CFB Weekly Ops console | Admin | §9b |
| *(deferred)* `/demo/cfb…` | CFB demo | Public | §10 |

The pool-detail **week selector** uses a query param (`?week=N`) — no separate route.

---

## 4. Screen — Dashboard, CFB pool tile `/dashboard`

**Register:** General. Shared page; CFB only changes the *tile*. Golf tiles unchanged.

**Data elements** (from `public.*` + `cfb.*`, via the neutral `lib/pools.js` + `lib/cfb.js`):
- `pools.name` — pool name
- `sports.key = 'cfb'` → which tile treatment + badge
- `cfb.event_details.season_year` — e.g. 2026
- **Current week context:** the open/next `cfb.weeks` row — `week_number`, `label`,
  `lock_time`, `status`
- **This user's card status for the current week:** does a complete `cfb.picks` set exist
  for `(pool_id, user_id, week_id)`? → "card in" vs "needs picks"
- **Season snapshot:** this user's `pool_standings.rank` + `pool_standings.total`
  (points), and pool size (`count(pool_participants)`)

**Must be on the tile:**
- CFB `SportBadge` (`md`, 40×46) in the CFB colorway
- Pool name (links to `/cfb/pool/:id`)
- Season line: `Season 2026 · N players`
- **Week status chip**, one of:
  - `Week 4 · Needs picks — locks Sat 12:00` (primary call-to-action) → links to picks
  - `Week 4 · Card in ✓` (confirmed) → links to picks (still editable) 
  - `Week 4 · Locked` (shipped without the `· Live` variant — no per-game state at the
    tile level, so a locked-mid-game week and a locked-between-games week read the same;
    deliberate scope cut, `docs/PAGES.md` §6)
  - `Week 4 · Graded` (between weeks)
  - `Season complete` (archived look)
- Season snapshot: `#3 · 41 pts` (rank + points)

**States:** needs-picks (primary CTA) · card-in · locked/live · graded/between-weeks ·
pre-season (before Week 1 slate exists → `Season starts soon`) · complete (archived).

**Design notes:** the tile is the primary **sport-flavor** surface — a CFB tile should
read football (per the CFB colorway) the way a golf tile reads golf. The needs-picks
state is the most important — it's the weekly re-engagement hook.

---

## 5. Screen — Join, CFB branch `/join/:code`

**Register:** General. Shared page; branches on `sport_id` to CFB copy + CFB route.

**Data elements** (from `public.pool_preview(code)` RPC — sport-agnostic; add CFB fields):
- `pools.name`, `sports.key`, participant count
- `cfb.event_details.season_year`
- Whether the season is **joinable** — v1 rule: **only before Week 1 locks** (single
  cutoff, no mid-season entry). If Week 1 is locked → a "this pool's season has already
  started" closed state.

**Must be on the page:**
- CFB `SportBadge` (`sm`) + pool name preview
- Sport line: `College Football Pick'em · Season 2026`
- **Format explainer** (CFB players may not know the format): a compact "how it works" —
  *"Every week: pick 5 to cover the spread, double-down your best one, and take an
  underdog to win outright. Points stack all season."*
- `N players in` social proof
- Join CTA → on success routes to `/cfb/pool/:id/picks` (shipped deviation from this
  brief's original `/cfb/pool/:id`: drops the joiner straight into the action, "Join &
  make picks →"; membership is written first either way)
- Closed state if past the Week 1 cutoff
- Consent line + Footer (shared, unchanged)

**Design notes:** mirrors golf's centered `bg-cream` join layout with the big wordmark;
just swaps the badge, copy, and the format explainer. Link-unfurl preview card
(`og-default.png`) is shared for now — a CFB-specific OG card is a later polish.

---

## 6. Screen — CFB Pool Detail / Leaderboard `/cfb/pool/:id`  ⭐ sport-specific

The season hero. Reuses the pool shell + the scorecard-expand *pattern*, but adds a
**week dimension golf never had**.

**IA decision (locked, from build plan):** the **season-cumulative standings are the
hero and stay ranked by season total.** The **week selector scopes the expand + the
widgets** to a chosen week — it does **not** re-rank the standings to that week.

**Data elements:**
- *Header:* `pools.name`, `cfb.event_details.season_year`, CFB `badge_config`,
  the selected/current `cfb.weeks` (`week_number`, `label`, `status`), a "last updated"
  timestamp, admin share-invite (admin only)
- *Standings (hero):* from `public.pool_standings` via `projectSeasonStandings(...)` —
  per row: `user_id`, `rank`, `total` (season points), `display.name`,
  `display.subtitle` (e.g. `"41 pts · Week 4"`). Mark the current user ("you" tag).
- *Selected-week card (the expand), per user:* their 6 `cfb.picks` for that
  `week_id`, each joined to its `cfb.games` — graded via `gradeWeekCard(...)`:
  - `pick_type` (`ats` | `underdog`), `selected_team`, `locked_spread`
  - `is_double_down`, `auto_filled`
  - `result` (`cover` | `push` | `miss` | `win` | `loss` | null if not graded)
  - `base_points`, `bonus_points`
  - the game: `away_team @ home_team`, `home_score`/`away_score`, `status`
- *Week selector:* the pool's `cfb.weeks` list (`week_number`, `label`, `status`)

**Must be on the page:**
- **Header band** (CFB theme gradient): back-to-dashboard, CFB badge, pool name hero,
  `Season 2026` sub-label, and a **live line** when the selected week is in progress:
  *"Live — scores update as games go final."*
- **Week selector** — a horizontal scroller/segmented control of weeks
  (`W1 W2 … W15`), current week default-selected; scopes the expand + widgets only.
- **Season Standings (full-width hero):** each row = rank, display name, "you" tag,
  **season total** (big; leader emphasized in the CFB accent). Secondary: the selected
  week's points for that player (e.g. `+7 this wk`). Ties share a rank.
  - **Expand (scorecard pattern, CFB-accent left-bar):** the selected week's **6 typed
    picks** as 6 marker rows —
    - slot marker circle (1–5 = ATS, ★ = the double-down among them, 🐕 = underdog)
    - matchup + the pick: `Michigan −7.5` / `Vanderbilt +10 (dog)`
    - final score `31–17` + game status
    - **result pill:** cover / push / miss (ATS) · win / loss (underdog); accent-fill on
      a hit, muted on a miss
    - **points:** `base_points` (+ `bonus_points` shown as `+1 DD` when the double-down
      clears)
    - `auto-filled` badge when `auto_filled = true` (and the week's DD is forfeit)
    - **TOTAL row** (`border-t`): the week total (= this player's `+N this wk`)
- **Widget row** (below standings — CFB widgets, see §6a)

**States:**
- **Pre-Week-1** (no graded weeks): everyone at 0 pts, standings alphabetical or by
  join; copy: *"Season kicks off Week 1 — standings fill in as weeks are graded."*
- **In-progress week:** live line shown; results/points update as games go final;
  ungraded picks show `—`.
- **Graded week selected:** full results + points in the expand.
- **Empty pool / no cards yet for a week:** *"No cards in for Week N yet."*
- **Season complete:** final standings, a subtle "Final" marker; a champion highlight on
  rank 1.

**Design notes:** the expand is the signature moment — carry it over faithfully (accent
bar from the colorway). The week selector is the one genuinely new axis; make "which week
am I looking at" unmistakable so users don't misread season vs week points.

### 6a. Component — `CfbWidgets` (the widget row)

Sport-specific analogues of golf's `Widgets.jsx`. All presentational, all scoped to the
**selected week** (except a season-level one). Render 2-up on the grid like golf.

| Widget | Data | Output |
|---|---|---|
| **This Week's Slate** | the week's `cfb.games` (`away_team @ home_team`, line as `Team −N`, `kickoff_at`, final score if `status='final'`) | the week's board — the context of what was pickable |
| **Weekly Points** | per-player points for the selected week (from `gradeWeekCard`) | bar chart of who won the week |
| **Most-Backed Teams** | the week's `cfb.picks` grouped by `selected_team` | which sides the pool piled onto (bar chart) — CFB's "Most Popular Picks" |
| **Underdog Board** *(optional)* | underdog picks + results for the week | who took which dog and who hit — CFB's signature slot |
| **Prize Pool** *(when `pools.stake_amount` set)* | shared `PrizePoolWidget` — reused as-is | total pot + per-placement payout (season-long) |

---

## 7. Screen — CFB Weekly Picks `/cfb/pool/:id/picks`  ⭐ sport-specific

**A full rebuild** — not a reskin of golf's `TierPicker`. This is the weekly **card
builder**: 5 ATS on 5 distinct games + 1 optional double-down flag + 1 mandatory
underdog on a separate 6th game, with live validity. Re-submittable until the week locks.

**Data elements:**
- *Week:* `cfb.weeks` — `week_number`, `label`, `lock_time`, `status`
- *The slate* (`cfb.games` for this `week_id`, already filtered at import to
  FBS-vs-FBS-with-a-line): per game —
  - `away_team @ home_team`, `away_conference`/`home_conference`, `kickoff_at`
  - `home_spread` (signed from home; **favorite** = negative side)
  - `underdog_team`, `underdog_spread` (positive — the points the dog gets)
  - derived for display: the favorite/underdog labels, the line as `Team −N`, and the
    **underdog tier** (`underdogTier(underdog_spread)` → +1.5–6.5 = T1 / +7–13.5 = T2 /
    +14+ = T3 → the points a win pays)
- *This user's existing card* (if editing before lock): their `cfb.picks` rows —
  `game_id`, `pick_type`, `selected_team`, `is_double_down`
- *Scoring helpers* (`cfbScoring.js`, already shipped) for live copy:
  `doubleDownBuffer(spread)` → the buffer N; `doubleDownWinBy(lockedSpread)` → the
  margin threshold (sign-general — see below)

**The card the user is building (validity rule the UI enforces live; the RPC is the
real gate):**
- exactly **5 ATS** picks on **5 distinct games**
- **≤ 1 double-down**, flagged on one of those 5 ATS picks (optional)
- exactly **1 underdog** pick, on a **6th distinct game** (mandatory)
- all 6 games distinct
- Submit disabled until the full 6-pick card is valid (no partial submission)

**Recommended interaction model** (design to refine):
- The slate is a scrollable list of **game cards**. Each game card shows kickoff,
  `away @ home`, and the line.
- **ATS pick:** two tappable team chips ("pick who covers"). Tapping fills an ATS slot
  (up to 5); tapping again clears. When 5 ATS are set, un-picked games' ATS chips
  disable.
- **Double-down:** a **★ flag** appears on a selected ATS card; flagging one un-flags any
  other (≤1). Show the live bonus condition on the flagged card using
  `doubleDownWinBy` — **sign-general copy** (per founder decision, `DECISIONS.md`
  2026-08-12): a **favorite** reads *"win by 14+ for the bonus"*; an **underdog** ATS
  pick reads *"cover by more than 5 (lose by ≤4 or win) for the bonus"*. **Never render a
  raw "win by −4."**
- **Underdog slot:** each game card also surfaces its `underdog_team` with a
  **"🐕 Take outright"** action showing the tier payout (`+2 pts if they win`). Selecting
  fills the single underdog slot; it's **disabled on any game already used for an ATS
  pick** (and an ATS-picked game disables if it's the current underdog).
- **Sticky tracker** (top or in `PicksSubmitBar`): `ATS 3/5 · Double-down 0/1 ·
  Underdog 0/1`, turning valid/green when complete; a **collision warning** if a rule is
  violated.

**Must be on the page:**
- `PicksHeader` (CFB theme gradient) — eyebrow `WEEK 4`, title *"Build your card"*,
  subtitle `Locks Sat, Sep 21, 12:00 PM ET` — built as the **viewer's own local
  timezone**, not a hardcoded "ET" (`formatLockLabel`, `src/utils/cfbFormat.js`)
- The slate builder (above)
- Live validity tracker + `PicksSubmitBar` (label reflects CFB: *"Submit card →"* /
  *"Update card →"*)
- Success confirmation state (link back to the pool)
- Read-only locked view (below)

**States:**
- **Slate not posted yet** (`weeks.status='scheduled'`, no games): *"This week's slate
  drops soon — check back once the lines are posted."*
- **Open, empty card:** build from scratch.
- **Open, editing existing card:** pre-selected picks; *"Your card's in — you can change
  it until Saturday."*
- **Locked, you submitted:** read-only card showing your 6 frozen picks + `locked_spread`
  each; *"Picks are locked for Week 4."*
- **Locked, you missed it → auto-filled:** read-only auto-filled card, each row badged
  `auto` ; *"You missed the deadline — a random card was filled in. No double-down this
  week."* (auto-fill forfeits the DD.)
- **Graded:** read-only card with results + points (or point users to the pool-detail
  expand for the graded view).

**Design notes:** this is the product's new signature interaction — make picking feel
like a Saturday-morning ritual. The three slot types (ATS / double-down / underdog)
must be visually distinct at a glance. The double-down is the emotional peak — give the
★ real weight (a little celebratory, in the CFB accent).

---

## 7a. Live scores — shared data element (data layer shipped ahead of the UI)

**The "don't switch tabs" feature.** While games play, every surface that shows a
CFB game can show its **live state**, so a player watching their Georgia −5.5 pick sees
the score, clock, and who has the ball without leaving Poold. The **data layer for this
is already built** (the `poll-cfb-scores` edge function refreshes it ~every minute on
game days); PR6/PR7 just render it.

**Where the data lives** (on each `cfb.games` row, kept current by the poller):
- `home_score` / `away_score` — current score (live during play, final when done)
- `status` — `scheduled` | `in_progress` | `final` (tells you which of the above it is)
- `live` (JSONB) — the ephemeral in-game blob: `period`, `clock` (`"07:42"`),
  `possession` (`"home"`/`"away"`), `situation` (`"3rd & 7 at MICH 42"`), `last_play`

**Where it renders** (same three surfaces, one data source):
1. **Your locked card view (§7 locked/live states)** — next to each of your 6 picks:
   `Michigan 21 – 17 Ohio State · Q3 7:42` with a **possession dot** on the team with
   the ball, and the down/distance/ball-spot line. This is the core ask.
2. **Leaderboard standings expand (§6)** — the same live line on each pick; a small
   **LIVE** pill on in-progress games. As games go final, results/points fill in and the
   season standings move (the poller grades on final).
3. **"This Week's Slate" widget (§6a)** — the board goes live (scores + clock inline).

**States per game:** `scheduled` (kickoff time, no score) → `in_progress` (live score +
`live` blob, LIVE pill, possession dot) → `final` (final score, result pill). The `live`
blob is only meaningfully populated while `in_progress`.

**Design notes:** a live game should feel *alive* — a subtle LIVE indicator, the score
updating, the possession dot. Keep it legible at a glance in a dense card; this is
glanceable context, not a full box score. **v1 fields are score/clock/quarter/
possession/situation** — richer data (win probability, drive summary, TV) is a later
add (the `live` blob can grow without a migration). Exact CFBD `/scoreboard` field names
are confirmed against a real Tier-2 response when this is wired into the UI.

---

## 8. Screen — Create CFB Pool (admin) `/admin/cfb/create-pool`

**Register:** General (admin). Analogous to golf's `CreateTournament`, but CFB is
**not create-once** — it spawns a season of weekly windows.

**Inputs the admin sets:**
- **Season** (`season_year`, e.g. 2026)
- **Pool name**
- **Weekly lock rule** — a recurring default (e.g. *"Saturdays 12:00 PM ET"*) used to
  seed each week's `lock_time`; editable per-week later in the ops console
- **Which weeks** the season spans (e.g. Weeks 1–15) → seeds `cfb.weeks` rows
- **Prize pool (optional):** `stake_amount` + `payout_structure` (shared with golf —
  same widget/validation; season-long, paid on final standings)
- Join cutoff is fixed by format (before Week 1) — surface it as info, not an input

**On submit** (creates the chain): `public.events` (`sport_id='cfb'`) →
`public.pools` → `cfb.event_details` (season_year) → seed `cfb.weeks`. Returns a
join code + link (same invite affordance as golf).

**States:** form, validating (payout sums to 100), success (shows join code + link to the
weekly ops console).

**Design notes:** keep it in the golf admin visual language; the new idea to convey is
"you're creating a *season*, and you'll run weekly ops from here on."

## 9. CFB `SportBadge` config

`SportBadge` is already generic. CFB v1 uses a **single static badge** (not 130
team-specific arts — that's a scope trap). Its `bg` / `border` colors come from the
**CFB colorway (owned separately)** — not proposed here. The badge *words* (design to
finalize) sit in a config shaped like:

```json
{ "line1": "CFB", "line2": "FBS", "bg": "<CFB colorway>", "border": "<CFB colorway>" }
```

Line 1 renders cream, line 2 renders in the border color, shape/type never vary (same
rules as golf's badge). Used at every size: dashboard tile (`md`), join (`sm`), picks
header (`pick`), pool header (`lg`).

### 9b. Screen — CFB Weekly Ops console (admin) `/admin/cfb/pool/:id`

**Register:** General (admin). The **recurring** surface golf never needed — where the
admin runs each week. (Buttons wire to PR3's `importWeekSlate`, PR5's grading job, and
PR9's cron.)

**Data elements:** the pool's `cfb.weeks` rows, each with `week_number`, `label`,
`lock_time`, `status` (`scheduled`|`open`|`locked`|`graded`), and a count of
`cfb.games` for the week.

**Per-week row controls:**
- **Import slate** — pulls games+lines from CFBD (`importWeekSlate`); shows imported/
  eligible counts
- **Edit lock time** / **Lock now**
- **Grade week** — runs the grading job once games are final (PR5); writes
  `pool_standings`
- **Refresh scores** — manually trigger a live/scoreboard poll (`refreshCfbScores` →
  `poll-cfb-scores`); the analogue of golf's "Refresh Now." Live scores otherwise
  refresh automatically on a ~1-minute pg_cron during game days (armed here, golf's
  polling-toggle pattern).
- Status badge per week; a `CFBD calls this month: n/30000` usage meter (from
  `public.api_usage.cfbd_calls`) — Tier 2 budget, shared by slate import, grading, and
  live polling

**States:** per-week — scheduled (import available) · open (locked-time set, editable) ·
locked (grade available once final) · graded (done). A season overview strip.

**Design notes:** this is an operator console, not a player surface — clarity and
safety over polish. Make destructive/irreversible actions (lock, grade) confirm.

---

## 10. Deferred (not v1) — note for design

- **CFB demo** (`/demo/cfb…`) — the golf demo pattern (static fixture, no auth) reskinned
  for CFB. Nice for marketing; not required to ship. Mirror §6/§7 off a fixture later.
- **Per-team badges / full CFB "sport pack" theme** — v1 is one static badge + the
  prop-based shell theming. The richer theming system (BRAINSTORM MS-9/10) is
  deliberately deferred.
- **Per-event OG unfurl card** for CFB join links — shared `og-default.png` for now.

---

## 11. PR mapping (so design knows what lands when)

| Screen / component | Build PR (see `CFB_BUILD_PLAN.md`) |
|---|---|
| **Live scores data layer (§7a)** — `poll-cfb-scores`, `cfb.games.live` | **shipped** (data only; UI consumes it in PR6/PR7) |
| Shell prop-ification (§2) + CFB Picks (§7) + `CfbWeekPicker` + live on locked card (§7a) | **PR6** |
| CFB Pool Detail (§6) + `CfbWidgets` (§6a) + standings expand + live line (§7a) | **PR7** |
| Dashboard CFB tile (§4) + Join branch (§5) + sport-dispatch + Create CFB Pool (§8) | **PR8** |
| Weekly Ops console (§9b) + cron (grading + **live-poll arming**) | **PR9** |
| Auto-fill states (§7 locked/auto-filled) | UI **shipped under PR6's PR-B** (`CfbCardReadonly`, PR #55); the backend that actually fills the card (`cfb.autofill_week` + lock cron) **shipped, PR10, PR #56** |
| CFB `SportBadge` config (§9) | with PR6 (first screen that renders it) |

Design can produce all of §4–§9 now; the PRs consume the designs in this order. The
live-scores **data** already exists, so §7a can be designed and rendered as soon as PR6/7.
