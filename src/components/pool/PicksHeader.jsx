import { Link } from 'react-router-dom'
import SportBadge from '../SportBadge'

// Shared gradient header for the picks page. Theme-able (golf's fairway/gold values are
// the defaults, so golf renders identically):
//   gradient     — header band background
//   accentColor  — eyebrow color (golf: gold; CFB: brick)
//   rib          — optional segmented stripe under the band
//   showBadge    — render the SportBadge (golf: yes; CFB picks header: no)
//   children     — optional extra content in the band, below the title block (CFB uses
//                  it for the validity tracker chip)
export default function PicksHeader({
  backTo,
  backLabel = '← Leaderboard',
  badgeConfig = null,
  eyebrow,
  title = 'Make your picks',
  subtitle,
  gradient = 'linear-gradient(165deg,#1B4332 0%,#0F241B 100%)',
  accentColor = '#C9A368',
  rib = null,
  showBadge = true,
  children = null,
}) {
  return (
    <>
      <div style={{ background: gradient, padding: '16px 20px 24px' }}>
        <Link
          to={backTo}
          className="no-underline"
          style={{ fontFamily: 'Inter', fontSize: 14, fontWeight: 500, color: 'rgba(248,245,238,.65)' }}
        >
          {backLabel}
        </Link>

        <div className="flex items-center gap-3 mt-4">
          {showBadge && <SportBadge config={badgeConfig} size="pick" />}
          <div>
            {eyebrow && (
              <div className="font-display font-bold uppercase mb-[2px]" style={{ fontSize: 10, letterSpacing: '.18em', color: accentColor }}>
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

        {children}
      </div>

      {rib && (
        <div className="flex" style={{ height: 5 }}>
          {rib.map((c, i) => <span key={i} style={{ flex: 1, background: c }} />)}
        </div>
      )}
    </>
  )
}
