import { Link } from 'react-router-dom'
import SportBadge from '../components/SportBadge'
import { CFB_THEME, cfbBadge } from '../theme/cfb'

// Sport chooser — the /demo entry point. Two cards, each themed like its real
// player-facing pages (golf's fairway/gold register; CFB's Varsity Navy), so the
// choice itself previews what's on the other side.
export default function DemoLanding() {
  return (
    <div className="min-h-screen bg-sand">
      <div className="max-w-[480px] mx-auto px-[18px] pt-10 pb-12">

        {/* Wordmark */}
        <div className="text-center mb-8">
          <div className="font-display font-extrabold text-[44px] text-brand tracking-[.07em] leading-none">POOLD</div>
          <div className="font-display italic font-semibold text-[14px] text-warm-400 mt-1.5">A quick look around.</div>
        </div>

        <div className="font-display font-bold text-[10px] uppercase tracking-[.22em] text-warm-400 mb-[10px]">
          Pick a Sport to Demo
        </div>

        {/* Golf card */}
        <div className="bg-white border border-[#EAD8C4] rounded-2xl overflow-hidden mb-[10px]">
          <div className="flex items-center gap-3 px-[15px] py-[13px]" style={{ background: 'linear-gradient(105deg,#1B4332,#0D1F18)' }}>
            <SportBadge config={null} size="md" />
            <div className="flex-1">
              <div className="font-display font-bold text-[9.5px] uppercase tracking-[.14em] text-gold">GOLF · TIERED PICK'EM</div>
              <div className="font-display font-extrabold text-[18px] text-cream leading-[1.05]">2026 US Open Pick'em</div>
            </div>
          </div>
          <div className="px-[15px] py-[13px]">
            <div className="text-[13.5px] text-warm-400">
              Draft one golfer from each tier, best scores count, watch the leaderboard move all tournament long.
            </div>
          </div>
          <div className="px-[15px] pb-[13px]">
            <Link to="/demo/tournament" className="block bg-brand rounded-[10px] py-3 text-center font-bold text-[13.5px] text-white no-underline">
              View golf demo →
            </Link>
          </div>
        </div>

        {/* CFB card */}
        <div className="rounded-2xl overflow-hidden" style={{ background: CFB_THEME.cardWhite, border: `1px solid ${CFB_THEME.border}` }}>
          <div className="flex items-center gap-3 px-[15px] py-[13px]" style={{ background: CFB_THEME.headerGradient }}>
            <SportBadge config={cfbBadge(2026)} size="md" />
            <div className="flex-1">
              <div className="font-display font-bold text-[9.5px] uppercase tracking-[.14em]" style={{ color: CFB_THEME.accent }}>
                CFB · WEEKLY ATS
              </div>
              <div className="font-display font-extrabold text-[18px] leading-[1.05]" style={{ color: CFB_THEME.cream }}>
                Varsity Pick’em
              </div>
            </div>
          </div>
          <div className="px-[15px] py-[13px]">
            <div className="text-[13.5px]" style={{ color: CFB_THEME.muted }}>
              Week 1 is already in the books — jump in and build your Week 2 card: 5 picks against the spread, one double-down, one mandatory underdog.
            </div>
          </div>
          <div className="px-[15px] pb-[13px]">
            <Link
              to="/demo/cfb"
              className="block rounded-[10px] py-3 text-center font-bold text-[13.5px] no-underline"
              style={{ background: CFB_THEME.accent, color: CFB_THEME.cream }}
            >
              View CFB demo →
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
