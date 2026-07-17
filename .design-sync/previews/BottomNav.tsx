import { BottomNav } from 'poold';

// BottomNav is position:fixed; a transformed wrapper becomes its containing
// block so it renders inside the card instead of pinning to the viewport.
const frame = { position: 'relative', transform: 'translateZ(0)', height: 72, background: '#F8F0E4', overflow: 'hidden' } as const;

export const PoolsActive = () => <div style={frame}><BottomNav active="pools" /></div>;
export const YouActive = () => <div style={frame}><BottomNav active="you" /></div>;
