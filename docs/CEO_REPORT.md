# Poold — CEO Report

*Updated 2026-08-15 · latest: PR #60 (CFB underdog rebalance + team logos)*

**Status:** 🟢 Golf live in prod · 🟢 CFB cut over to prod (all code + infra live) — no real season run through it yet · Sports live: **1** (CFB awaiting real users)

**State of the app.** Golf pick'em is live in production (auth, pools, picks, live leaderboards, prize-pool math). CFB is fully cut over: edge functions deployed, three billable pollers armed. The public `/demo` showcase, previously golf-only, is now a sport chooser — a no-auth CFB demo (`/demo/cfb`, `/demo/cfb/picks`) mirrors the golf one, built entirely from the same live CFB components so it can't drift from the real pages. Both live and demo CFB pages also gained a "How scoring works" explainer button.

**Recent wins.** CFB's mandatory-underdog scoring widened from 1/2/3 to 1/3/5 points so a big-dog swing pays off more than a small one. Every game on the picks builder and scorecard now shows both teams' crest logos, riding an API call the app already makes hourly — zero added cost.

**Next up.** Self-serve pool creation — still the top blocker for either sport, since pool creation remains founder-only.

**Pitfalls to watch.** None new this PR.
