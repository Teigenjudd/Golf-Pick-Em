import { PicksHeader } from 'poold';

const badge = { line1: 'US', line2: 'OPEN', bg: '#0A3161', border: '#C9A368' };

export const Default = () => (
  <PicksHeader
    backTo="#"
    badgeConfig={badge}
    eyebrow="2026 US Open Pickem"
    subtitle="Pick one from each tier - Best 5 of 8 count"
  />
);
