# Poold — CEO Report

*Updated 2026-08-31 · latest: PR #64 (CFB picks nudge + live-game polish)*

**Status:** 🟢 Golf live in prod · 🟢 CFB cut over to prod (all code + infra live) — no real season run through it yet · Sports live: **1** (CFB awaiting real users)

**State of the app.** Golf pick'em is live in production (auth, pools, picks, live leaderboards, prize-pool math). CFB is fully cut over: edge functions deployed, three billable pollers armed.

**Recent wins.** CFB's pool page now nudges players who haven't made their weekly picks yet, mirroring golf's leaderboard banner — visible from an open pool's very first week, not just after a week's graded. Also fixed a mobile layout bug (a graded game's score text could overflow the card instead of truncating) and added a live down/distance/clock line to in-progress games on the weekly slate page.

**Next up.** Self-serve pool creation — still the top blocker for either sport, since pool creation remains founder-only.

**Pitfalls to watch.** A Week-0 pool created for a season not yet added to the manual date map (`WEEK_ZERO_WINDOW`) comes up silently empty — low risk while pool creation is founder-only. Guard deferred, logged as BACKLOG C7.
