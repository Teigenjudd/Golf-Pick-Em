# Poold — CEO Report

*Updated 2026-08-17 · latest: PR #62 (CFB Week 0 support)*

**Status:** 🟢 Golf live in prod · 🟢 CFB cut over to prod (all code + infra live) — no real season run through it yet · Sports live: **1** (CFB awaiting real users)

**State of the app.** Golf pick'em is live in production (auth, pools, picks, live leaderboards, prize-pool math). CFB is fully cut over: edge functions deployed, three billable pollers armed.

**Recent wins.** CFB pools can now start at Week 0 — CFBD's real pre-Labor-Day slate (e.g. TCU/UNC) — after finding the admin create-pool form's "min 1" floor was the only thing blocking it (no DB constraint). Fixed alongside: four pages that read the URL's `?week=` param were coercing a *missing* param to Week 0 instead of the intended default; now fixed to tell "absent" from "explicitly 0" apart. Also closed a real gap: picks now freeze per-game at kickoff, not just at the whole week's lock.

**Next up.** Self-serve pool creation — still the top blocker for either sport, since pool creation remains founder-only.

**Pitfalls to watch.** None new this PR.
