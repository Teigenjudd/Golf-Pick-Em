import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import PoolHeader from '../../components/pool/PoolHeader'
import { getCfbPool } from '../../lib/cfb'
import { CFB_THEME, cfbBadge } from '../../theme/cfb'

// CFB Pool Detail / Leaderboard (docs/CFB_UI_PLAN.md §6). Phase 1: the Varsity Navy
// themed shell + a placeholder body — the season standings, week selector, scorecard
// expand, and widgets land in Phase 2 (wired to pool_standings + live cfb.games).

export default function CfbPoolDetail() {
  const { id: poolId } = useParams()
  const [pool, setPool] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      const p = await getCfbPool(poolId)
      if (!active) return
      if (!p) { setError('Pool not found.'); setLoading(false); return }
      setPool(p); setLoading(false)
    })().catch(err => { if (active) { setError(err.message); setLoading(false) } })
    return () => { active = false }
  }, [poolId])

  return (
    <div className="min-h-screen" style={{ background: CFB_THEME.pageCard }}>
      <PoolHeader
        backTo="/dashboard"
        badgeConfig={cfbBadge(pool?.season_year)}
        subLabel={pool ? `${pool.season_year} CFB · Season` : 'College Football'}
        heroName={pool?.name ?? '…'}
        gradient={CFB_THEME.headerGradient}
        accentColor={CFB_THEME.accent}
        rib={CFB_THEME.rib}
      />

      <div className="max-w-[560px] mx-auto px-4 py-8">
        {error ? (
          <p className="text-[13px]" style={{ color: CFB_THEME.warnInk }}>{error}</p>
        ) : loading ? (
          <p className="text-[13px]" style={{ color: CFB_THEME.muted }}>Loading…</p>
        ) : (
          <div
            className="rounded-[10px] px-5 py-8 text-center"
            style={{ background: CFB_THEME.cardWhite, border: `1px solid ${CFB_THEME.border}` }}
          >
            <div className="font-display font-bold text-[10px] uppercase tracking-[.22em] mb-2" style={{ color: CFB_THEME.label }}>
              Season Standings
            </div>
            <p className="text-[13px]" style={{ color: CFB_THEME.ink }}>Leaderboard is coming soon.</p>
            <p className="text-[11.5px] mt-1" style={{ color: CFB_THEME.muted }}>
              Standings, the week selector, and live scores land next.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
