import { Link } from 'react-router-dom'
import SportBadge from '../SportBadge'

// Shared gradient header for the pool leaderboard page.
// Rendered by both the live TournamentDetail and the demo (change once, both update).
export default function PoolHeader({
  backTo,
  backLabel = '← Dashboard',
  badgeConfig = null,
  subLabel,
  heroName,
  metaParts = [],
  roundBadge,
  updatedLabel,
  action = null,
}) {
  return (
    <div style={{ background: 'linear-gradient(165deg,#1B4332 0%,#0F241B 100%)', paddingBottom: 24 }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-4">
        <Link to={backTo} className="text-[14px] font-medium no-underline" style={{ color: 'rgba(248,245,238,.65)' }}>
          {backLabel}
        </Link>
        {action}
      </div>

      {/* Hero */}
      <div className="flex items-end justify-between gap-4 flex-wrap px-5 pt-5">
        <div className="flex items-center gap-[14px]">
          <SportBadge config={badgeConfig} size="lg" />
          <div>
            {subLabel && (
              <div className="font-display font-bold text-[11px] uppercase tracking-[.2em] text-gold mb-0.5">
                {subLabel}
              </div>
            )}
            <h1 className="font-display font-extrabold text-[38px] text-cream leading-[.9] tracking-tight">
              {heroName}
            </h1>
            {metaParts.length > 0 && (
              <div className="text-[12.5px] mt-1.5" style={{ color: 'rgba(248,245,238,.5)' }}>
                {metaParts.join(' · ')}
              </div>
            )}
          </div>
        </div>

        <div className="text-right pb-0.5">
          {roundBadge && (
            <div className="font-display font-bold text-[11px] uppercase tracking-[.16em] text-gold">
              {roundBadge}
            </div>
          )}
          {updatedLabel && (
            <div className="text-[12px] mt-[3px]" style={{ color: 'rgba(248,245,238,.45)' }}>
              {updatedLabel}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
