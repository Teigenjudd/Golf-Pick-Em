import { Standings, StandingsCard } from 'poold';
import { standings, currentUserId, tournament } from '../preview-data.js';

export const Leaderboard = () => (
  <StandingsCard>
    <Standings standings={standings} currentUserId={currentUserId} pickCount={tournament.pick_count} />
  </StandingsCard>
);
