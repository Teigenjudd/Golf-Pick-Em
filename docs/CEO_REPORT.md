# Poold — CEO Report

*Updated 2026-08-13 · latest: CFB sport-dispatch — pools joinable + visible through the normal flow*

**Status:** 🟢 Golf live in prod · 🟡 CFB in build — PR8 of ~10 shipped (plus a live-scores PR, the PR8/PR9 admin foundation, an import-automation PR, and two UI-foundation PRs, all landed early/out of sequence) · Sports live: **1**

**State of the app.** Golf pick'em is live in production (auth, pools, picks, live leaderboards, prize-pool math). CFB is in active build; an admin can stand up a real CFB pool and it now keeps itself current automatically. A CFB pool is now reachable and joinable the normal way, not just by an admin link.

**Recent wins.** Closed the funnel gap: a CFB pool now shows up on a player's Dashboard and its join link works like golf's — sign in, see an invite card (format explainer, player count), tap join, land straight in the weekly picks builder. Membership is written explicitly on join (CFB's submit rule requires it up front, unlike golf), and a missing join-cutoff now fails closed instead of open.

**Next up.** The read-only view for a locked or graded picks card, so a player can see what they picked and how it scored after the week closes — the last major piece of the CFB player experience.

**Pitfalls to watch.** None new. The live-score polling-schedule decision flagged a few updates ago is still open, unchanged.
