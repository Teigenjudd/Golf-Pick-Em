import { Link } from 'react-router-dom'
import SportBadge from '../SportBadge'
import { CFB_THEME, cfbBadge } from '../../theme/cfb'
import { formatLockLabel } from '../../utils/cfbFormat'

// The Dashboard's CFB pool tile (docs/CFB_UI_PLAN.md §4). Mirrors the golf tile's
// structure in Dashboard.jsx (bg-white/rounded-2xl card + colored sport strip) but in
// the Varsity Navy colorway. Presentational only — takes one row from getMyCfbPools.

const EYEBROW = {
  preseason: 'PRESEASON',
  'needs-picks': 'NEEDS PICKS',
  'card-in': 'CARD IN',
  locked: 'LOCKED',
  graded: 'GRADED',
}

// Resolve the week-status chip: label, destination, and whether it's the primary
// (re-engagement) CTA. `currentWeek.locked` is `weekIsLocked(w)` from lib/cfb.js.
function weekChip(tile) {
  const w = tile.currentWeek
  if (!w) {
    return { key: 'preseason', label: 'Season starts soon', to: `/cfb/pool/${tile.poolId}` }
  }
  const wk = `Week ${w.week_number}`
  if (!w.locked && tile.cardStatus === 'needs-picks') {
    return {
      key: 'needs-picks',
      label: `${wk} · Needs picks — locks ${formatLockLabel(w.lock_time)}`,
      to: `/cfb/pool/${tile.poolId}/picks`,
      primary: true,
    }
  }
  if (!w.locked && tile.cardStatus === 'card-in') {
    return { key: 'card-in', label: `${wk} · Card in ✓`, to: `/cfb/pool/${tile.poolId}/picks` }
  }
  if (w.status === 'graded') {
    return { key: 'graded', label: `${wk} · Graded`, to: `/cfb/pool/${tile.poolId}` }
  }
  // Locked but not yet graded. (No per-game live check at the tile level — see
  // docs/CFB_UI_PLAN.md §4's "· Live" variant, deferred; "Locked" covers both today.)
  return { key: 'locked', label: `${wk} · Locked`, to: `/cfb/pool/${tile.poolId}` }
}

export default function CfbPoolTile({ tile }) {
  const chip = weekChip(tile)
  const eyebrow = EYEBROW[chip.key] ?? 'SEASON'
  const hasStanding = tile.rank != null

  return (
    <div className="bg-white border border-[#EAD8C4] rounded-2xl overflow-hidden mb-[10px]">
      {/* Sport strip */}
      <Link
        to={`/cfb/pool/${tile.poolId}`}
        className="flex items-center gap-3 px-[15px] py-[13px] no-underline"
        style={{ background: CFB_THEME.headerGradient }}
      >
        <SportBadge config={cfbBadge(tile.seasonYear)} size="md" />
        <div className="flex-1">
          <div
            className="font-display font-bold text-[9.5px] uppercase tracking-[.14em]"
            style={{ color: CFB_THEME.accent }}
          >
            {eyebrow}
          </div>
          <div className="font-display font-extrabold text-[18px] text-cream leading-[1.05]">{tile.name}</div>
        </div>
      </Link>

      <div className="px-[15px] py-[13px]">
        <div className="text-[11.5px] text-warm-400 mb-[9px]">
          Season {tile.seasonYear ?? '—'} · {tile.playerCount} player{tile.playerCount !== 1 ? 's' : ''}
        </div>

        {chip.key === 'preseason' ? (
          <div className="text-[13.5px] font-semibold text-[#1C1610]">{chip.label}</div>
        ) : (
          <Link
            to={chip.to}
            className={`block rounded-[10px] py-3 px-[14px] text-center font-bold text-[13.5px] no-underline ${
              chip.primary ? 'text-white' : 'border border-[#EAD8C4] text-[#1C1610]'
            }`}
            style={chip.primary ? { background: CFB_THEME.accent } : undefined}
          >
            {chip.label}
          </Link>
        )}

        {hasStanding && (
          <div className="mt-[9px] text-[13px] font-semibold text-[#1C1610]">
            #{tile.rank} · {tile.total} pts
          </div>
        )}
      </div>
    </div>
  )
}
