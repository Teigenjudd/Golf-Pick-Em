import { PrizePoolWidget } from 'poold';

export const Default = () => (
  <div style={{ maxWidth: 300, padding: 8 }}>
    <PrizePoolWidget stakeAmount={25} participantCount={12} payoutStructure={[60, 30, 10]} />
  </div>
);
