import { PGALeadersWidget, MostPopularWidget, TierValueWidget, PrizePoolWidget } from '../leaderboard/Widgets'

// Shared 2-col widget row below the standings. Golf renders its own widgets by default;
// another sport passes its widgets as `children` (rendered in the same grid) so the row
// layout stays shared. See docs/CFB_UI_PLAN.md §6a.
export default function WidgetGrid({ leaderboardData, picks, stakeAmount, participantCount, payoutStructure, children }) {
  const hasPrize = stakeAmount && payoutStructure?.length

  if (children) {
    return <div className="grid grid-cols-2 gap-3">{children}</div>
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {hasPrize && (
        <PrizePoolWidget
          stakeAmount={stakeAmount}
          participantCount={participantCount}
          payoutStructure={payoutStructure}
        />
      )}
      <div className={hasPrize ? '' : 'col-span-2'}>
        <PGALeadersWidget leaderboardData={leaderboardData} />
      </div>
      <div className="col-span-2">
        <MostPopularWidget picks={picks} />
      </div>
      <div className="col-span-2">
        <TierValueWidget picks={picks} leaderboardData={leaderboardData} />
      </div>
    </div>
  )
}
