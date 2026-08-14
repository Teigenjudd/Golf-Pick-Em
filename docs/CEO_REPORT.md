# Poold — CEO Report

*Updated 2026-08-14 · latest: CFB read-only picks card + sport-agnostic admin create (PR #55)*

**Status:** 🟢 Golf live in prod · 🟡 CFB in build — every player and admin screen is now built; only the prod cutover is left · Sports live: **1**

**State of the app.** Golf pick'em is live in production (auth, pools, picks, live leaderboards, prize-pool math). CFB is fully built end to end in code — backend, admin, join/dashboard, live leaderboard, weekly picks — but not deployed or cron-armed, so it isn't running for real users yet.

**Recent wins.** The weekly picks page now shows a frozen read-only card once a week locks (submitted, auto-filled, or graded) — the last missing CFB player screen. Admin pool creation got a sport chooser plus a Golf|CFB switcher shared by both admin panels, and CFB pools no longer leak into the golf admin list.

**Next up.** The prod cutover: apply the CFB migration, deploy the edge functions, and flip the polling toggle on — the step that actually turns CFB on for real users.

**Pitfalls to watch.** None new.
