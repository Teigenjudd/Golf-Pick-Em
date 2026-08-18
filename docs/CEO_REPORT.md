# Poold — CEO Report

*Updated 2026-08-18 · latest: PR #63 (CFB Week 0 → CFBD mapping fix)*

**Status:** 🟢 Golf live in prod · 🟢 CFB cut over to prod (all code + infra live) — no real season run through it yet · Sports live: **1** (CFB awaiting real users)

**State of the app.** Golf pick'em is live in production (auth, pools, picks, live leaderboards, prize-pool math). CFB is fully cut over: edge functions deployed, three billable pollers armed.

**Recent wins.** Fixed a real gap in last PR's Week 0 support: live testing found CFBD doesn't give the pre-Labor-Day slate its own week number — it lumps those games into the same raw week as the following weekend's real Week 1. The poller and grader now split them by kickoff date, so a Week-0 pool's slate actually populates instead of sitting empty.

**Next up.** Self-serve pool creation — still the top blocker for either sport, since pool creation remains founder-only.

**Pitfalls to watch.** A Week-0 pool created for a season not yet added to the manual date map (`WEEK_ZERO_WINDOW`) comes up silently empty — low risk while pool creation is founder-only. Guard deferred, logged as BACKLOG C7.
