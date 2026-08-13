# Senior review — cfb-ui-phase1-foundation

- **Reviewed:** 2026-08-13
- **Head:** 33317a7 (`git rev-parse --short HEAD`)
- **Verdict:** APPROVE WITH QUESTIONS

## Summary
Phase 1 of the CFB player UI: a locked "Varsity Navy" theme (`src/theme/cfb.js`), a
backward-compatible prop-ification of the four shared pool shells so a second sport can
dress them, two placeholder CFB pages, and two new routes. This is scaffolding — no live
CFB screens, no backend, no golf logic touched. The load-bearing claim (golf renders
byte-identically after the shells were prop-ified) holds under inspection: every new prop
defaults to golf's exact prior value, and all four golf callers pass zero new props. Tests
green (173/173). This is a clean, well-scoped, low-risk branch. The one thing worth a
decision is small and forward-looking, not a merge blocker.

## Findings
Ranked most-severe first.

**1. (nit / debt) `getCfbPool` doesn't verify the pool is actually a CFB pool.**
`src/lib/cfb.js:153` reads from `public.pools` (which holds *all* pools, golf included) and
only tags on `season_year` from the `cfb` schema. So hitting `/cfb/pool/<a-golf-pool-id>`
renders golf data inside the navy CFB chrome with `season_year = null` — wrong surface, but
no crash. Today nothing links here (routes are reachable only by typing the URL), so this is
harmless *now*; it matters because Phase 2 builds the real standings on top of this same
fetch. Fix direction: either have `getCfbPool` return null when the event has no
`cfb.event_details` row (treat "not a CFB pool" as not-found), or let the dashboard be the
guard by only ever linking CFB pools here. Cheap to decide now, annoying to retrofit later.

**2. (nit) Loading-state asymmetry between the two placeholder pages.**
`CfbPoolDetail.jsx` tracks a `loading` flag and shows "Loading…"; `CfbPicks.jsx` has no
loading state and shows the "coming soon" card immediately while the fetch is in flight. Not
a bug (the picks page has nothing to wait for yet), but the two pages will want to converge
on one pattern when their real bodies land, so flag it as intentional now or unify it.

**3. (note, not a defect) New routes aren't linked from the dashboard yet.**
`/cfb/pool/:id` and `/cfb/pool/:id/picks` exist but are unreachable through the UI. Expected
for a scaffolding phase — noting it only so it's a conscious "wired in a later phase," not a
forgotten link.

### Byte-identical verification (the load-bearing claim) — passed
- `#C9A368` is exactly the `--color-gold` token (`src/index.css:8`), so `text-gold` →
  `style={{color:'#C9A368'}}` is a visual no-op on the sub-label / round-badge / eyebrow.
- Both header gradients default to the identical `linear-gradient(165deg,#1B4332 0%,#0F241B 100%)`
  literal the components used before.
- Wrapping each root `<div>` in a fragment adds no DOM: when `rib`/`children` are null the
  fragment renders exactly the single prior `<div>` and nothing else. `{children}` → null,
  `{rib && …}` → null.
- `StandingsCard` default `label` = `"Pick'em Standings"` (ASCII apostrophe) renders the same
  glyph the old `Pick&apos;em` produced.
- `WidgetGrid` with no `children` (golf's case) falls through to the original branch untouched.
- `PicksHeader` `showBadge` defaults true → golf still renders `SportBadge`.
- Confirmed all four golf/demo callers (`TournamentDetail.jsx`, `Picks.jsx`,
  `DemoTournament.jsx`, `DemoPicks.jsx`) pass none of the new props.
- Placeholder pages use a correct unmount-guarded async IIFE (`let active` + cleanup), the
  lint-clean effect pattern; no `async` handed straight to `useEffect`.

## Questions for the founder

1. **Should the CFB pool pages refuse a non-CFB pool?** Right now the page fetches from the
   shared pool table without checking the sport, so if someone lands on `/cfb/pool/<id>` with
   a *golf* pool's id, they'd see golf data wearing the navy CFB skin (no crash, just the wrong
   outfit). Two ways to handle it: (a) make the fetch treat "this pool isn't a CFB pool" as
   "not found" so it shows your error card, or (b) rely entirely on the dashboard to only ever
   send CFB pools to this route. Both are fine — (a) is belt-and-suspenders, (b) is simpler and
   trusts the navigation. Which do you want before Phase 2 starts building the real standings on
   this same fetch? (Not a merge blocker — nothing links here yet.)
