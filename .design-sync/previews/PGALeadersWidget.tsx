import { PGALeadersWidget } from 'poold';
import { leaderboardData } from '../preview-data.js';

export const Default = () => (
  <div style={{ maxWidth: 300, padding: 8 }}>
    <PGALeadersWidget leaderboardData={leaderboardData} />
  </div>
);
