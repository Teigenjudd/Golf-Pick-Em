import { CfbCardRows } from 'poold';
import { gradedCard } from '../preview-data-cfb.js';

// The shared 6-pick + TOTAL row renderer, shown in the brick-left-bar card it lives in.
export const GradedCard = () => (
  <div style={{ background: '#F4EFE4', padding: 16 }}>
    <div style={{ maxWidth: 540, display: 'flex', background: '#FFFDF8', border: '1px solid #E4DDD0', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ width: 3, flex: 'none', background: '#D6291B' }} />
      <div style={{ flex: 1, padding: '12px 16px' }}>
        <CfbCardRows picks={gradedCard.picks} total={gradedCard.total} totalLabel="Total · Week 4" />
      </div>
    </div>
  </div>
);
