import { Link } from 'react-router-dom'
import { useDemo } from './DemoContext'
import { demoTournament, demoParticipants, demoLeaderboardData } from './demoData'
import { computeScores, assignRanks } from '../utils/scoring'
import Standings from '../components/leaderboard/Standings'
import { PGALeadersWidget, MostPopularWidget, TierValueWidget } from '../components/leaderboard/Widgets'

export default function DemoTournament() {
  const { submitted, myPickRows } = useDemo()

  const picks = [...demoParticipants, ...myPickRows]
  const standings = assignRanks(computeScores({
    picks,
    leaderboardData: demoLeaderboardData,
    scoresToKeep: demoTournament.scores_to_keep,
  }))

  const roundBadge = `Round ${demoLeaderboardData.roundId}${demoLeaderboardData.status === 'In Progress' ? ' · In Progress' : ''}`

  return (
    <div>
      {/* ── Header ── */}
      <div className="bg-fairway px-6 pt-6 pb-8">
        <div className="max-w-5xl mx-auto">
          <Link to="/demo" className="text-cream/40 hover:text-cream/70 text-sm transition-colors">
            ← Pools
          </Link>

          <div className="flex items-end justify-between mt-4 gap-6">
            <div>
              {demoTournament.pga_name && (
                <p className="font-display font-bold text-xs uppercase tracking-widest text-gold mb-1">
                  {demoTournament.pga_name}
                </p>
              )}
              <h1 className="font-display font-bold text-3xl sm:text-4xl text-cream tracking-tight leading-tight">
                {demoTournament.course_name ?? demoTournament.name}
              </h1>
            </div>
            <div className="text-right shrink-0 pb-0.5 space-y-0.5">
              <p className="font-display font-bold text-xs uppercase tracking-widest text-gold">
                {roundBadge}
              </p>
              <p className="text-cream/50 text-sm">Updated just now</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Your-picks CTA ── */}
        {submitted ? (
          <div className="bg-fairway/5 border border-fairway/20 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-fairway">Your card is in — find <span className="font-semibold">You</span> on the board below.</p>
            <Link to="/demo/picks" className="text-xs text-fairway font-medium hover:text-fairway/80 transition-colors shrink-0">
              edit picks →
            </Link>
          </div>
        ) : (
          <div className="bg-gold/10 border border-gold/30 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-charcoal">Make your picks to drop into the standings.</p>
            <Link
              to="/demo/picks"
              className="bg-fairway hover:bg-fairway/90 text-cream text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0"
            >
              Make Your Picks →
            </Link>
          </div>
        )}

        {/* ── Pick'em Standings ── */}
        <div>
          <h2 className="font-display font-bold text-xs uppercase tracking-widest text-warm-500 mb-2">
            Pick'em Standings
          </h2>
          <div className="bg-white border border-warm-200 rounded-lg overflow-hidden">
            <Standings
              standings={standings}
              currentUserId="demo-you"
              pickCount={demoTournament.pick_count}
            />
          </div>
        </div>

        {/* ── Three-column widget row ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PGALeadersWidget leaderboardData={demoLeaderboardData} />
          <MostPopularWidget picks={picks} />
          <TierValueWidget picks={picks} leaderboardData={demoLeaderboardData} />
        </div>
      </div>
    </div>
  )
}
