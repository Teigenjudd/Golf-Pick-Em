import { TierValueWidget } from 'poold';
import { picks, leaderboardData } from '../preview-data.js';

export const Default = () => (
  <div style={{ maxWidth: 300, padding: 8 }}>
    <TierValueWidget picks={picks} leaderboardData={leaderboardData} />
  </div>
);
