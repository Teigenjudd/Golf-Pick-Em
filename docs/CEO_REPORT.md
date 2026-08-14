# Poold — CEO Report

*Updated 2026-08-13 · latest: CFB weekly picks builder — real card + submit (PR-A)*

**Status:** 🟢 Golf live in prod · 🟡 CFB in build — PR6 of ~10 shipped (plus a live-scores PR, the PR8/PR9 admin foundation, an import-automation PR, and two UI-foundation PRs, all landed early/out of sequence) · Sports live: **1**

**State of the app.** Golf pick'em is live in production (auth, pools, picks, live leaderboards, prize-pool math). CFB is in active build; an admin can stand up a real CFB pool and it now keeps itself current automatically. Both real player pages exist now — the leaderboard and the weekly picks card — though nobody but an admin can actually open one yet.

**Recent wins.** The CFB weekly picks screen is real: players build a full card (5 picks against the spread, one optional bonus double-down, one required underdog pick) with live on-screen validity, then submit it through the same server rule that's guarded picks since the backend shipped. A locked week today just shows a short notice rather than a read-only recap — that richer view is next.

**Next up.** The read-only view for a locked or graded picks card (so a player can see what they picked and how it scored after the week closes). After that, wiring a CFB pool into the normal join-link flow so players — not just admins — can reach one.

**Pitfalls to watch.** None new. The live-score polling-schedule decision flagged a few updates ago is still open, unchanged.
