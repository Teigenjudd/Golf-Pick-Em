## Poold design system

Poold is a golf pick'em app (React + Tailwind CSS v4, "clubhouse not sportsbook"
voice). These are the real shipped components — brand-themed and data-driven.
Compose them as-is; write your own layout glue with the Tailwind token classes
below. Do not invent lookalike components or off-brand colors.

### Wrapping & setup
- Styles load from `styles.css` (Tailwind v4 tokens + utilities) — already wired.
- **Router:** `PoolHeader`, `PicksHeader`, `Footer`, and `BottomNav` render
  react-router `<Link>`s, so they must sit inside a router. Wrap them in the
  exported `MemoryRouter` (`window.Poold.MemoryRouter`).
- **BottomNav** also reads auth context — wrap it in the exported `AuthProvider`
  (nested inside `MemoryRouter`). It renders signed-out (a "?" avatar) with no
  backend, which is exactly what you want in a mockup.
- Everything else (`SportBadge`, `Standings`, `TierPicker`, the `*Widget`s,
  `WidgetGrid`, `StandingsCard`, `PicksSubmitBar`) is presentational — pass data
  props, no wrapper needed.

### Styling idiom — Tailwind v4 utility classes (no CSS-in-JS, no class maps)
Style your layout with Tailwind utilities keyed to Poold's tokens:
- Color: `bg-fairway` (dark-green primary), `bg-cream` / `bg-sand` (page bg),
  `text-gold` (accent), `text-birdie` (under-par RED — in golf red = good),
  `text-charcoal` (body), `bg-warm-100`..`bg-warm-600`, `border-warm-200`.
- Type: `font-display` (Barlow Condensed — tournament names, scores, section
  labels; pair with `uppercase tracking-widest` or `tracking-tight`),
  `font-body` (Inter — default body).
- Cards: `bg-white border border-warm-200 rounded-lg`. Primary button:
  `bg-fairway text-cream rounded-lg`.

### Where the truth lives
- Per-component API + usage examples: each `<Name>.d.ts` and `<Name>.prompt.md`.
- Token/utility source: `styles.css` and its imports — read before styling.

### Data shapes (data-driven components)
- `Standings` — `standings` (array of {rank, display_name, total_score, picks}),
  `currentUserId`, `pickCount`.
- `TierPicker` — `tiers` (array of {id, tier_number, label, tier_players:
  [{id, player_name, odds}]}), `selections` (map tierId -> player object),
  `onSelect(tier, player)`.
- Widgets take `leaderboardData` (Slash Golf leaderboard shape) and/or `picks`;
  `PrizePoolWidget` takes `stakeAmount`, `participantCount`, `payoutStructure`
  (percent array e.g. [60,30,10]).
- `SportBadge` — `config` {line1, line2, bg, border}, `size` "sm"|"md"|"pick"|"lg".

### Build snippet
```jsx
import { PoolHeader, StandingsCard, Standings, MemoryRouter } from 'poold';

<MemoryRouter>
  <PoolHeader backTo="#" subLabel="U.S. Open" heroName="Shinnecock Hills"
    badgeConfig={{ line1: 'US', line2: 'OPEN', bg: '#0A3161', border: '#C9A368' }}
    metaParts={['Best 5 of 8', '12 players']} roundBadge="R3" />
  <div className="max-w-[640px] mx-auto px-4 pt-6 bg-cream">
    <StandingsCard>
      <Standings standings={standings} currentUserId="u1" pickCount={8} />
    </StandingsCard>
  </div>
</MemoryRouter>
```
