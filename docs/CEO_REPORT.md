# Poold — CEO Report

*Updated 2026-08-13 · latest: CFB admin grading ops (PR9a) — code shipped, cutover still pending*

**Status:** 🟢 Golf live in prod · 🟡 CFB in build — PR9a of ~10 shipped (admin grading code; deploy + cron-arming, PR9b, is what's left) · Sports live: **1**

**State of the app.** Golf pick'em is live in production (auth, pools, picks, live leaderboards, prize-pool math). CFB is fully built end to end in code — backend, admin, join/dashboard, live leaderboard, weekly picks builder — but nothing is deployed or cron-armed yet, so it isn't running for real users.

**Recent wins.** Admins can now grade a CFB week, and un-stick one that never fully finalizes (cancelled/postponed game) with a "Finalize as-is" override — grades what finished, voids the rest as a no-score push.

**Next up.** The prod cutover: deploy the CFB edge functions and arm the three crons (slates, live scores, grading) — the step that actually turns CFB on. Then the read-only locked/graded picks view, the last missing player screen.

**Pitfalls to watch.** None new. The live-score polling-schedule decision flagged a few updates ago is still open, unchanged.
