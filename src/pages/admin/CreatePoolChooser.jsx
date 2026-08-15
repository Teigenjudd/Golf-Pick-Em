import { Link } from 'react-router-dom'
import SportBadge from '../../components/SportBadge'
import { cfbBadge } from '../../theme/cfb'

// The sport-agnostic "create a pool" entry point (/admin/create). The dashboard's
// "+ New" routes here so creating isn't hardwired to golf; each card leads into that
// sport's existing create flow. General admin register. Adding a sport = one row here
// plus its create route. Cards carry the real SportBadge emblem, not emoji.

const GOLF_BADGE = { line1: 'PGA', line2: 'GOLF', bg: '#1B4332', border: '#C9A368' }

const SPORTS = [
  {
    key: 'golf',
    badge: GOLF_BADGE,
    title: 'Golf pool',
    blurb: 'PGA field with tiered picks, best-N scoring, and a live weekend leaderboard.',
    to: '/admin/create-tournament',
  },
  {
    key: 'cfb',
    badge: cfbBadge(new Date().getFullYear()),
    title: 'CFB pool',
    blurb: 'A season of weekly against-the-spread cards with cumulative standings.',
    to: '/admin/cfb/create-pool',
  },
]

export default function CreatePoolChooser() {
  return (
    <div className="min-h-screen bg-sand pb-12">
      {/* Sticky nav */}
      <div className="bg-white border-b border-[#EAD8C4] px-[18px] h-14 flex items-center gap-[14px] sticky top-0 z-10">
        <Link to="/dashboard" className="text-[13px] text-warm-400 no-underline">← Dashboard</Link>
        <span className="text-[#EAD8C4] text-base select-none">|</span>
        <span className="font-display font-extrabold text-[22px] text-brand tracking-[.06em]">POOLD</span>
        <span className="font-display font-bold text-[16px] text-[#1C1610] tracking-[.04em]">New Pool</span>
      </div>

      <div className="max-w-[560px] mx-auto px-[18px] pt-[26px]">
        <div className="font-display font-extrabold text-[30px] text-[#1C1610] leading-none mb-[6px]">
          Create a pool
        </div>
        <p className="text-[13px] text-warm-400 mb-[22px]">Pick a sport to set one up.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
          {SPORTS.map(s => (
            <Link
              key={s.key}
              to={s.to}
              className="block bg-white border border-[#EAD8C4] rounded-[16px] p-5 no-underline hover:border-brand/40 hover:shadow-sm transition-all"
            >
              <SportBadge config={s.badge} size="lg" />
              <div className="font-display font-bold text-[18px] text-[#1C1610] mt-3 leading-tight">
                {s.title}
              </div>
              <p className="text-[12px] text-warm-400 mt-[5px] leading-snug">{s.blurb}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
