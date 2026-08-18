import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SportBadge from '../SportBadge'
import BottomSheet from '../BottomSheet'
import { CFB_THEME, cfbBadge } from '../../theme/cfb'

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

// Short date for the "Locks …" line — matches golf's Dashboard.jsx tile exactly
// ("Aug 28, 10:46 PM"), for parity between the two sports' tiles.
function lockLabel(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// Resolve the week-status chip. `currentWeek.locked` is `weekIsLocked(w)` from
// lib/cfb.js. needs-picks/card-in are the two "open" states — those get golf's
// two-button (Leaderboard / Edit·Make picks) treatment; the rest stay a single link.
function weekChip(tile) {
  const w = tile.currentWeek
  if (!w) {
    return { key: 'preseason', label: 'Season starts soon', to: `/cfb/pool/${tile.poolId}` }
  }
  const wk = `Week ${w.week_number}`
  if (!w.locked && tile.cardStatus === 'needs-picks') {
    return { key: 'needs-picks', wk, lockTime: w.lock_time }
  }
  if (!w.locked && tile.cardStatus === 'card-in') {
    return { key: 'card-in', wk, lockTime: w.lock_time }
  }
  if (w.status === 'graded') {
    return { key: 'graded', label: `${wk} · Graded`, to: `/cfb/pool/${tile.poolId}` }
  }
  // Locked but not yet graded. (No per-game live check at the tile level — see
  // docs/CFB_UI_PLAN.md §4's "· Live" variant, deferred; "Locked" covers both today.)
  return { key: 'locked', label: `${wk} · Locked`, to: `/cfb/pool/${tile.poolId}` }
}

export default function CfbPoolTile({ tile }) {
  const navigate = useNavigate()
  const chip = weekChip(tile)
  const eyebrow = tile.status === 'complete' ? 'COMPLETE' : (EYEBROW[chip.key] ?? 'SEASON')
  const hasStanding = tile.rank != null
  const isOpen = chip.key === 'needs-picks' || chip.key === 'card-in'
  const [confirmingReset, setConfirmingReset] = useState(false)

  // Editing an already-submitted card re-locks EVERY line to today's numbers on
  // resubmit, not what was originally picked (cfb_submit_week_picks reads the
  // current game row, not the old locked_spread). So editing confirms up front, then
  // lands on a builder (?reset=1) that clears every not-yet-started pick — no
  // stale-looking selections whose underlying line quietly changed. A pick on a game
  // that's already kicked off is carried forward pre-filled and locked instead of
  // cleared: the RPC's kickoff lock won't let a resubmit drop it (CfbPicks.jsx).
  function confirmEdit() {
    setConfirmingReset(false)
    navigate(`/cfb/pool/${tile.poolId}/picks?reset=1`)
  }

  return (
    <div
      className="bg-white border border-[#EAD8C4] rounded-2xl overflow-hidden mb-[10px]"
      style={{ opacity: tile.status === 'complete' ? 0.55 : 1 }}
    >
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
        ) : isOpen ? (
          <>
            {/* Status row — parity with golf's tile: a dot, "card is in" vs. "picks
                aren't in yet", and the lock time. */}
            <div className="flex items-center gap-[9px] mb-[10px]">
              <div
                className="w-2 h-2 rounded-full flex-none"
                style={{ background: chip.key === 'card-in' ? CFB_THEME.positive : CFB_THEME.accent }}
              />
              <div className="flex-1">
                <div className="text-[13.5px] font-semibold text-[#1C1610]">
                  {chip.key === 'card-in' ? `${chip.wk} card is in.` : `${chip.wk} picks aren't in yet.`}
                </div>
                {chip.lockTime && (
                  <div className="text-[11.5px] text-warm-400 mt-[1px]">
                    Locks {lockLabel(chip.lockTime)}
                  </div>
                )}
              </div>
            </div>

            {/* CTAs — same Leaderboard / Edit·Make picks split as golf's open tile. */}
            <div className="flex gap-[9px]">
              <Link
                to={`/cfb/pool/${tile.poolId}`}
                className="flex-1 rounded-[10px] py-3 px-[14px] text-center font-bold text-[13.5px] text-white no-underline"
                style={{ background: CFB_THEME.accent }}
              >
                Leaderboard →
              </Link>
              {chip.key === 'card-in' ? (
                <button
                  type="button"
                  onClick={() => setConfirmingReset(true)}
                  className="border border-[#EAD8C4] rounded-[10px] py-3 px-[14px] text-center font-medium text-[13px] text-warm-400 whitespace-nowrap bg-transparent cursor-pointer"
                >
                  Edit picks
                </button>
              ) : (
                <Link
                  to={`/cfb/pool/${tile.poolId}/picks`}
                  className="border border-[#EAD8C4] rounded-[10px] py-3 px-[14px] text-center font-medium text-[13px] text-warm-400 no-underline whitespace-nowrap"
                >
                  Make picks
                </Link>
              )}
            </div>
          </>
        ) : (
          <Link
            to={chip.to}
            className="block rounded-[10px] py-3 px-[14px] text-center font-bold text-[13.5px] no-underline border border-[#EAD8C4] text-[#1C1610]"
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

      <BottomSheet open={confirmingReset} onClose={() => setConfirmingReset(false)} title="Edit your card?">
        <p className="text-[13.5px] leading-relaxed mb-5 text-[#736A5F]">
          Your picks on games that haven&apos;t started will be reset — you&apos;ll be offered only
          today&apos;s lines to build those fresh. Anything already underway stays locked in as-is.
        </p>
        <div className="flex gap-[9px]">
          <button
            type="button"
            onClick={() => setConfirmingReset(false)}
            className="flex-1 border border-[#EAD8C4] rounded-[10px] py-3 px-[14px] text-center font-medium text-[13px] text-warm-400 bg-transparent cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmEdit}
            className="flex-1 rounded-[10px] py-3 px-[14px] text-center font-bold text-[13.5px] text-white border-none cursor-pointer"
            style={{ background: CFB_THEME.accent }}
          >
            Edit picks
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
