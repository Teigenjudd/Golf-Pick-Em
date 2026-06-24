import { PGALeadersWidget, MostPopularWidget, TierValueWidget, PrizePoolWidget } from '../leaderboard/Widgets'

// Shared widget row below the standings.
// Rendered by both the live TournamentDetail and the demo (change once, both update).
export default function WidgetGrid({ leaderboardData, picks, stakeAmount, participantCount, payoutStructure }) {
  const hasPrize = stakeAmount && payoutStructure?.length

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
