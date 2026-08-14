# Poold — CEO Report

*Updated 2026-08-14 · latest: CFB cron-control admin toggle (PR9b, code only) — cutover still pending*

**Status:** 🟢 Golf live in prod · 🟡 CFB in build — PR9b of ~10 shipped (cron-control toggle code; deploy + arming is what's left) · Sports live: **1**

**State of the app.** Golf pick'em is live in production (auth, pools, picks, live leaderboards, prize-pool math). CFB is fully built end to end in code — backend, admin, join/dashboard, live leaderboard, weekly picks builder — but nothing is deployed or cron-armed yet, so it isn't running for real users.

**Recent wins.** Admins now have an on/off toggle for CFB's three pollers (slates, live scores, grading), mirroring golf's existing control. The live-score schedule now runs every in-season day, not just game weekends, so the Monday championship and weekday bowls get live scores too — free, since the poller costs nothing when idle.

**Next up.** The prod cutover: apply the migration, deploy the CFB edge functions, and flip the new toggle on — the step that actually turns CFB on. Then the read-only locked/graded picks view, the last missing player screen.

**Pitfalls to watch.** None new.
