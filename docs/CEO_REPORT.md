# Poold — CEO Report

*Updated 2026-08-12 · latest: PR5 (CFB grading + season standings)*

**Status:** 🟢 Golf live in prod · 🟡 CFB in build — PR5 of ~10 shipped · Sports live: **1**

**State of the app.** Golf pick'em is live in production (auth, pools, picks, live leaderboards, prize-pool math). CFB is in active build; PR5 wires the scoring engine up to a real weekly job and posts standings.

**Recent wins.** CFB now grades a week end to end: a server job pulls final scores, scores every pick, and rolls results into season standings — the first time any sport has written that shared standings table. It also closes a risk flagged last PR: the browser's and server's scoring math are now tested against identical worked examples, so drift between them fails a test (152 cases pass). Earlier this month: the scoring engine (PR4), real college-football data hookup (PR3).

**Next up.** CFB PR6 — the weekly picks screen players will actually use.

**Pitfalls to watch.** Two edge cases are intentionally punted to PR9, when admin screens and automation land: a cancelled/rescheduled game can leave a week stuck, and a future "grade now" admin button doesn't yet check whether picks are still open. Neither can happen today — nothing triggers grading automatically yet. CFB's database is live in prod but still invisible to the app until one dashboard setting flips, deferred on purpose.
