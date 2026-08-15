import { AdminSportSwitcher } from 'poold';

// Segmented Golf | CFB control atop both admin panels. Contains a <Link> (provider
// supplies the Router). Shown in both sizes / both active states.
const frame = { background: '#F4EFE4', padding: 24, display: 'flex', gap: 24, alignItems: 'center' } as const;

export const GolfActive = () => (
  <div style={frame}>
    <AdminSportSwitcher active="golf" />
    <AdminSportSwitcher active="golf" size="lg" />
  </div>
);

export const CfbActive = () => (
  <div style={frame}>
    <AdminSportSwitcher active="cfb" />
    <AdminSportSwitcher active="cfb" size="lg" />
  </div>
);
