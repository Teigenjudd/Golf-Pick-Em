# Senior review — cfb-pr4-scoring-engine

- **Reviewed:** 2026-08-12
- **Head:** 8e3e91f
- **Verdict:** APPROVE WITH QUESTIONS

## Summary
PR4 adds a pure, import-free CFB scoring engine (`src/utils/cfbScoring.js`), its unit tests
(`src/utils/cfbScoring.test.js` — the repo's first, starting to close BACKLOG F4), and wires
`vitest` + a `test` script into `package.json`. No app code imports the engine yet, which is
correct for this slice — PR4 is the tested arithmetic, consumers come later.

I traced every rule in `docs/CFB_FORMAT.md` against the code and ran the suite: **42/42 pass**.
The math is right on all the axes flagged as risky — the buffer rounding is genuinely
float-safe, the strict half-point boundaries are handled correctly, the underdog tiers match,
and the standings projection emits the neutral `pool_standings` shape with correct
descending/competition-rank behavior. The engine's emitted `result` values all satisfy the
PR1 `cfb.picks` CHECK constraint. This is clean, well-documented work. The two questions below
are design/forward-looking, not merge blockers — nothing here is wrong.

## Findings

### Correctness — verified sound (no defects)
Recorded so the trace is on the record:
- **Buffer rounding is float-safe.** CFBD lines are multiples of 0.5, so `|spread|·0.5` is always
  an exact quarter-point (exact in binary float). `Math.round(raw*2)/2` rounds `.25→.5` and
  `.75→next integer`, which is exactly "round to nearest 0.5, quarter-ties up." `8.5→4.25→4.5`,
  `10.5→5.25→5.5` confirmed. No epsilon needed — correct call.
- **Strict bonus threshold / `doubleDownWinBy`.** `cover_margin > buffer` and
  `Math.floor(buffer − lockedSpread) + 1` are correct at every half-point boundary: an 8.5
  favorite (buffer 4.5) needs to win by 14, and a 13-point win lands exactly on the threshold
  and earns no bonus. All comparisons are on multiples of 0.5 → exact. Correct.
- **Underdog tiers.** `6.5→1, 7→2, 13.5→2, 14→3`, `abs`-based so sign-agnostic, and scored only
  on outright win (`margin > 0`). Matches the format table and worked examples.
- **`cfb.picks` CHECK compliance.** Engine emits `result ∈ {cover, push, miss, win, loss, null}`
  and integer `base_points`/`bonus_points` — all inside the PR1 constraint.
- **`projectSeasonStandings`.** Sorts descending (higher = better, opposite of golf), standard
  competition ranking (1, 2, 2), stable tie order, and returns `{user_id, rank, total, display}`
  matching `public.pool_standings` (`rank int`, `total numeric`, `display jsonb`). Correct.

### debt — Dual-language implementation, only one side tested
`src/utils/cfbScoring.js:1-5` — the header states authoritative grading will run server-side in
`supabase/functions/_shared/cfbScoring.ts` (PR5), a hand-kept TS twin of this same arithmetic.
That's a deliberate and defensible split (server-authoritative grading is the right integrity
call), but it means the load-bearing scoring logic will live in two languages that must be kept
in sync by hand, and **only the JS copy is covered by these tests**. When PR5 lands, the tested
prototype and the authoritative grader can silently diverge. Cost: a scoring bug could pass CI
(JS green) while the real grader is wrong. Not actionable in this PR — flagging so it's a
conscious decision at PR5, not a surprise. See Question 1.

### nit — `doubleDownWinBy` assumes the pick is a favorite
`src/utils/cfbScoring.js:41-44` — the helper produces the "win by X+" copy, but a double-down is
legal on *any* of the 5 ATS picks, including one where you took the underdog to cover (positive
`locked_spread`). For a `+6.5` dog DD it returns `-2` ("win by −2+"), which is nonsensical as
copy — the correct framing there is "lose by ≤2 (or win)". The scoring itself (`gradeDoubleDown`)
is correct for this case; only the *display* helper breaks, and nothing consumes it yet. Heads-up
for whoever builds the picks/DD UI (PR6+): this helper is favorite-only as written, and the dog
case is currently untested. See Question 2.

### nit — Tests aren't wired into any automated gate
`package.json` adds `test`/`test:watch`, but nothing runs them on merge (the merge-guard hook
doesn't invoke vitest). Fine for now, but the suite can rot without anyone noticing until someone
runs it by hand. Process note only — no change needed in this PR.

## Questions for the founder

**1. The scoring math is about to exist in two places — is that the plan you want, and how do
we keep them honest?**
Right now the rules live in this JavaScript file (which the app/browser can use). PR5 will add a
second copy in TypeScript that runs on the server and is the one that *actually* awards points.
Two copies of the same math, edited by hand, is how they quietly drift apart — and only the
JavaScript one has tests. That trades a bit of duplication for server-side integrity (the server,
not the browser, decides scores), which is the right trade. The open decision is the safety net:
when PR5 lands, do you want the TS grader to reuse/share these exact tests (so both must pass), or
are you comfortable trusting a manual "keep the two in sync" note? Nothing to change now — just
worth deciding before PR5 so the second copy ships with a guard, not a promise.

**2. Should a double-down be allowed on an underdog pick — and if so, the "win by X+" copy needs a
different phrasing for that case.**
You can flag any of your 5 spread picks as the double-down, including one where you picked the
*underdog* to cover. The scoring handles that correctly. But the little helper that will generate
the button text ("win by 14+") only makes sense for a favorite; for an underdog it currently
computes a negative number. No screen uses it yet, so nothing's broken today. The decision: when
the picks screen gets built, either (a) phrase the underdog-DD case differently ("cover by more
than N") or (b) if you'd rather keep it simple, decide double-downs are favorites-only and enforce
that at submit. Flagging now so it's a design choice then, not a bug report later.
