import { SportBadge } from 'poold';

const open    = { line1: 'THE', line2: 'OPEN',  bg: '#162258', border: '#C9A368' };
const usopen  = { line1: 'US',  line2: 'OPEN',  bg: '#0A3161', border: '#C9A368' };
const masters = { line1: 'THE', line2: 'MASTERS', bg: '#004F2D', border: '#E8C872' };
const pga     = { line1: 'PGA', line2: 'CHAMP', bg: '#0B4DA2', border: '#E8C872' };

const row = { display: 'flex', gap: 22, alignItems: 'flex-end', padding: 8 } as const;

export const Majors = () => (
  <div style={row}>
    <SportBadge config={open} size="lg" />
    <SportBadge config={usopen} size="lg" />
    <SportBadge config={masters} size="lg" />
    <SportBadge config={pga} size="lg" />
  </div>
);

export const Sizes = () => (
  <div style={row}>
    <SportBadge config={usopen} size="sm" />
    <SportBadge config={usopen} size="md" />
    <SportBadge config={usopen} size="pick" />
    <SportBadge config={usopen} size="lg" />
  </div>
);
