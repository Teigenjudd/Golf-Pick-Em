# Poold — CEO Report

*Updated 2026-08-13 · latest: CFB player UI Phase 2 — real Pool Detail leaderboard (PR #49)*

**Status:** 🟢 Golf live in prod · 🟡 CFB in build — PR6 of ~10 shipped (plus a live-scores PR, the PR8/PR9 admin foundation, an import-automation PR, and two UI-foundation PRs, all landed early/out of sequence) · Sports live: **1**

**State of the app.** Golf pick'em is live in production (auth, pools, picks, live leaderboards, prize-pool math). CFB is in active build; an admin can stand up a real CFB pool and it now keeps itself current automatically. The player side's leaderboard page is now real — season standings, weekly results, live scores — though nobody but an admin can actually open one yet.

**Recent wins.** The CFB leaderboard page went from a placeholder to fully real: season-long standings ranked by total points, a week-by-week results view with live scores as games finish, and a widget row (this week's games, who's leading the week, most-picked teams, and the underdog leaderboard). Built entirely on the branded look locked two updates ago, and reuses the same shared building blocks golf uses so nothing there changed.

**Next up.** The weekly picks screen — the actual card players fill out each week (pick winners against the spread, one double-down, one underdog). After that, wiring a CFB pool into the normal join-link flow so players — not just admins — can reach one.

**Pitfalls to watch.** None new. The live-score polling-schedule decision flagged a few updates ago is still open, unchanged.
