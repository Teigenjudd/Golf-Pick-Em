# Poold — CEO Report

*Updated 2026-09-28 · latest: PR #72 (fix CFB week premature lock)*

**Status:** 🟢 Golf live in prod · 🟢 CFB cut over to prod (all code + infra live) — no real season run through it yet · Sports live: **1** (CFB awaiting real users)

**State of the app.** Golf pick'em is live in production (auth, pools, picks, live leaderboards, prize-pool math). CFB is fully cut over: edge functions deployed, three billable pollers armed. The app is installable to a phone's home screen (a PWA, not a native app) via `/install`, and now re-checks for a new deploy every time a backgrounded install comes back to the foreground, not just on a fresh relaunch.

**Recent wins.** Fixed a live prod bug where a CFB week could flip to "locked" (blocking pick submission) the moment any single game in it finished, sometimes days ahead of the real deadline — a week now only locks once its own `lock_time` passes. An installed iOS home-screen icon no longer needs a full force-quit to pick up a new deploy. Admins can manually lock/unlock a CFB week early if needed. A player in more than one CFB pool can copy an already-built weekly card into another pool instead of re-picking from scratch.

**Next up.** Self-serve pool creation — still the top blocker for either sport, since pool creation remains founder-only.

**Pitfalls to watch.** A Week-0 pool created for a season not yet added to the manual date map (`WEEK_ZERO_WINDOW`) comes up silently empty — low risk while pool creation is founder-only. Guard deferred, logged as BACKLOG C7.
