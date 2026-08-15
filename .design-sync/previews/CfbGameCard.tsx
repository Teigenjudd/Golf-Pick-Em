import { CfbGameCard } from 'poold';
import { builderGame } from '../preview-data-cfb.js';

// One game in the weekly card builder. Static states (the page owns real card state).
const frame = { background: '#F4EFE4', padding: 16, maxWidth: 420 } as const;
const noop = () => {};
const handlers = { onPickAts: noop, onToggleDoubleDown: noop, onPickUnderdog: noop };

export const Unpicked = () => (
  <div style={frame}>
    <CfbGameCard game={builderGame} atsSelectedTeam={null} isDoubleDown={false}
      isUnderdogPick={false} atsFull={false} dogFilled={false} {...handlers} />
  </div>
);

export const AtsSelected = () => (
  <div style={frame}>
    <CfbGameCard game={builderGame} atsSelectedTeam={builderGame.home_team} isDoubleDown={false}
      isUnderdogPick={false} atsFull={false} dogFilled={false} {...handlers} />
  </div>
);

export const DoubleDown = () => (
  <div style={frame}>
    <CfbGameCard game={builderGame} atsSelectedTeam={builderGame.home_team} isDoubleDown
      isUnderdogPick={false} atsFull={false} dogFilled={false} {...handlers} />
  </div>
);

export const UnderdogTaken = () => (
  <div style={frame}>
    <CfbGameCard game={builderGame} atsSelectedTeam={null} isDoubleDown={false}
      isUnderdogPick atsFull={false} dogFilled={false} {...handlers} />
  </div>
);
