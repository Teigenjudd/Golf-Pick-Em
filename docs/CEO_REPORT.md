# Poold — CEO Report

*Updated 2026-08-31 · latest: PR #65 (password sign-in)*

**Status:** 🟢 Golf live in prod · 🟢 CFB cut over to prod (all code + infra live) — no real season run through it yet · Sports live: **1** (CFB awaiting real users)

**State of the app.** Golf pick'em is live in production (auth, pools, picks, live leaderboards, prize-pool math). CFB is fully cut over: edge functions deployed, three billable pollers armed.

**Recent wins.** Login now offers email+password as a second sign-in method alongside the sign-in link (unchanged, still default). A new Password card on the account page sets one and doubles as "forgot my password" — no separate reset email. Two Supabase dashboard settings still need a quick founder check (BACKLOG A11); no code risk either way.

**Next up.** Self-serve pool creation — still the top blocker for either sport, since pool creation remains founder-only.

**Pitfalls to watch.** A Week-0 pool created for a season not yet added to the manual date map (`WEEK_ZERO_WINDOW`) comes up silently empty — low risk while pool creation is founder-only. Guard deferred, logged as BACKLOG C7.
