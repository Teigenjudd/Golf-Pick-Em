# Senior review — feat/cfb-cron-controls

- **Reviewed:** 2026-08-13
- **Head:** (see `git rev-parse --short HEAD` at commit)
- **Verdict:** APPROVE WITH QUESTIONS

## Summary
PR9b adds the CFB analogue of golf's leaderboard-polling toggle: a migration with three
`SECURITY DEFINER` RPCs (`admin_start_cfb_polling` / `admin_stop_cfb_polling` /
`admin_cfb_polling_status`), three thin invokers in `src/lib/cfb.js`, and a "CFB polling"
on/off card in `CfbAdmin.jsx`. It is a near-line-for-line mirror of
`20260716000000_admin_polling_controls.sql` and `AdminDashboard`'s `PollingControl`, with
the one real difference being that CFB arms **three** jobs (`cfb-lines`, `cfb-scores`,
`cfb-grade`) instead of golf's four identical `poll-*` jobs. The security shape, secret
handling, job-set isolation, POST targets, and toggle behavior are all correct and faithful
to the template. No blockers. The findings are one genuine design question (the live-score
cron's day-of-week window) and one syntax item I want validated live before cutover — both
already flagged as safe-to-defer. This diff is not applied/deployed; arming is a separate
guided step.

## Findings
Ranked most-severe first.

### 1. (debt / design question) `cfb-scores` day-of-week `4-7` silently skips weekday bowl games, the Monday CFP title game, and Tue/Wed MACtion
File: `supabase/migrations/20260814000000_admin_cfb_polling_controls.sql`, the
`cfb-scores` schedule `'*/2 15-23,0-7 * 8-12,1 4-7'`.

The `4-7` in the last field means the live-score poller **only ever runs Thursday through
Sunday**. But the CFB calendar the season window (`8-12,1`) is meant to cover has games on
other weekdays: bowl games land on Mon/Tue/Wed across late December, the **College Football
Playoff National Championship is a Monday night in January**, and November has Tuesday/
Wednesday "MACtion." On those days `poll-cfb-scores` won't fire at all, so the live in-game
score ticker won't update for exactly the marquee games.

Why this is a design question and not a blocker: (a) grading still happens — `cfb-grade`
runs twice daily every day in season with no day-of-week restriction, so final scores and
standings still land within ~12 hours; only the *live* mid-game ticker is missing. (b) The
missing-live-scores cost is what it is regardless. But the *savings* from the restriction
are tiny: per CLAUDE.md, `poll-cfb-scores` already self-gates — it runs a cheap DB-only
check ("is any game live right now?") and returns with **zero API spend** when nothing's
live. So the `4-7` restriction saves only a handful of cheap DB queries on off-days, at the
cost of no live scores on the biggest weekday games of the year. Fix direction: drop the
`4-7` day-of-week field (make it `*`) — the self-gate already keeps idle days free — or at
minimum widen it to include the bowl/CFP weekdays.

### 2. (nit / verify-live) Cron-string validity — I believe it's valid, recommend the planned throwaway check
Same `cfb-scores` string. This combines a comma-list-of-ranges in the hour field
(`15-23,0-7`), a month list (`8-12,1`), and a day-of-week range (`4-7`). I walked each
field against standard (Vixie/ISC-derived) cron parsing, which is what pg_cron uses:
comma-separated lists where each element may itself be a range are standard and accepted;
day-of-week `7` is accepted as Sunday; month lists are accepted. There is no true
"midnight-wrapping" range here — `15-23,0-7` is just two ascending ranges in a list, not a
wrapping `23-7`, which is the form that would be rejected. **My read: it is valid pg_cron
syntax.** See the yes/no/uncertain call in the report.

Reassurance on the partial-arm fear: even if it *were* invalid, `cron.schedule` validates
the expression and raises before inserting, and the whole `admin_start_cfb_polling` body
runs in a single transaction (each `cron.schedule` is a transactional upsert into
`cron.job`). So an invalid string would roll back the already-scheduled `cfb-lines` too —
you'd get a clean all-or-nothing failure and `admin_cfb_polling_status` would correctly
report "off," not a half-armed state.

### 3. (debt, deferred-known) Arming `cfb-grade` before the PR5 "finalize week as-is" override means a cancelled/rescheduled-game week re-polls CFBD twice daily indefinitely
File: the `cfb-grade` job (`grade-cfb-week` with `body '{}'`, the scan path). Per CLAUDE.md,
`grade-cfb-week`'s open deferred item is that a week stuck on a game that never goes final
re-polls CFBD on every run forever. With this backstop armed twice daily, that becomes two
wasted CFBD fetches/day for any stuck week. It's bounded and nowhere near the 30k/mo cap, so
not a blocker — just noting the interaction, since this PR is what actually turns that loop
on. The override was explicitly deferred; no action needed here beyond awareness.

### 4. (nit) Toggle treats a failed status read as "off"
File: `src/pages/admin/cfb/CfbAdmin.jsx`, `load()` — on error it sets `on = false` and shows
the error. So a transient `admin_cfb_polling_status` failure renders the card as "Off / Turn
on," and pressing it would attempt to arm. This is identical to golf's `PollingControl`
(intentional parity), so it's fine to leave — flagging only for completeness.

## Non-issues confirmed (the ranked risks you asked about)
- **Job-set isolation (risk 2): clean.** Stop and status both filter `jobname LIKE 'cfb-%'`;
  start only creates `cfb-lines`/`cfb-scores`/`cfb-grade`. Golf's jobs are `poll-*` and its
  RPCs filter `poll-%`. The literal prefixes can never cross-match (`cfb-` vs `poll-`), so a
  CFB "off" press can't touch golf's leaderboard jobs and vice-versa. Note the edge-function
  *slugs* in the POST URLs (`poll-cfb-lines`, `poll-cfb-scores`) start with `poll-`, but the
  **job names** are `cfb-*`, so golf's `LIKE 'poll-%'` still can't match them. This migration
  does not modify golf's migration or jobs.
- **SECURITY DEFINER correctness (risk 3): clean.** All three RPCs re-check `is_admin()`
  inside the body (raising `42501`), `SET search_path = public`, and the start RPC reads
  `cron_secret` from `vault.decrypted_secrets` and raises `42704` if null. Grants are
  REVOKE-from-PUBLIC + GRANT-to-`authenticated`, mirroring golf exactly. A non-admin
  authenticated caller is refused server-side regardless of the UI. The secret is never
  returned by any RPC (start/stop return `void`, status returns `boolean`); it only lands in
  `cron.job.command`, which browser roles can't read. No leak path.
- **POST target correctness (risk 4): clean.** URLs resolve to `.../functions/v1/` +
  `poll-cfb-lines` / `poll-cfb-scores` / `grade-cfb-week` on the correct project ref. The
  `x-cron-secret` header carries the Vault secret; the `Authorization` bearer is the public
  anon JWT, **byte-identical** to golf's migration constant — safe to commit. The `format()`
  argument order (url, secret, `Bearer `+anon) maps correctly to the three `%L`.
- **Toggle UI (risk 5): clean.** Status fetch on mount; on/off call the right RPCs and
  re-read status; loading (`on === null`) and error/busy states handled; reuses
  `PollingControl`'s exact structure and admin-register (no CFB colorway) styling; page is
  `AdminRoute`-gated.

## Questions for the founder
1. **The live-score poller only runs Thursday–Sunday. Is that the window you want?** The
   `cfb-scores` job is restricted to Thu–Sun, so on Monday/Tuesday/Wednesday it never checks
   for live games — which means **no live in-game scores for bowl games on those weekdays or
   for the CFP National Championship (a Monday in January)**, and none for November's
   Tue/Wed MACtion games. Those games still get *graded* (the twice-daily grader runs every
   day), so standings and final scores are correct within ~12 hours; you'd just lose the
   real-time score ticker during those specific games. Because the live poller is already
   cheap on idle days (it checks the database first and makes no API call when nothing's
   live), removing the Thu–Sun restriction costs you almost nothing but gets live scores on
   every game day. Do you want to keep the tighter Thu–Sun window, or open it up so the
   playoff and bowls get live scores too?

2. **The cron string for the live poller** — `*/2 15-23,0-7 * 8-12,1 4-7` — reads as: every
   2 minutes, during 15:00–23:59 and 00:00–07:59 UTC (the US game window across time zones),
   Thursday–Sunday, in August–December plus January. That matches the stated intent. I
   believe it's valid syntax, but please run the throwaway schedule/unschedule check you
   planned during cutover to be 100% sure before relying on it — if it were rejected, the
   arming would fail cleanly (all-or-nothing, no half-armed state), so there's no risk in
   testing it live.
