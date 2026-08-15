import { CfbStandings } from 'poold';
import { standings, currentUserId } from '../preview-data-cfb.js';

// CFB season-standings hero (scorecard-expand). Rendered on the cream card page inside
// a white card, as on the pool-detail page.
const frame = { background: '#F4EFE4', padding: 16 } as const;
const card = { background: '#FFFDF8', border: '1px solid #E4DDD0', borderRadius: 14, overflow: 'hidden' } as const;

export const SeasonStandings = () => (
  <div style={frame}>
    <div style={{ maxWidth: 520, ...card }}>
      <CfbStandings entries={standings} currentUserId={currentUserId} weekLabel="Week 4" />
    </div>
  </div>
);
