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
until it has run. Enforced by `.claude/hooks/pm-sync-guard.mjs`.

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
