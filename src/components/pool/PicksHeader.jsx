import { Link } from 'react-router-dom'
import SportBadge from '../SportBadge'

// Shared gradient header for the picks page.
// Rendered by both the live Picks page and the demo (change once, both update).
export default function PicksHeader({
  backTo,
  backLabel = '← Leaderboard',
  badgeConfig = null,
  eyebrow,
  title = 'Make your picks',
  subtitle,
}) {
  return (
    <div style={{ background: 'linear-gradient(165deg,#1B4332 0%,#0F241B 100%)', padding: '16px 20px 24px' }}>
      <Link
        to={backTo}
        className="no-underline"
        style={{ fontFamily: 'Inter', fontSize: 14, fontWeight: 500, color: 'rgba(248,245,238,.65)' }}
      >
        {backLabel}
      </Link>

      <div className="flex items-center gap-3 mt-4">
        <SportBadge config={badgeConfig} size="pick" />
        <div>
          {eyebrow && (
            <div className="font-display font-bold uppercase mb-[2px]" style={{ fontSize: 10, letterSpacing: '.18em', color: '#C9A368' }}>
              {eyebrow}
            </div>
          )}
          <div className="font-display font-extrabold text-cream leading-[.95]" style={{ fontSize: 28 }}>
            {title}
          </div>
          {subtitle && (
            <div className="mt-[5px]" style={{ fontFamily: 'Inter', fontSize: 12, color: 'rgba(248,245,238,.5)' }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
