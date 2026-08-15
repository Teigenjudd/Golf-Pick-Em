# Poold — CEO Report

*Updated 2026-08-15 · latest: Admin refresh — unified golf/CFB admin chrome, bottom nav retired for a header avatar*

**Status:** 🟢 Golf live in prod · 🟡 CFB in build — all ~10 build-plan PRs shipped in code; only the prod cutover is left · Sports live: **1**

**State of the app.** Golf pick'em is live in production (auth, pools, picks, live leaderboards, prize-pool math). CFB is fully built end to end in code — backend, admin, join/dashboard, live leaderboard, weekly picks — but not deployed or cron-armed, so it isn't running for real users yet.

**Recent wins.** Admin cleanup: golf and CFB admin panels now share one nav/sport-switcher shell, role management moved to its own shared page, and the bottom tab bar was retired for a header avatar (with an admin dropdown). Also fixed three dashboard bugs around the closed-pools toggle.

**Next up.** The CFB prod cutover: deploy the CFB edge functions and arm the three billable CFBD pollers (lines, live scores, grading) — the step that turns CFB on for real users. The auto-fill/lock cron is separate, free, and already running.

**Pitfalls to watch.** The admin cleanup dropped the only in-app way to remove a pool participant (rare need, but now requires a developer to fix by hand).
