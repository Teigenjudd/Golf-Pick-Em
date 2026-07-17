import { TierPicker } from 'poold';
import { tiers } from '../preview-data.js';

const three = tiers.slice(0, 3);
const selected: Record<string, unknown> = {};
three.forEach((t: any) => { selected[t.id] = t.tier_players[0]; });

export const Empty = () => (
  <div style={{ maxWidth: 520, padding: 8 }}>
    <TierPicker tiers={three} selections={{}} onSelect={() => {}} />
  </div>
);

export const WithSelections = () => (
  <div style={{ maxWidth: 520, padding: 8 }}>
    <TierPicker tiers={three} selections={selected} onSelect={() => {}} />
  </div>
);
