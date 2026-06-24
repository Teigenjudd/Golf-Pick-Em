import { Link } from 'react-router-dom'
import { demoTournament, demoParticipants } from './demoData'
import SportBadge from '../components/SportBadge'

export default function DemoLanding() {
  const participantCount = new Set(demoParticipants.map(p => p.user_id)).size

  return (
    <div className="min-h-screen bg-sand">
      <div className="max-w-[480px] mx-auto px-[18px] pt-10 pb-12">

        {/* Wordmark */}
        <div className="text-center mb-8">
          <div className="font-display font-extrabold text-[44px] text-brand tracking-[.07em] leading-none">POOLD</div>
          <div className="font-display italic font-semibold text-[14px] text-warm-400 mt-1.5">A quick look around.</div>
        </div>

        {/* Section label */}
        <div className="font-display font-bold text-[10px] uppercase tracking-[.22em] text-warm-400 mb-[10px]">
          Your Active Pools
        </div>

        {/* Pool tile — matches the dashboard open-pool card */}
        <div className="bg-white border border-[#EAD8C4] rounded-2xl overflow-hidden mb-[10px]">
          {/* Sport strip */}
          <div className="flex items-center gap-3 px-[15px] py-[13px]" style={{ background: 'linear-gradient(105deg,#1B4332,#0D1F18)' }}>
            <SportBadge config={null} size="md" />
            <div className="flex-1">
              <div className="font-display font-bold text-[9.5px] uppercase tracking-[.14em] text-gold">PICKS OPEN</div>
              <div className="font-display font-extrabold text-[18px] text-cream leading-[1.05]">{demoTournament.name}</div>
            </div>
          </div>

          {/* Meta row */}
          <div className="px-[15px] py-[13px]">
            <div className="text-[13.5px] font-semibold text-[#1C1610]">
              {demoTournament.course_name ?? demoTournament.name}
            </div>
            <div className="text-[11.5px] text-warm-400 mt-[1px]">
              {participantCount} players · Best {demoTournament.scores_to_keep} of {demoTournament.pick_count}
            </div>
          </div>

          {/* CTAs */}
          <div className="px-[15px] pb-[13px] flex gap-[9px]">
            <Link to="/demo/tournament" className="flex-1 bg-brand rounded-[10px] py-3 text-center font-bold text-[13.5px] text-white no-underline">
              View leaderboard →
            </Link>
            <Link to="/demo/picks" className="border border-[#EAD8C4] rounded-[10px] py-3 px-[14px] text-center font-medium text-[13px] text-warm-400 no-underline whitespace-nowrap">
              Make picks
            </Link>
          </div>
        </div>

        <p className="text-center text-[12px] text-warm-400 mt-10">
          Like what you see?{' '}
          <Link to="/" className="text-brand hover:text-brand/80 font-semibold transition-colors">
            Sign in to play for real →
          </Link>
        </p>
      </div>
    </div>
  )
}
