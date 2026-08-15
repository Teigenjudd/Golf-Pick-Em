import { CfbCardReadonly } from 'poold';
import { gradedCard, liveCard, autoFilledCard } from '../preview-data-cfb.js';

const frame = { background: '#F4EFE4', padding: 16, maxWidth: 560 } as const;

// The frozen read-only weekly card, in its three states.
export const Graded = () => (
  <div style={frame}>
    <CfbCardReadonly card={gradedCard} weekLabel="Week 4"
      notice="Picks locked Sat, Sep 26, 12:00 PM EDT. This card is final." />
  </div>
);

export const Live = () => (
  <div style={frame}>
    <CfbCardReadonly card={liveCard} weekLabel="Week 4"
      notice="Your card is locked — games are underway." />
  </div>
);

export const AutoFilled = () => (
  <div style={frame}>
    <CfbCardReadonly card={autoFilledCard} weekLabel="Week 4" variant="autofilled"
      notice="You missed the Week 4 deadline, so a random valid card was auto-filled for you." />
  </div>
);
