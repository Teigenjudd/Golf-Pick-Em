# Poold — Product Roadmap

> **What this file is:** The prioritized plan — where we can win, what we build next,
> and how hard each thing is. Reference it at the start of every build session; update
> statuses as items ship and re-rank when strategy changes. What the product *is* today
> lives in `PRODUCT.md`; engineering-level defects live in `docs/BACKLOG.md` (IDs like
> A1/B2 below point there).
>
> **Last updated:** 2026-07-13 (P0.5 added after the Supabase pause outage; badge system
> shipped — see the status log at the bottom)
>
> **Ease scale:** 🟢 Easy (a session or two) · 🟡 Moderate (several sessions, one
> surface) · 🔴 Hard (multi-PR, schema + UI + new moving parts)
> **Impact:** judged against the three questions from PM.md — does it acquire
> commissioners, retain players, or cut friction?

---

## 1. Market snapshot (July 2026)

Researched: Splash Sports, RunYourPool, Majors Challenge, RunMyPools, EasyOfficePools.

- **Splash Sports** is the funded, real-money operator. Their golf lineup: tiered
  majors pools (six tiers, pick one per tier — *the same format we run*), One & Done
  (season-long, huge — $3,500-entry flagship with $1M+ guaranteed), Survivor, DFS.
  They handle entry collection and payouts — which is exactly why they carry state
  restrictions, KYC, and rake. They validate our format and can't follow us down the
  free/no-money path without breaking their business model.
- **RunYourPool** (multi-sport) and **Majors Challenge** (golf-first) both charge the
  commissioner ~$1 per entry. Both are feature-rich (message boards, multi-event
  season standings, custom scoring) and both look dated. Majors Challenge sells a
  $599/yr unlimited product to golf clubs and white-labels pools for brands — proof
  the club/course channel we're targeting has money in it.
- **RunMyPools / EasyOfficePools** are the free/cheap tail — templated, utilitarian.
- **Format landscape:** tier pools, One & Done, and majors-series (aggregate standings
  across the four majors) are the three formats that dominate golf pools. We have the
  first. We have nothing season-long — and season-long is what keeps a group alive
  between events.

**Conclusions — where Poold can win:**
1. **The friend-group experience.** Everyone else optimizes for pool *administration*;
   nobody owns the Saturday-afternoon *feeling*. Design, mobile feel, and social energy
   are our differentiation — lean in.
2. **Free + legal simplicity.** Incumbents charge the exact person we need to win
   (the commissioner); Splash carries regulatory weight everywhere. "Free, beautiful,
   no legal weirdness" is the pitch.
3. **Season-long play is the retention unlock.** A single-event pool dies Sunday
   night. A majors-season or One & Done pool keeps the group chat alive from April to
   July. This is the biggest format gap between us and every competitor.
4. **The club/bar channel is real** (Majors Challenge proves it) — but only after
   self-serve pool creation exists.

---

## 2. The blunt strategic read

Our stated strategy is "win the commissioner — they bring the group."
**Today, nobody but the founder can create a pool.** Pool creation is gated behind the
global admin role. Until that changes, Poold has no acquisition motion at all — every
other growth idea is downstream of this one fact. That, plus the two security items
that make a public push irresponsible (A1, A2), defines P0.

---

## 3. Roadmap

### P0 — Make it safe and make it self-serve *(prerequisite for telling anyone about Poold)*

| # | Item | Why | Impact | Ease |
|---|---|---|---|---|
| 0.1 | **Fix A1 privilege escalation** — any signed-in user can set `role='admin'` via the unscoped profiles RLS policy | One curious user away from full takeover (all emails, all pools). Blocks everything. | Critical | 🟢 (BACKLOG A1 has the fix sketched) |
| 0.2 | **Self-serve pool creation** — any user can create a pool and becomes its commissioner; per-pool commissioner powers (lock/close/refresh/manage participants for *their* pool); global admin stays for ops | Turns the product from founder-run to commissioner-run. THE strategic unlock — without it there is no growth loop. | Very High | 🔴 (roles model + RLS + admin-UI split into "my pools"; the create wizard itself already exists and mostly just needs un-gating) |
| 0.3 | **A2: move Odds API key server-side** + rotate | Key is in the public JS bundle; anyone can burn our quota. Pre-marketing gate. | High (risk removal) | 🟢 (copy the existing `slash-golf-proxy` pattern) |
| 0.4 | **Error states instead of blank screens** (C1, C2, B2) | A commissioner's first bad experience shouldn't look like a broken product. Silent failures are trust killers for exactly the audience we can't afford to lose. | High | 🟡 (thread errors through `lib/golf.js` + a few UI states) |
| 0.5 | **Stop Supabase auto-pausing the project** — upgrade to Pro (~$25/mo), or run a year-round heartbeat so the DB never idles out | **Proven failure, 2026-07-13:** the free tier paused after ~7 days idle, Supabase pulled the project's DNS, and getpoold.app died at sign-in with an opaque "load failed." Any gap between tournaments is long enough to trigger it — so an invite that lands in a quiet week reaches a dead app. This is the single cheapest way to stop losing users we've already acquired. | High (risk removal) | 🟢 (Pro is a billing toggle; the heartbeat is a scheduled function) |

### P1 — Sharpen the growth loop *(make every invite and every weekend better)*

| # | Item | Why | Impact | Ease |
|---|---|---|---|---|
| 1.1 | **Invite link preview (OG tags)** — pool name, "You're invited," branded card (H3; includes fixing the "Golf Pick'Em" tab title) | The join link IS the funnel and it currently unfurls as a bare URL in the group chat. Cheapest conversion win available. | High | 🟢 (static OG + title; per-pool dynamic cards are a 🟡 follow-up via a Netlify edge function) |
| 1.2 | **Pick-deadline reminder emails** — "picks lock in 24h and you haven't submitted" | The #1 commissioner pain in every pool is chasing stragglers. Automating the nudge is a retention AND commissioner-love feature. Table stakes at competitors. | High | 🟡 (Supabase scheduled edge function + email; magic-link infra means we already send email) |
| 1.3 | **Live-feel leaderboard** — auto-refetch on interval/focus while an event is in progress, subtle "updated Xm ago" | Users park on this page all weekend; today they must hard-refresh. The product's core moment should feel alive. | Medium-High | 🟢 (client-side refetch of the existing cache; no new infra) |
| 1.4 | **Score-swing / final-result email or share moment** — "You moved to 2nd" or a shareable final-standings card | Brings people back mid-weekend and gives winners something to rub in — trash talk is the product. | Medium | 🟡 |
| 1.5 | **Unmatched-pick flagging (B1) + DQ/DNS handling (B3)** | Scoring integrity is the whole product promise; silent mis-scoring during a live event is a group-chat catastrophe. | Medium | 🟢 |

### P2 — Retention formats *(keep the group alive between Sundays)*

| # | Item | Why | Impact | Ease |
|---|---|---|---|---|
| 2.1 | **Season / series pools** — one pool spanning multiple events (e.g. all four majors) with aggregate standings | The single biggest format gap vs. every competitor. Converts a one-weekend group into an April-to-July group. Schema hint: `events` is already separate from `pools`; this needs a pool↔many-events link + season standings. | Very High | 🔴 |
| 2.2 | **One & Done format** — season-long, pick one golfer per event, can't reuse | The most popular season format in golf pools (Splash's flagship). Second contest type proves the multi-format seam. | High | 🔴 (new format logic; reuses events/leaderboard infra) |
| 2.3 | **In-pool chat or reactions** — even a lightweight emoji-on-scorecard layer | "Social energy over utility" is a principle; today all trash talk happens off-platform. Start tiny (reactions), not a full chat. | Medium | 🟡 (Supabase realtime exists; scope discipline required) |
| 2.4 | **Pool history / archive** — past pools with final standings, "champion" badges | Gives pools a memory and commissioners bragging-rights continuity. Feeds 2.1. | Medium | 🟢 |
| 2.5 | **Configurable tier format (G1)** | Commissioners of small/large groups need different shapes; currently hardcoded 6×6+2 wildcards. | Medium | 🟡 |

### P3 — Channel + platform expansion *(after golf is demonstrably won)*

| # | Item | Why | Impact | Ease |
|---|---|---|---|---|
| 3.1 | **Club/bar onboarding** — a "run your club's Masters pool on Poold" page + white-label-lite (logo/name on the pool) | Majors Challenge charges $599/yr for this; we can land the channel free and monetize later. Needs 0.2 first. | High | 🟡 |
| 3.2 | **PWA / add-to-home-screen** — installable, app icon, offline shell | Mobile-first product with no app-store presence; PWA is 80% of native's value at 5% of cost. | Medium | 🟡 |
| 3.3 | **Multiple pools per event (UI)** — schema already supports it | Lets a bar run a free pool and a stakes pool on the same US Open; also the seam for public "featured event" pools someday. | Medium | 🟡 |
| 3.4 | **Second sport (NFL likely, game-winner/spread, own schema)** | Only after golf retention is proven. The migration made this additive, not a refactor. | High (later) | 🔴 |
| 3.5 | **Monetization decision** — likely: free forever for friends, paid tier for clubs/brands (white-label, custom formats) | Don't charge the commissioner we're trying to acquire; charge the business that uses pools as engagement. Decide only with channel data from 3.1. | — | (decision, not build) |

### Engineering hygiene (running alongside, not a phase)
Phase 5 legacy-table cleanup + `pool_standings` decision (F1) · tests for
`scoring.js`/`tierBuilder.js` (F4) · Nominatim geocoding switch (F3) · a11y pass (E3)
· 404 route (C3). Pull one in whenever a PR is in the neighborhood.

---

## 4. Sequencing logic (why this order)

1. **P0 before any acquisition effort** — a security hole plus founder-gated pool
   creation means marketing would be wasted or dangerous.
2. **P1 before P2** — sharpen the loop for the pools that already happen (majors come
   4× a year; each is a growth event) before building new formats.
3. **2.1 (season pools) is the single most valuable post-P1 build** — it multiplies the
   value of every other retention feature by keeping groups alive between events.
4. **Monetization stays unresolved on purpose** until the club channel produces data.
   Free is a weapon right now; don't sheath it early.

---

## 5. Status log

| Date | Change |
|---|---|
| 2026-07-10 | Initial roadmap from market research + full repo read. Nothing started; P0 defined as A1 + self-serve creation + A2 + error states. |
| 2026-07-13 | **Shipped: tournament badge color system** (Claude Design import). Badge bg/border are now per-tournament and encode prestige + geography; all 48 events designed and seeded. Not on this roadmap when written — it's craft/polish rather than a P0–P3 item, but it lands squarely on differentiation #1 (the friend-group *feel*), so it earns its place. |
| 2026-07-13 | Supabase free tier **auto-paused the project** after ~7 days idle, taking getpoold.app down with an opaque "load failed" at sign-in. Restored manually. This is a live launch risk, not an annoyance — see the new item **0.5** in P0. |

---

*Sources for the market snapshot: [Splash Sports golf](https://splashsports.com/category/golf) · [Splash PGA pool FAQ](https://splashsports.com/faq/pga-pool) · [Splash One & Done](https://splashsports.com/blog/where-to-play-golf-one-and-done-contests) · [RunYourPool golf](https://www.runyourpool.com/golf/) · [RYP pricing](https://help.runyourpool.com/en/articles/5547004-what-is-the-cost-to-run-my-pool) · [Majors Challenge](https://www.majorschallenge.com/) · [Majors Challenge club product](https://landing.majorschallenge.com/golfclub.html) · [MC white-label launch](https://thegolfwire.com/majors-challenge-u-s-open-pools) · [RunMyPools golf](https://runmypools.com/golf/) · [EasyOfficePools](https://www.easyofficepools.com/personalized-pga-fantasy-golf-pools/)*
