# Poold — CEO Report

*Updated 2026-08-12 · latest: PR4 (CFB scoring engine)*

**Status:** 🟢 Golf live in prod · 🟡 CFB in build — PR4 of ~10 shipped · Sports live: **1**

**State of the app.** Golf pick'em is live in production (auth, pools, picks, live leaderboards, prize-pool math). CFB is in active build; PR4 adds the math that turns a week's picks into points.

**Recent wins.** CFB now has a working, tested scoring engine — it grades spread covers, the bonus double-down, and underdog wins, then rolls results into season standings. It also ships the app's first automated tests: 44 cases, all passing, checked line-by-line against the rulebook on review. One real design call came out of it: a bonus double-down is allowed on an underdog pick, not just a favorite, so the picks screen (later PR) will need to phrase that clearly. Earlier this month: real college-football data hookup (PR3), pick-submission security (PR2).

**Next up.** CFB PR5 — the weekly job that runs this scoring engine against final scores and posts season standings, plus a safeguard so the browser and server copies of the math can't quietly drift apart.

**Pitfalls to watch.** CFB's database is live in prod but still invisible to the app until one dashboard setting flips, deferred on purpose until the frontend is ready. No screen uses the scoring engine yet — that's PR5 (grading) and PR6 (picks UI).
