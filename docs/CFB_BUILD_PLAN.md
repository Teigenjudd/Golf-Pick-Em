# College Football (Sport #2) — Build Plan

> **Status:** Planning. Written 2026-08-11 from a dedicated planning pass, grounded in a
> full read of the golf implementation as the template. This is the *how-we-build-it*
> sequencing doc; the *what-the-game-is* rules live in `docs/CFB_FORMAT.md` (PR0).
> Supersedes nothing — it's net-new work. See `docs/MULTI_SPORT_MIGRATION.md` for the
> per-schema architecture this sits on, and BACKLOG **F1** (`pool_standings`) / **F6**
> (format contract) for the debt this interacts with.

CFB is Poold's second sport: a new `cfb` Postgres schema and a genuinely new **format**
(weekly against-the-spread, season-cumulative). The full rules are in `docs/CFB_FORMAT.md`.

---

## Settled architecture decisions

These are decided — build within them.

1. **Full siloing of the sport layer.** CFB owns its Postgres `cfb` schema, its `src/lib/cfb.js`
   seam (the only file that calls `supabase.schema('cfb')`), its scoring engine, picks UI,
   theme + badge, and data-provider proxy. **CFB code never imports golf and vice versa;
   neither sport schema references the other.**
2. **Shared neutral `public` core** (profiles, sports, events, pools, pool_participants,
   pool_standings), auth, hosting, dashboard shell, and the pool shells in
   `src/components/pool/`. `public` references no sport schema; sport schemas reference
   `public` only.
3. **The one shared shape is the standings *output*.** Silo the scoring engines completely
   (golf's best-N-relative-to-par fold and CFB's weekly ATS grading share zero logic), BUT
   both emit the same normalized `{ rank, total, display }` projection into
   `public.pool_standings`, so the shared dashboard renders a golf pool and a CFB pool with
   **zero sport-specific branches**. Each engine writes that row shape independently — it is
   not an engine coupling. This finally wires up `pool_standings` (unused since Phase 1).
4. **No full FormatEngine abstraction now (F6).** Two dissimilar formats is too few to
   extract the right interface. Only the standings-output contract (#3) is shared. Revisit
   F6 at format #3.
5. **A thin neutral sport-dispatch layer** reads `events.sport_id` and routes to the golf or
   CFB module. It holds no sport logic — it just dispatches (see Finding 3).

---

## Three findings from reading the golf code (these shape the sequencing)

**Finding 1 — the "shared" pool shells are not actually sport-agnostic today.**
`src/components/pool/PoolHeader.jsx` and `PicksHeader.jsx` hardcode golf's fairway-green
gradient inline (not as a prop); `WidgetGrid.jsx` hardcodes an import of golf's widgets;
`StandingsCard.jsx` hardcodes the label "Pick'em Standings." Fine at one sport; a blocker
the moment CFB needs its own register. Fix = small, backward-compatible prop-ification
(golf's current values become the defaults), which also puts the unused
`public.sports.theme` column to work. Must land before CFB reuses the shells.

**Finding 2 — golf's row-by-row pick RLS can't enforce CFB's whole-card rules.**
Golf's `golf.picks` policies validate one row at a time (one pick = one tier, independently
checkable). CFB's rules are a **set constraint across the 6 rows of one week's card**
(exactly 5 ATS on 5 distinct games, 1 underdog on a 6th distinct game, ≤1 double-down).
Postgres RLS is row-level and cannot express that. So CFB's submit path must be a
`SECURITY DEFINER` RPC — `cfb_submit_week_picks(pool_id, week_id, picks jsonb)` — that
validates the full set and writes it in one transaction. (This also avoids the non-atomic
delete-then-insert bug BACKLOG B5 flags for golf; for CFB it's load-bearing, not optional.)
This RPC lives entirely in the `cfb` schema and touches only `cfb` tables — it is not a
cross-sport concern.

**Finding 3 — `Join.jsx` is the real forcing function for sport-dispatch.**
`Join.jsx` looks a pool up by join code alone, hardcodes golf copy, and navigates to the
golf picks route. A join code doesn't reveal the sport — so this is the one screen that
*must* branch on `sport_id` before it knows which page/copy to render. The clean way: a
thin neutral `src/lib/pools.js` that reads only `public.*` to learn each pool's `sport_id`,
so `Join.jsx`/`Dashboard.jsx` never import both sport libs. Dashboard has the same need one
level down (it already knows each pool's sport from its query).

---

## The `cfb` schema (sketch)

Mirrors golf's per-schema pattern, with one structural addition golf never needed: golf's
`event_id` = one tournament (one lock, scored once); **CFB's `event_id` = one season**, with
weeks/games hanging off it and shared by every pool on that season (reuses the D3
"multiple pools per event" hinge, for a season instead of a weekend).

```
cfb  (FKs point within cfb or cfb → public, never → golf)
├── event_details   event_id → public.events (1:1), season_year int
├── weeks           id, event_id → public.events, week_number int, label,
│                    lock_time timestamptz, status ('scheduled'|'open'|'locked'|'graded')
│                    -- event-level: one slate/lock per week, shared by every pool on the season
├── games           id, week_id → cfb.weeks, cfbd_game_id text UNIQUE,
│                    home_team, away_team, home_conference, away_conference, kickoff_at,
│                    home_spread numeric NOT NULL,      -- signed vs home; away = -home_spread
│                    is_fbs_vs_fbs boolean NOT NULL,
│                    status ('scheduled'|'in_progress'|'final'), home_score int, away_score int,
│                    underdog_team text, underdog_spread numeric  -- denormalized for the picks UI
├── picks           id, pool_id → public.pools, week_id → cfb.weeks, user_id → public.profiles,
│                    game_id → cfb.games, pick_type CHECK IN ('ats','underdog'),
│                    selected_team text NOT NULL, is_double_down boolean DEFAULT false,
│                    locked_spread numeric NOT NULL,   -- frozen at submit time, for grading
│                    auto_filled boolean DEFAULT false, status text DEFAULT 'confirmed',
│                    result text,                       -- cover|push|miss|win|loss (grading)
│                    base_points numeric, bonus_points numeric, created_at timestamptz,
│                    UNIQUE (pool_id, user_id, week_id, game_id)
```

**Grants** — copy `20260624120000_multisport_phase1_scaffold.sql` line-for-line for `cfb`
(`GRANT USAGE ON SCHEMA cfb`, per-table privileges, `ALTER DEFAULT PRIVILEGES` for
`authenticated` + `service_role`). Skipping this = "permission denied" *before RLS runs* —
the migration doc's #1 cross-schema foot-gun.

**RLS** — `weeks`/`games`/`event_details` mirror golf's `tiers`/`tier_players`/`event_details`
(authenticated read-all, admin manages). `cfb.picks`: read-own anytime; read-others'-picks
only after **that week's** lock (`cfb.weeks.lock_time`/`status`, per-week not per-pool); plus
row-level insert/delete policies mirroring golf's for defense-in-depth — but the real
enforcement is the `cfb_submit_week_picks` RPC (Finding 2). Auto-fill and grading also run
server-side (service role), not client writes.

---

## Data layer — CFD proxy, slate import, grading

- **`supabase/functions/cfd-proxy/index.ts`** — mirrors `slash-golf-proxy`: admin-JWT/cron-secret
  gated, `CFBD_API_KEY` as a Supabase secret (never browser-exposed), usage guard against
  `api_usage` (+ a `cfbd_calls` column matching `slash_golf_calls`). Proxies
  CollegeFootballData's games/lines/teams endpoints. **Confirm CFBD's real free-tier limits
  before sizing the cap** — don't reuse golf's `1800` placeholder.
- **Slate import** (`src/lib/cfb.js`) — per week, fetch games + lines, compute
  `is_fbs_vs_fbs`/`underdog_team`/`underdog_spread`, upsert into `cfb.games`. **Runs a few days
  before each week's lock, not once at season start** (lines move; future weeks aren't
  posted). CFB pool "creation" seeds ~15 empty `cfb.weeks` with placeholder locks; each
  week's games import later, as a recurring op (PR9).
- **Grading** (not just caching, unlike golf) — because standings are cumulative across
  weeks, a `grade-cfb-week` job runs after a week's games go final: fetch final scores,
  update `cfb.games`, grade every pick, write the shared `pool_standings` projection. Same
  "cron + admin manual-refresh" shape as golf's poller, with a grading step added.

---

## Scoring engine — `src/utils/cfbScoring.js`

Pure module, no imports (same discipline as `src/utils/scoring.js`):
`doubleDownBuffer(spread)` → `max(spread*0.5, 4)` rounded to nearest 0.5;
`gradeAtsPick(...)` → cover/push/miss + points (push = exact margin = 0);
`gradeDoubleDown(...)` → +1 if margin clears the buffer, else 0 (never negative);
`underdogTier(spread)` → 1|2|3 at the documented boundaries; `gradeUnderdogPick(...)` →
outright win/loss, tiered on win; `gradeWeekCard(...)`; `projectSeasonStandings(...)` → the
cumulative fold returning the shared `{ rank, total, display }` shape (with a pre-rendered
subtitle like `"142 pts · Week 9"` so the shared UI never needs CFB scoring knowledge).

**Unit tests (the repo's first — starts closing BACKLOG F4).** Add `vitest`, a `test` script,
and `cfbScoring.test.js` covering the boundary cases from `CFB_FORMAT.md` verbatim.

**Client↔edge duplication:** authoritative grading runs server-side (service role) so users
can't grade their own picks. Deno edge functions can't import `src/` cleanly, so keep
`cfbScoring.js` as the tested source of truth and maintain a small
`supabase/functions/_shared/cfbScoring.ts` mirror with a comment pointing back (precedented
by `.design-sync/scoring-preview.js`, BACKLOG F7). Bounded, pure arithmetic — not a slippery
slope.

---

## Picks UI + theme

- **`src/pages/cfb/CfbPicks.jsx` + `src/components/picks/CfbWeekPicker.jsx`** — CFB's own pick
  UI (not a modification of golf's `TierPicker`). Weekly slate (pre-filtered to
  FBS-vs-FBS-with-a-line at import), pick 5 ATS on distinct games, flag one double-down, pick
  one underdog on a sixth distinct game. Client-side validation mirrors the RPC rules (live
  counters, disabled submit, collision warning) — UX only; the RPC is the real enforcement.
- **Reuses the shared shells** after the Finding-1 prop-ification: `PoolHeader`/`PicksHeader`
  take a `theme` prop (golf's gradient as default), `StandingsCard` takes a `label` prop,
  `WidgetGrid` takes widgets via render-prop/children. Build CFB's own
  `src/components/leaderboard/CfbWidgets.jsx` ("This Week's Slate," "Weekly Points" — not
  golf's "PGA Leaders").
- **Badge** — `SportBadge` is already sport-agnostic (renders whatever `badge_config` it's
  handed). CFB just needs its own `badge_config` values — a single static CFB badge for v1
  (not 130 team-specific arts; that's a scope trap).

---

## Design direction & the two sport pages

Both CFB sport pages are **functionally new**, not reskins of golf — size PR6/7 accordingly:
- **Picks page** — a full rebuild (no `TierPicker` reuse): a weekly slate builder with 5 ATS
  selections, a double-down flag, and a separate-game underdog, with live validity.
- **Pool detail / leaderboard** — reuses the shell + the scorecard-expand *pattern*, but adds a
  **week dimension golf never had** (week selector, cumulative-across-weeks scoring, all-new
  widgets), and the expand shows 6 typed picks with per-pick points, not tiers.

**Week vs season IA (decided):** the season-cumulative standings are the hero and stay ranked by
season total; the **week selector scopes the expand + widgets to a chosen week** — it does NOT
re-rank the standings to that week's points. A "Live — scores update as games go final" line sets
the in-progress expectation.

**Visual direction (exploratory — from a Claude Design pass, NOT locked into tokens yet):**
midnight-navy ground + brick-red accent over the existing warm-cream neutrals, golf's
scorecard-expand carried over with a red bar. Reads collegiate-Saturday, distinct from fairway
green, coherent with the Poold system. Two fixes to carry into the real build:
1. Use a neutral sample pool name in mocks — avoid "Warpath"-style Native American war imagery.
2. Double-down copy must reflect the **strict** rule: "cover by more than N · win by X+" — the
   buffer is a strictly-greater threshold, so an inclusive "N+" is wrong for spreads whose buffer
   lands on a half-point (e.g. an 8.5 line → 4.5 buffer, which a 13-point win lands exactly on).
   Build the buffer→"win by X" helper in the scoring engine (PR4) and unit-test it.

---

## Sport-dispatch wiring + CFB pool creation

- **`src/lib/pools.js`** (new, neutral) — sport-agnostic reads that only touch `public.*`:
  "which pools is this user in and what `sport_id` each," "look up a pool by join code + get
  its `sport_id`." Lets `Join.jsx`/`Dashboard.jsx` learn the sport before choosing a module,
  without importing both sport libs.
- **`Join.jsx`** branches on `sport_id` (golf copy + `/tournament/:id/picks`; cfb copy + a
  `/cfb/...` route). **`Dashboard.jsx`** rewritten against `lib/pools.js`, links each card to
  the right sport route (real surgery — its own PR; it currently computes golf scores inline).
- **`App.jsx`** gets CFB's own `/cfb/*` routes; **leave golf's `/tournament/*` untouched**
  (avoid churning live bookmarked URLs for zero gain; more consistent with siloing).
- **Admin CFB pool creation** (`src/pages/admin/cfb/CreateCfbPool.jsx`) — pick a season, set a
  recurring lock rule, create `public.events` (`sport_id:'cfb'`) → `public.pools` →
  `cfb.event_details` → seed `cfb.weeks`. Unlike golf, **not create-once-and-done**; weekly
  slate ops are a new recurring admin surface (PR9).

**Config/grants foot-guns to check off explicitly:**
1. `supabase/config.toml` → add `cfb` to `[api] schemas` in **PR1** (so local dev works day one).
2. **Prod dashboard → Settings → API → Exposed Schemas must add `cfb` manually** — not in any
   migration; the highest-likelihood cutover foot-gun. Checklist item on the first PR to real users.
3. Edge functions touching `cfb` must call `.schema('cfb')` (service role bypasses RLS, not
   schema-qualification).
4. `SECURITY DEFINER` functions need `SET search_path` pinned (like `is_admin()`).
5. Local/CI parity: `supabase db reset` + seed scripts must know about `cfb`.

---

## PR sequence

| # | PR | Goal | Key risk |
|---|---|---|---|
| 0 | `docs/CFB_FORMAT.md` | Rules + worked examples + schema sketch, reviewed before code | ambiguity found mid-build instead of now |
| 1 | `cfb` schema scaffold | Additive tables, grants, RLS-deny-all, seed `public.sports` row; add `cfb` to config.toml | grants forgotten → silent "permission denied" |
| 2 | RLS + `cfb_submit_week_picks` RPC | Row policies mirroring golf + the atomic whole-card submit (Finding 2) | RLS alone can't enforce the 6-pick set — don't skip the RPC |
| 3 | `cfd-proxy` + slate import | Server-side CFBD access; `src/lib/cfb.js` import | lineless games must be excluded at import, not just unscored |
| 4 | `cfbScoring.js` + tests | Pure grading engine + the repo's first unit tests (F4) | double-down rounding + underdog tier boundaries |
| 5 | `grade-cfb-week` → `pool_standings` | Weekly grading writes the shared projection (CFB half of F1) | mirror/source drift — comment both files |
| 5b | *(optional)* wire `pool_standings` for golf | Closes F1's other half; not required to ship CFB | none blocking — keep it from gating CFB |
| 6 | Weekly picks UI + shell theme-props | `CfbPicks`/`CfbWeekPicker`; prop-ify the shells (Finding 1) | shell changes must not visually change golf (defaults) |
| 7 | CFB pool detail / leaderboard | `CfbPoolDetail`, `CfbWidgets`; `WidgetGrid` → render-prop | first page reading `pool_standings` — validates Decision #3 |
| 8 | Sport-dispatch + CFB pool creation | `lib/pools.js`; `Join`/`Dashboard` branch on sport; `CreateCfbPool`; CFB routes | Dashboard surgery — golf must be byte-identical after |
| 9 | Weekly admin ops + cron | Manual import/lock/grade buttons, then pg_cron (golf's pattern) | 15 weeks of manual ops/season until automation lands |
| 10 | Auto-fill on missed deadline | Random fill of missing slots, DD forfeiture, `auto_filled` flag | partial-card semantics (see CFB_FORMAT open questions) |
| — | **Prod cutover checklist** | Flip Exposed Schemas to include `cfb` in the Supabase dashboard | silent 404s on every `cfb` query if forgotten |

---

## Open questions for the founder (feed into `docs/CFB_FORMAT.md`)

Ranked. Load-bearing ones must be answered before the PR that depends on them.

1. **Double-down buffer rounding** — if the buffer computes to a non-half-point number, round
   up, down, or to nearest? (Needed before PR4 tests.)
2. **Partial-submission auto-fill** — submit 3 of 6 then miss the deadline: top up only the
   missing 3 (keep real picks + DD), or wipe the whole card to random? Does a *partial* miss
   forfeit the DD?
3. **Mid-season joins** — single cutoff before week 1, or join mid-season (and if so, 0 for
   missed weeks)? Affects the standings query.
4. **CFBD API tier/limits** — confirm real free-tier cap before sizing the proxy guard.
5. **Route shape** — OK to give CFB its own `/cfb/*` namespace, golf's untouched? (Recommended.)
6. **Theme scope** — minimal prop-based fix now vs. the fuller "sport pack" theming system
   (BRAINSTORM MS-9/10). Plan defers the big version deliberately; confirm that's intended.
