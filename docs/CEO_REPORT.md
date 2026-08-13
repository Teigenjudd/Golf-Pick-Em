# Poold — CEO Report

*Updated 2026-08-13 · latest: CFB admin — pool creation + weekly ops (PR #46)*

**Status:** 🟢 Golf live in prod · 🟡 CFB in build — PR5 of ~10 shipped, plus a live-scores PR and the PR8/PR9 admin foundation, landed early · Sports live: **1**

**State of the app.** Golf pick'em is live in production (auth, pools, picks, live leaderboards, prize-pool math). CFB is in active build; an admin can now stand up a real CFB pool and run it week by week, though nobody but an admin can reach it yet.

**Recent wins.** An admin can now create a CFB season pool and import each week's game slate — the first CFB screens anyone can click through, and what finally makes a real, testable CFB pool exist. Building it surfaced an important fix: each CFB pool now gets its own season data instead of sharing one across pools, so two office pools on the same season can start at different weeks. Caught and fixed before merge by our review process.

**Next up.** The weekly picks screen players will actually use (PR6), then wiring a CFB pool into the normal join-link flow so players — not just admins — can reach one.

**Pitfalls to watch.** None new. The live-score polling-schedule decision flagged last update is still open, unchanged.
