import { CfbCardTracker } from 'poold';

// Sticky submit bar for the card builder. position:fixed, so anchor it inside a
// transformed frame (same trick as PicksSubmitBar's preview).
const frame = { position: 'relative', transform: 'translateZ(0)', height: 84, background: '#F4EFE4', overflow: 'hidden' } as const;

export const Incomplete = () => (
  <div style={frame}>
    <CfbCardTracker atsCount={3} ddCount={0} dogCount={1} valid={false}
      warning="Pick 2 more ATS games to complete your card." onSubmit={() => {}} />
  </div>
);

export const Ready = () => (
  <div style={frame}>
    <CfbCardTracker atsCount={5} ddCount={1} dogCount={1} valid onSubmit={() => {}} />
  </div>
);

export const UpdateExisting = () => (
  <div style={frame}>
    <CfbCardTracker atsCount={5} ddCount={1} dogCount={1} valid hasExistingCard onSubmit={() => {}} />
  </div>
);
