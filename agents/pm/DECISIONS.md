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

---

## 2026-07-14 — The crawler gets an RPC, not a service-role key

**Decision:** Link previews are rendered by a Netlify **edge function** that rewrites the
OG tags in the served HTML. To read pool data it calls `public.pool_preview(code)` — a
`SECURITY DEFINER` RPC with a fixed, five-field projection, granted to `anon`. We
explicitly **did not** give the edge function a Supabase service-role key.

**Why an edge function at all (and not React):** crawlers — iMessage, WhatsApp, Slack,
Discord, Signal, Twitter — fetch the URL and read `<head>` **without running JavaScript**.
We are an SPA: every route serves the same `index.html` and React paints afterwards, long
after the crawler has gone. Meta tags set from React are *structurally* invisible to the
thing that needs them. This is not a preference; it is the only place the fix can live.

**Why not the service-role key:** it is the obvious way to let an anonymous request read a
row that RLS protects, and it would have taken ten minutes. It also bypasses RLS on *every
table in the database*, and it would have been sitting in Netlify's environment — reachable
by any future build script, any dependency in the build, anyone with dashboard access — in
order to serve a preview card. The blast radius of losing that key is the entire database;
the value it was buying is a nicer link. That trade is not close.

**What the RPC gives up instead:** it discloses pool name, organizer display name, course,
pick count, lock time, and badge to anyone holding a **valid join code**. That is not a new
leak — holding the code already lets you join the pool and see all of it, and then some.

**The pattern, stated generally:** when something *outside* the app needs to read something
*inside* it, give it a narrow function, not a wide key. Same instinct as `admin_list_users()`
and `admin_set_role()`; same reasoning as the column-GRANT entry below.

**Revisit if:** a preview ever needs data that can't live behind a safe projection — at
which point the answer is still not the service-role key, it's a signed request.

---

## 2026-07-14 — Nobody plays under a name derived from their email

**Decision:** `profiles.display_name` is chosen by the user, never generated from their
email. New accounts are created with it NULL and are **blocked** at `/welcome` until they
pick one — a wall, not a prompt. Existing users are **not** forced to rename; they get a
short-lived nudge pointing at the "You" tab and change it when they feel like it.

**Why:** The signup trigger had been writing `split_part(email, '@', 1)` into
`display_name` since 2026-06-16. That column is the one piece of identity other players
are *supposed* to read about each other, so it is exempt from the column-GRANT lockdown
that hides `email` — which means we were publishing the local part of every user's email
address to everyone else in their pool, on every leaderboard, for two months. The fix is
not a stronger grant; the column was never the problem. The data we put in it was.

**Why a wall for new users but only a nudge for existing ones:** an account with no name
renders as "Participant" on a leaderboard, which is worse than a bad name — so new
accounts have to clear the bar. Existing accounts already have *a* name; forcing a rename
would interrupt everyone to fix something they may not care about. And a login-time prompt
would have missed them anyway: Supabase keeps sessions alive, so most users never see the
login screen — they go straight to `/dashboard`. That is why the nudge lives in the bottom
nav, not in the auth flow. (Founder's read, and it's correct.)

**What we gave up:** one extra step in the signup funnel — on the invite path, which is
the growth loop, so it is not free. Mitigated by carrying the join code through `?next=`
so the invite still lands in the pool it was for. Also: email-derived names persist on
leaderboards until each user acts, so the leak closes gradually, not at once.

**Mechanism worth knowing:** `display_name_set_at` distinguishes "a human chose this" from
"the old trigger wrote this." It is stamped by a `BEFORE UPDATE` trigger, never sent by the
client, so it cannot be faked to dodge the nudge — and it kept the write path on the plain
`GRANT UPDATE (display_name)` from A1 rather than inventing a second one.

**Revisit if:** the extra step measurably hurts invite conversion (then: let people in and
nudge them instead, accepting "Participant" rows), or if we ever want handles to be unique
(they are not — two Mikes in one pool is currently allowed and fine).

---

## 2026-07-14 — The legal pages say exactly what the code does about money

**Decision:** Shipped public `/privacy` and `/terms`. The load-bearing clause is that
**Poold never processes, holds, escrows, collects, or transfers money** — stakes and
payouts are described as a *convenience calculator* over numbers the commissioner typed
in, settling happens between participants off-platform, and we disclaim any dispute about
who owes what. Utah governing law, 18+, as-is warranty, and an explicit note that
third-party score data can be wrong and the commissioner has the final say on results.

**Why:** The no-money-on-platform rule has been a standing constraint since June (see the
2026-06 entry) and is the legal moat, but it existed only as a *product* principle — there
was no document anywhere telling a user, or a regulator, that this is what the app does.
The prize-pool feature (`stake_amount`, `payout_structure`) makes the app *look* like it
might touch money. Saying plainly that it doesn't is the cheapest protection available, and
it costs nothing precisely because it is true.

**The coupling to remember:** the Terms now describe the code. If a future feature ever
does touch money — Stripe, escrow, payouts, anything — **the Terms must change before it
ships**, and at that point the legal moat is gone and this is a different company. That
constraint is the point of the document, not a footnote to it.

**What we gave up:** consent friction (a line under both magic-link forms), and a small
maintenance burden — the documents are now something that can go stale.

**Known and accepted:** the contact address the documents name, `privacy@getpoold.app`,
**does not exist** — `getpoold.app` has no MX records, so mail to it bounces. The privacy
policy promises deletion on request, so the one channel we advertise for that right is
currently a dead drop. Founder chose to ship anyway rather than block on DNS; tracked as
**A7** in `docs/BACKLOG.md` (🟠) with the ~5-minute forwarding fix and a one-line fallback
(point the docs at the Gmail that does receive mail). This is the weakest line in either
document.

**Revisit if:** we take payments (see above), incorporate somewhere other than Utah, or
the user base stops being "friends of friends" — at which point these want a real lawyer,
not a first draft.

---

## 2026-07-14 — Column access is a GRANT problem, not an RLS problem

**Decision:** Privileged *columns* on `public.profiles` are protected by column-level
GRANTs, and every privileged operation on them goes through a `SECURITY DEFINER` RPC that
re-checks `is_admin()` itself. `anon`/`authenticated` can SELECT only
`(id, display_name, role, status, created_at)` and UPDATE only `(display_name)`.
`admin_list_users()` reads email; `admin_set_role()` writes role. Fixing A1 (PR #24).

**Why:** The instinct on seeing "any user can set `role='admin'`" is to fix the *policy* —
add a `WITH CHECK` that pins `role` to its current value. **That cannot work: Postgres RLS
is row-level and has no column granularity.** A policy can say *which rows* you may touch
and *what the resulting row must look like*, but it cannot say *which columns you may
write*, and expressing "role must not change" inside a policy means either an
`OLD`-referencing check RLS doesn't give you, or a `BEFORE UPDATE` trigger — i.e. a second
mechanism, in a second place, that the next person won't know to look for.

Column GRANTs are the mechanism Postgres actually provides for this, and they're *stronger*
than a policy: **privileges are checked before any policy runs**, so a revoked column is
unreachable regardless of what any current or future policy says. It's the same move C3
made for reads (2026-06-20) — this just applies it symmetrically to writes, so `profiles`
is now locked in both directions by one consistent mechanism.

**Consequence to know:** a plain `supabase.from('profiles').update({ role })` **will fail,
by design.** That is not a bug to route around — it's the fix. Privileged writes get an RPC.

**`admin_set_role()` also refuses a self-role-change.** The admin UI already hid the toggle
on your own row, but that was a UI convention, not an invariant. A sole admin demoting
themselves leaves nobody able to promote anyone, and recovery needs raw SQL. We have locked
ourselves out of admin once already (the coupled-migration incident); once is enough.

**Gave up:** Self-service display-name editing is the only profile write a user can make,
and any *new* self-editable field now needs an explicit `GRANT UPDATE (col)` — a small,
deliberate friction. That's the intended cost: adding a user-writable column to `profiles`
should be a decision, not a default.

**Watch for:** Someone hitting the failed `.update({ role })`, concluding the RLS policy is
"too strict," and re-granting table-level UPDATE to make it work. That silently reopens A1.
The grant is the gate; the policy is belt-and-braces.

**Revisit if:** Postgres ever gains column-level RLS, at which point the two mechanisms
could collapse into one.

---

## 2026-07-13 — The merge guard checks `agents/pm/`, not "any .md"

**Decision:** `merge-guard.mjs` (renamed from `pm-sync-guard.mjs` 2026-07-15) now blocks `gh pr merge` when a substantive diff leaves
`agents/pm/` untouched (and separately, when `src/pages|components` changes without
`docs/PAGES.md`). It previously allowed the merge if **any** `.md` file had changed.
Supersedes the enforcement half of *"Doc sync runs before the merge"* (same date); the
principle there is unchanged.

**Why:** The old check was a proxy that PR #22 walked straight through. That PR updated
`CLAUDE.md`, `docs/PAGES.md`, and added `docs/NAME_MATCHING.md` — three docs, so the
guard saw a well-documented branch and allowed it. But `/pm-sync` never ran, and the PM
docs went stale: two genuinely re-litigable decisions went unlogged and the ROADMAP
status log missed a ship. **Docs written *alongside* the code are not the same as the PM
reconciling the strategy docs against it**, and only the second one is what this hook
exists to force. It failed silently, which is the worst way to fail.

**Gave up:** More merges will now be gated, including small ones where nothing in
`agents/pm/` genuinely applies. That is the intended cost — it converts "no PM docs
needed" from an accident into a claim you have to make out loud via `PM_SYNC_SKIP=1`.

**Known false positive (accepted):** the guard matches the *string* `gh pr merge`
anywhere in a Bash command, so a command that merely mentions it (a test harness, an
echoed payload) is also gated. Deliberately conservative — a spurious block is
recoverable in seconds, a spurious allow is how we got here.

**Revisit if:** The escape hatch starts getting used routinely. That would mean the rule
is miscalibrated and is training us to bypass it, which is worse than no rule at all.

---

## 2026-07-13 — An ambiguous player-name match is refused, not guessed

**Decision:** When joining bookmaker odds onto the Slash Golf field, a fallback match
(same surname + same first initial) is only accepted when **exactly one** candidate
matches. If two players collide, we decline the match and the player shows `N/A` rather
than receiving a best-guess price. `src/utils/playerMatch.js`.

**Why:** The two failure modes are not symmetric. A **missing** price is loud and
cheap — the admin sees `N/A` in the tier builder and drags the player where he belongs.
A **wrong** price is silent: it flows into `impliedProbability` in `tierBuilder.js`,
mis-sorts the player into the wrong tier, and nobody ever finds out. We would rather
under-match and be corrected by a human than over-match and be quietly wrong.

**Gave up:** 100% automatic coverage. Some fields will always have a residual `N/A`, and
that is the intended resting state, not a bug to chase.

**Watch for:** Someone seeing an `N/A` and "fixing" it by loosening the match rule.
That trades a visible gap for an invisible error. If coverage needs improving, add an
alias (`src/utils/nameAliases.js`) — a fact — rather than weakening the rule.

**Revisit if:** We ever get a shared player ID across the two APIs, at which point all
name matching becomes unnecessary.

---

## 2026-07-13 — No LLM for cross-source name resolution

**Decision:** Player names are reconciled between Slash Golf and The Odds API by a
deterministic three-layer resolver — normalize/transliterate → surname + first-initial
fallback → hand-maintained alias table. We considered and **rejected** an LLM fallback
for the names the rules can't reach.

**Why:** The idea is genuinely appealing — the residue is exactly "arbitrary world
knowledge" (Tom Kim is legally Joohyung Kim), which is what an LLM is good at, and the
join runs once per pool creation so cost and latency would be irrelevant. What killed it
was the measurement: after the first two layers, **exactly one name in the entire Open
field still needed help.** Standing up an edge function (the key can't go in the browser
— see A2), plus prompt, schema, and a hallucination-guard for a one-row problem, is not
a trade worth making. A table with one entry beats a model call.

**Gave up:** Automatic coverage of future unknown names. New aliases are manual — that's
a per-season chore, documented in `docs/NAME_MATCHING.md`.

**Revisit if:** The alias table grows past roughly 30 entries, or a season opens with a
double-digit residual after layers 1–2. That would mean the rules stopped generalizing,
and the economics flip.

---

## 2026-07-13 — Docs live where their readers look; PM owns them centrally

**Decision:** PM owns every doc in the repo, but only strategy artifacts (`PM.md`,
`PRODUCT.md`, `ROADMAP.md`, `DECISIONS.md`) physically live in `agents/pm/`. Engineering
references (`docs/PAGES.md`, `BACKLOG.md`, `DESIGN_SPEC.md`, `MULTI_SPORT_MIGRATION.md`)
stay in `docs/`, and `CLAUDE.md` stays at the repo root.

**Why:** The instinct was to consolidate everything under `agents/pm/`. But ownership
and location solve different problems. A dev agent building a feature looks in `docs/`;
filing `PAGES.md` under `agents/pm/` re-frames it as the PM's private notes and it gets
missed by exactly the readers who need it. `CLAUDE.md` is worse — Claude Code auto-loads
it *from the repo root*, so moving it breaks the one doc guaranteed to be read.
Consolidation is achieved by the **ownership index** in `PM.md` (which the `/pm-sync`
skill runs on), not by moving files.

**Gave up:** A single tidy folder. Docs remain spread across three locations.

**Revisit if:** The index in `PM.md` stops being maintained — at that point the
directory layout is the least of the problems.

---

## 2026-07-13 — Doc sync runs *before* the merge, in the same PR

**Decision:** The `/pm-sync` skill runs while a PR is still open, so doc updates ride in
the same PR as the change that caused them. A `PreToolUse` hook blocks `gh pr merge`
until it has run. Enforced by `.claude/hooks/merge-guard.mjs` (renamed from
`pm-sync-guard.mjs` 2026-07-15).

**Why:** The obvious design was to sync *after* merging. But that spawns a second
docs-only PR for every change — forever — and each PR costs a Netlify build. Syncing
pre-merge means one PR, one deploy, and docs are never even briefly stale. It also means
the doc update is reviewed alongside the code it describes.

**Gave up:** Merges are now gated. If a PR genuinely needs no doc change, you must say
so explicitly (`PM_SYNC_SKIP=1 gh pr merge …`) rather than merging silently. That
friction is the point — it makes "no docs needed" a deliberate claim rather than an
oversight.

**Related:** `netlify.toml` now skips builds for doc-only changes, so documentation is
free regardless.

**Revisit if:** Merges start happening outside Claude Code (github.com UI, mobile). The
hook can't see those — that's when this graduates to a GitHub Action.

---

## 2026-07-13 — Badge color is a system, not a constant

**Decision:** Tournament badge background + border are stored per event in
`badge_config` and encode prestige + geography. Implemented from the Claude Design
"Tournament Badges" prototype; all 48 tournaments seeded.

**Why:** It reads as pure polish, but it lands on our #1 differentiator. Every
competitor (Splash, RunYourPool, Majors Challenge) is functionally complete and
aesthetically dated. Friend groups choose with vibes, not feature matrices — "this looks
like something made, not generated" is a real moat, and a per-event badge is a cheap,
high-visibility way to buy it.

**Gave up:** `badge_config` changed shape (array of styled lines → one object), a
breaking change requiring a coupled frontend + DB deploy. Mitigated with a legacy branch
in `SportBadge` so a half-applied migration degrades instead of blanking.

**Note:** We kept The Open as big-`THE` / small-`OPEN` because that's how the designer
drew it, despite a PM suggestion to flip it. Design intent wins over PM instinct on
design calls.

---

## 2026-07-13 — Supabase auto-pause is a P0, not an annoyance

**Decision:** Added ROADMAP **P0.5** — either upgrade to Supabase Pro or run a
year-round heartbeat, before any growth push.

**Why:** The free tier paused the project after ~7 days idle, pulled its DNS, and took
getpoold.app down with an opaque "load failed" at sign-in. The failure mode is what
makes it P0: cron polling is only scheduled on tournament weekends *by design*, so every
quiet week between events is long enough to trip the timer. Our entire growth loop is
"commissioner shares a link" — an app that can be *asleep* when the link is opened
undermines the one motion that matters.

**Revisit if:** Never — this is a floor, not a preference.

---

## 2026-07-10 — Self-serve pool creation is the real P0 feature

**Decision:** Ranked self-serve pool creation (P0.2) above every other feature.

**Why:** The stated strategy is "win the commissioner — they bring the group." But pool
creation is gated behind the global admin role, so **nobody except the founder can start
a pool.** There is no acquisition motion at all until this changes; every other growth
idea is downstream of it. This was not obvious from the code — it only surfaced when the
product inventory was written against the strategy.

**Gave up:** Nothing yet — not started.

---

## 2026-06 — No money moves through the platform (standing constraint)

**Decision:** Poold never collects, holds, or pays out money. Commissioners *may* declare
a per-player stake and payout split, and the leaderboard displays the pot — settlement
happens offline between friends.

**Why:** This is the legal moat. Splash Sports is a regulated real-money operator and
carries state restrictions, KYC, and rake as a result. Display-only stakes give us the
social stakes ("something on the line") with none of the regulatory weight, and let us
be free where competitors must charge.

**Gave up:** The most obvious monetization path. Revenue will have to come from the club
/ brand channel instead (see ROADMAP 3.5).

**Revisit if:** Never, without legal counsel. Flag any feature that edges toward it.

---

## 2026-06 — Per-sport Postgres schemas; team sports won't reuse the golf shape

**Decision:** Thin sport-agnostic core in `public` (events, pools, participants); each
sport owns its contest structure in its own schema (`golf`). A future NFL models
`weeks → games → picks(spread)` independently rather than being forced into golf's
`picks → tier → competitor` shape.

**Why:** Golf's tiered-athlete format is *golf's* contest shape, not a generic one.
Generalizing it would produce a worse abstraction for both sports. Per-schema costs some
boilerplate (grants, RLS duplication) but buys full modeling freedom per sport and keeps
adding a sport **additive work, not a refactor**.

**Gave up:** Referential tightness (`public.pools` has no FK to golf's detail row) and
some out-of-band config risk (PostgREST "exposed schemas" is a dashboard setting, not a
migration).

**Status:** Phases 0–4 shipped. Phase 5 (drop legacy tables) pending —
`public.pga_event_badges` is the one legacy table that is NOT droppable.

---

## 2026-07-15 — Share leaderboard polls by tournament; don't merge pools into one event

**Decision:** Fix the "N pools on one tournament = N Slash Golf calls" waste at the *poll*
layer — `poll-leaderboard` groups active events by `slash_golf_tournament_id`, fetches
once per tournament, and writes the payload to every event's cache row. We did **not** take
the "purer" route of making `createGolfPool` reuse one shared event across pools.

**Why:** Sharing the API call is all the problem needs. Merging pools onto one event would
also force them to share the field (tiers/players), the odds frozen at creation, and the
scoring params (`pick_count`/`scores_to_keep`) — but pools on the same tournament are created
at different times, at different odds, and may want different rules. The poll-layer fix keeps
each pool's frozen odds/field intact (odds live in `golf.tier_players`, never touched by the
poll) while decoupling API spend from pool count: one isolated edge-function change, no data
model surgery, no create-flow change. Verified live: The Open, 7 pools → 1 call, 7 cache rows.

**Gave up:** The single-event-per-tournament model stays unrealized (still one event per
pool). The "many pools share one event" capability (D3 / BACKLOG G3) remains wired-but-unused;
if a real product need appears (e.g. a commissioner-managed shared field), that's the larger
Option-B build, tracked separately.

**Revisit if:** we want commissioners to attach pools to a shared, admin-managed tournament
field — then the event-merge refactor earns its cost.

**Related:** the admin polling toggle in the same PR is gated on `is_admin()`, not a hardcoded
owner email, on purpose — a future commissioner is a different role, so `is_admin()` already
excludes it at the server and the split only needs to hide the UI card.

---

## 2026-07-15 — Merge flow splits into two subagents; the guard can't gate its own edits, and test-only PRs skip review on purpose

**Decision:** The pre-merge flow is now two agents, not one. `senior-dev` (Opus) reviews
the branch diff for correctness/tech-debt/design and commits
`agents/senior-dev/reviews/<branch>.md` with plain-English questions for the founder;
`pm` (Sonnet, this doc-sync) runs second and cheap so it stops holding the merge up. The
hook (renamed `pm-sync-guard.mjs` → `merge-guard.mjs`) now requires **both** artifacts —
a review when code changed, and an `agents/pm/` touch — reading committed files as proof,
since a hook can't observe an agent running. Two narrower calls came with it:

- **The guard cannot gate changes to itself.** Everything under `.claude/` (the hook, the
  agents, the skills) is excluded from what counts as "substantive," so a branch touching
  only that machinery — including one that breaks the guard — merges with zero checks. A
  hook reviewing its own edit is structurally circular, so this isn't a bug to fix in code;
  it's handled as a **convention**: any PR touching `.claude/hooks|agents|skills` gets a
  manual `/senior-review` before merging (this branch is the dogfood case — see
  `agents/senior-dev/reviews/chore-pr-review-and-pm-subagents.md`, Finding 1).
- **Test-only PRs intentionally skip the senior-dev review.** The guard's `CODE` pattern
  doesn't match `*.test.[jt]sx?`, so a branch that adds only tests produces no
  `codeChanged` and merges without a review pass. Treated as an acceptable trade (tests
  are low-risk, and reviewing test logic wasn't the point of this flow) rather than an
  oversight — flagged explicitly so it reads as a choice if revisited.

**Why:** The single-agent flow was blocking merges on judgment work (a real code review)
using the same fast pass meant for keeping docs current. Splitting them lets the
expensive model do the one thing worth paying for — catching a bad design call before
it ships — while the doc sync stays fast and never holds the PR hostage.

**Gave up:** A `.claude/`-only edit gets no automatic backstop, and neither does a
test-only one; both rely on a human doing the right thing rather than a hook enforcing it.

**Revisit if:** the `.claude/` convention gets skipped in practice (that's a sign it needs
to become a GitHub Action or a separate check outside the repo's own hook), or a test-only
PR ships a real logic bug that a review would have caught.

---

## 2026-07-16 — Course geocoding stays direct-to-Nominatim, town-level fallback over precision

**Decision:** `CreateTournament` now geocodes courses via Nominatim's free-text search
instead of Open-Meteo's name-only match (BACKLOG F3), called directly from the browser —
same pattern as the geocoder it replaces — rather than routed through an edge-function
proxy. The query tries the specific `courseName, city, state` string first (pins the
actual course), and falls back to a town-level `city, state` query if that misses, so a
course name that doesn't fuzzy-match OpenStreetMap's data still resolves to roughly the
right weather. Requests carry Nominatim's policy-compliant `email=` identifier param
(the browser can't set a custom `User-Agent`).

**Why:** Weather only needs to be regionally right, not GPS-precise, so a resolvable
town-level fallback is worth more than a precise query that can silently return nothing —
the senior-dev review flagged this as the one real regression risk (a course string that
doesn't match OSM would have gone from "geocodes the town" under the old Open-Meteo query
to "resolves nothing" under a courseName-only Nominatim query). On proxying: this is one
lookup at tournament-creation time against a free public endpoint with no API key to
protect, unlike Slash Golf/Odds (`slash-golf-proxy`, `odds-proxy`) where a leaked key was
the actual risk being defended against — so a proxy would add infra with no matching
threat. The `email=` param is the cheap, correct way to be a good citizen of that public
endpoint instead.

**Gave up:** No fallback ladder finer than "specific query, then town" — a course whose
*town* also fails to geocode (unlikely, but possible for very small towns) still gets no
weather, same as before. Geocoding also stays inline in `CreateTournament.jsx` rather than
factored into a `src/lib/` helper like the other third-party calls — flagged as a nit, not
worth a refactor for one call site.

**Revisit if:** Nominatim's public server starts rate-limiting or blocking Poold's traffic
(the `email=` param is the mitigation, not a guarantee), or a second geocoding call site
appears and the inline-vs-helper tradeoff changes.
