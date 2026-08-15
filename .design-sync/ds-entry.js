// Barrel entry for the Poold design-system sync (design-sync skill).
// The app's components are default exports across several files; a plain
// `export *` synth entry would drop every default, so we re-export each one
// as a NAMED export here. This is the module esbuild bundles into
// window.Poold. Keep in sync with src/components/ when components are added.
export { default as BottomNav } from '../src/components/BottomNav.jsx';
export { default as Footer } from '../src/components/Footer.jsx';
export { default as SportBadge } from '../src/components/SportBadge.jsx';
export { default as Standings } from '../src/components/leaderboard/Standings.jsx';
export {
  WidgetHeader,
  PGALeadersWidget,
  MostPopularWidget,
  PrizePoolWidget,
  TierValueWidget,
} from '../src/components/leaderboard/Widgets.jsx';
export { default as TierPicker } from '../src/components/picks/TierPicker.jsx';
export { default as PicksHeader } from '../src/components/pool/PicksHeader.jsx';
export { default as PicksSubmitBar } from '../src/components/pool/PicksSubmitBar.jsx';
export { default as PoolHeader } from '../src/components/pool/PoolHeader.jsx';
export { default as StandingsCard } from '../src/components/pool/StandingsCard.jsx';
export { default as WidgetGrid } from '../src/components/pool/WidgetGrid.jsx';

// CFB (Varsity Navy) — the sport-specific pool-detail + picks building blocks.
export { default as CfbStandings } from '../src/components/cfb/CfbStandings.jsx';
export { default as CfbCardRows } from '../src/components/cfb/CfbCardRows.jsx';
export { default as CfbCardReadonly } from '../src/components/cfb/CfbCardReadonly.jsx';
export { default as CfbCardTracker } from '../src/components/cfb/CfbCardTracker.jsx';
export { default as CfbGameCard } from '../src/components/cfb/CfbGameCard.jsx';
export { default as CfbPoolTile } from '../src/components/cfb/CfbPoolTile.jsx';
export { default as CfbWeekSelector } from '../src/components/cfb/CfbWeekSelector.jsx';
export { default as CfbWidgets } from '../src/components/cfb/CfbWidgets.jsx';

// Admin chrome (sport-agnostic). Full stateful admin pages stay out of the design
// tool (they fetch live data); these two are presentational.
export { default as AdminSportSwitcher } from '../src/components/admin/AdminSportSwitcher.jsx';
export { default as CreatePoolChooser } from '../src/pages/admin/CreatePoolChooser.jsx';

// Preview-only providers (not synced as components; used by cfg.provider so
// Link-based components have a Router and BottomNav has its AuthContext).
export { MemoryRouter } from 'react-router-dom';
export { AuthProvider } from '../src/context/AuthContext.jsx';
