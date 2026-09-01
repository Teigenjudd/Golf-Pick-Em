# Poold — CEO Report

*Updated 2026-08-31 · latest: PR #67 (avatar crop)*

**Status:** 🟢 Golf live in prod · 🟢 CFB cut over to prod (all code + infra live) — no real season run through it yet · Sports live: **1** (CFB awaiting real users)

**State of the app.** Golf pick'em is live in production (auth, pools, picks, live leaderboards, prize-pool math). CFB is fully cut over: edge functions deployed, three billable pollers armed.

**Recent wins.** Uploading a profile photo (added last PR) now starts with a quick crop step — drag to reposition, zoom, circular guide — so photos actually look good in the round frame everywhere they show. Every upload is also downscaled to a small fixed size before it's stored, and the photo on both leaderboards (golf and CFB) is bigger and easier to recognize at a glance. Login still offers email+password alongside the sign-in link (BACKLOG A11 open, no code risk).

**Next up.** Self-serve pool creation — still the top blocker for either sport, since pool creation remains founder-only.

**Pitfalls to watch.** A Week-0 pool created for a season not yet added to the manual date map (`WEEK_ZERO_WINDOW`) comes up silently empty — low risk while pool creation is founder-only. Guard deferred, logged as BACKLOG C7.
