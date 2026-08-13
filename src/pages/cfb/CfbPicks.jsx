import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import PicksHeader from '../../components/pool/PicksHeader'
import { getCfbPool } from '../../lib/cfb'
import { CFB_THEME } from '../../theme/cfb'

// CFB Weekly Picks builder (docs/CFB_UI_PLAN.md §7). Phase 1: the Varsity Navy themed
// shell (no badge, brick eyebrow, rib) + a placeholder body — the weekly card builder
// (5 ATS + double-down + underdog, live validity, submit) lands in Phase 3.

export default function CfbPicks() {
  const { id: poolId } = useParams()
  const [pool, setPool] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      const p = await getCfbPool(poolId)
      if (!active) return
      if (!p) { setError('Pool not found.'); return }
      setPool(p)
    })().catch(err => { if (active) setError(err.message) })
    return () => { active = false }
  }, [poolId])

  return (
    <div className="min-h-screen" style={{ background: CFB_THEME.pageCard }}>
      <PicksHeader
        backTo={`/cfb/pool/${poolId}`}
        backLabel="← Pool"
        eyebrow={pool ? `${pool.season_year} CFB` : 'College Football'}
        title="Build your card"
        subtitle={pool?.name}
        gradient={CFB_THEME.headerGradient}
        accentColor={CFB_THEME.accent}
        rib={CFB_THEME.rib}
        showBadge={false}
      />

      <div className="max-w-[560px] mx-auto px-4 py-8">
        {error ? (
          <p className="text-[13px]" style={{ color: CFB_THEME.warnInk }}>{error}</p>
        ) : (
          <div
            className="rounded-[10px] px-5 py-8 text-center"
            style={{ background: CFB_THEME.cardWhite, border: `1px solid ${CFB_THEME.border}` }}
          >
            <p className="text-[13px]" style={{ color: CFB_THEME.ink }}>The weekly card builder is coming soon.</p>
            <p className="text-[11.5px] mt-1" style={{ color: CFB_THEME.muted }}>
              5 against-the-spread picks, a double-down, and an underdog — with live validity.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
