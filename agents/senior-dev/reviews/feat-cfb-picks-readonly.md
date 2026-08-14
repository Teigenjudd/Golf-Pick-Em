# Senior review — feat/cfb-picks-readonly

- **Reviewed:** 2026-08-14
- **Head:** 05efab7 (`git rev-parse --short HEAD`)
- **Verdict:** APPROVE WITH QUESTIONS

## Summary
Two changes. (1) PR-B: once a CFB week locks, `/cfb/pool/:id/picks` renders a frozen
read-only card (locked / auto-filled / graded). `shapeCard` is lifted verbatim from
CfbPoolDetail into `utils/cfbCard.js`, and the pick-row rendering is extracted from
CfbStandings into a new shared `CfbCardRows`, so the picks card and the pool-detail
scorecard-expand can't drift. Week resolution now honors a `?week=N` deep-link (even to a
locked week) and falls back to the latest locked week. (2) Admin: a sport chooser at
`/admin/create`, a Golf|CFB switcher on both admin panels, and a filter so CFB pools stop
appearing in the golf admin lists.

The refactor is clean and genuinely reduces duplication (net −211/+502 but most of the +
is two new small files that replace inlined blocks). The read-only state machine is
guarded correctly and I found no crash/null path. The one thing worth the founder's
attention is a design choice — golf detects "is this a golf pool" by probing the golf
schema, when the sport is already stamped on the event. Nothing blocks merge.

## Findings
Ranked most-severe first.

1. **(debt) Golf-pool filter uses a schema-probe where a `sport_id` filter already
   exists — `src/lib/golf.js:113-127` (`getAllPools`).** The new filter answers "is this a
   golf pool?" by fetching `golf.event_details` for every pool's event and keeping only
   pools that got a row back. This is *functionally correct* — golf pool creation always
   mints a `golf.event_details` row and CFB pools never do, so the proxy holds today. But
   the authoritative answer is already sitting on `public.events.sport_id`: the CFB side
   (`getAdminCfbPools`, cfb.js:156) filters pools with a plain `events.sport_id = 'cfb'`.
   So the codebase now has *two different mechanisms* for the same "which sport" question —
   one clean indexed-column filter (CFB) and one cross-schema existence-probe (golf). In
   `getAllPools` the probe also costs a second round-trip that a `sport_id` filter
   wouldn't. Cost: when sport #3 lands, the sport-filter pattern doesn't generalize — each
   sport would need its own schema probe instead of one `sport_id` value. In
   `getAdminPools` the probe is nearly free (that function fetches `event_details` anyway
   for refresh counts), so the filter there is fine; it's `getAllPools` that pays for the
   proxy. Fix direction: filter both on `events.sport_id = 'golf'`. See Question 1 —
   there may be a seam reason (`golf.js` is deliberately the only file touching the golf
   schema) that I want the founder to confirm is the intended trade.

2. **(nit) Missing `?week` param parses to `0` and relies on "no Week 0 exists" —
   `src/pages/cfb/CfbPicks.jsx:100-102`.** `Number(searchParams.get('week'))` returns `0`
   when the param is absent (`Number(null) === 0`), so `weeks.find(w => w.week_number === 0)`
   runs on every plain visit. It's harmless *today* because `CreateCfbPool` enforces
   `startWeek >= 1`, so no week ever has number 0 and the lookup misses and falls through.
   But CFB "Week 0" (late-August games) is a real concept; if a Week-0 pool were ever
   created, a bare `/picks` visit with no deep-link would silently resolve to Week 0
   instead of the current open week. Latent, not live. Fix direction: guard with
   `searchParams.has('week')` (or `wanted > 0`) before treating it as a deep-link.

3. **(nit) A graded-and-auto-filled card shows the "missed the deadline" notice instead
   of a "final" notice — `src/pages/cfb/CfbPicks.jsx:308-312`.** When a week is both graded
   and was auto-filled, `notice` takes the auto-filled branch ("You missed the deadline —
   a random card was filled in…") and never says the week is final. Low impact: the card
   subtitle still reads "Final" and the result pills/points are visible, so the user isn't
   misled — it's just that the final-ness is conveyed by the subtitle rather than the
   notice. Fine to leave; flag only if you'd rather the notice lead with "final."

**Note (not a defect):** the extracted `CfbCardRows` now renders the `DD → +4`
effective-line chip, which means the **pool-detail scorecard-expand also gains that chip**
(it previously showed a plain "DD"). That's a consistency win and presumably intended, but
it's a visible change to an already-shipped surface that the PR body frames as a
picks-page feature — worth knowing it touches both.

## Questions for the founder

1. **The golf pool list figures out "this is a golf pool" by asking the golf database
   whether it has a golf-specific detail row — instead of reading the sport label that's
   already stored on the pool's event.** (Every pool's event carries a `sport_id`, and the
   CFB side already filters on it directly.) The probe works and isn't wrong; the tradeoff
   is an extra database round-trip in one spot and a second, different way of doing the
   same thing that won't generalize cleanly when a third sport arrives. Was that a
   deliberate choice to keep all golf-schema access inside the one `golf.js` file, or is it
   fine to switch this to the simpler `sport_id = 'golf'` filter? (Not a merge blocker
   either way — just deciding whether to clean it up now or note it as debt.)

2. **When a week is both finished (graded) and was auto-filled for a player who missed the
   deadline, the banner above their card says "you missed the deadline, a random card was
   filled in" — it doesn't also say the week is final** (the "Final" label still appears in
   the card's subtitle). Is that the message you want in that corner case, or should a
   finished week always lead with "final"? Purely a copy call.
