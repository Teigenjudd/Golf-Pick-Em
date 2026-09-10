# Poold — CEO Report

*Updated 2026-09-09 · latest: PR #69 (PWA installability + CFB pick copying)*

**Status:** 🟢 Golf live in prod · 🟢 CFB cut over to prod (all code + infra live) — no real season run through it yet · Sports live: **1** (CFB awaiting real users)

**State of the app.** Golf pick'em is live in production (auth, pools, picks, live leaderboards, prize-pool math). CFB is fully cut over: edge functions deployed, three billable pollers armed. The app is now installable to a phone's home screen (a PWA, not a native app) via a new `/install` page.

**Recent wins.** Poold can now be added to a phone's home screen like a real app icon (data still always live — nothing is cached offline). Admins can manually lock/unlock a CFB week early if needed. A player in more than one CFB pool can copy an already-built weekly card into another pool instead of re-picking from scratch. Login still offers email+password alongside the sign-in link.

**Next up.** Self-serve pool creation — still the top blocker for either sport, since pool creation remains founder-only.

**Pitfalls to watch.** A Week-0 pool created for a season not yet added to the manual date map (`WEEK_ZERO_WINDOW`) comes up silently empty — low risk while pool creation is founder-only. Guard deferred, logged as BACKLOG C7.
