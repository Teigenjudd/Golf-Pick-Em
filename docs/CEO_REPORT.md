# Poold — CEO Report

*Updated 2026-08-11 · latest: PR #40 (CFB PR1)*

**Status:** 🟢 Golf live in prod · 🟡 CFB in build — PR1 of ~10 shipped · Sports live: **1**

**State of the app.** Golf pick'em is live in production (auth, pools, picks, live leaderboards, prize-pool math). Sport #2 — college football (CFB) — is now in active build; PR1 laid the database foundation today.

**Recent wins.** CFB schema scaffold shipped (PR #40), fully siloed from golf and hardened with extra integrity checks caught in senior review. Earlier this month: legal-contact and auth-email deliverability fixes.

**Next up.** CFB PR2 — the secure "submit your weekly card" logic — is the next and most technically demanding piece, then data import, scoring, and the CFB pages.

**Pitfalls to watch.** CFB is deliberately the "expensive" second sport: it needs a live data feed (CollegeFootballData) and ~15 weeks of hands-on admin per season until automation lands. The prod database switch for CFB is staged but not yet flipped on — a manual cutover still remains.
