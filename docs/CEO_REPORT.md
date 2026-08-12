# Poold — CEO Report

*Updated 2026-08-11 · latest: PR #41 (CFB PR2)*

**Status:** 🟢 Golf live in prod · 🟡 CFB in build — PR2 of ~10 shipped · Sports live: **1**

**State of the app.** Golf pick'em is live in production (auth, pools, picks, live leaderboards, prize-pool math). CFB is in active build; PR2 locked down who can see and write picks.

**Recent wins.** CFB now enforces its security rules: a player can only submit their own weekly picks, through one locked-down function that checks the whole 6-pick card is legal — closing a gap simple per-pick rules couldn't. Approved on review, no blockers. Earlier this month: the schema foundation (PR1) and legal-contact/email fixes.

**Next up.** CFB PR3 — connecting the real college football data feed and importing each week's games and spreads, so there's finally real data to pick against.

**Pitfalls to watch.** CFB's database is live in prod but invisible to the app until one dashboard setting flips, deferred on purpose until the frontend is ready. No real games are imported yet, so the submit logic is verified by review only, not a live card.
