import { CfbWidgets, WidgetGrid } from 'poold';
import { games, weekPicks, weeklyPoints, prize } from '../preview-data-cfb.js';

// The CFB widget row. Its children use `col-span-2`, so render them inside the shared
// WidgetGrid (a 2-col grid) on the cream card page.
const frame = { background: '#F4EFE4', padding: 16, maxWidth: 640 } as const;

// Locked week — all four widgets (slate, weekly points, most-backed, underdog board)
// plus the reused Prize Pool.
export const Locked = () => (
  <div style={frame}>
    <WidgetGrid>
      <CfbWidgets
        games={games} weekPicks={weekPicks} weeklyPoints={weeklyPoints}
        weekLabel="Week 4" locked
        stakeAmount={prize.stakeAmount} participantCount={prize.participantCount}
        payoutStructure={prize.payoutStructure}
      />
    </WidgetGrid>
  </div>
);

// Pre-lock — pick-derived widgets are held behind a note; only the slate shows.
export const PreLock = () => (
  <div style={frame}>
    <WidgetGrid>
      <CfbWidgets
        games={games} weekPicks={[]} weeklyPoints={[]}
        weekLabel="Week 5" locked={false}
      />
    </WidgetGrid>
  </div>
);
