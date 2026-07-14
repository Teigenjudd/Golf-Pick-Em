# Poold — Product Inventory

> **What this file is:** The single-page answer to "what is our product, exactly, today?"
> Reference it when briefing dev agents, writing copy, or evaluating ideas. Update it
> whenever a user-facing capability ships or changes — it should always describe the
> product as deployed, not as planned. (The plan lives in `ROADMAP.md`.)
>
> **Last updated:** 2026-07-14 · Live at [getpoold.app](https://getpoold.app)

---

## 1. What Poold is

**Poold is a social pick'em app for friend groups — the handshake bet, modernized.**
A commissioner creates a pool on a real golf tournament, shares a join link, friends
pick one golfer from each tier, and everyone watches a live leaderboard all weekend.
Lowest score wins.

- **Tagline:** "Make it interesting."
- **Descriptor:** "Drop your picks. Jump in the pool. Make it interesting."
- **One sentence for a stranger:** "It's like a Masters pool your buddy runs on a
  spreadsheet, except the spreadsheet is beautiful, scores itself live, and nobody has
  to chase anyone for picks."

**The core legal/structural position:** no money ever moves through the platform.
Commissioners *can* declare a per-player stake and payout split, and the leaderboard
displays the pot — but settling up happens offline, between friends. This keeps Poold
out of gambling/fantasy-contest licensing entirely (vs. Splash Sports, which is a
regulated real-money operator).

---

## 2. What it does (capabilities as shipped)

### The contest format (golf)
- **Tiered pick'em:** the tournament field is split into tiers by betting odds/OWGR —
  currently 6 regular tiers of 6 players + 2 wildcard tiers of ~32 (top 100 players).
  Each participant picks one player per tier.
- **Scoring:** relative-to-par, best *N* of *M* picks count (commissioner sets both).
  WD and CUT players score +20 and stay in your card — a bad pick hurts, it doesn't
  vanish. Lowest total wins. Ties share a rank.
- **Live leaderboard:** real PGA scores (Slash Golf API) polled every 20 minutes on
  tournament weekends via cron, cached server-side, plus 3 manual refreshes per event
  for the admin.
- **Pick privacy:** you can't see anyone else's picks until picks lock — enforced in
  the database (RLS), not just the UI.
- **Prize pool (optional, display-only):** stake × participants = pot, split by
  commissioner-defined percentages, shown as whole-dollar payouts per placement.

### Surfaces (11 pages)
| Surface | What the user gets |
|---|---|
| **Login** (`/`) | Magic-link email sign-in. No passwords, ever. |
| **Join** (`/join/:code`) | The invite landing page — the conversion moment. Shows pool name + CTA; handles signed-out arrivals. |
| **Dashboard** (`/dashboard`) | Home base: your pools, pick status per pool, quick links to picks/leaderboard. Admin section for admins. |
| **Leaderboard** (`/tournament/:id`) | The main event. Pick'em standings with the signature expandable scorecard, plus widgets: Prize Pool, PGA Leaders, Most Popular Picks, Tier Value. Weather inline in the header. |
| **Picks** (`/tournament/:id/picks`) | The tier picker: one player per tier, odds shown as context, resubmittable until lock. |
| **Admin** (`/admin`) | Ops panel: tournament status controls (lock/reopen/close), join-link copy, manual score refresh, participant management, user roles. |
| **Create Tournament** (`/admin/create-tournament`) | Two-step wizard: metadata + live field/odds import, then a drag-and-drop tier builder. Auto-builds tiers from odds/rankings. |
| **Demo** (`/demo`, `/demo/tournament`, `/demo/picks`) | Full product experience — picks and all — with zero sign-up, running on a static snapshot. The "see it before you commit" funnel. |

### Who can do what (today)
- **Player:** join via code, submit/edit picks until lock, watch the leaderboard.
- **Admin (currently = the founder):** everything players can, plus create pools,
  manage status, refresh scores, manage participants and roles.
- ⚠️ **There is no self-serve commissioner role yet.** Pool creation sits behind the
  global admin role — a structural gap against the "win the commissioner" strategy.
  (This is the top strategic item in `ROADMAP.md`.)

---

## 3. What it looks like

**Aesthetic:** "Clubhouse, not consumer app." Warm cream/sand backgrounds, deep fairway
green, muted gold accents, condensed display type for scores and headers. Cards are
white with warm borders and modest radii — no glassy consumer-app gloss.

**Two visual registers** (full token spec in `DESIGN_SPEC.md`):
- **General** (login, join, dashboard, admin): brand-level, sport-agnostic. Primary CTA
  is brand orange `#C14A18`.
- **Sport** (leaderboard + picks pages only): golf theme — fairway green `#1B4332`
  gradient headers, cream text, scorecard vocabulary, birdie-red for under-par
  (red = good, because golf).

**Signature UI moment:** the scorecard expand. Tapping a standings row unfolds a
scorecard with a gold left bar, hole-marker tier circles, per-pick scores with WD/CUT
badges, and a TOTAL row. This is the thing users remember; protect it.

**Tournament badges:** every pool wears a shield emblem, and **its colors are specific to
the event** — background and border encode prestige and geography. Each major has a
signature palette (The Open is navy and gold, the Masters deep green), flagship and
playoff events use dark grounds with prestige gold, and regular tour stops follow
regional families. All 48 tournaments on the calendar are designed. It's a small thing
that does real work: a pool tile reads as *which tournament* at a glance, and it's the
kind of detail that makes the product feel made rather than generated — which is exactly
the ground we're competing on (see Positioning).

**Type system:** Barlow Condensed (display — tournament names, ranks, scores, section
labels) over Inter (body). Scores are always tabular numerals.

**Voice:** casual, confident, social, competitive — group-chat energy. Copy sounds like
a friend ("No cards in yet," "Your picks are in"), never like a sportsbook or ESPN.

---

## 4. What users experience (the journeys)

**The player (invited):**
1. Gets a link from a friend → lands on Join, sees the pool name → enters email →
   clicks magic link → is in. No password, no profile setup, no approval step.
2. Picks one golfer per tier in a couple of minutes; odds shown for context. Card
   auto-confirms; editable until lock.
3. All weekend: opens the leaderboard on their phone, watches their rank move, expands
   rivals' scorecards after lock, checks the pot. This mid-round phone check is the
   core habit loop.
4. After the event: pool goes "complete," winner is settled offline. *(Nothing currently
   pulls them back before the next invite — the retention gap.)*

**The commissioner (today, admin-only):**
1. Create pool: name it, pick the real tournament from a live list, set picks/scores-to-
   keep/lock time, optionally set stake + payouts. Field, odds, and rankings import
   automatically; tiers auto-build; drag to adjust. Under 5 minutes.
2. Copy the join link into the group chat. That link is the entire funnel.
3. During the week: watch cards come in, nudge stragglers (manually — no tooling).
4. Weekend: scores flow on their own; 3 manual refreshes if the cron feels slow.
5. Close the tournament when it's official.

**The curious visitor:** `/demo` gives the full experience — browse the board, submit a
demo card, see yourself in the standings — without an account.

**Known experience gaps (honest list):** no notifications of any kind (lock reminders,
score swings); no in-app chat/trash-talk surface; nothing between events (no season
standings, no history page); some failures render as empty states instead of errors;
invite links unfurl as bare URLs with no preview card.

---

## 5. Positioning

**Category:** social sports pools / pick'em hosting — *not* fantasy sports, *not*
betting.

| | **Poold** | Splash Sports | RunYourPool / RunMyPools | Majors Challenge |
|---|---|---|---|---|
| Money | Displayed, settled offline | **On platform** (regulated, state-limited) | Off platform | Off platform |
| Cost | Free (today) | Rake on entries | ~$1/entry, commissioner pays | $1/entry; $599/yr for clubs |
| Golf formats | Tiered pick'em (one event) | Tiers, One & Done, Survivor, DFS | Pick-X weekly, majors | Rosters, majors series, custom scoring |
| Feel | Modern, mobile-first, designed | Sportsbook-adjacent | Utilitarian, dated | Golf-traditional |
| Social layer | Group-chat-shaped (BYO chat) | In-app | Message boards | Basic |
| Setup | < 5 min, auto field/odds import | Guided | Templated | Templated |

**Our wedge, in order:**
1. **Legality + zero friction where Splash can't go.** No state restrictions, no KYC,
   no rake. The 45-second join (link → email → picking) is something a regulated
   operator structurally cannot match.
2. **Design and feel.** Every incumbent looks like 2012. Poold looks like something you
   *want* to open on a Saturday afternoon — that's a real moat with friend groups, who
   choose with vibes, not feature matrices.
3. **Free where incumbents charge the commissioner.** RYP and Majors Challenge charge
   the exact person we're trying to win. "Free and nicer" is a clean pitch.
4. **The commissioner motion.** Win the person who runs the pool; they bring 10–30
   friends. Early channels: golf clubs, courses, bars (Majors Challenge's $599/yr club
   product proves the channel pays).

**What we are NOT (scope guards):** no money processed on platform, ever; no public
pool discovery; no native app yet; no social graph outside the pool; no second sport
until golf is won.

---

## 6. How we work

**Stack:** React + Vite + Tailwind v4 (Netlify) · Supabase (Postgres + magic-link Auth
+ Edge Functions + RLS) · Slash Golf via RapidAPI and The Odds API (both proxied
server-side — no third-party key reaches the browser) · Open-Meteo (weather +
geocoding — keyless, so still called client-side).

**Architecture in one line:** thin sport-agnostic core in the `public` schema (events,
pools, participants); golf's whole contest structure in the `golf` schema; the only
door between frontend and golf data is `src/lib/golf.js`. Shared "pool shell"
components keep the live pages and `/demo` pixel-identical by construction.

**Team:** solo founder (data scientist — explain web/infra plainly) + Claude agents
(dev, PM). PM working files live in `agents/pm/`.

**Process rules that matter:**
- Branch → PR → merge for everything; Netlify serves `main`.
- **Never apply a coupled DB migration to prod before the matching frontend ships to
  `main`** (violating this once locked the admin out).
- Any page change updates `docs/PAGES.md` in the same PR.
- Docs source-of-truth order on conflicts: code → `docs/BACKLOG.md` → migration doc →
  `docs/PAGES.md` → `DESIGN_SPEC.md` → `CLAUDE.md` → `docs/AUDIT.md` (superseded).

**Operational rhythm:** before a tournament weekend, schedule the cron polls
(`supabase/cron-schedule.sql`); after the final round, unschedule. Slash Golf is capped
at 1,800 calls/month — polling cadence and manual refreshes are budgeted against it.

**Current health, honestly:** product works end-to-end and survived its first live
event (2026 US Open). **The two security launch-blockers are closed** (2026-07-14, PR
#24): a signed-in user can no longer self-promote to admin (A1), and the Odds API key no
longer ships in the browser bundle (A2). What remains before a public push: the Supabase
free tier auto-paused the whole project after a week idle and took the site down
(2026-07-13, ROADMAP P0.5); pool creation is still founder-only (P0.2), so there is no
acquisition motion; zero test coverage; several silent-failure states render as blank
screens. See `ROADMAP.md` P0.
