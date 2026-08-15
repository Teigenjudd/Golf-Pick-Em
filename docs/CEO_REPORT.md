# Poold — CEO Report

*Updated 2026-08-15 · latest: PR #58 (CFB admin close + picks UX pass)*

**Status:** 🟢 Golf live in prod · 🟢 CFB cut over to prod (all code + infra live) — no real season run through it yet · Sports live: **1** (CFB awaiting real users)

**State of the app.** Golf pick'em is live in production (auth, pools, picks, live leaderboards, prize-pool math). CFB is now fully cut over too: its edge functions are deployed and its three billable pollers (lines, live scores, grading) are armed, alongside a UX pass on the weekly picks page (search/filter, a redesigned underdog pick, a "Card progress" tracker, and a new read-only weekly slate page). Admin can now close a CFB pool for the season, same as golf.

**Recent wins.** CFB prod cutover complete. Three real bugs fixed: a polling-toggle bug was silently killing the free auto-fill cron, spreads could round to a quarter-point that no sportsbook posts, and closed CFB pools weren't disappearing from the Dashboard.

**Next up.** Self-serve pool creation — still the top blocker for either sport, since pool creation remains founder-only.

**Pitfalls to watch.** None new this PR.
