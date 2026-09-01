# Poold — CEO Report

*Updated 2026-08-31 · latest: PR #66 (profile avatars)*

**Status:** 🟢 Golf live in prod · 🟢 CFB cut over to prod (all code + infra live) — no real season run through it yet · Sports live: **1** (CFB awaiting real users)

**State of the app.** Golf pick'em is live in production (auth, pools, picks, live leaderboards, prize-pool math). CFB is fully cut over: edge functions deployed, three billable pollers armed.

**Recent wins.** Players can now upload a profile photo — shows on the account page, the dashboard header, and both leaderboards (golf and CFB), with initials as the fallback everywhere else. Admins can set anyone's photo from Users & Settings. This is the app's first use of Supabase's file-storage product, locked down so uploads can only land in your own folder, must be a real small image, and the profile field can't be redirected to an outside link. Login still offers email+password alongside the sign-in link (BACKLOG A11 open, no code risk).

**Next up.** Self-serve pool creation — still the top blocker for either sport, since pool creation remains founder-only.

**Pitfalls to watch.** A Week-0 pool created for a season not yet added to the manual date map (`WEEK_ZERO_WINDOW`) comes up silently empty — low risk while pool creation is founder-only. Guard deferred, logged as BACKLOG C7.
