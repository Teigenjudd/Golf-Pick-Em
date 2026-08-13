# Poold — CEO Report

*Updated 2026-08-13 · latest: CFB slate import automated (PR #47)*

**Status:** 🟢 Golf live in prod · 🟡 CFB in build — PR5 of ~10 shipped, plus a live-scores PR and the PR8/PR9 admin foundation, landed early, plus this import-automation PR · Sports live: **1**

**State of the app.** Golf pick'em is live in production (auth, pools, picks, live leaderboards, prize-pool math). CFB is in active build; an admin can stand up a real CFB pool and it now keeps itself current automatically, though nobody but an admin can reach it yet.

**Recent wins.** Real season data showed betting lines only post 1-2 weeks before kickoff, so the manual "import this week's games" button an admin used last update couldn't actually run a full season. Replaced it with an hourly background job that pulls current games and spreads for every active season on its own — one less thing an admin has to remember to do every week, all season long. Also logs when a line moves, for a future "see how the odds shifted" view.

**Next up.** The weekly picks screen players will actually use (PR6), then wiring a CFB pool into the normal join-link flow so players — not just admins — can reach one.

**Pitfalls to watch.** None new. The live-score polling-schedule decision flagged last update is still open, unchanged.
