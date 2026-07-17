import { PoolHeader } from 'poold';

const badge = { line1: 'US', line2: 'OPEN', bg: '#0A3161', border: '#C9A368' };

export const Leaderboard = () => (
  <PoolHeader
    backTo="#"
    subLabel="U.S. Open"
    heroName="Shinnecock Hills"
    badgeConfig={badge}
    metaParts={['Best 5 of 8', '12 players']}
    roundBadge="R3 - In Progress"
    updatedLabel="Updated just now"
  />
);
