import { CfbPoolTile } from 'poold';
import { tileNeedsPicks, tileGraded } from '../preview-data-cfb.js';

// Dashboard CFB pool tiles. Contain <Link>s — the design-sync provider wraps everything
// in a MemoryRouter, so they render.
const frame = { background: '#F4EFE4', padding: 16, maxWidth: 380 } as const;

export const NeedsPicks = () => (
  <div style={frame}><CfbPoolTile tile={tileNeedsPicks} /></div>
);

export const Graded = () => (
  <div style={frame}><CfbPoolTile tile={tileGraded} /></div>
);
