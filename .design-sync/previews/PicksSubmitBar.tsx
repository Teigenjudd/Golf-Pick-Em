import { PicksSubmitBar } from 'poold';

const frame = { position: 'relative', transform: 'translateZ(0)', height: 76, background: '#F4EFE4', overflow: 'hidden' } as const;

export const Incomplete = () => <div style={frame}><PicksSubmitBar selectedCount={5} totalCount={8} onSubmit={() => {}} /></div>;
export const Ready = () => <div style={frame}><PicksSubmitBar selectedCount={8} totalCount={8} onSubmit={() => {}} /></div>;
