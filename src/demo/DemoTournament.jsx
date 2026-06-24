import { Link } from 'react-router-dom'
import { useDemo } from './DemoContext'
import { demoTournament, demoParticipants, demoLeaderboardData } from './demoData'
import { computeScores, assignRanks } from '../utils/scoring'
import Standings from '../components/leaderboard/Standings'
import PoolHeader from '../components/pool/PoolHeader'
import StandingsCard from '../components/pool/StandingsCard'
import WidgetGrid from '../components/pool/WidgetGrid'

export default function DemoTournament() {
  const { submitted, myPickRows } = useDemo()

  const picks = [...demoParticipants, ...myPickRows]
  const participantCount = new Set(picks.map(p => p.user_id)).size
  const standings = assignRanks(computeScores({
    picks,
    leaderboardData: demoLeaderboardData,
    scoresToKeep: demoTournament.scores_to_keep,
  }))

  const roundBadge = `R${demoLeaderboardData.roundId}${demoLeaderboardData.status === 'In Progress' ? ' · In Progress' : ''}`
  const heroName = demoTournament.course_name ?? demoTournament.name
  const metaParts = [
    demoTournament.scores_to_keep && demoTournament.pick_count
      ? `Best ${demoTournament.scores_to_keep} of ${demoTournament.pick_count}`
      : null,
    `${participantCount} players`,
  ].filter(Boolean)

  return (
    <div className="min-h-screen bg-[#F4EFE4] pb-8">

      <PoolHeader
        backTo="/demo"
        backLabel="← Pools"
        subLabel={demoTournament.pga_name}
        heroName={heroName}
        metaParts={metaParts}
        roundBadge={roundBadge}
        updatedLabel="Updated just now"
      />

      <div className="max-w-[640px] mx-auto px-[18px] pt-[22px]">

        {/* Your-picks banner */}
        {submitted ? (
          <div className="bg-white border border-[#E4DDD0] rounded-[12px] px-[14px] py-[11px] flex items-center justify-between mb-[18px]">
            <div className="flex items-center gap-[9px]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1B4332" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-[13px] text-[#1C1610]">
                Your card is in — find <span className="font-semibold">You</span> on the board below.
              </span>
            </div>
            <Link to="/demo/picks" className="text-[12.5px] font-semibold text-brand no-underline">
              Edit picks →
            </Link>
          </div>
        ) : (
          <div className="bg-white border border-[#E4DDD0] rounded-[12px] px-[14px] py-[11px] flex items-center justify-between mb-[18px]">
            <span className="text-[13px] text-[#1C1610]">Make your picks to drop into the standings.</span>
            <Link to="/demo/picks" className="text-[12.5px] font-semibold text-brand no-underline">
              Make picks →
            </Link>
          </div>
        )}

        {/* Standings */}
        <StandingsCard>
          <Standings
            standings={standings}
            currentUserId="demo-you"
            pickCount={demoTournament.pick_count}
          />
        </StandingsCard>

        {/* Widget grid */}
        <WidgetGrid
          leaderboardData={demoLeaderboardData}
          picks={picks}
          stakeAmount={demoTournament.stake_amount}
          participantCount={participantCount}
          payoutStructure={demoTournament.payout_structure}
        />
      </div>
    </div>
  )
}
