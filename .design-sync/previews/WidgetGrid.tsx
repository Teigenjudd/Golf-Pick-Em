import { WidgetGrid } from 'poold';
import { picks, leaderboardData, tournament } from '../preview-data.js';

export const Full = () => (
  <div style={{ background: '#F4EFE4', padding: 16 }}>
    <WidgetGrid
      leaderboardData={leaderboardData}
      picks={picks}
      stakeAmount={tournament.stake_amount}
      participantCount={12}
      payoutStructure={tournament.payout_structure}
    />
  </div>
);
