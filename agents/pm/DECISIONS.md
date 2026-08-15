# Poold — Decision Log

> **What this file is:** *Why* we chose what we chose. Append-only — a decision that
> gets reversed is not deleted, it gets a new entry that supersedes it, because the
> reasoning behind a reversal is usually more valuable than the reversal itself.
>
> **Write an entry when a call would otherwise be re-litigated later** — an architecture
> fork, a scope guard, a "we deliberately did NOT do X." Don't log routine
> implementation choices; the code shows those.
>
> Newest first. Each entry: what we decided, why, what we gave up, and what would make
> us revisit it.
>
> **Older entries (2026-08-10 and earlier) live in `DECISIONS_ARCHIVE.md`.** Grep spans
> both files; new entries always go here (at the top), never in the archive.

---

## 2026-08-15 — CFB prod cutover (PR #58): quarter-point spread backfill stays a one-off; edit-picks resets the card instead of pre-filling it

**Decision 1 — data backfill (`cfb-admin-close-and-picks-ux`, senior review finding #1):**
`chooseLine()`'s new `roundToHalfPoint` fix (nearest-half-point rounding, closing a gap
where an even-provider median could land on a quarter point no sportsbook ever posted)
was applied going forward in code, but the ~38 existing `cfb.games` rows and 3 already-
locked `cfb.picks` rows it retroactively affected were corrected with a one-time SQL
statement run directly against prod — not captured as a migration. Founder-confirmed:
leave it as a one-off, don't add a backfill migration.

**Why:** Prod doubles as the CFB dev DB and there are no real users yet, so the cost of
an unreproducible hand-patch is genuinely low today. Writing a migration for a
data-correction that will never need to run again (the code fix prevents recurrence) is
effort with no future payoff at this stage.

**What we gave up:** If prod is ever rebuilt from the migration folder, or a fresh dev DB
stood up from it, the corrected rows come back with their old (already-graded-if-locked)
quarter-point values — nothing in version control reproduces the patch. Sharpest edge:
a locked `cfb.picks.locked_spread` is frozen and only ever fixed by hand again.

**What would make us revisit:** The first time prod has real users and a locked pick's
frozen spread needs a hand-correction — at that point every retroactive DB fix needs a
migration, not just this class of bug.

---

**Decision 2 — reset-on-edit, not pre-fill-on-edit (`src/pages/cfb/CfbPicks.jsx`):** the
Dashboard's "Edit picks" button now confirms first, then opens the picks builder with
`?reset=1`, which starts the card **empty** instead of pre-filling the player's saved
picks for in-place editing. Kept as built (senior review flagged the banner copy/URL
stickiness as nits, not the design itself — see `agents/senior-dev/reviews/
cfb-admin-close-and-picks-ux.md`).

**Why:** `cfb_submit_week_picks` re-freezes `locked_spread` from the *current* game row
for **every** pick in a resubmitted payload, not just the ones that changed. Silently
pre-filling old picks would let a player believe an unchanged pick keeps its original
line, when resubmitting actually re-locks it to whatever the line has moved to since.
Starting empty forces a deliberate rebuild against today's numbers — the saved card is
untouched in the DB until a full valid card is submitted, so nothing is lost by backing
out.

**What we gave up:** A player who wants to tweak one pick out of five must reselect all
five, not just the one they're changing — more taps for the common "I want to change one
game" case.

**What would make us revisit:** If this friction measurably suppresses edits once there
are real users, the fix is server-side — e.g. have the RPC only re-freeze
`locked_spread` for picks that actually changed — not reverting to silent pre-fill.

---

## 2026-08-15 — Admin refresh: dropped the Participants tab (no UI replacement); bottom nav retired for a header avatar

**Decision (`feat/admin-refresh`, senior review Q1/Q3):** `AdminDashboard`'s golf-only
"Participants" tab is deleted with this PR, and nothing replaces it — a commissioner can no
longer view every participant's submitted card or remove a participant from a pool through the
app. The backing functions (`getPoolPicks`, `removePoolParticipant` in `src/lib/golf.js`) are
left in place, unused, for a future rebuild. Separately, the app-wide `BottomNav` (Pools/You tabs)
is deleted; `/profile` is now reached via a header avatar on Dashboard/Profile, and admins get a
`ProfileMenu` dropdown (Profile / Admin) instead of an always-visible admin row. The display-name
nudge that used to live on `BottomNav`'s "You" tab is now a small gold dot on the avatar.

**Why:** Viewing a pool's picks is largely redundant with the public post-lock leaderboard, and
the admin surface was overdue for consolidation (`AdminShell` now unifies golf/CFB chrome +
`/admin/users`). Removing an entire tab was the fastest path to a cleaner admin area; nobody has
hit the "kick a participant" need yet in practice. The bottom nav only ever had two real
destinations, so a header avatar reads as less chrome for the same reach.

**What we gave up:** Self-serve removal of a duplicate/mistaken/bad-actor participant now
requires a developer to run SQL or restore the UI — there is no in-app path. Flagged explicitly
by senior review as a real (if currently unused) capability loss, not just dead weight.

**What would make us revisit:** The first time someone actually needs to remove a participant
and can't. Rebuilding it is cheap — `removePoolParticipant`/`getPoolPicks` already exist; it just
needs a screen (possibly folded into `/admin/users` or a per-pool admin detail view rather than
a full tab).

---

## 2026-08-14 — CFB auto-fill: underdog-eligibility for pick'em games, per-week advisory lock, and an always-on free cron ahead of the billable pollers

**Decision (PR10, PR #56, senior review):** `cfb.autofill_week`'s random underdog draw is
restricted to underdog-*eligible* games (non-null `underdog_team`/`underdog_spread`); a pick'em
(spread-0) game is still usable as one of the 5 random ATS picks but can never land in the
mandatory underdog slot — mirroring the rule `cfb_submit_week_picks` already enforced for a human
pick, which the first draft of the auto-generator missed (a pick'em drawn into the underdog slot
triggered a NOT NULL violation and silently dropped that player from scoring). Added a
`pg_advisory_xact_lock` keyed per week inside `autofill_week` so the cron, the grader's backstop
call, and the admin "Auto-fill missing cards" button can't race into a 12-pick corrupt card by
each independently drawing a disjoint random 6. And `cfb.process_locked_weeks()` — the function
that flips a week to `locked` and runs the fill — is armed as its own always-on `cfb-lock-autofill`
pg_cron job, live in prod now, separate from and ahead of the three billable CFBD pollers
(`cfb-lines`/`cfb-scores`/`cfb-grade`), which stay gated behind the admin toggle and are still not
armed.

**Why:** The underdog-eligibility bug is a correctness bug, not a design choice, but the fix pins
a rule (pick'em ≠ underdog-eligible) that wasn't written down anywhere before this PR — future
auto-generation or admin tooling touching the underdog slot needs to know it (now in
`docs/CFB_FORMAT.md` §Eligibility). The advisory lock is cheap insurance against three independent
triggers (cron/grader/button) hitting the same week. Arming the lock/fill cron now, ahead of the
billable pollers, was a deliberate split: it's pure SQL with zero API spend, so there's no cost
reason to wait for the PR9 cutover, and it's the piece that actually makes "closed at lock_time"
visible and consequence-free for players.

**What we gave up:** Nothing measurable — the pick'em fix and the lock both shipped in the same
migration pass senior review required before merge, and the free cron carries no cost tradeoff.

**What would make us revisit:** If a future format change makes pick'em eligible for the underdog
slot (e.g. treat a 0-spread as pick-either-side), both `cfb_submit_week_picks` and
`autofill_week`'s eligibility filter need updating together — they're two independent enforcement
points, not one shared check.

---

## 2026-08-14 — Golf-pool list filtering: two mechanisms, kept deliberately; graded+auto-filled notice copy left as-is

**Decision (PR #55, senior review Findings 1 & 3):** `getAllPools()` (`src/lib/golf.js`) now
filters to golf pools via `events.sport_id = 'golf'` — the canonical, indexed sport marker,
matching CFB's own `getAdminCfbPools` pattern. `getAdminPools()` keeps its original
`golf.event_details`-presence probe instead of switching to the same `sport_id` filter,
because that function already fetches `event_details` for golf-only fields (refresh count,
`slash_golf_tournament_id`) — adding a second query there would cost a round-trip the
`sport_id` filter doesn't save. Separately, when a week is both graded and auto-filled, the
picks-page notice leads with "you missed the deadline" rather than "week is final" (finality
is still conveyed by the card's "Final" subtitle) — left as a deliberate copy call, not a bug.

**Why:** `getAllPools` is a cheap list-only read with no other reason to touch the golf
schema, so the plain `sport_id` filter is strictly better there and is the pattern to copy
when sport #3 arrives. `getAdminPools` already pays the `event_details` round-trip for
legitimate reasons, so the probe is free in that one spot. The notice copy was judged fine
as-is — the auto-fill warning is the more actionable message for that user in that moment.

**What we gave up:** The codebase now has two different "is this pool golf?" mechanisms
instead of one — acceptable because they're used in genuinely different cost contexts, but
worth remembering if a third caller needs the same check (default to `sport_id`, not the
schema probe).

**What would make us revisit:** If `getAdminPools` ever stops needing `event_details` for
other reasons, switch it to `sport_id` too and delete the probe. If user feedback says the
graded+auto-filled notice is confusing, swap it to lead with "final."

---

## 2026-08-14 — CFB cron cadence: windowed/in-season, and `cfb-scores` runs every in-season day, not just Thu–Sun

**Decision:** CFB's three admin-toggled cron jobs (`cfb-lines`, `cfb-scores`, `cfb-grade` —
`admin_start_cfb_polling()`, `supabase/migrations/20260814000000_admin_cfb_polling_controls.sql`)
are windowed to the Aug–Jan season (months 8-12,1), not year-round, mirroring golf's seasonal-only
approach. Within season, `cfb-scores` (the live in-game score poller) runs every 2 min during game
hours on **every in-season day**, not day-restricted to Thu–Sun the way it was first drafted.

**Why:** `poll-cfb-scores` self-gates to a cheap DB-only check ("is anything in the live window
right now?") and returns with zero CFBD API spend when nothing's live — so restricting the cron to
Thu–Sun saves no real API cost, it only drops live scores for whoever's playing outside that
window: the Monday CFP national championship, weekday bowl games, and Tue/Wed MACtion. Running it
every day is effectively free and strictly more correct.

**What we gave up:** Nothing measurable — worst case is some extra cheap DB-check invocations on
days with no games, not extra CFBD API calls.

**What would make us revisit:** If CFBD's `/scoreboard` pricing or rate limits ever change so the
DB-gate itself becomes non-trivial cost, or if a future poller's self-gate isn't this cheap,
day-restricting the cron would be worth reconsidering on a case-by-case basis.

---

## 2026-08-13 — CFB PR9a: finalize-as-is is uniform push/0 and one-way through the UI; `push` reused instead of a new `void` result

**Decision:** Ships the admin escape hatch for a stuck CFB week (`gradeWeek`'s `opts.finalize`,
`grade-cfb-week`'s `finalize` param, `finalizeCfbWeek()`, "Finalize as-is" on `CfbPoolOps.jsx`) —
closing the two PR5 review gaps this file flagged as PR9 must-dos (2026-08-12, "stuck-week
finalization deferred to PR9" and "manual grade-by-id lock guard deferred to PR9"). Both are now
closed in code: (a) a no-contest game (cancelled/postponed/never reports final) grades **every**
affected pick — ATS, double-down, and underdog alike — as `result: 'push', base_points: 0,
bonus_points: 0`, with no double-down "slot refund"; a player who spent their once-per-week
double-down on the voided game just scores 0 on it, same as anyone else. Simple and symmetric,
accepted for a rare, no-money escape hatch. (b) Finalize is deliberately **one-way through the
admin UI** — once a week is stamped `graded`, both buttons disappear (gated on `status !==
'graded'`) and nothing in the app re-opens it; undoing a too-early finalize needs a raw SQL
update back to `locked`. Accepted as intended "un-stick it and move on" behavior, guarded by a
`window.confirm` naming the week. Also: the voided result reuses the existing `push` value rather
than adding a `void` value to `cfb.picks.result`'s CHECK — `push` already means zero points, and a
distinct `void` would need a migration for no behavioral gain.

**Why:** Finalize exists only for the rare case a game never finalizes (cancelled/postponed) —
optimizing its edge semantics (partial refunds, reversibility) isn't worth the complexity for an
admin-only, confirm-gated, no-money-on-platform override. The lock-time guard (grade-cfb-week's
targeted `{week_id}` path now refuses a week whose `lock_time` hasn't passed, mirroring the scan
path's existing gate) closes gap (b) from PR5 the same way.

**Gave up:** No in-UI recovery from an early or mistaken finalize (needs direct DB access); no
partial double-down credit on a voided game.

**Revisit if:** finalize gets used often enough in practice that "raw SQL to undo" becomes a real
support burden — add an admin "re-open week" action then, not preemptively.

**Note — deploy status unchanged:** this PR (PR9a, `feat/cfb-admin-grading-ops`) is the admin-code
half of `docs/CFB_BUILD_PLAN.md`'s PR9 row only. The CFB edge functions are still not deployed and
no CFB cron is armed — that cutover (PR9b) is still pending; see `docs/CFB_BUILD_PLAN.md`.

---

## 2026-08-13 — CFB sport-dispatch: neutral `lib/pools.js` seam, explicit join, route straight to picks, client-only cutoff

**Decision:** `src/lib/pools.js` is a new **sport-neutral** data seam — reads/writes
only `public.*` tables, never `golf()`/`cfb()` — distinct from the per-sport
`lib/golf.js`/`lib/cfb.js` seams. It exists because `Join.jsx` and `Dashboard.jsx` must
learn a pool's `sport_id` *before* they know which per-sport lib to hand off to.
`getPoolByCode(code)` does that lookup; `joinPool(poolId, userId)` writes
`pool_participants` explicitly for CFB — **golf records that membership implicitly at
pick-submit, but CFB's `cfb_submit_week_picks` RPC requires the row to already exist**,
so an implicit-at-submit join would just fail the RPC. Three follow-on calls, made in
the same PR: the CFB join CTA routes to `/cfb/pool/:id/picks` (not `/cfb/pool/:id` as
`docs/CFB_UI_PLAN.md` §5 originally specced) — drops a new joiner straight into the
action, matching the CTA copy "Join & make picks →"; the season join-cutoff
(`joinClosed` in `Join.jsx`) is enforced **client-side only**, hardened in-branch to
fail *closed* on a null `lock_time` rather than fail open; and the CFB dashboard tile
ships without golf's "Live" chip variant (no per-game query at the list-endpoint level).

**Why:** This is the real seam a second sport's dispatch has to cross — golf's
implicit-join pattern (RLS lets a pick-submit insert its own membership row inline)
quietly assumed there'd only ever be one join mechanism. CFB's RPC-first membership
requirement broke that assumption, so the fix had to be a new, explicit, sport-neutral
write path rather than a tweak to `lib/cfb.js`. Routing to picks-first and a
client-only cutoff were both scoped decisions to ship the funnel now rather than block
on a fuller join RPC.

**What we gave up:** a server-side backstop on the join cutoff (tracked as BACKLOG A10 —
today nothing stops a `pool_participants` insert after a pool's season has started
except the browser check) and the "Live" tile state golf has (BACKLOG G5).

**Revisit if:** CFB ever needs a join step with side effects beyond a plain upsert (e.g.
payment, waitlist, capacity cap) — at that point the cutoff enforcement belongs in a
`SECURITY DEFINER` RPC next to `joinPool`, not in the browser.

## 2026-08-13 — CFB Phase 2: keep the instant client-side weekly-points recompute over the server total

**Decision:** On `/cfb/pool/:id`, the season total (the big number, per player) reads
straight from `public.pool_standings.total` (server-written by `grade-cfb-week`). The
selected-week's points — in the standings-row expand and the Weekly Points widget — are
instead **recomputed live in the browser**, using the shared `gradeWeekCard`/`pickMargin`
scoring functions against each game's current score. We keep that split rather than
gating the weekly number on `week.status === 'graded'`.

**Why:** It's the only way a player sees their weekly points update the instant a game
goes final, instead of waiting for the next live-poller cycle (which does the same
computation server-side and writes it back to `pool_standings`). Surfaced by senior
review (`agents/senior-dev/reviews/cfb-ui-phase2-pool-detail.md`, Finding 1) as the one
place the page trusts its own math over the server's. The two numbers agree once the
poller re-grades — normally within one poll cycle of a game finalizing — and drift
between the JS engine the page uses and the TS mirror the server uses is guarded by the
existing parity test suite (`cfbScoring.parity.test.js`), so this is a *timing* gap, not
a correctness gap.

**What we gave up:** a brief window (a game going final → the next live-poller run)
where the weekly number in the expand can lead the season total above it, which could
read as "these two numbers don't add up" if a player takes a screenshot mid-window. The
alternative (gate on `week.status === 'graded'`) would have removed that window at the
cost of "the game just ended and I still see nothing" for however long grading takes.

**Revisit if:** the live-poller cadence ever slows enough (e.g. a cost-driven throttle)
that the lead window becomes minutes instead of seconds — at that point, gating the
weekly number on `graded` becomes the better trade.

## 2026-08-13 — CFB Phase 2: hide the three pick-derived widgets until the selected week locks

**Decision:** On `/cfb/pool/:id`, `CfbWidgets`' Weekly Points, Most-Backed Teams, and
Underdog Board widgets render a "reveal when Week N locks" placeholder instead of live
data until `weekIsLocked(selectedWeek)` is true. This Week's Slate and Prize Pool are
unaffected (they don't depend on other players' picks).

**Why:** `cfb.picks` RLS correctly returns only the viewer's own picks before a week
locks (by design — nobody sees anyone else's card early). Feeding that into the three
pick-derived widgets pre-lock would have shown e.g. "Most-Backed Teams: Alabama 1/1" —
not a leak, but a misleading single-player sample that reads like a near-empty pool.
Senior review flagged this as a presentation-only question (Finding 2, no
correctness/privacy angle) with three options: leave as-is, hide the three widgets, or
show a "reveals at lock" note. We took the third.

**What we gave up:** nothing functional — the widgets were only ever going to be
accurate post-lock; this just stops them from showing a technically-true but confusing
partial view in the meantime.

**Revisit if:** a future "who's leaning where" pre-lock teaser becomes a deliberate
product feature (distinct from today's incidental single-player sample) — that would be
a new, intentional widget, not un-hiding these three.

## 2026-08-13 — CFB player UI is a 4-phase PR series; PR #48 = Phase 1 (theme + shells + scaffolds)

**Decision:** The CFB player-facing UI (the Claude Design comp "CFB Pool Detail and Picks
- Full States") ships as four PRs rather than one: (1) locked colorway + shared-shell
prop-ification + placeholder routes [this PR, #48], (2) the real Pool Detail body
(`docs/CFB_BUILD_PLAN.md` PR7 — season standings, week selector, scorecard-expand,
CFB widgets), (3) the real Weekly Picks body (PR6 — 5 ATS + double-down + underdog builder
with live validity), (4) reachability (`src/lib/pools.js` sport-dispatch, `Join.jsx`/
`Dashboard.jsx` branching on `sport_id`, a sport-agnostic "New Pool" flow — PR8). Routes
`/cfb/pool/:id` and `/cfb/pool/:id/picks` exist as of Phase 1 but are not linked from
anywhere in the UI yet — reachable only by typing the URL.

**Why:** Each phase is independently reviewable and low-risk on its own. Phase 1 alone
touches four widely-shared components (`PoolHeader`, `PicksHeader`, `StandingsCard`,
`WidgetGrid`) — bundling it with the actual picks/standings logic would make "does golf
still render byte-identically" harder to verify in one sitting. Splitting lets senior
review confirm that claim in isolation (it did — see
`agents/senior-dev/reviews/cfb-ui-phase1-foundation.md`) before any real CFB logic lands
on top of the shells.

**What we gave up:** four PRs' worth of review/merge overhead instead of one, and a CFB
pool remains unreachable through normal navigation until Phase 4 ships.

**Revisit if:** the phase boundaries turn out to not be independently shippable (e.g.
Phase 2's standings need a shell prop Phase 1 didn't anticipate) — fine to adjust, just
note the change here rather than re-deriving why 4 phases were chosen.

## 2026-08-13 — CFB colorway locked: "Varsity Navy"

**Decision:** CFB's sport-specific register (pool detail + picks pages only) is navy
`#101C3D→#0A1229` header gradient, brick `#D6291B` accent (eyebrow, expand bar, double-down
flag, selected pick, submit, badge border), green `#2E8F4F` for cover/win, and the existing
warm-cream neutrals shared with golf — over a brick/cream/brick 3-segment "rib" stripe
under the header in place of golf's plain band. Constants live in `src/theme/cfb.js`
(`CFB_THEME`, `cfbBadge(seasonYear)`/`CFB_BADGE`), not in `public.sports.theme` (still
unused) or Tailwind tokens — plain JS since the hexes are CFB-only and consumed both
inline and passed into the shared shells. Golf keeps fairway `#1B4332`/gold `#C9A368`
unchanged.

**Why:** Founder-finalized in a Claude Design comp pass ("CFB Pool Detail and Picks - Full
States"). Reads collegiate-Saturday, distinct from golf's fairway green, consistent with
the rest of Poold's warm-cream system. Supersedes `docs/CFB_BUILD_PLAN.md`'s earlier
"exploratory, NOT locked into tokens yet" note on the same visual direction.

**What we gave up:** nothing load-bearing — this only affects the two CFB-specific
screens, and both are still placeholder bodies (Phase 1), so no real content had to be
restyled.

**Revisit if:** the design comp's remaining states (in-progress, error, empty) surface a
color this palette doesn't cover — extend `CFB_THEME`, don't introduce a second CFB
palette.

## 2026-08-13 — Shared pool shells prop-ified for a second sport (Finding 1 resolved)

**Decision:** `PoolHeader`, `PicksHeader`, `StandingsCard`, and `WidgetGrid`
(`src/components/pool/`) now accept theme/content props — `gradient`, `accentColor`,
`rib`, `children` on the two headers (+ `showBadge` on `PicksHeader`), `label` on
`StandingsCard`, `children` on `WidgetGrid` — every one defaulting to golf's exact prior
literal value. No golf caller (`TournamentDetail.jsx`, `Picks.jsx`, `DemoTournament.jsx`,
`DemoPicks.jsx`) passes any new prop, so golf renders byte-identically; verified line-by-
line in senior review rather than just asserted (`agents/senior-dev/reviews/
cfb-ui-phase1-foundation.md`).

**Why:** `docs/CFB_BUILD_PLAN.md`'s Finding 1 flagged these shells as hardcoding golf's
colors/labels/widgets inline, which would have forced CFB to fork its own copies (and
then the two sports' shells drift the moment either changes) rather than the "shared
chrome, per-page data source" pattern the rest of the app relies on. Prop-ifying with
golf-matching defaults keeps the one-shell-both-sports guarantee CLAUDE.md documents.

**What we gave up:** nothing — this is additive and backward-compatible by construction
(default parameters), not a rewrite.

**Revisit if:** a third sport needs a shell customization these props can't express (e.g.
a fundamentally different header layout, not just different colors) — that's the signal
to stop prop-threading and consider a real theme-object/render-prop redesign.

## 2026-08-13 — CFB: slate import automated (hourly poller), not manual per-week admin action

**Decision:** Replaced the PR3 admin-triggered `importWeekSlate()` flow with
`supabase/functions/poll-cfb-lines/index.ts` — an hourly, service-role poller that pulls
ONE season-wide CFBD fetch set (`/games`+`/lines`+`/teams/fbs`) per active season and fans
the shaped rows onto every pool's `cfb.weeks` for that `(season, week_number)`, deduped.
Admins set title/lock/weeks/stake at pool creation and never import a slate by hand;
`CfbPoolOps.jsx` (`src/pages/admin/cfb/CfbPoolOps.jsx`) now shows auto-slate status plus a
single "Refresh slates now" override (`refreshCfbSlates()` in `src/lib/cfb.js`) instead of
a per-week "Import slate" button. The CFBD→`cfb.games` transform
(`chooseLine`/`favoriteFromFormattedSpread`/`buildGameRows`) moved server-side into
`supabase/functions/_shared/cfbSlate.ts` — `src/lib/cfb.js` no longer shapes CFBD data at
all, since import is server-only now. **CFB has no admin "odds" step, unlike golf's
odds-market pick at pool creation — spreads ARE the CFBD lines, pulled automatically.**

**Why:** A real pull against 2025 season data showed betting lines only post ~1-2 weeks
before kickoff (Week 1 = 51 games with a line, Week 3 = 0), so a season's slate cannot be
imported upfront the way golf imports a tournament field once. An hourly poll keeps every
pool's pickable slate current as lines roll in, without an admin remembering to click
"import" on a rolling cadence for the life of the season.

**Spread freeze at kickoff:** the poller only writes games where `now < kickoff_at`; once a
game kicks off its `home_spread` is left alone (frozen at the last pre-kickoff value = the
closing line), both so "the line at kickoff" is the number displayed forever after and so
the poller can never clobber `poll-cfb-scores`, which owns status/scores/live once a game
starts. Per-pick grading still uses each player's own frozen `locked_spread` from submit
time, unaffected by this.

**Spread history:** `cfb.spread_history` (migration `20260813010000_cfb_spread_history.sql`)
logs a snapshot — keyed by the real `cfbd_game_id`, not a per-pool `cfb.games` row, since all
pools share the same real line — only when a game's spread actually moves since the last
poll, for a future line-movement UI (`getSpreadHistory()` in `src/lib/cfb.js`). Authenticated
users can read it; only the poller (service role) and admins write it.

**Gave up:** `cfd-proxy` (PR3) stays deployed but is no longer called from the browser —
`poll-cfb-lines` calls CFBD directly with its own service-role key rather than going through
the admin-JWT-gated proxy, since it now runs server-side on a cron, not from an admin
session. Left in place rather than deleted; unused, not broken. Senior review also caught and
fixed a scale bug before merge: the poller's change-detection read was changed to one
representative `cfb.event_details` row per season (all pools on a season share the same real
games/spreads) instead of every pool's own game copies, which would have multiplied with pool
count and risked truncating past PostgREST's row cap at ~20 pools — see
`agents/senior-dev/reviews/cfb-auto-lines-poller.md`.

**Deploy note:** the `spread_history` migration, `poll-cfb-lines` function deploy, and arming
its hourly cron are all deferred to PR9 (same CFB prod-as-dev pattern as every prior CFB PR) —
not applied to prod as part of this merge. PR9 now arms **three** CFB crons total: hourly
slate/lines (`poll-cfb-lines`), ~1-minute live scores (`poll-cfb-scores`), and weekly grading
(`grade-cfb-week`).

**Revisit if:** CFBD's free-line-window assumption changes (e.g. lines start posting a full
season ahead), which would make upfront import viable again and the poller unnecessary
overhead; or if `cfd-proxy` sits unused long enough that it's worth deleting outright.

---

## 2026-08-13 — CFB: per-pool events, not one shared event per season (supersedes PR1's original note)

**Decision:** CFB pools use **per-pool `public.events` rows** — each pool gets its own event,
`cfb.event_details`, `cfb.weeks`, and `cfb.games`, exactly like golf's per-pool event pattern
(`createGolfPool`/D3). This **supersedes** the assumption written into `docs/CFB_BUILD_PLAN.md`'s
original schema sketch (and echoed in `agents/pm/PM.md`/`agents/senior-dev/reviews/
cfb-pr1-schema-scaffold.md`) that "CFB's `event_id` = one season, shared by every pool on that
season." That assumption never shipped in working form and is now formally wrong — fixed in this
PR's doc-sync, not just noted.

**Why:** A founder requirement surfaced while building CFB admin pool creation (PR #46): two pools
on the same real season need to be able to start at different weeks and carry different lock
schedules, and each pool's admin should only see that pool's own weeks. A single shared
season-level event can't represent "pool A starts Week 1, pool B starts Week 4" — there's only one
`cfb.weeks` row per `(event, week_number)`. Per-pool events fix this the same way `createGolfPool`
already solves "multiple pools, each with its own settings" for golf. The grading and live-score
functions (`grade-cfb-week`, `poll-cfb-scores`, `_shared/cfbGrading.ts`) already dedupe CFBD calls
by the *real* `(season, week_number)` across events rather than assuming one DB row per real game —
so they needed zero changes to keep working under per-pool events.

**What shipped to make it safe:** `cfb.games` was re-keyed from a **global**
`UNIQUE (cfbd_game_id)` (PR1's original constraint) to `UNIQUE (week_id, cfbd_game_id)` — migration
`20260813000000_cfb_games_per_week_unique.sql`. Under the old global key, a second pool importing
an overlapping week would silently steal the first pool's game rows via the upsert's `onConflict`.
`importWeekSlate`'s upsert now targets `onConflict: 'week_id,cfbd_game_id'` to match. Caught by
senior review's first pass (CHANGES NEEDED) on this PR; the re-key + re-review (APPROVE) both
landed in-branch same day. `docs/CFB_BUILD_PLAN.md`'s schema sketch, PR sequence, and status
header are corrected in this doc-sync rather than left to silently contradict the code.

**Gave up:** Admin slate imports now scale with `(pools × weeks)` instead of `(seasons × weeks)` —
two pools on the same real season each spend their own CFBD import calls for an overlapping week,
rather than sharing one import. Live-score cost is unchanged (`poll-cfb-scores`'s `/scoreboard`
call is already global-per-tick, independent of pool count). Founder-accepted as the price of
per-pool flexibility, same shape as golf's per-pool leaderboard polling (see
`per_pool_per_event_polling` in project memory).

**Revisit if:** CFB pool counts per season grow large enough that redundant per-pool imports
meaningfully approach the CFBD monthly cap (30k/mo at Tier 2) — at that point a shared-import-cache
layer (import once per real `(season, week)`, fan into every pool's `cfb.games` rows) would be
worth building, but is not needed at expected pool counts today.

---

## 2026-08-13 — CFB: live in-game scores added to the build (scope insert between PR5 and PR6)

**Decision:** Founder requested in-app live scores for CFB — a player should be able to watch
their pick's score/clock/possession inside Poold instead of switching tabs. Approved and built
immediately as a data-layer-only PR inserted between `docs/CFB_BUILD_PLAN.md` PR5 (grading) and
PR6 (picks UI), rather than folded into PR6/7 or pushed to the end of the sequence. What shipped:
migration `20260812120000_cfb_live_scores.sql` (additive `cfb.games.live jsonb`),
`supabase/functions/poll-cfb-scores/index.ts` (the live poller), and the `MONTHLY_CAP` bump
1000→30000 across `cfd-proxy`/`grade-cfb-week`/`poll-cfb-scores`. UI consumption is still PR6/7;
cron arming and the prod deploy are still PR9.

**Why:** A CFBD **Tier 2** upgrade (30k calls/mo, unlocking the `/scoreboard` endpoint) makes this
cheap: `/scoreboard` returns the entire live FBS slate in ONE call, so live polling costs one API
call per tick regardless of games/pools/players — the same economics that make golf's
per-tournament leaderboard dedup affordable. Shipping the data layer now (schema + poller +
shared grading) rather than bundling it into the picks/leaderboard UI PRs keeps each PR
single-purpose and lets PR6/7 consume `cfb.games.live` as a plain column instead of building the
ingestion path themselves.

**Gave up:** Nothing structural — this is additive and reversible (drop the column, delete the
function). The PR sequence in `docs/CFB_BUILD_PLAN.md` grows by one inserted step; nothing already
shipped had to be redone.

**Revisit if:** live scores turn out not to be worth the Tier-2 spend once real usage data exists
(unlikely — Tier 2 is now load-bearing for the whole CFB build, not just this feature).

---

## 2026-08-13 — CFB: live poller triggers grading on final (confirmed), shared via `_shared/cfbGrading.ts`

**Decision:** Confirms an earlier founder call: when the live poller (`poll-cfb-scores`) sees a
game flip to final, it grades that week and recomputes standings immediately, so standings move
live as games end rather than waiting for `grade-cfb-week`'s scan. `grade-cfb-week` remains the
manual/backfill grader (targeted `{week_id}` or "scan everything due"). To avoid two grading
implementations that can drift, the grading logic (`gradeWeek`, `recomputeStandings`) was
extracted verbatim out of `grade-cfb-week` into `supabase/functions/_shared/cfbGrading.ts`, which
both functions now import — `grade-cfb-week`'s behavior is unchanged (senior-reviewed, confirmed
byte-for-byte equivalent on its normal path).

**Why:** "Standings move live" is the whole point of the feature; deferring grading to a separate
scheduled scan would make the live poller update scores but not points, which is a confusing half
of the feature. Sharing one grading module rather than duplicating the logic in the poller removes
the risk of the two graders silently disagreeing on a scoring edge case.

**Gave up:** Nothing — `gradeWeek` gained one additional branch (trust an already-`final`-in-DB
game when the live poller's partial `/scoreboard` map doesn't include it, so a multi-game week
doesn't get un-finalized mid-slate); it's inert for `grade-cfb-week`'s full-week `/games` map,
which always includes every game.

**Revisit if:** a future format wants grading to happen only on an explicit admin action (not
automatically on final) — would need a flag to disable the poller's grade-on-final path.

---

## 2026-08-13 — CFB: live-poller look-ahead tightened to 30 minutes (judgment call, PR9 must confirm)

**Decision:** The live poller's "is anything worth polling right now" gate originally used an 18h
look-ahead (any non-final game with `kickoff_at` within the next 18 hours counted as "live
window," alongside a 6h after-kickoff tail). Senior review found this would spend one CFBD call
per cron tick for most of a game day *before* any game had actually started — idle spend with no
score to show for it, risking the 30k/mo Tier-2 cap over a full season. Tightened in-branch to 30
minutes: still enough to catch any kickoff within one future ~1-minute cron tick (PR9), but
eliminates hours of pre-game dead-air polling.

**Why:** My (PM) judgment call to unblock this PR rather than leave the finding open — 30 minutes
is a defensible number (cron cadence + margin) but it's a guess, not a founder-confirmed value.

**Gave up:** Nothing functional; a real edge case (an early/moved kickoff outside the 30-min
window) would be caught on the very next poll once `kickoff_at` enters the window, so the cost is
a few minutes of delay on the very first live update for that game, not a missed game.

**Revisit if / must-do:** **flagging for PR9 explicitly** — the founder needs to confirm (a) the
30-minute figure, and (b) the broader cron-cadence question the senior review raised: a windowed
schedule like golf's `poll-thursday..sunday` (business hours only) vs. year-round every-minute.
Both numbers together determine whether the live-scores feature survives a full season on the 30k
cap. Not a merge blocker for this data-layer PR (the cron isn't armed here) — but PR9 must not
arm the cron without settling this.

---

## 2026-08-13 — CFB: live-scores deploy steps deliberately deferred to PR9

**Decision:** This PR does not push the migration to prod, does not deploy `poll-cfb-scores` or
the updated `grade-cfb-week`/`cfd-proxy`, does not set any new secrets or `verify_jwt` config, and
does not arm any cron job. All of that is deferred to PR9, matching the CFB "prod-as-dev, defer
the deploy" pattern already used for PR1–PR5.

**Why:** Consistent with every prior CFB PR — while there are no real users, prod doubles as the
CFB dev DB, and deploy/cron-arming is batched into PR9 (the dedicated admin-ops PR) rather than
spread across every data-layer PR. Also: the exact CFBD `/scoreboard` field names
(`period`/`clock`/`possession`/`situation`/`last_play`) are read defensively but unconfirmed
against a real Tier-2 response — worth verifying once, at UI-wiring time, rather than deploying
speculatively now.

**Gave up:** Nothing — this is sequencing, not a scope cut. The migration is additive and
reversible whenever it does land.

**Revisit if:** PR9 slips significantly and live scores become blocking for a launch — could pull
just the migration + function deploy forward without waiting for the rest of PR9's admin-ops
scope.

---

## 2026-08-12 — CFB PR5: double-down minimum-line rule declined; `effectiveDoubleDownLine` added instead

**Decision:** Considered requiring a minimum spread (e.g. 5.5) for a pick to be double-down
eligible, to stop a bettor from "farming" a bonus point off a coin-flip favorite. **Declined** —
the existing 4-point buffer floor (`doubleDownBuffer`) already blocks that: a small favorite like
Georgia `-1.5` earns the cover point on any win but needs to win by 6+ to also clear the buffer
and earn the double-down bonus, so there's no free bonus to farm. Instead of a gating rule, added
a pure helper, `effectiveDoubleDownLine(lockedSpread) = lockedSpread - doubleDownBuffer(lockedSpread)`,
returning the buffer-adjusted line in the picked team's own sign convention (favorite `-1.5` →
`-5.5`; `+7` underdog → `+3`). It doesn't change any scoring rule; it exists so PR6's picks UI can
render the real bar a double-down has to clear ("this pick is really `-5.5`") instead of leaving
players to infer the buffer math themselves.

**Why:** A minimum-line gate would be a second, redundant floor on top of one that already works,
adding a rule surface with no scoring benefit. The buffer already does the job; the gap was
communication, not rules, so the fix is a UI-facing helper, not a new constraint.

**Gave up:** Nothing — no scoring behavior changed. `effectiveDoubleDownLine` is additive (JS
engine + TS mirror, covered by the shared fixtures/parity test).

**Directive for PR6:** surface `effectiveDoubleDownLine`'s output in the double-down copy, not
just the raw locked spread.

**Revisit if:** live play shows the buffer floor isn't actually deterring farming in practice
(unlikely — it's the same arithmetic already unit-tested in PR4).

---

## 2026-08-12 — CFB PR5: stuck-week finalization deferred to PR9

**Decision:** `grade-cfb-week` only marks a week `graded` once every game in it reports
`completed: true` from CFBD. A cancelled, postponed, or rescheduled game leaves the week stuck at
`locked` forever, and scan mode re-fetches CFBD for that week on every cron run (one call against
the 1000/mo cap, per run, indefinitely) since it stays outside `status = 'graded'`. Senior review
(`agents/senior-dev/reviews/cfb-pr5-grading.md`, Finding 1 / Question 1) flagged this. **Decision:
punt to PR9** — when the admin grading UI and cron wiring land, add both an admin "finalize week
as-is" override and treat a game the provider stops returning as a no-contest so the week can
still reach `graded`. Safe to defer because nothing auto-triggers the grader yet (no cron, no
admin button) — PR5 ships as pure library/edge-function code with zero live callers.

**Why:** A truly stuck game is rare (most weeks fully finalize within a day) and the fix requires
UI (an admin decision point), which doesn't exist until PR9 anyway. Building the override now
would be speculative — no caller could reach it.

**Gave up:** Some near-term cap-safety margin — a single genuinely stuck week between now and PR9
would burn one CFBD call per cron run if the cron were live. Not a live risk today since PR9 is
what wires up the cron.

**Revisit if:** PR9 is delayed and a manual/interim cron gets wired up before then — the override
would need to land first.

**MUST be handled in PR9** — tracked in `docs/CFB_BUILD_PLAN.md`'s PR9 row.

---

## 2026-08-12 — CFB PR5: manual grade-by-id lock guard deferred to PR9

**Decision:** The scan path in `grade-cfb-week` only grades weeks whose `lock_time` has passed;
the targeted `{week_id}` path (built for PR9's future "Grade week" admin button) has no such
check today, so an admin could in principle grade a week that's still open for picks. Senior
review (`agents/senior-dev/reviews/cfb-pr5-grading.md`, Question 2) flagged it. **Decision: defer
the guard to PR9**, when that admin button actually gets a caller — it's a one-line addition
(`lock_time IS NOT NULL AND lock_time <= now()`) and there is no live caller of the by-id path
today (PR5 ships `gradeCfbWeek(weekId)` in `src/lib/cfb.js` as an unused invoker; no UI wires it
until PR9).

**Why:** No code path can trigger this today, so adding the guard now is speculative work ahead
of its consumer. It's cheap enough to land alongside PR9's admin button with full context.

**Gave up:** Nothing live — idempotent re-grading after the true lock also self-corrects any
early manual grade, so the risk window is small even once PR9 ships.

**MUST be handled in PR9** — tracked in `docs/CFB_BUILD_PLAN.md`'s PR9 row.

---

## 2026-08-12 — CFB PR4: double-down is legal on an underdog ATS pick; UI copy must phrase it generally

**Decision:** A double-down flag may be placed on any of the 5 ATS picks, including one where
the picked team is the underdog getting points (e.g. a `+10` pick, buffer `5`, which clears by
losing by 4 or fewer, or winning outright). Senior review on PR4
(`agents/senior-dev/reviews/cfb-pr4-scoring-engine.md`, Question 2) flagged that `cfbScoring.js`'s
`gradeDoubleDown` already scores this case correctly, but the UI copy helper
(`doubleDownWinBy`) was documented as if the flagged pick were always a favorite, returning a
negative, nonsensical "win by −4" for a dog. The founder chose to **allow** the underdog
double-down (the alternative — restrict double-downs to favorites and enforce it at submit —
was also on the table and rejected) and fix the *documentation/consumption* contract instead of
the rule: `doubleDownWinBy` now returns a **sign-general** margin threshold (positive for
favorites, negative for underdogs) and its header comment spells out both readings. No scoring
logic changed — the arithmetic was already correct; only the doc comment and two new tests
(pinning the underdog case) landed in this PR.

**Why:** Restricting double-downs to favorites would be an arbitrary rule with no basis in
`docs/CFB_FORMAT.md` (which never says the DD must be a favorite pick) and would remove a
legitimate, students-of-the-game strategic choice — flagging a live underdog is a real, exciting
decision, not an edge case to design away. The engine handles it for free; the only real cost is
that PR6's picks-UI copy layer must branch on sign ("win by X+" for favorites vs. "cover by more
than N" / "keep it within N" for underdogs) instead of using one static string template.

**Gave up:** A simpler picks-UI copy layer (one string template, no sign branching) — not worth
it for removing a real strategic option from players.

**Revisit if:** PR6 finds the sign-branching copy genuinely can't read naturally in the UI
(unlikely — it's two template strings selected on `doubleDownWinBy`'s sign, not a formula in the
UI). See `docs/CFB_BUILD_PLAN.md`'s design-direction section for the concrete phrasing note.

---

## 2026-08-12 — CFB PR4→PR5: guard JS/TS scoring-engine drift with shared fixtures, not a comment

**Decision:** PR5 will add the authoritative, server-side grader as a hand-kept TypeScript
mirror of `src/utils/cfbScoring.js` (`supabase/functions/_shared/cfbScoring.ts`), because Deno
edge functions can't cleanly import from `src/`. Senior review on PR4
(`agents/senior-dev/reviews/cfb-pr4-scoring-engine.md`, Question 1) flagged that this means the
load-bearing scoring math will exist in two languages, edited by hand, with only the JS side
under test — the TS grader could silently diverge from the tested arithmetic and nothing would
catch it. The founder decided: **when PR5 lands, extract the worked-example cases (the buffer
rounding boundaries, DD thresholds, underdog tier edges, the underdog-DD case from the entry
above) into a shared fixtures file that both the existing JS test suite and a new TS-grader test
consume.** A drift between the two implementations then fails a test, not just a code-review
glance at a "keep these in sync" comment.

**Why:** Server-authoritative grading (so users can't grade their own picks) is the right
integrity call and isn't being revisited — but "keep two files in sync by hand" is exactly the
kind of promise that erodes silently over a season of edits. A shared fixtures file makes the
sync requirement mechanically enforced instead of a documentation convention, for close to zero
extra cost (the fixtures already exist as worked examples in `docs/CFB_FORMAT.md` and PR4's test
file — this is packaging them for reuse, not writing new cases).

**Gave up:** Nothing real — this is additive scaffolding for PR5, not a scope cut. The
alternative (a manual "keep in sync" comment only) was rejected as insufficient.

**Revisit if:** PR5's shared-fixtures approach turns out to be awkward across the JS/TS
boundary (e.g. fixture format needs per-language transforms) — fall back to a documented manual
sync with a stronger comment, but treat that as a downgrade to flag, not the default.

---

## 2026-08-12 — CFB PR3: cross-check CFBD's spread sign against its own text label; skip and warn on disagreement

**Decision:** `src/lib/cfb.js` computes the underdog purely from the sign of CFBD's
numeric `home_spread` — the entire ATS/underdog contract rests on that one number, with no
second data source to corroborate it (golf, by contrast, joins Slash Golf + The Odds API
and refuses an ambiguous match rather than guess). Senior review on PR3
(`agents/senior-dev/reviews/cfb-pr3-slate-import.md`, Finding 1 / Question 1) flagged this
as a silent-failure risk: if CFBD ever flips its sign convention, every underdog would be
computed backwards with no error. The founder chose a code-level tripwire over "re-run the
smoke test each season": `buildGameRows` now also reads CFBD's own `formattedSpread` text
label (e.g. `"Michigan -17.5"`, which names the favorite in words) via the new
`favoriteFromFormattedSpread()` helper, and compares it against the favorite implied by the
numeric sign. On disagreement, the game is skipped entirely (excluded from that week's
importable slate) and a `console.warn` is logged — not silently imported with a guessed
side.

**Why:** A wrong underdog freezes into `locked_spread` at submit time and grades wrong with
no downstream signal — the exact "confidently wrong beats silently missing" failure this
whole app tries to avoid elsewhere (see the 2026-07-13 player-name-matching decision, same
principle). CFBD already ships both snake_case and camelCase field names across versions,
so a sign-convention drift isn't a hypothetical. The text label is redundant information
CFBD already sends on every line — reading it costs nothing extra and turns a silent
mis-grade into a loud, recoverable gap (one missing game from the week's slate) instead.

**Gave up:** A game gets excluded (not corrected) when the two disagree — there's no "trust
the label over the number" fallback, because we don't know which one drifted. Also gave up
on a second independent data source (golf's approach); CFBD stays the sole provider for
CFB, this is a self-consistency check on one provider, not real corroboration.

**Revisit if:** the warn-and-skip starts firing in real seasons (would mean CFBD's
convention or label format actually changed) — at that point, add real alerting instead of
a console log an admin has to be watching for, and re-derive the sign mapping fresh rather
than patching around it.

---

## 2026-08-12 — CFB PR3: `importWeekSlate` asserts the target week's number/season match the CFBD week being pulled

**Decision:** `importWeekSlate({ weekId, seasonYear, weekNumber })` takes the stored
`cfb.weeks` row to write into (`weekId`) and the CFBD slate to fetch (`seasonYear` +
`weekNumber`) as separate arguments with nothing previously checking they refer to the same
week. Senior review on PR3 (Finding 3 / Question 2) flagged this as a silent-miswire risk
once an admin UI wires the two together (PR9). The founder chose to add the guard now
rather than defer it: before fetching anything, the function reads the stored week's
`week_number` (and its season via `event_details`, split-query per the public/`cfb`
boundary discipline) and throws if either disagrees with what was passed.

**Why:** Cheap now (one extra read, pure function, no new schema) versus a real production
failure mode later — a wrong week wiring in the eventual admin UI would silently store one
week's games under another week's id with no DB-level error, and nobody would notice until
players saw the wrong slate. Fixing it while the only caller is `importWeekSlate` itself
(no admin UI yet, PR9) means the guard ships before the risk exists, not after.

**Gave up:** Nothing meaningful — one extra query per import call, which already makes
three sequential CFBD fetches, so the added latency is negligible.

**Revisit if:** never — this is a permanent input-validation guard, not a stopgap.

---

## 2026-08-12 — CFB PR3: CFBD monthly call cap confirmed at 1000, not reused from golf's placeholder

**Decision:** `docs/CFB_BUILD_PLAN.md`'s original sketch flagged golf's `1800`
(`slash_golf_calls`) cap as a placeholder not to reuse for CFBD without checking real
limits (open question #4). The founder confirmed CollegeFootballData's free tier is
**1000 calls/month**; `cfd-proxy`'s `MONTHLY_CAP` is set to `1000` and `api_usage
.cfbd_calls` (mirroring `slash_golf_calls`) tracks it with the same read-then-write
per-call pattern golf uses (BACKLOG B4's lost-update race — "Non-atomic monthly API
counter" — applies equally here; note the senior review artifact cites this as "B5," which
is actually the unrelated `submitPicks`-atomicity item, but the described bug matches B4
exactly. Not re-flagged as new since PR3's three fetches already run sequentially by
design).

**Why:** Sizing the cap to the vendor's actual limit, not a copy-pasted number from a
different API, is the whole point of tracking usage at all — an oversized cap risks a
mid-season 429 lockout during live import, and reusing golf's number was never anything
more than a placeholder to unblock scaffolding.

**Gave up:** Nothing — this just closes an open question, it doesn't trade anything away.

**Revisit if:** CFBD's account is upgraded to a paid tier, or usage patterns (weekly slate
import across many weeks/pools) approach the cap in practice.

---

## 2026-08-11 — CFB PR2: `cfb.picks` gets NO client write policy at all — the submit RPC is the only door, not a defense-in-depth layer

**Decision:** `docs/CFB_BUILD_PLAN.md`'s original RLS sketch called for row-level
insert/delete policies on `cfb.picks` "mirroring golf's, for defense-in-depth," on top of
the `cfb_submit_week_picks()` RPC being the "real" enforcement. PR2 (`agents/senior-dev/
reviews/cfb-pr2-rls-and-submit-rpc.md`) shipped without that row-level layer: there is no
client insert/update/delete policy on `cfb.picks` at all. RLS-on plus no matching policy
means a normal authenticated user's direct write is denied outright; the only way onto
the table is the `SECURITY DEFINER` RPC.

**Why:** Golf's picks RLS can validate row-by-row because one golf pick is independently
legal (one tier, one player). A CFB weekly card is a **set constraint across 6 rows** —
exactly 5 ATS on 5 distinct games, 1 underdog on a 6th, ≤1 double-down only on an ATS
pick. Postgres RLS evaluates one row at a time and cannot express "these 6 rows together
are a legal card." A permissive per-row write policy sitting *next to* the RPC wouldn't
be extra safety — it would be a second door that a crafted API call could walk through to
insert e.g. 6 ATS picks or two double-downs, each individually passing a per-row check
while corrupting the card. Removing that door entirely, rather than writing one that
"defends in depth," is what actually closes Finding 2 (`docs/CFB_BUILD_PLAN.md`).

**Gave up:** The row-level policies golf-style defense-in-depth would have provided
against a bug *inside* the RPC itself (e.g. a future edit to the function that
accidentally skips a check) — there's now exactly one code path guarding card integrity,
not two. Accepted because a second, weaker guard that permits partial/invalid writes is
worse than no guard, not safer.

**Revisit if:** a future requirement needs a legitimate direct-row write on `cfb.picks`
(e.g. a per-pick admin correction tool) — that should get its own narrow `SECURITY
DEFINER` RPC re-validating the whole card, not a raw RLS policy.

---

## 2026-08-11 — CFB PR2: a week is "open" once its slate exists and `lock_time` hasn't passed — not gated on the `status` label

**Decision:** `cfb_submit_week_picks()` rejects a submission only when
`weeks.status IN ('locked','graded')` or `weeks.lock_time <= now()`. It does **not**
require `weeks.status = 'open'` first — a week seeded `'scheduled'` is already pickable
as soon as its games are imported and the lock time is still in the future. Raised as
senior-review Question 3 on PR2; the founder confirmed this is the intended behavior, not
an oversight.

**Why:** `lock_time` is the actual deadline players see and the actual moment picks stop
counting — it's the one date that has to be correct. Requiring a separate `'open'` flip
would just be a second manual step admins could forget, with no player-facing benefit: a
player literally cannot build a legal 6-pick card until the week's games are imported
regardless of the status label (the RPC's "game must belong to this week" check fails on
an empty slate). So the status label is informational for admin tooling; `lock_time` plus
"do games exist yet" is what actually governs pickability. This mirrors golf's permissive
style (picks open as soon as the tournament/field exists, not behind a second toggle).

**Gave up:** No admin "soft off" switch to pause picks on a week whose slate is imported
but not yet meant to be pickable (e.g. lines still being finalized) — the only lever is
`lock_time` and whether games exist. If that gap matters in practice, add an explicit
`status = 'open'` gate to the RPC then; it's a one-line change.

**Revisit if:** slate import (PR3) ever needs to stage partial/unconfirmed lines before a
week should be pickable — right now "games exist" and "week is pickable" are the same
moment, and that would need to split.

---

## 2026-08-11 — CFB PR1: schema enforces game∈week and week uniqueness at the database level, not just in the future RPC

**Decision:** Senior review of the `cfb` schema scaffold (PR1, PR #40) raised four
foundation-shape questions before any data existed in the new tables — cheap to fix then,
expensive after. All four were accepted and shipped in the same migration:

1. **`UNIQUE (event_id, week_number)` on `cfb.weeks`.** A CFB event is one season shared
   by every pool on it (unlike golf, which mints a fresh event per pool), so a re-run of
   season setup — or a second pool created against the same season — could otherwise
   double-insert "Week 5" with no way to tell which row a game belongs to.
2. **A composite FK, `cfb.picks (game_id, week_id) → cfb.games (id, week_id)`.** The plan
   (`docs/CFB_BUILD_PLAN.md`) always intended the PR2 `cfb_submit_week_picks` RPC to be
   the enforcement point for "this pick's game is actually in this pick's week." We chose
   to *also* make it structurally impossible at the schema level, for near-zero cost while
   the tables are empty, rather than trusting one code path alone. Belt-and-suspenders,
   not a replacement for the RPC — PR2 still validates the whole weekly card as a set,
   which no FK can express.
3. **`CHECK` constraints on the remaining enum-shaped text columns** (`weeks.status`,
   `games.status`, `picks.result`) — `picks.pick_type` already had one; the others didn't,
   which was an inconsistency the review caught. A future typo in server code now fails
   loudly at write time instead of silently writing a bad value that would poison grading
   or standings later.
4. **`cfb.event_details.season_year` is `NOT NULL`.** It's always known at event creation
   and is the defining attribute of a CFB event; nullable was only ever an artifact of the
   scaffold being unpopulated.

**Why now, not later:** all four are one-line additions on tables with zero rows. Once
real weeks/games/picks exist, adding a uniqueness constraint or a composite FK means
dedup­ing live data first — a materially more expensive and riskier change.

**What we gave up:** nothing functional — these are pure guardrails, not scope. The
schema is marginally less "minimal" than the original `docs/CFB_BUILD_PLAN.md` sketch,
which is now updated to match what shipped.

**What would make us revisit:** if a legitimate write path needs a week status or pick
result value outside the current enums, the fix is widening the `CHECK`, not removing it.

---

## 2026-08-11 — CFB chosen as sport #2, against the docs' own recommendation; full sport-layer siloing; FormatEngine still deferred

**Decision:** Six calls, made in one planning pass (PR0, PR #39, `docs/CFB_FORMAT.md` +
`docs/CFB_BUILD_PLAN.md`, both docs-only — no code shipped):

1. **College football is sport #2**, format = weekly against-the-spread, season-cumulative
   (5 ATS picks + 1 optional double-down + 1 mandatory tiered underdog, all-or-nothing
   submission, full random auto-fill on a missed deadline, single join cutoff before Week 1).
2. **Full siloing of the sport layer** — CFB gets its own `cfb` Postgres schema, its own
   `src/lib/cfb.js` seam, its own scoring engine, picks UI, theme/badge, and data-provider
   proxy. CFB code never imports golf and vice versa. The one shared shape is the standings
   **output**: both sports write the normalized `{ rank, total, display }` projection into
   `public.pool_standings`, so the dashboard renders either sport with zero sport-specific
   branches. This finally puts `pool_standings` to work — scaffolded but unused since Phase 1
   (BACKLOG F1).
3. **No FormatEngine abstraction (BACKLOG F6) extracted now**, even though F6's own stated
   trigger — "the moment format #2 is being designed" — has technically fired. Two dissimilar
   formats (golf's best-N-relative-to-par vs. CFB's weekly ATS grading, sharing zero logic) is
   judged too few examples to derive the right interface from; extracting now risks the
   wrong-abstraction-from-too-few-examples failure mode. Revisit at format #3.
4. **Single data vendor:** the CollegeFootballData API supplies schedule, scores, *and*
   lines — The Odds API is not used for CFB. Spreads are frozen per pick (`locked_spread`)
   at submission for grading, since the line can move before kickoff.
5. **Three findings from reading the golf code, adopted as build constraints:** (a) the
   "shared" pool shells (`PoolHeader`, `PicksHeader`, `WidgetGrid`, `StandingsCard`) hardcode
   golf styling today and must be prop-ified before CFB can reuse them; (b) golf's row-by-row
   `golf.picks` RLS can validate one pick at a time but cannot express CFB's whole-card set
   constraint (5 distinct ATS games + 1 distinct underdog game + ≤1 double-down), so CFB's
   submit path is a `SECURITY DEFINER` RPC, `cfb_submit_week_picks`, not row policies; (c)
   `Join.jsx` — which looks a pool up by join code alone and hardcodes golf's copy/route
   today — is the real forcing function for sport-dispatch, resolved via a new thin neutral
   `src/lib/pools.js` that reads only `public.*` to learn a pool's `sport_id` before either
   sport module is imported.
6. **Structural note:** a CFB pool spans a season of weekly pick windows with cumulative
   scoring — golf's one-lock-per-pool model has no week concept, so `cfb.weeks`/a per-week
   pick-window model is genuinely net-new, not a golf pattern reused.

**Why:** Every strategy doc that has weighed in on sport #2 — `docs/BRAINSTORM.md`
(Obs.1/§A: "NFL is the second sport" is backwards; team sports are the *most expensive*
second sport and reuse zero lines of golf) and `docs/MULTI_SPORT_MIGRATION.md` (D1: team
sports "won't reuse the golf shape") — recommends a golf-shaped sport first (F1, UFC, the
Derby, awards shows) specifically because it's cheap: same tiered-pick shape, same schema
pattern, same scoring family. CFB is the opposite of that recommendation on every axis: new
schema, new format, new data provider, new theme, zero golf reuse. **The founder is
proceeding with CFB anyway.** This entry exists so that choice reads as a deliberate,
eyes-open call — not a case of the docs' own advice being missed.

**What we gave up:** The cheap-second-sport path (F1/UFC/Derby/awards) that would have
validated multi-sport for a fraction of the cost and proved the schema seam before taking on
a genuinely new contest shape. Also: F6's extraction is deferred a second time, at the exact
moment its own trigger condition says not to — a conscious bet that two data points still
isn't enough to abstract from, weighed against the forensic-untangling cost F6 warns about if
deferred past 3+ formats.

**Revisit if:** CFB's build reveals the golf/CFB scoring engines share more structure than
expected (then F6 might be worth doing at 2 formats after all, not 3) — or if the schema/UI
work turns out cheaper or more expensive than the ~11-PR estimate, which should feed back into
whether "expensive team sport first" was the right call for future retrospective honesty.

---

*Older decisions (2026-08-10 and earlier) are in [`DECISIONS_ARCHIVE.md`](DECISIONS_ARCHIVE.md). Grep spans both files; only this one takes new entries (append at the top, under the header).*
