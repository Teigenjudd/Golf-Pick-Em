# Poold — CEO Report

*Updated 2026-08-13 · latest: CFB live in-game scores (data layer)*

**Status:** 🟢 Golf live in prod · 🟡 CFB in build — PR5 of ~10 shipped, plus a live-scores data-layer PR · Sports live: **1**

**State of the app.** Golf pick'em is live in production (auth, pools, picks, live leaderboards, prize-pool math). CFB is in active build; standings can now update live as games finish, not only on a scheduled grading run.

**Recent wins.** CFB now has a live-scores data layer: one API call refreshes the whole live college-football slate, and a game going final automatically grades its week and updates standings. This runs on an upgraded data plan (30k calls/month) bought specifically to make live scores affordable. Earlier this month: the grading job posted CFB's first-ever standings (PR5), and the scoring engine (PR4).

**Next up.** CFB PR6 — the weekly picks screen players will actually use; live scores reach the UI in PR6/7.

**Pitfalls to watch.** Review caught the live-score checker looking too far ahead of kickoff, which could have burned a chunk of the monthly data budget on idle time before games start. Tightened before merge; the exact polling schedule is still a decision to lock down before this goes live in PR9.
