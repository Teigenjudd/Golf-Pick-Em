## Poold design system

Poold is a multi-sport social pick'em app for friend groups (React + Tailwind
CSS v4, "clubhouse not sportsbook" voice). Two sports are live today — PGA golf
and college football (CFB) — each with its own sport-specific theme; more sports
follow the same pattern. These are the real shipped components — brand-themed
and data-driven. Compose them as-is; write your own layout glue with the
Tailwind token classes below. Do not invent lookalike components or off-brand
colors.

### Sports & registers
- **General** (brand-level, sport-agnostic): auth, dashboard, admin —
  `AdminSportSwitcher`, `CreatePoolChooser`, `Footer`, `SportBadge`.
- **Golf** (fairway green `#1B4332` + gold `#C9A368`): `PoolHeader`,
  `PicksHeader`, `Standings`, `TierPicker`, `StandingsCard`, `WidgetGrid`, the
  `*Widget`s.
- **CFB — "Varsity Navy"** (navy `#101C3D`→`#0A1229` header gradient, brick
  `#D6291B` accent, green `#2E8F4F` cover/win; constants in `src/theme/cfb.js`):
  `CfbStandings`, `CfbCardRows`, `CfbCardReadonly`, `CfbCardTracker`,
  `CfbGameCard`, `CfbPoolTile`, `CfbWeekSelector`, `CfbWidgets`. Renders inside
  the shared `PoolHeader`/`WidgetGrid` shells (via `children`), same as golf —
  only the theme swaps.

### Wrapping & setup
- Styles load from `styles.css` (Tailwind v4 tokens + utilities) — already wired.
- **Router:** `PoolHeader`, `PicksHeader`, `Footer`, and `CfbPoolTile` render
  react-router `<Link>`s, so they must sit inside a router. Wrap them in the
  exported `MemoryRouter` (`window.Poold.MemoryRouter`).
- The exported `AuthProvider` (nested inside `MemoryRouter`) is also available
  for any component that reads auth context — none of the currently-synced
  components need it, but it's wired for when one does.
- Everything else (`SportBadge`, `Standings`, `TierPicker`, the `*Widget`s,
  `WidgetGrid`, `StandingsCard`, `PicksSubmitBar`, and all `Cfb*` components
  except `CfbPoolTile`) is presentational — pass data props, no wrapper needed.

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
- `CfbStandings` — `entries` (array of {user_id, display_name, rank, total,
  week: {state: 'card'|'nocard'|'hidden', total, picks}}), `currentUserId`,
  `weekLabel`.
- `CfbCardRows` / `CfbCardReadonly` — a graded/live/auto-filled weekly card:
  `picks` (6 rows, 5 ATS + 1 underdog: {slot, pickType, isDoubleDown,
  autoFilled, line, matchup, awayTeam, homeTeam, awayScore, homeScore, status,
  live, kickoffAt, result, points}), `total`, `weekLabel`.
- `CfbGameCard` — one game in the pick builder: `game` {home_team, away_team,
  home_spread, kickoff_at, underdog_team, underdog_spread}, plus selection
  state (`atsSelectedTeam`, `isDoubleDown`, `isUnderdogPick`) and callbacks.
- `CfbPoolTile` — `tile` {poolId, name, seasonYear, playerCount, rank, total,
  cardStatus, currentWeek}.
- `CfbWeekSelector` — `weeks` (array of {id, week_number, label, status}),
  `selectedNumber`. Styled for the dark navy header band it renders inside.
- `CfbWidgets` — `games`, `weekPicks`, `weeklyPoints`, `weekLabel`, `locked`
  (bool — gates the pick-derived widgets pre-lock); renders inside `WidgetGrid`
  via `children`, same pattern as golf.

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
