import { Link } from 'react-router-dom'
import { demoTournament, demoParticipants } from './demoData'

export default function DemoLanding() {
  const participantCount = new Set(demoParticipants.map(p => p.user_id)).size

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="text-center mb-10">
        <h1 className="font-display font-bold text-5xl text-fairway tracking-tight">PICK'EM</h1>
        <p className="text-warm-400 text-sm mt-2">
          A quick look around — pick your players, watch the leaderboard.
        </p>
      </div>

      <h2 className="font-display font-bold text-xs uppercase tracking-widest text-warm-400 mb-3">
        Your Pools
      </h2>
      <Link
        to="/demo/tournament"
        className="block bg-white border border-warm-200 rounded-lg p-5 hover:border-warm-300 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            {demoTournament.pga_name && (
              <p className="font-display font-bold text-xs uppercase tracking-widest text-gold mb-1">
                {demoTournament.pga_name}
              </p>
            )}
            <p className="font-display font-bold text-xl text-charcoal tracking-tight leading-tight">
              {demoTournament.course_name ?? demoTournament.name}
            </p>
            <p className="text-sm text-warm-400 mt-1">
              {participantCount} players · pick {demoTournament.pick_count}, best {demoTournament.scores_to_keep} count
            </p>
          </div>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-fairway/10 text-fairway shrink-0">
            open
          </span>
        </div>
        <p className="text-sm text-fairway font-medium mt-4">Enter pool →</p>
      </Link>

      <p className="text-center text-xs text-warm-400 mt-10">
        Like what you see?{' '}
        <Link to="/" className="text-fairway hover:text-fairway/80 font-medium transition-colors">
          Sign in to play for real
        </Link>
      </p>
    </div>
  )
}
