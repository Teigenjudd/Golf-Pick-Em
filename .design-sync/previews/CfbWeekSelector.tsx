import { CfbWeekSelector } from 'poold';
import { weeks, selectedWeekNumber } from '../preview-data-cfb.js';

// The week scroller lives inside the navy PoolHeader band, so it's styled for a dark
// ground — preview it on the navy gradient.
const navy = { background: 'linear-gradient(165deg,#101C3D 0%,#0A1229 100%)', padding: '4px 0 16px', maxWidth: 520 } as const;

export const OnNavy = () => (
  <div style={navy}>
    <CfbWeekSelector weeks={weeks} selectedNumber={selectedWeekNumber} onSelect={() => {}} />
  </div>
);
