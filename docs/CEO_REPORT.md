# Poold — CEO Report

*Updated 2026-08-15 · latest: PR #59 (CFB demo)*

**Status:** 🟢 Golf live in prod · 🟢 CFB cut over to prod (all code + infra live) — no real season run through it yet · Sports live: **1** (CFB awaiting real users)

**State of the app.** Golf pick'em is live in production (auth, pools, picks, live leaderboards, prize-pool math). CFB is fully cut over: edge functions deployed, three billable pollers armed. The public `/demo` showcase, previously golf-only, is now a sport chooser — a no-auth CFB demo (`/demo/cfb`, `/demo/cfb/picks`) mirrors the golf one, built entirely from the same live CFB components so it can't drift from the real pages. Both live and demo CFB pages also gained a "How scoring works" explainer button.

**Recent wins.** Public CFB demo shipped, reusing the real pick'em components on a fixture season. A confusing underdog-pick label ("+3" read like a spread) now reads unambiguously as points.

**Next up.** Self-serve pool creation — still the top blocker for either sport, since pool creation remains founder-only.

**Pitfalls to watch.** None new this PR.
