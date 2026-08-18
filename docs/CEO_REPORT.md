# Poold — CEO Report

*Updated 2026-08-17 · latest: PR #61 (CFB per-game kickoff lock + OG card reskin)*

**Status:** 🟢 Golf live in prod · 🟢 CFB cut over to prod (all code + infra live) — no real season run through it yet · Sports live: **1** (CFB awaiting real users)

**State of the app.** Golf pick'em is live in production (auth, pools, picks, live leaderboards, prize-pool math). CFB is fully cut over: edge functions deployed, three billable pollers armed.

**Recent wins.** Closed a real gap: a player could still pick or change an early game up until the whole week locked, even after that game had kicked off. Picks now freeze per-game at kickoff, server-side and in the UI; "Edit picks" carries forward started games instead of wiping the whole card. The default link-preview card was also reskinned off golf's look to a neutral one, since CFB now shares that same front door.

**Next up.** Self-serve pool creation — still the top blocker for either sport, since pool creation remains founder-only.

**Pitfalls to watch.** None new this PR.
