# Poold — Where This Goes Next

> **What this is:** An unfiltered idea dump, organized and ranked, written 2026-07-13 against a
> full read of `PRODUCT.md`, `ROADMAP.md`, `DECISIONS.md`, `BACKLOG.md`, `DESIGN_SPEC.md`, and
> `MULTI_SPORT_MIGRATION.md`. **Nothing here is decided.** It's raw material for you to cut.
>
> **What this is NOT:** a replacement for `ROADMAP.md`. The roadmap holds committed work (P0
> security + self-serve creation still gate everything below). This file is the pile of things
> the roadmap could pull *from* once that's done. When an idea graduates, it moves to ROADMAP
> and dies here.
>
> **ID scheme:** `MS` multi-sport · `FMT` formats · `SOC` social · `LIVE` the Sunday experience ·
> `IQ` data/intelligence · `BR` brand · `GRO` growth · `RET` retention · `NTF` notifications ·
> `PLAT` platform · `MON` money · `WILD` swings. IDs don't collide with `BACKLOG.md` (A1–H4).
>
> **Effort:** 🟢 a session or two · 🟡 several sessions, one surface · 🔴 multi-PR, schema + UI
> **Brand test used throughout:** *Does this feel like Sunday afternoon, the group chat popping
> off, everyone with something on the line?* If it feels like a sportsbook, ESPN, or a corporate
> fantasy app, it got cut or flagged.

---

## Table of contents

1. [The read: what Poold actually is](#0-the-read)
2. [The ten I'd bet on](#1-the-ten)
3. [The cheap wins (high impact, low effort)](#2-cheap-wins)
4. [A — Multi-sport](#a--multi-sport)
5. [B — Contest formats & tournament behavior](#b--contest-formats--tournament-behavior)
6. [C — Social & group behavior](#c--social--group-behavior)
7. [D — The Sunday experience (live UI)](#d--the-sunday-experience-live-ui)
8. [E — Data & intelligence (your unfair advantage)](#e--data--intelligence-your-unfair-advantage)
9. [F — Brand, identity, voice](#f--brand-identity-voice)
10. [G — Growth, funnel, commissioner tooling](#g--growth-funnel-commissioner-tooling)
11. [H — Retention & the between-events problem](#h--retention--the-between-events-problem)
12. [I — Notifications & comms](#i--notifications--comms)
13. [J — Platform & infrastructure](#j--platform--infrastructure)
14. [K — Monetization (without touching money)](#k--monetization-without-touching-money)
15. [L — Wild swings](#l--wild-swings)
16. [M — Anti-ideas: things we should NOT build](#m--anti-ideas)
17. [Decisions this file forces](#decisions-this-file-forces)
18. [A suggested 12-month arc](#a-suggested-12-month-arc)

---

<a name="0-the-read"></a>
## 0. The read: what Poold actually is

Before the ideas, the thing I kept coming back to while reading the repo. Three observations
that shape everything below.

**Observation 1 — You are not a golf app. You are an *event pick'em engine*, and golf is the
first event type.**
Look at what the golf schema actually models: *a field of competitors, split into tiers, one
pick per tier, a live scoreboard, lowest total wins.* Strip the word "golf" out of that sentence
and it describes the Kentucky Derby, a UFC fight card, an F1 Grand Prix, a NASCAR race, the
Oscars, and Survivor. **The golf shape is not golf's shape — it's the shape of every
one-off-event-with-a-field contest in the world.** `DECISIONS.md` (2026-06) says team sports
"won't reuse the golf shape," and that's correct — but the conclusion the repo draws from it
("NFL is the second sport") is, I think, backwards. NFL is the *most expensive* second sport.
The cheap ones are the ones that look like golf. This is the single biggest strategic idea in
this document and Section A is built on it.

**Observation 2 — The product's actual competitor is a group chat and a spreadsheet, and the
thing it must beat them at is *drama*, not administration.**
Every incumbent (RunYourPool, Majors Challenge, Splash) has more features than you. None of
them have a Saturday afternoon. You already know this — "social energy over utility" is written
in `PM.md`. But the product as shipped is still, functionally, a very beautiful spreadsheet: it
collects picks, computes a total, and shows a table. There is currently **no moment of drama
that the app itself creates.** Sections C, D, and E are almost entirely about manufacturing
drama. That's where the moat is.

**Observation 3 — The retention hole is a *pool* problem, not a *season* problem, and it's much
cheaper to fix than the roadmap thinks.**
ROADMAP 2.1 (season pools) is ranked "Very High / 🔴" as the retention unlock. I think there's a
🟡-effort version that captures 70% of the value: **the crew persists, not the pool.** Give a
group of friends a durable identity that survives the tournament, and "season standings" becomes
a `GROUP BY` over pools they already played. See `RET-1` (Crews) — it's my highest-conviction
idea in this whole file and it's cheaper than a season pool by a wide margin.

---

<a name="1-the-ten"></a>
## 1. The ten I'd bet on

Ranked. If you did only these, in this order (after P0 ships), I think you'd have a real product.

| # | ID | Idea | Why it's here | Effort |
|---|---|---|---|---|
| 1 | `RET-1` | **Crews** — a durable named group that plays many pools | Turns one-weekend pools into a standing group. Makes season standings a query, not a schema. Makes "run it back" one tap. Everything social compounds on top of it. | 🟡 |
| 2 | `RET-2` | **"Run it back"** — clone a finished pool onto the next event, re-invite the whole roster in one tap | The single cheapest retention feature in existence. The group is *already assembled* on Sunday night; today you make them re-assemble it from scratch. | 🟢 |
| 3 | `LIVE-1` | **Rooting Interest widget** — "you need Scheffler to bogey 18" | This is *the* feature. It converts a leaderboard (information) into a reason to scream at a TV (drama). No competitor has it. It's a pure data problem, which is your strength. | 🟡 |
| 4 | `SOC-1` | **Auto-generated round recap card** (image, shareable to the group chat) | Your growth loop and your social loop are the same object. A beautiful "Round 2 · Judd took the lead" card dropped in iMessage is marketing that your users do for you. | 🟡 |
| 5 | `MS-1` | **F1 or UFC as sport #2** (not NFL) | Both are the golf shape with different nouns. Proves multi-sport for a fraction of NFL's cost, and both have far more events per year than golf's four majors — which fixes the calendar gap golf can't. | 🟡🔴 |
| 6 | `IQ-1` | **Win probability** (live Monte Carlo per participant) | "You have a 23% chance" is the most shareable number in the product. Nobody in this category has it. You, specifically, can build it in an afternoon. | 🟡 |
| 7 | `GRO-1` | **A real landing page + per-event SEO pages** ("2027 Masters pool — free") | Right now `/` is a login form. The highest-intent search traffic in your category ("masters pool", "how to run a golf pool") lands nowhere. This is free acquisition you're leaving on the table. | 🟡 |
| 8 | `FMT-1` | **Prop sheet / tiebreaker questions** (5 fun questions per event) | Enormous fun-per-line-of-code. Solves the tiebreaker gap. Gives non-golf-nerds in the group a way to compete. Pure brand: "make it interesting." | 🟢 |
| 9 | `SOC-2` | **Superlatives at close** — auto-awarded Biggest Boom / Biggest Bust / The Fader | Free trash talk, generated by the app, at exactly the moment the group is paying attention. Cheap, delightful, deeply on-brand. | 🟢 |
| 10 | `FMT-2` | **The Captain** — one pick counts 1.5× | One line of scoring logic; adds a genuine decision, a bragging right, and a thing to argue about. Highest drama-per-effort ratio in the file. | 🟢 |

**The through-line:** none of these are features in the "competitor has it, we need it" sense.
Every one of them exists to make the group text each other.

---

<a name="2-cheap-wins"></a>
## 2. The cheap wins (high impact, low effort)

Everything 🟢 in this file, collected. Most are an afternoon each. Several are one-liners.

| ID | Idea | One-line |
|---|---|---|
| `RET-2` | Run it back | Clone pool → next event, one tap |
| `FMT-1` | Prop sheet | 5 fun questions, doubles as tiebreaker |
| `FMT-2` | The Captain | One pick scores 1.5× |
| `FMT-3` | Send it | Auto-fill a random/chalk/contrarian card in one tap |
| `SOC-2` | Superlatives | Auto-awards at pool close |
| `SOC-3` | Reactions | 🔥 / 💀 on a rival's scorecard |
| `SOC-4` | Status line | A one-liner you set when you submit ("locked and loaded") |
| `SOC-5` | Cards-in counter | "7 of 12 cards in" — visible pressure |
| `LIVE-2` | Live pulse + "updated 2m ago" | Already ROADMAP 1.3 |
| `LIVE-3` | Cut Line widget | Which of your picks are on the wrong side of it |
| `LIVE-4` | Movers | Biggest risers/fallers today |
| `LIVE-5` | Pin "You" | Sticky your own row on a long board |
| `LIVE-9` | Countdown to lock | Ticking, in the header |
| `IQ-4` | The perfect card | "Best possible was −41. You: −22. 54th percentile." |
| `BR-1` | The ripple | Signature submit animation — "drop your picks" made literal |
| `BR-2` | "Make it interesting?" | Use the tagline as the literal stake-field prompt |
| `BR-4` | Own the word "card" | Vocabulary discipline — it's already half-done |
| `BR-6` | Twilight mode | Dark mode, named like a golfer would name it |
| `GRO-3` | OG invite card | ROADMAP 1.1 — the badge, the pool name, "7 cards already in" |
| `GRO-6` | QR poster | A printable pro-shop/bar poster that joins the pool |
| `NTF-1` | Lock reminder | ROADMAP 1.2 |
| `NTF-3` | Cut-day gut punch | "2 of your picks missed the cut 💀" |
| `MON-1` | Sponsored prize slot | A sponsor ships a prize; no money touches us |

---

<a name="a--multi-sport"></a>
## A — Multi-sport

> **The strategic claim (from Observation 1):** sort candidate sports by *how much of golf's
> schema they reuse*, not by how big their audience is. The `golf` schema already models
> "field → tiers → one pick per tier → live scoreboard → lowest/highest total wins." Any sport
> that fits that sentence is nearly free. Any sport that doesn't is a from-scratch build.
>
> Two families:
> - **Field sports** (reuse golf's shape almost verbatim): F1, UFC, NASCAR, horse racing,
>   tennis majors, Olympics, awards shows, reality TV.
> - **Team sports** (need a whole new contest shape — `weeks → games → picks(spread)`):
>   NFL, CFB, NBA, NHL, March Madness.
>
> **The roadmap currently names NFL as sport #2 (P3.4). I'd challenge that.** NFL is the
> highest-cost, highest-competition, most-crowded option and it doesn't reuse a single line of
> golf. It's the right *eventual* sport and the wrong *next* one.

### The candidates, ranked by (schema reuse × cultural fit × calendar value)

**`MS-1` — Formula 1** · 🟡 · **My pick for sport #2**
24 races a year. A grid of 20 drivers with a natural tier structure (top teams / midfield /
backmarkers) and public betting odds. Pick one driver per tier, score by finishing position.
This is *literally golf with different nouns* — the tier builder, the odds join, the field
import, the leaderboard cache, the scorecard expand all survive. **The calendar is the real
prize:** golf gives you four moments a year that matter; F1 gives you twenty-four. A Poold crew
that runs an F1 pool has a reason to open the app almost every other Sunday, year-round.
- *Brand fit:* Enormous. F1 is the most group-chat-native sport on earth right now, the audience
  skews exactly to Poold's demographic, and "Sunday afternoon" is *literally* when F1 runs.
- *Data:* Ergast/Jolpica API (free, open) for results and grids; The Odds API covers F1 outrights.
- *Theme:* new sport register — asphalt/carbon dark ground, a signature accent. Badge shape can
  vary *per sport* while staying constant *within* a sport (the DESIGN_SPEC rule is "shape never
  varies," which I read as within-sport). An F1 badge could be a pennant or a shield with a
  chequered edge.
- *New scoring concept:* positional, not stroke-relative. Slots into `pool_standings`'s
  normalized `rank/total/display` cleanly — this is exactly what that table was scaffolded for.

**`MS-2` — UFC / fight cards** · 🟡
A card has 10–13 fights. Pick a winner in each (plus method/round for bonus). Monthly cadence,
enormous casual-group energy, and "the card" is *already Poold's core vocabulary* — you call a
pick sheet a card, and UFC calls a fight night a card. That's a rare gift.
- *Schema fit:* very high, but not identical — a fight is a 2-competitor "tier," so it's actually
  a *simpler* case of the golf shape (tiers of size 2). Scoring is win/loss, not relative-to-par.
- *Brand fit:* Massive. Fight nights are the purest "make it interesting" occasion that exists.
  Everyone in the room has an opinion; nobody knows anything.
- *Risk:* the audience overlaps less with the golf-club channel. It's a *different* crew, not the
  same crew's second sport. That's fine — arguably good (two beachheads) — but be clear-eyed.

**`MS-3` — The Majors of everything: Kentucky Derby / Triple Crown** · 🟢🟡
A 20-horse field, one day a year, and *the single most-poold event in America* — every office,
every bar, every family runs one. It's a two-minute event with a full week of build-up.
- *Schema fit:* near-perfect. It's one tier of 20 (or tiers by odds), one pick, one result.
- *Brand fit:* perfect, and it's *seasonally adjacent to golf* (Derby is May, between the Masters
  and the PGA). A Poold crew could run Masters → Derby → PGA → US Open → Open without a gap.
- *The wrinkle:* horse racing is culturally closer to gambling than golf is. Since no money moves
  through the platform this is fine legally, but watch the brand — keep the copy about the *party*,
  not the *bet*.

**`MS-4` — Awards shows (Oscars, Emmys, Grammys)** · 🟡 · **The sneaky one**
Hear me out. It's a field (nominees), split into natural tiers (categories), one pick per tier,
scored on a single night, with public odds available. It is *structurally identical to golf* and
it brings in **the half of the friend group that doesn't care about sports** — which is exactly
the constituency that makes a group chat pop off. Everyone has an opinion on Best Picture.
- *Brand fit:* "Make it interesting" is *the entire premise of an Oscar pool.* This is the most
  on-brand non-sport in existence.
- *Strategic value:* it proves Poold isn't a sports app, it's a **"make it interesting" app** —
  which is a much bigger category and a much more defensible brand.
- *Risk:* the scope guard in `PM.md` says "no second sport until golf is won." An awards pool
  isn't a sport; it's arguably a *different product*. Needs a real decision (see
  [Decisions](#decisions-this-file-forces)).

**`MS-5` — March Madness bracket** · 🔴
The biggest pool event in America by a mile. Also: a completely different contest shape
(bracket-tree), a brutal 4-day scoring window, and the most saturated competitive space that
exists (ESPN, CBS, Yahoo all give it away free and beautifully). **High reward, and the only
one on this list I'd genuinely warn you off** — you cannot out-feature ESPN's bracket, and a
bracket doesn't reuse anything you've built.
- *Unless:* you run it as a **Poold-flavored** bracket — crews, superlatives, roasts, rooting
  guides — and compete on the social layer rather than the bracket itself. That's a real angle,
  but it's a 2028 conversation.

**`MS-6` — Reality TV (Survivor, Traitors, Bachelor)** · 🟡 · **The wildest fit**
A field of contestants, weekly eliminations, a survivor-pool format. The audience is *ferociously*
group-chat-native. It's the "make it interesting" brand pushed to its logical end.
- Keep it in the back pocket. But note that it and `MS-4` point at the same insight: **Poold's
  addressable market is "any event a group of friends already argues about," not "sports."**

**`MS-7` — NFL (survivor + pick'em ATS + squares)** · 🔴
The biggest pool culture in the country and the one the roadmap names. It's the right *destination*.
Three formats matter: **Survivor** (pick one winner a week, can't reuse, lose and you're out —
brutal, addictive, and the single most social pool format ever invented), **weekly pick'em ATS**,
and **squares** (Super Bowl). But it's a new schema, a new data provider, a new scoring engine, a
new theme, and it competes with a thousand free products. Do it when you have a reason to — i.e.
when crews are asking for it — not to check a box.
- *If/when you do:* **Survivor first.** It's the cheapest of the three and by far the most
  dramatic. Squares second (trivially simple, enormous casual reach, one weekend a year).

**`MS-8` — Tennis majors / Olympics / Ryder Cup / World Cup** · 🟡🔴
One-off event pools with huge spikes. The **Ryder Cup** deserves special mention: it's a golf
event you *already have the data pipeline for*, it's inherently team-vs-team (see `FMT-8`), and
it happens every two years. The **World Cup** (2026 is a US-hosted World Cup — *this summer*)
is the largest office-pool event on earth and you are, right now, letting it pass by.

### Cross-cutting multi-sport ideas

**`MS-9` — The Sport Pack as a unit of work** · 🟡
Formalize what adding a sport *is*: a Postgres schema, a theme token set, a badge family, a
vocabulary jsonb (`sports.vocabulary` **already exists in the schema and is unused** — this is
the hook), a data adapter, and a scoring function. Write this down as a checklist before sport
#2 so sport #3 is a weekend. The migration doc did the hard architectural work; this is the
operational sequel.

**`MS-10` — Vocabulary as a first-class system** · 🟢
`public.sports.vocabulary` is sitting there empty. Fill it. Golf: *card, tee off, the cut,
clubhouse, back nine.* F1: *grid, lights out, the podium, paddock.* UFC: *card, the walkout, the
scorecards.* This is a nearly-free way to make each sport feel *made* rather than reskinned —
which is your entire stated moat.

**`MS-11` — Mixed dashboard** · 🟡
Once you have two sports, a crew's dashboard shows a golf pool and an F1 pool side by side, each
in its own register. The sport strip on the dashboard card already does the color work. This is
the first moment Poold *looks* like a platform rather than a golf app.

**`MS-12` — The Poold Calendar** · 🟡
A public page: every event Poold supports, in date order, each with a "Start a pool" button.
The Masters, the Derby, Silverstone, UFC 315, the Oscars. **This page is simultaneously the SEO
engine (`GRO-1`), the retention engine ("what's next?"), and the clearest possible statement of
what the brand is.** I like this idea a lot. It's the artifact that makes the "make it
interesting" positioning legible in one screen.

**`MS-13` — Cross-sport crew standings** · 🔴
Your crew's season spans a golf major, two F1 races, and a fight card. One aggregate table.
This is the endgame of `RET-1` + multi-sport, and it's the thing no competitor can copy without
rebuilding their whole product. File under "north star," not "next quarter."

---

<a name="b--contest-formats--tournament-behavior"></a>
## B — Contest formats & tournament behavior

> The current format (6 tiers × 6 + 2 wildcards, best N of M, lowest wins) is good and shipped.
> Everything here is a *variation* that reuses the same field, the same leaderboard cache, and
> the same scoring pass. Most are days, not weeks. Formats are the cheapest possible way to make
> the same tournament feel new.

### Scoring twists (all reuse the existing pick shape)

**`FMT-1` — The Prop Sheet** · 🟢 · **Top-10 idea**
Alongside the tiers, 3–5 fun questions per event, set by the commissioner (or auto-suggested):
*Winning score? Will anyone shoot 62 or lower? Will Rory make the cut? Over/under on the number
of players under par? Will someone hole out from the fairway on 18?* Worth a few points each,
and the winning-score question **doubles as the tiebreaker you currently don't have.**
- *Why it matters more than it looks:* it gives the person in the group who doesn't watch golf a
  way to win. That person is currently the weakest link in every invite chain, and they're the
  one who decides whether the pool is fun.
- *Brand:* it is "make it interesting" in its purest form.

**`FMT-2` — The Captain** · 🟢 · **Top-10 idea**
Designate one of your picks as captain: it scores 1.5× (or 2×). One boolean on `golf.picks`, one
multiplier in `computeScores`. In exchange you get: a real decision, a reason to argue, a reason
to check the board, and a spectacular way to lose. *"He captained Scheffler and Scheffler shot 79"*
is a group chat message that writes itself.

**`FMT-3` — "Send It" (auto-card)** · 🟢
A one-tap card fill for the guy who forgot. Three flavors, and the *naming* is the whole feature:
**Chalk** (all favorites), **Send It** (random), **Fade the Field** (all longshots). Kills the
biggest source of pool death (people who never submit) and creates its own trash talk (*"He hit
Send It and he's beating you"*).

**`FMT-4` — Mulligan** · 🟡
Every player gets one mulligan per pool (or per season): swap a single pick after Round 1, before
the cut. Perfect golf vocabulary, real strategic drama, and it drags people back into the app on
Friday morning — a day the product currently has no reason to exist.

**`FMT-5` — The underdog bonus** · 🟢
Bonus points scaled to your pick's pre-tournament odds. Picking the 200/1 guy who finishes T5 should
*mean* something. Pushes people off chalk, which makes leaderboards more varied, which makes them
more fun. You already have calibrated implied probabilities in `tierBuilder.js` — this is nearly free.

**`FMT-6` — Contrarian / ownership bonus** · 🟡
Points weighted by how few people in *your pool* picked that player. Rewards the person who fades
the crowd. Requires post-lock ownership (you already compute it for the Most Popular Picks widget).

**`FMT-7` — Sunday Swing (final-round multiplier)** · 🟢
Round 4 scores count double. Keeps the pool mathematically alive into Sunday afternoon — which is
*the entire point of the product*. A pool that's decided by Saturday night is a product failure,
and this is a one-line fix for it.

**`FMT-8` — Ryder Cup mode (teams)** · 🟡 · **Best idea for the club/bar channel**
Split the pool into two teams. Team total vs team total. Optionally: head-to-head sessions where
your card is matched against one rival's card, point per session won.
- *Why this is special:* it's a *golf* format, so it's automatically on-brand; it makes the pool
  a shared identity rather than an individual grind; and it is *exactly* what a golf club wants
  (Members vs Guests, Front Nine vs Back Nine, Old Guys vs Young Guys). ROADMAP 3.1 (the club
  channel) is much more compelling with this in the box.

**`FMT-9` — Skins** · 🟡
A side pot per round: lowest card on Thursday wins Thursday's skin. Four small contests inside
the big one. Gives four winners instead of one, which keeps four more people engaged.

**`FMT-10` — Closest to the pin (tiebreaker pot)** · 🟢
A named side prize for the winning-score guess. Pairs with `FMT-1`. Pure flavor, and the naming
does the work.

### New contest types (bigger builds)

**`FMT-11` — The Draft** · 🔴 · **The most fun thing in this document**
Before the event, the crew drafts the field live — snake order, 8 rounds, everyone takes turns
picking golfers. Nobody can have the same golfer. Then it's just: your 8 guys vs their 8 guys.
- *Why it's transformative:* a draft is a **synchronous social event.** It's the thing fantasy
  football groups schedule their lives around. It turns Poold from "a thing I check" into "a thing
  we do together on Tuesday night." Supabase Realtime is already available; a simple draft room
  (turn timer, pick clock, autopick, a live board) is very achievable.
- *Effort is real* (realtime, turn state, timers, a draft room UI) but the payoff is the strongest
  retention mechanic in all of fantasy sports, imported wholesale.
- *Half-price version:* an **async draft** — a snake order with a 12-hour clock per pick, done
  over a day in the group chat. 80% of the drama, 20% of the engineering.

**`FMT-12` — Salary cap / budget** · 🟡
Everyone gets $100 (fake). Golfers are priced by odds. Build any 8-man card you want under the cap.
- No tiers, total freedom, completely different strategy from the same data. You already have
  calibrated prices. This is arguably the *second format* to build after tiers, because it costs
  almost nothing and plays completely differently.
- *Careful:* "salary cap" is DFS vocabulary and DFS is a sportsbook-adjacent word. Rename it —
  **"The Budget"** or **"Buy Your Bag."** Keep the mechanic, kill the jargon.

**`FMT-13` — One & Done** · 🔴 (ROADMAP 2.2)
Season-long: one golfer per event, can't reuse. Splash's flagship. Genuinely great format, and it
becomes *much* cheaper to build once `RET-1` (Crews) exists, because the hard part of a
season-long format is the season-long *group*, not the scoring.

**`FMT-14` — Survivor** · 🟡
Pick one golfer per event who must make the cut. Miss the cut, you're out. Last one standing wins.
Simple, brutal, and it produces a weekly elimination — which is the most reliable engagement
mechanic in existence. Cheaper than One & Done and nearly as good.

**`FMT-15` — Head-to-head league** · 🔴
Season-long, but each week your card is matched against one crew member's card. A W-L record, a
standings table, a playoff. This is fantasy football's shape applied to golf, and it's the
strongest possible version of a season format — but it needs Crews first, and a schedule generator.

**`FMT-16` — The Poold Handicap** · 🟡 · **Very on-brand**
Track a rolling performance rating per user, and let a commissioner turn on handicapped scoring so
the guy who wins everything spots the newcomer a few strokes. **This is the most golf idea in this
document** — it's literally how the sport keeps a bad player interested in a game against a good
one, and it solves the #1 cause of casual pool death: one person always wins and everyone else
stops caring.

**`FMT-17` — Ladder / promotion & relegation** · 🔴
Across a season, crews or players move between divisions. Extremely sticky, extremely complicated.
Back pocket.

### Commissioner-configurable rules

**`FMT-18` — Format presets** · 🟡
The create wizard offers: *Classic (tiers)*, *The Budget*, *Survivor*, *One & Done*, *Draft*.
Each preset is just a config; the tier format itself should also be configurable (this is
`BACKLOG G1` — tier count/size is currently hardcoded).

**`FMT-19` — House rules toggle sheet** · 🟢
One screen where the commissioner flips: Captain on/off · Mulligans (0–2) · Sunday Swing ·
Underdog bonus · Prop sheet on/off. **Every one of these is a scoring-function flag.** Ship the
flags first, the UI second. A pool's "house rules" become a thing crews argue about and take
pride in — and that's a moat that's very hard to copy because it's *social*, not technical.

**`FMT-20` — Late entry** · 🟢
Let someone join after lock with a penalty (their card starts +5, or they can only pick from
players who haven't teed off). Right now late = excluded = a friend who bounced.

---

<a name="c--social--group-behavior"></a>
## C — Social & group behavior

> This is the section I'd fight hardest for. `PM.md` says "the nudges, trash talk, and leaderboard
> drama are the product" — but as shipped, **none of the three exist.** The app currently has zero
> surfaces where one user says something to another. All the social energy happens in a group chat
> you don't own, don't see, and don't feed.
>
> **The strategic frame:** don't try to move the group chat into Poold — you will lose. Instead,
> **make Poold the thing the group chat is about.** Manufacture content and hand it to iMessage.

**`SOC-1` — The Recap Card** · 🟡 · **Top-10 idea**
After each round, auto-generate a beautiful shareable image: the pool name, the event badge, the
top 3, the biggest mover, the biggest disaster, one line of copy in Poold's voice. One tap to share.
- *Why it's the whole ballgame:* this is a marketing asset your users voluntarily distribute into
  exactly the groups you want to acquire, at exactly the moment those groups are paying attention,
  and it carries a join link. It is simultaneously your **retention loop, your social loop, and
  your acquisition loop.** If I could only build one thing in this file, it might be this.
- *Effort note:* image generation server-side (Netlify edge function + an OG-image renderer like
  Satori) is the standard, well-trodden path.

**`SOC-2` — Superlatives** · 🟢 · **Top-10 idea**
At pool close, the app hands out awards automatically:
- 🔥 **Biggest Boom** — best pick relative to odds
- 💀 **Biggest Bust** — worst pick relative to odds
- 🧊 **Mr. Consistent** — lowest variance card
- 🎯 **The Sniper** — only person to have the winner
- 🪦 **The Cemetery** — most cut players on one card
- 🐐 **Wire to Wire** — led after every round
Each is a query. Each is a group chat message. Each is free.

**`SOC-3` — Reactions** · 🟢
Emoji on a rival's scorecard row after lock. 🔥 💀 😂 🫡. That's it — no chat, no threads, no
moderation surface. **Start here, not with chat.** ROADMAP 2.3 already says this; I'm underlining
it. Reactions give you 60% of the trash talk at 5% of the product surface, and they can't turn
into a place that needs moderating.

**`SOC-4` — The Status Line** · 🟢
When you submit your card, you can attach one line of text (60 chars) that everyone sees on the
leaderboard next to your name after lock. *"Locked in. Book it."* *"I have no idea what I'm doing."*
It's the trash talk surface with a hard character limit — which is exactly the right amount of
product to build.

**`SOC-5` — Cards In counter + the pressure ticker** · 🟢
"7 of 12 cards in · locks in 6h 12m" on the leaderboard and the dashboard. Visible social pressure
does the commissioner's chasing for them. Pair with `SOC-6`.

**`SOC-6` — The Nudge** · 🟢
A commissioner button: *"Nudge the 5 who haven't picked."* Sends the reminder email/text. One tap.
This is the #1 pain of running a pool and you can solve it with a button. (`NTF-1` automates it;
this one gives the commissioner the *satisfaction* of doing it, which matters more than it should.)

**`SOC-7` — The Reveal** · 🟡 · **A moment worth building**
At lock time, picks flip from hidden to visible. Today that's a state change. Make it **an event**:
a "cards on the table" screen — every card flipping over, the ownership numbers landing, a
"consensus vs contrarian" summary. Notify the pool when it happens. **You have a dramatic moment
built into your product (the RLS privacy gate!) and you are currently rendering it as a table
refresh.** That's the single biggest wasted opportunity in the app.

**`SOC-8` — Rivalries / the Ledger** · 🟡
Once Crews exist: a lifetime head-to-head record between any two members. *"You're 3–1 vs Dan."*
Show it on the leaderboard when you're adjacent to them. Petty, personal, and enormously sticky.

**`SOC-9` — The Trophy Case** · 🟡
Your profile: pools played, wins, best finish, career-best card, your most-picked golfer ("your
guy"), badges earned. Gives a *reason to have an identity* on Poold, which is the precondition for
everything social.

**`SOC-10` — The Roast** · 🟡 · *(Use an LLM here — this is where it earns its keep)*
One auto-generated line per round, in Poold's voice, about the pool's biggest story.
*"Judd captained Rory. Rory shot 78. Judd has gone quiet in the group chat."*
- *Caution, and it's a real one:* `DECISIONS.md` already rejected an LLM for name-matching on
  cost/complexity grounds — correctly. This is the opposite case: a *creative* task with no correct
  answer, where a wrong output is funny rather than broken. That's the right shape of problem for
  a model. Keep it opt-in, keep it kind, and never let it punch at anything but the picks.

**`SOC-11` — Group chat exports** · 🟢
A "copy to chat" button that formats the standings as plain text for iMessage/WhatsApp. Ugly,
unglamorous, and I guarantee it gets used more than any chat feature you could build.

**`SOC-12` — Discord / Slack webhook** · 🟡
For the crews that live in Discord (F1 and UFC crews absolutely do), post round updates and lock
reminders into their channel. Meet them where they already are.

**`SOC-13` — Spectator link** · 🟢
A read-only leaderboard URL you can send to someone not in the pool. A spouse, a coworker, the guy
who missed the deadline. **Every spectator is a warm lead** who watches your product be fun for a
weekend and then wants in on the next one.

**`SOC-14` — Poold Rating (ELO)** · 🟡
A cross-pool skill rating. Purely cosmetic, endlessly argued about. Feeds `FMT-16` (handicap).

**`SOC-15` — Avatars** · 🟢
Initials today. Let people pick an emoji or upload a photo. Cheap identity, big personality
delta on a leaderboard. An emoji-only avatar picker avoids all the image-upload/moderation cost.

---

<a name="d--the-sunday-experience-live-ui"></a>
## D — The Sunday experience (live UI)

> The core habit, per `PRODUCT.md`, is *"opens the leaderboard on their phone, watches their rank
> move."* Everything in this section is about making that habit stronger. Right now the board is
> **static** (you have to hard-refresh) and **flat** (it tells you your score, not your story).

**`LIVE-1` — Rooting Interest** · 🟡 · **Top-10 idea, and the one I'd build first after P0**
A widget that reads: *"You need Scheffler to bogey 18 · You're rooting against Dan's Hovland
(currently −4) · If Rahm birdies the last, you drop to 3rd."*
- This is the thing that makes a person **watch the golf.** It converts an app into a reason to
  sit on the couch. It's the answer to "why do I care about this putt?" — and no competitor is
  even trying.
- *It's a pure data problem:* diff your card against the leaderboard, diff against the rivals
  adjacent to you in the standings, surface the highest-leverage in-progress players.
- *Brand:* this is the most Poold feature imaginable. Sunday afternoon energy, literally.

**`LIVE-2` — Actually live** · 🟢 (ROADMAP 1.3)
Auto-refetch on interval + on window focus. A live pulse dot. "Updated 2m ago." Scores that
change without a hard refresh. **Table stakes that you don't have.**

**`LIVE-3` — The Cut Line** · 🟢
A widget during Rounds 1–2: the live projected cut line, and which of *your* picks are on the wrong
side of it. Friday afternoon is a dead zone in the product right now and this fills it with dread.

**`LIVE-4` — Movers** · 🟢
"Biggest movers today" — up and down, within the pool. Feeds `SOC-1` and `SOC-2` for free.

**`LIVE-5` — Sticky "You"** · 🟢
Your own row pins to the bottom of the viewport as you scroll a long leaderboard. Tiny, and
everyone who has used a leaderboard on a phone knows why it matters.

**`LIVE-6` — Score-change animation** · 🟡
Rows reorder with a transition when ranks change. A brief flash on a score that improved. **Make
the board move.** A leaderboard that visibly rearranges itself is the difference between a
spreadsheet and a sporting event.

**`LIVE-7` — Rank sparkline** · 🟡
A tiny line per participant showing rank over the four rounds. Tells a story in 40px. Perfect
material for the recap card.

**`LIVE-8` — The Player Card** · 🟡
Tap a golfer's name anywhere → a mini card: live position, thru, today's score, their round-by-round,
**and who in this pool has them.** That last line is the social payload: *"Owned by: you, Dan, Meg."*

**`LIVE-9` — Countdown to lock** · 🟢
A ticking clock in the header while picks are open. Urgency is free.

**`LIVE-10` — Round-by-round in the scorecard expand** · 🟡
The signature expand currently shows one total per pick. Add R1/R2/R3/R4 columns. Same interaction,
four times the information, and it makes the expand feel like an actual scorecard — which is the
metaphor you're already committed to.

**`LIVE-11` — Tap-to-follow a golfer** · 🟡
Star a player and get notified when they birdie/bogey. For the degenerate in every group.

**`LIVE-12` — TV / Clubhouse Mode** · 🟡 · **The club channel's killer app**
A full-screen, auto-rotating, big-type leaderboard designed for a TV in a bar or a pro shop. No
nav, no chrome, huge scores, the pool's name in the header, the badge on screen.
- *Why it matters commercially:* it's the single most persuasive thing a bar or golf club could
  see. It's also **ambient advertising** — twenty people in a room look at your product for four
  hours and every one of them asks what it is. Pair with `GRO-6` (a QR code on the screen to join
  next week's pool). This might be the highest-ROI thing in the whole file for ROADMAP 3.1.

**`LIVE-13` — Weather as a story** · 🟢
You already fetch it. Use it: *"Wind gusting 22mph this afternoon — the late starters are in
trouble."* One sentence in the header turns a data point into a narrative.

**`LIVE-14` — Live pick ownership on the board** · 🟢
Next to each golfer in the PGA Leaders widget, show how many people in the pool have them.
Instantly tells you whether the leader is helping you or killing you.

---

<a name="e--data--intelligence-your-unfair-advantage"></a>
## E — Data & intelligence (your unfair advantage)

> You're a data scientist. **Every competitor in this space is a web shop.** This is the one
> dimension where you can build something they structurally cannot, and it's currently
> completely unexploited. None of this requires ML — it's simulation and descriptive stats,
> which is exactly the stuff that's cheap for you and impossible for them.

**`IQ-1` — Win Probability** · 🟡 · **Top-10 idea**
Monte Carlo the remaining holes (or remaining rounds) from the live leaderboard, simulate the
field, score every participant's card in each sim, and report *P(win)* per person. Show it as a
live number on the leaderboard. *"You: 23%."*
- The most shareable number in the product. The most argued-about number in the product. And the
  headline of the recap card (`SOC-1`).
- *Simplest v1:* sample each golfer's remaining-round scores from a distribution keyed to their
  current position and the field's scoring average. It doesn't need to be right, it needs to be
  *reasonable and fun.* Nobody is auditing your priors.

**`IQ-2` — Leverage** · 🟡
Per remaining golfer: how much does *your* win probability move if he birdies vs bogeys? Sort by
absolute leverage → that's `LIVE-1` (Rooting Interest), rigorously computed. Same engine, two
features.

**`IQ-3` — Card post-mortem** · 🟡
After the event: your card's expected score (from pre-tournament odds) vs actual. Were you unlucky
or bad? **Everyone thinks they were unlucky. Now you can prove they weren't.**

**`IQ-4` — The Perfect Card** · 🟢
"The best possible card in this pool's tiers scored −41. Yours scored −22. That's the 54th
percentile of all possible cards." Trivially computable (min per tier), endlessly humbling.

**`IQ-5` — Chalk index** · 🟢
How contrarian was your card, 0–100? Plot it against your finish. Over a season this produces the
best possible group-chat argument: *does fading the field actually work?* Then you can answer it
with data, publicly, as content.

**`IQ-6` — Pick assistant** · 🟡
Three auto-cards with real strategy behind them: *Balanced*, *Chalk*, *Boom or Bust* — with a
one-line rationale each. This is `FMT-3` (Send It) with a brain. Helps the newcomer feel competent,
which is the #1 predictor of whether they come back.

**`IQ-7` — Player form** · 🟡
On the picks page, show each golfer's last 5 finishes and their history at this course. This is
the depth that makes the golf nerd in the group trust the product — and the golf nerd is usually
the commissioner. (Depends on what Slash Golf exposes; may need a second data source.)

**`IQ-8` — Poold Ownership Index** · 🟡 *(needs scale)*
Across *all* Poold pools: *"14% of Poold picked Rory this week."* A stat only you can produce,
which is inherently interesting, which makes it **content** (see `GRO-9`).

**`IQ-9` — Live projected finish** · 🟢
Not just current score — projected final standing based on holes remaining. Prevents the "I'm
winning!" / "no you're not, your guys have 12 holes left" confusion that every pool has.

**`IQ-10` — Tier difficulty calibration** · 🟢
Post-event: which tier actually separated the pool? Feeds back into a better tier builder, and
it's a genuinely useful commissioner insight ("Tier 3 was a coin flip — nobody gained anything").

---

<a name="f--brand-identity-voice"></a>
## F — Brand, identity, voice

> The brand work already done (the badge system, the two-register theme, the copy voice) is
> genuinely strong — and per `DECISIONS.md` you already understand *why* it matters strategically.
> These are amplifiers.

**`BR-1` — The Ripple** · 🟢 · **Free signature moment**
"Drop your picks. Jump in the pool." — and when you submit your card, **nothing happens.** Make a
ripple. A single water-ripple animation on submit, radiating from the button. It's 20 lines of CSS,
it makes the tagline literal, and it's the kind of detail that people screenshot. Every great
product has one gratuitous animation; this is yours, and it's already written into your slogan.

**`BR-2` — "Make it interesting?"** · 🟢
The stake field on the create wizard should be labeled **"Make it interesting?"** with the amount
input underneath. Your tagline, deployed as the literal UI prompt for the exact moment it describes.
This is the kind of thing that makes people say "this app gets it."

**`BR-3` — The Pool metaphor is underused** · 🟡
Everything visual is golf. But the *brand* is Poold — a pool, a drop, jumping in, making waves.
There's a whole second visual language (water, ripples, depth, the drop) that belongs to the
**general register** (auth, dashboard, join), leaving golf green for the **sport register**. Right
now the general register is just "golf minus the green." Give it its own identity and the
multi-sport story becomes visually obvious before you ship a single second sport.

**`BR-4` — Own the word "card"** · 🟢
`"No cards in yet."` is already the best line in the app. Push it everywhere: *your card · cards
on the table · card of the week · a clean card · he's got a live card.* One word, consistently
used, becomes brand vocabulary. **Bonus: "card" is *also* UFC's word** — which makes it a
multi-sport asset, not a golf one.

**`BR-5` — A copy deck** · 🟢
One file: every string in the app, with the voice rules. As agents write more surfaces, the voice
will drift — and voice drift is how a distinctive product becomes a generic one. Cheap insurance,
and it's the kind of doc `/pm-sync` can keep honest.

**`BR-6` — Twilight mode** · 🟢
Dark mode, but named the way a golfer would name it (a twilight round is an evening round). Most
people check scores at night on a couch. The fairway-green register is *made* for a dark theme.

**`BR-7` — Badge as collectible** · 🟡
You built 48 gorgeous per-event badges and they appear in exactly four places. Make them **earnable**:
win a pool, keep the badge in your trophy case (`SOC-9`). A player's profile becomes a wall of
shields. Suddenly the badge system isn't decoration — it's a progression system.

**`BR-8` — iMessage sticker pack** · 🟡
Ship the badges + a few voice lines as an iMessage sticker pack. Pure marketing, lives in exactly
the app where your users' pools actually happen, costs one afternoon and an Apple developer account.

**`BR-9` — Sound** · 🟢
One sound: a soft "plink" on submit (muted by default, respects reduced-motion/silent). Optional,
delightful, and almost nobody in this category does it.

**`BR-10` — Naming defaults** · 🟢
When creating a pool, suggest names in-voice instead of a blank field: *The Back Nine Boys ·
Sunday Sickos · The Shank Tank · Bogey Brigade.* A blank text field is a moment of friction; a
funny suggestion is a moment of delight, and it *teaches the voice* to new commissioners.

**`BR-11` — Poold as a verb** · 🟢
*"Poold it."* / *"We're poolding the Masters."* If the copy uses it, the users will. Low cost,
high ceiling — verbs are the strongest possible brand position.

**`BR-12` — The wordmark needs to leave the login page** · 🟢
`index.html` still says "Golf Pick'Em" (BACKLOG H3). Fix it, obviously — but more importantly, the
brand currently exists only on screens that logged-in people see. It needs to exist on the screens
that *strangers* see (see `GRO-1`).

---

<a name="g--growth-funnel-commissioner-tooling"></a>
## G — Growth, funnel, commissioner tooling

> Gated behind ROADMAP P0.2 (self-serve pool creation). Everything here assumes that's done.

**`GRO-1` — A real landing page + per-event SEO pages** · 🟡 · **Top-10 idea**
`/` is a login form. That's a conversion mistake. Two things:
1. **A landing page** — what Poold is, the demo embedded or one click away, "Start a pool free."
2. **Per-event pages** — `/masters-pool`, `/us-open-pool`, `/the-open-pool`, `/f1-pool`. Each one:
   what the event is, when it starts, how a pool works, **Start a pool** button.
- *Why:* people search *"how to run a Masters pool"* and *"masters pool template"* every single
  April, in enormous numbers, with the highest imaginable purchase intent. They currently land on
  a spreadsheet template blog or RunYourPool. **This is free, evergreen, perfectly-qualified
  traffic and you have no page to catch it with.** The Poold Calendar (`MS-12`) is the hub; these
  are the spokes.

**`GRO-2` — Kill the magic-link mobile trap** · 🟡 · **Possibly your biggest silent conversion leak**
Magic links on mobile are notoriously lossy: the link opens in the email app's in-app browser, not
the browser holding the session, and the user ends up in a broken or confusing state. Your entire
funnel (`join link → email → picking`) runs through this. **Add a 6-digit OTP code option**
(Supabase supports it — same `signInWithOtp`, verified with `verifyOtp` instead of a link). The
user types 6 digits *in the tab they're already in*. This is a well-known ~10–20% conversion swing
in link-based auth and it costs a session's work.
- Also consider Apple/Google sign-in. Friend groups on iPhones + one tap = the shortest possible
  path from "link in the chat" to "picking golfers."

**`GRO-3` — The invite card (OG)** · 🟢 (ROADMAP 1.1)
The join link is the entire funnel and it unfurls as a bare URL. Give it: the event badge, the pool
name, the commissioner's name, *"7 cards already in — picks lock Thursday."* Social proof + urgency
in the group chat, before anyone even clicks.

**`GRO-4` — Pick first, sign in later** · 🟡
Let an invited user **make their picks before authenticating**, then ask for an email to lock them
in. You lose people at the auth wall who would never have left the picks screen. The picks are the
hook; make them taste it first. (RLS makes this fiddly — the picks would have to be held
client-side and submitted post-auth — but the funnel math is compelling.)

**`GRO-5` — Contact / SMS invite** · 🟡
"Copy link" is fine. "Text these 8 people" is better. Friend groups live in SMS, not email.

**`GRO-6` — The QR poster** · 🟢 · **The club channel's front door**
A printable, beautiful poster (generated per pool): the event badge, the pool name, a QR code.
Pin it in a pro shop, a bar, a locker room, an office kitchen. **This is how you get into a golf
club without a sales team.** Pair it with `LIVE-12` (TV mode) and you have a complete physical-world
acquisition motion that costs you a PDF generator.

**`GRO-7` — Commissioner onboarding** · 🟡
The create wizard is good but it assumes competence. Add: a "first pool?" path with defaults, a
preview of what players will see, and a checklist ("share the link → 4 of 12 in → lock Thursday").
The commissioner is your entire acquisition strategy — treat their first 5 minutes like a product,
not a form.

**`GRO-8` — Co-commissioner** · 🟢
Two people can run a pool. Halves the abandonment risk, doubles the invite surface.

**`GRO-9` — Content as acquisition** · 🟡
Once `IQ-8` exists you have proprietary stats nobody else has (*"Poold pools picked Rory 3× more
than the betting market implies"*). That's a weekly post. It's the cheapest content engine in
sports media: **you have data, and data is content.** This is a channel that plays directly to your
strengths and costs no engineering.

**`GRO-10` — The public pool ("The Clubhouse")** · 🟡 · *conflicts with a scope guard*
A Poold-run public pool for each major that anyone can join. Free, huge leaderboard, no money.
- *Why:* gives a curious solo visitor something to *do* right now (today they can only look at a
  demo), creates a weekly habit independent of whether their friends joined, and gives you a
  showcase leaderboard with real people on it.
- *Conflict:* `PM.md` explicitly says "no public pool discovery." This is a real, deliberate
  scope guard and I'm not going to pretend otherwise — but I'd argue it was written to prevent
  *becoming a public-contest platform*, not to prevent *one flagship pool as a front door*.
  Flag for a decision.

**`GRO-11` — Referral, without money** · 🟢
You can't pay people. You can give them **status**: a badge for the crew's founder, "Commissioner"
flair, a trophy for bringing 10 people. Status is cheaper than cash and works better on exactly
this audience.

**`GRO-12` — Alumni re-engagement** · 🟢
When a pool ends, everyone in it is a warm lead who just had fun. Email them 3 weeks later: *"The
Open starts Thursday. Run it back?"* → deep link to `RET-2`. Today they hear from you never.

---

<a name="h--retention--the-between-events-problem"></a>
## H — Retention & the between-events problem

> `PRODUCT.md` names this honestly: *"Nothing currently pulls them back before the next invite — the
> retention gap."* Golf's majors are 4× a year. **A product with four moments a year is not a
> product, it's an event.** This section and Section A (more events) are the two answers.

**`RET-1` — Crews** · 🟡 · **My #1 idea in this document**
A **Crew** is a durable, named group of people that plays many pools together. Create it once, and
every future pool is created *inside* it — the roster carries over, no re-inviting, no re-joining.
- **What it unlocks, all of it nearly free once the object exists:**
  - **Season standings** = `GROUP BY crew` over their pools. ROADMAP 2.1 (rated 🔴 Very High) becomes
    mostly a query. *You don't need a season-pool schema; you need a group.*
  - **Run it back** (`RET-2`) becomes trivial — the roster already exists.
  - **Rivalries** (`SOC-8`), the **Ledger**, lifetime records — all become possible.
  - **Cross-sport standings** (`MS-13`) — the crew plays golf, F1, and a fight card, one table.
  - **The crew is the retention unit.** A pool ends. A crew doesn't.
- *Schema shape:* `public.crews` + `public.crew_members`, and `pools.crew_id` (nullable, so one-off
  pools still work). That's it. Two tables and a foreign key.
- *Brand:* a crew has a name, a badge, a group identity. That's the entire "group chat popping off"
  premise made into a first-class object. **This is the missing primitive in the data model.**

**`RET-2` — Run It Back** · 🟢 · **Top-10 idea**
On the final standings screen, a button: **"Run it back — The Open, 3 weeks."** One tap clones the
pool config onto the next event and re-invites everyone.
- The group is *at maximum enthusiasm* on Sunday night. Today you do nothing with that. The window
  closes in about 48 hours and then they never think about it again. **This button is the entire
  retention product** and it's an afternoon of work.

**`RET-3` — Pool history / archive** · 🟢 (ROADMAP 2.4)
Past pools, final standings, who won. A pool with a memory. Precondition for trophies, ledgers,
and crew identity.

**`RET-4` — Season standings** · 🟡 (with Crews) / 🔴 (without)
The four majors, aggregate. See `RET-1` — this is a query if the crew exists, a project if it doesn't.

**`RET-5` — The Poold Calendar in-app** · 🟢
"What's next for your crew": the Open in 3 weeks, the Ryder Cup in September. A reason to open the
app on a Tuesday in a dead week. Public version of this = `MS-12`.

**`RET-6` — Off-season content** · 🟡
Golf has a dead winter. Crews will churn. Fill it with: year-end awards (auto-generated from the
season's data — `IQ`-powered), a "best card of the year," a preseason prediction pool for next
season's majors. **Or:** fill it with another sport, which is the real answer, and the strongest
argument for `MS-1` (F1 runs March–December).

**`RET-7` — Streaks** · 🟢
"You've played 6 straight majors." Simple, and it works — the sunk-cost engine that powers Duolingo
and every other habit product. Keep it light; this is one line on a dashboard, not a gamification
system.

**`RET-8` — The dead-week dashboard** · 🟢
Today, in a week with no tournament, the dashboard is *empty*. That's the state most users see most
of the time. Fill it with: the next event, the crew's season table, last pool's superlatives, a
"run it back" prompt. **The empty dashboard is where your retention is dying.**

---

<a name="i--notifications--comms"></a>
## I — Notifications & comms

> Currently: zero notifications of any kind. Every re-engagement depends on a human remembering.

**`NTF-1` — Lock reminder** · 🟡 (ROADMAP 1.2) — *"Picks lock in 24h and you haven't submitted."*
The single highest-value notification. Solves the commissioner's #1 pain.

**`NTF-2` — Cards on the table** · 🟢 — *"Picks are locked. See what everyone took."* Fires the
`SOC-7` reveal moment. Drags the whole pool back in on Thursday morning.

**`NTF-3` — Cut day** · 🟢 — *"2 of your picks missed the cut 💀"* Bad news is more engaging than
good news. This is a *gut punch* and people will open it every time.

**`NTF-4` — Sunday morning brief** · 🟡 — *"You're 2nd, 3 back. You need Hovland to go low."*
Includes the rooting guide (`LIVE-1`). This is the notification that makes someone *watch the golf*.

**`NTF-5` — Lead change** · 🟡 — *"Dan just passed you."* Real-time, personal, infuriating. Perfect.

**`NTF-6` — Final result + recap card** · 🟡 — the moment of maximum attention. Attach `SOC-1` and
`RET-2` (run it back) right there in the same message.

**`NTF-7` — SMS over email** · 🟡
Friend groups don't read email. Consider SMS for lock reminders at minimum (Twilio; costs pennies;
massively higher open rate). Email for the recaps, SMS for the urgent stuff.

**`NTF-8` — Web push (needs PWA)** · 🟡
Free, instant, no per-message cost, works on Android well and iOS acceptably (16.4+, installed PWA
only). The right long-term channel. See `PLAT-1`.

**`NTF-9` — Per-user preferences** · 🟢
One screen: what you want, on what channel. Build it *before* you have an unsubscribe problem, not
after.

**`NTF-10` — The commissioner's broadcast** · 🟢
Let the commissioner send one message to the pool ("Reminder: cash by Saturday, degenerates").
Simple, useful, and it makes the commissioner feel powerful — which is a feature, because the
commissioner is the customer.

---

<a name="j--platform--infrastructure"></a>
## J — Platform & infrastructure

**`PLAT-1` — PWA** · 🟡 (ROADMAP 3.2)
Installable, app icon on the home screen, offline shell, **and it's the prerequisite for web push**
(`NTF-8`). 80% of a native app for 5% of the cost. The icon on the home screen is worth more than
the offline support — it's a permanent presence on the device.

**`PLAT-2` — Native app** · 🔴
Later. Only if push and the home-screen icon prove they matter. React Native/Expo would reuse a
lot, but this is a 2028 conversation, not a 2026 one.

**`PLAT-3` — TV mode** · 🟡 — see `LIVE-12`. Just a route with a big-type layout and auto-refresh.
Almost no new engineering, disproportionate commercial value.

**`PLAT-4` — Real-time (Supabase Realtime)** · 🟡
You're paying for it already. It unlocks: live leaderboard push, the draft room (`FMT-11`),
reactions appearing instantly, "Dan just submitted his card" presence. **Presence is the cheapest
social feature there is** — just showing that other people are *here, now, looking at this* makes
a leaderboard feel alive.

**`PLAT-5` — Get off the free tier** · 🟢 (ROADMAP 0.5) — already correctly ranked P0. Nothing to add
except: this is not optional and every idea in this file assumes it's done.

**`PLAT-6` — Test the scoring engine** · 🟢 (BACKLOG F4)
`scoring.js` and `tierBuilder.js` are pure functions with zero tests, and **every format idea in
Section B lands directly on them.** If you build Captain, Mulligans, Underdog bonuses, and Sunday
Swing on top of an untested scoring function, you *will* mis-score a live pool during a major, and
that is the one bug this product cannot survive. **Do this before Section B, not after.**

**`PLAT-7` — An events ingestion pipeline** · 🟡
Today, a pool is created by an admin picking from a live API list. For `MS-12` (the Calendar) and
`GRO-1` (SEO pages) you need a *table of upcoming events* across sports, synced on a schedule.
That's the backbone of multi-sport, and it's a cron job.

**`PLAT-8` — Feature flags** · 🟢
Section B is a pile of scoring flags. You want to turn Captain on for one pool and off for another
without a deploy. `pools.rules jsonb` is probably the whole implementation.

**`PLAT-9` — An admin ops console** · 🟡
As pools multiply beyond your friends, you need to see: which pools are live, which cron polls
failed, API quota burn, which pools have zero cards in. Today you'd find out when someone texts you.

**`PLAT-10` — Slash Golf quota is a growth ceiling** · 🟡 ⚠️
1,800 calls/month with 20-minute polling across a weekend. **That's fine for N pools on one event
(the cache is per-event — good design), but the moment you add sports and a calendar you'll be
polling several events at once.** Model this before it bites: per-event polling cost × concurrent
events × cadence. It's a real constraint on how many events the Calendar can list *live*.

---

<a name="k--monetization-without-touching-money"></a>
## K — Monetization (without touching money)

> Standing constraint, correctly ranked as sacred: **no money moves through the platform.** Everything
> here respects that absolutely. `ROADMAP 3.5` says decide later with channel data — agreed. These are
> the options to have ready.

**`MON-1` — Sponsored prize slot** · 🟢
A brand (a golf apparel company, a local course, a whiskey) puts up the prize for a public pool
(`GRO-10`). They ship the prize directly to the winner. **No money touches Poold** — you sold
attention, not a contest. This is the cleanest possible revenue shape for your legal position.

**`MON-2` — The club/venue plan** · 🟡 (ROADMAP 3.1)
Majors Challenge charges $599/yr for exactly this. Your version: club logo on the pool, TV mode
(`LIVE-12`), the QR poster (`GRO-6`), a member leaderboard across the season. Charge the *venue*,
never the commissioner. The venue has a marketing budget; your friend doesn't.

**`MON-3` — Brand-run pools (white label)** · 🟡
A beverage brand runs "The [Brand] Masters Pool" for their customers. You host it, they promote it,
their logo is on it. Majors Challenge already proved this sells.

**`MON-4` — Poold for Work** · 🟡
Office pools are the largest untapped segment and companies *will* pay for an HR-safe, no-money,
branded engagement tool. It's a different sales motion, but the product is 95% identical and the
"no money on platform" constraint that limits you elsewhere is a **selling point** here — it's the
only version of an office pool that legal will approve.

**`MON-5` — Never charge the commissioner** · —
Not an idea; a rule. It's your entire wedge against RYP and Majors Challenge. Write it in
`DECISIONS.md` so a future you doesn't quietly erode it.

**`MON-6` — Affiliate, carefully** · ⚠️
Golf gear, tee times, tickets. Real money, real brand risk — every affiliate link makes you look
slightly more like the thing you're positioned against. I'd hold this in reserve and probably never
use it.

---

<a name="l--wild-swings"></a>
## L — Wild swings

> Low-confidence, high-ceiling. Included because you asked for everything.

**`WILD-1` — Poold is not a sports app, it's a "make it interesting" app.**
The logical end of Observation 1 + `MS-4` + `MS-6`. The product's real category is *"a group of
friends wants to compete over a thing that's already happening."* That's the Oscars, the election,
the Super Bowl ads, the Bachelor finale, the World Cup, the office March Madness bracket, and
whether it'll rain on Saturday. If you commit to that framing, the roadmap changes completely and
the TAM goes up by an order of magnitude. **The tagline already says this. The product doesn't yet.**
It's the biggest strategic fork available to you and it deserves a real decision, not a drift.

**`WILD-2` — The Commissioner is the character.**
Lean all the way in. Give commissioners a title, a badge, a leaderboard of their own ("your pools
have hosted 340 cards"), a private commissioner's channel, tools that make them feel like a
sheriff. **The commissioner isn't a user role, it's an identity** — and if you make it feel great,
they'll evangelize you for free. It's the single highest-leverage psychological lever in the whole
product and it costs almost nothing.

**`WILD-3` — Pools as content.**
Publish (with consent) the most dramatic pool finishes each weekend. "Someone won by one stroke
because their Tier 6 pick birdied 18." That's a story, and stories travel where feature lists don't.

**`WILD-4` — Live "pick-along" mode.**
Everyone in a crew makes their picks *at the same time*, in a shared session, with a timer.
Turns the picks page into a synchronous event. It's the draft (`FMT-11`) without the draft's
complexity — same social payload, way less schema.

**`WILD-5` — The Poold Ryder Cup.**
Two crews. Head to head. Over a whole season. Trophy. Absolutely absurd, absolutely on-brand, and
it's the kind of thing a group of friends organizes their *year* around.

**`WILD-6` — Voice/audio recap.**
A 30-second auto-generated audio recap of the pool's weekend, in a broadcast voice, dropped in the
group chat Sunday night. Ridiculous, cheap with modern TTS, and *nobody* is doing it. Would either
be the most-shared thing you've ever made or a total flop. Worth a prototype exactly once.

**`WILD-7` — Betting-market mirror, without betting.**
You already ingest odds. Show the market's implied probabilities *as the market moves during the
week* — "Rory's odds shortened 40% since Tuesday." All the information of a sportsbook, none of
the sportsbook. It's the most defensible use of odds data: **you're not offering a bet, you're
offering a signal.** But it's also the idea most at risk of making the product *feel* like a
sportsbook, which is the one thing the brand forbids. Handle with care, or not at all.

**`WILD-8` — Physical trophy.**
A real, cheap, ugly-beautiful trophy that a crew buys once and passes to the winner each year, with
a Poold badge on it. It's merch, it's a moat, it's a group ritual, and it puts your brand on a
shelf in someone's house for a decade.

---

<a name="m--anti-ideas"></a>
## M — Anti-ideas: things we should NOT build

> Saying no is the other half of a roadmap. Each of these is something a reasonable person would
> suggest, and each is a trap.

- **A full in-app chat.** You will lose to iMessage. You'll inherit moderation, notification, and
  read-state complexity for a feature nobody switches to. **Reactions and a status line
  (`SOC-3`/`SOC-4`) get you the social payload with none of the surface.** ROADMAP 2.3 already says
  "start tiny" — hold that line hard.
- **A social graph / friends list / global feed.** The pool *is* the graph. The crew (`RET-1`) is
  the graph. Anything bigger is a different company.
- **Real-money anything.** The moat. Never.
- **Out-featuring the incumbents.** RunYourPool has more formats than you ever will. Competing on
  the feature matrix is competing on their terms and losing. **Compete on the Saturday.**
- **NFL as sport #2, "because it's the biggest."** See Section A. Biggest audience ≠ cheapest build
  ≠ best fit. It's a destination, not a next step.
- **A native app before a PWA.** Expensive, slow, and it solves a problem (push, home screen icon)
  that a PWA solves for a tenth of the cost.
- **Public pool discovery / a marketplace.** One flagship public pool as a front door (`GRO-10`) is
  arguably worth a debate. A directory of strangers' pools is a different, worse product with a
  regulatory smell.
- **Gamification for its own sake.** XP, levels, daily streaks, coins. It's the fastest way to
  make a confident, casual brand feel cheap. Badges tied to *real achievements* (`BR-7`) are fine;
  a points economy is not.
- **AI everywhere.** `DECISIONS.md` already got this right once (no LLM for name matching). The
  rule holds: use a model where the task is *creative and failure is funny* (`SOC-10`, the roast),
  never where the task is *factual and failure is silent* (scoring, matching, tiering).
- **More admin tooling before more player joy.** The temptation, always, is to build for the
  commissioner because they're the customer. But the commissioner's real need is *for their friends
  to have fun*, and the friends are the ones who churn.

---

<a name="decisions-this-file-forces"></a>
## Decisions this file forces

Four questions that a bunch of the ideas above depend on. I'd want your call before building.

1. **Is Poold a *sports* app or a *"make it interesting"* app?** (`WILD-1`, `MS-4`, `MS-6`)
   If the latter, awards shows and reality TV are legitimate targets and they're cheap. If the
   former, cut them and focus. **This is the biggest fork in the file.** Everything downstream of
   the brand depends on the answer, and the tagline is currently writing a check the roadmap
   doesn't cash.

2. **Is the second sport NFL (the roadmap's answer) or a field sport like F1/UFC (mine)?**
   (`MS-1`, `MS-2`, `MS-7`) Cost differs by an order of magnitude. Calendar value differs even more.

3. **Do we add a *Crew* object?** (`RET-1`) I think this is the single most important schema
   decision remaining, and it's the cheap path to the retention feature the roadmap currently
   rates 🔴. If you say yes, a *lot* of this file gets cheaper. If you say no, season pools stay
   expensive and the social features stay orphaned.

4. **Does the "no public pool discovery" guard survive one flagship public pool?** (`GRO-10`)
   Worth an explicit yes or no rather than a slow drift.

---

<a name="a-suggested-12-month-arc"></a>
## A suggested 12-month arc

Not a commitment — a shape. It assumes ROADMAP **P0 ships first, unchanged** (A1 privilege
escalation, self-serve pool creation, Odds key server-side, error states, Supabase Pro). Nothing
in this file matters if a user can make themselves admin or the app is asleep when the link lands.

| Phase | Theme | What ships |
|---|---|---|
| **0. Now** | *(ROADMAP P0 — unchanged)* | A1 · self-serve creation · A2 · error states · Supabase Pro. **Plus `PLAT-6` (test the scoring engine)** — it's cheap and every format idea below stands on it. |
| **1. The Sunday** | Make the core weekend undeniable | `LIVE-2` live board · `LIVE-1` + `IQ-1` rooting guide & win probability · `LIVE-3` cut line · `SOC-7` the reveal · `NTF-1`/`NTF-3` reminders |
| **2. The Group** | Manufacture the drama | `SOC-1` recap cards · `SOC-2` superlatives · `SOC-3` reactions · `SOC-4` status line · `SOC-13` spectator links · `BR-1` the ripple |
| **3. The Crew** | Stop the churn | **`RET-1` Crews** · `RET-2` run it back · `RET-3` history · `RET-8` the dead-week dashboard · season standings falls out nearly free |
| **4. The Front Door** | Turn it on | `GRO-1` landing + SEO pages · `GRO-2` OTP auth · `GRO-3` OG cards · `GRO-6` QR poster · `LIVE-12` TV mode · `MS-12` the calendar |
| **5. The Formats** | Same field, new games | `FMT-1` props · `FMT-2` captain · `FMT-19` house rules · `FMT-8` Ryder Cup mode · `FMT-12` the budget · then `FMT-11` the draft |
| **6. The Second Sport** | Prove the platform | `MS-1` F1 (or `MS-2` UFC) · `MS-9` the sport pack · `MS-10` vocabulary · `MS-11` mixed dashboard |

**The logic of the order:** make the weekend great (1) → make the weekend *loud* (2) → keep the
group (3) → *then* let strangers in (4), because inviting people to a product with a retention hole
is pouring water into a bucket with a hole in it. Formats and sports (5, 6) are what you do once
the loop actually closes.

---

*Written by Claude, 2026-07-13. Ideas are cheap; this file is a menu, not a plan. Kill 80% of it.*
