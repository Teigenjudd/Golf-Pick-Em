import { formatScore, parseScore, normalizeName } from '../../utils/scoring'
import { ordinal, formatMoney } from '../../utils/format'

// Kept for backwards compatibility with any external consumers
export function WidgetHeader({ children }) {
  return (
    <div className="font-display font-bold text-[10px] uppercase tracking-[.16em] text-warm-400 mb-[10px]">
      {children}
    </div>
  )
}

export function PGALeadersWidget({ leaderboardData }) {
  if (!leaderboardData?.leaderboardRows?.length) return null

  const leaders = leaderboardData.leaderboardRows
    .filter(r => {
      const s = (r.status ?? '').toLowerCase()
      return r.total && r.total !== '-' && s !== 'cut' && s !== 'wd'
    })
    .map(r => ({
      position: r.position ?? '-',
      name: r.lastName,
      total: r.total,
      score: parseScore(r.total),
    }))
    .filter(r => r.score !== null)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)

  if (!leaders.length) return null

  return (
    <div className="bg-[#FFFDF8] border border-[#E4DDD0] rounded-[14px] p-4">
      <div className="font-display font-bold text-[10px] uppercase tracking-[.16em] text-warm-400 mb-[10px]">
        PGA Leaders
      </div>
      {leaders.map((l, i) => (
        <div
          key={i}
          className="flex items-center py-[5px]"
          style={{ borderBottom: i < leaders.length - 1 ? '1px solid #F0EBE1' : 'none' }}
        >
          <span
            className="text-[13px] flex-none w-[18px] font-semibold"
            style={{ color: i === 0 ? '#C9A368' : '#9E9488' }}
          >
            {l.position}
          </span>
          <span className="flex-1 text-[13px] text-charcoal">{l.name}</span>
          <span className={`font-display font-bold tabular-nums ${l.score < 0 ? 'text-birdie' : 'text-charcoal'}`}>
            {l.total}
          </span>
        </div>
      ))}
    </div>
  )
}

export function MostPopularWidget({ picks }) {
  const participants = new Set(picks.map(p => p.user_id)).size
  if (!participants) return null

  const counts = {}
  picks.forEach(p => { counts[p.player_name] = (counts[p.player_name] ?? 0) + 1 })

  const top = Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  if (!top.length) return null

  return (
    <div className="bg-[#FFFDF8] border border-[#E4DDD0] rounded-[14px] p-4">
      <div className="font-display font-bold text-[10px] uppercase tracking-[.16em] text-warm-400 mb-[12px]">
        Most Popular Picks
      </div>
      <div className="space-y-2">
        {top.map((p, i) => (
          <div key={i} className="flex items-center gap-[10px]">
            <span className="text-[12.5px] text-charcoal w-[120px] flex-none truncate">{p.name}</span>
            <div className="flex-1 h-[6px] rounded-[3px] overflow-hidden" style={{ background: '#EFE8DA' }}>
              <div
                className="h-full rounded-[3px] bg-fairway"
                style={{ width: `${Math.round((p.count / participants) * 100)}%` }}
              />
            </div>
            <span className="text-[11px] text-warm-400 w-[28px] text-right tabular-nums">{p.count}/{participants}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PrizePoolWidget({ stakeAmount, participantCount, payoutStructure }) {
  if (!stakeAmount || !payoutStructure?.length || !participantCount) return null

  const total = Math.round(stakeAmount * participantCount)
  const payouts = payoutStructure.map(pct => Math.round((total * pct) / 100))
  const diff = total - payouts.reduce((a, b) => a + b, 0)
  if (payouts.length) payouts[0] += diff

  return (
    <div className="bg-[#FFFDF8] border border-[#E4DDD0] rounded-[14px] p-4">
      <div className="font-display font-bold text-[10px] uppercase tracking-[.16em] text-warm-400 mb-[10px]">
        The Money
      </div>
      <div
        className="flex justify-between items-center pb-[9px] mb-[2px]"
        style={{ borderBottom: '1px dashed #D5CBB8' }}
      >
        <span className="text-[12px] text-warm-500">Pool · {participantCount} × {formatMoney(stakeAmount)}</span>
        <span className="font-display font-bold text-[17px] text-charcoal">{formatMoney(total)}</span>
      </div>
      {payouts.map((amount, i) => (
        <div
          key={i}
          className="flex justify-between items-center py-[7px]"
          style={{ borderBottom: i < payouts.length - 1 ? '1px solid #F0EBE1' : 'none' }}
        >
          <span className="text-[12px] text-charcoal">
            <strong>{ordinal(i + 1)}</strong> · {payoutStructure[i]}%
          </span>
          <span className="font-display font-extrabold text-[17px] text-fairway">{formatMoney(amount)}</span>
        </div>
      ))}
    </div>
  )
}

export function TierValueWidget({ picks, leaderboardData }) {
  if (!leaderboardData?.leaderboardRows || !picks.length) return null

  const byId = {}
  const byName = {}
  leaderboardData.leaderboardRows.forEach(row => {
    const score = parseScore(row.total)
    if (score === null) return
    byId[String(row.playerId)] = score
    byName[normalizeName(`${row.firstName} ${row.lastName}`)] = score
  })

  const tierMap = {}
  picks.forEach(pick => {
    const t = pick.tiers
    if (!t) return
    const { tier_number, label } = t
    const score = byId[String(pick.player_id)] ?? byName[normalizeName(pick.player_name)] ?? null
    if (!tierMap[tier_number]) {
      tierMap[tier_number] = { tier_number, label, best: null }
    }
    if (score !== null && (tierMap[tier_number].best === null || score < tierMap[tier_number].best.score)) {
      tierMap[tier_number].best = { name: pick.player_name, score }
    }
  })

  const tiers = Object.values(tierMap).sort((a, b) => a.tier_number - b.tier_number)
  if (!tiers.length) return null

  return (
    <div className="bg-[#FFFDF8] border border-[#E4DDD0] rounded-[14px] p-4">
      <div className="font-display font-bold text-[10px] uppercase tracking-[.16em] text-warm-400 mb-[10px]">
        Tier Value
      </div>
      {tiers.map((t, i) => (
        <div
          key={t.tier_number}
          className="flex items-center py-[5px] text-[13px]"
          style={{ borderBottom: i < tiers.length - 1 ? '1px solid #F0EBE1' : 'none' }}
        >
          <span className="w-16 text-[11px] text-warm-400 flex-none">{t.label}</span>
          <span className="flex-1 text-charcoal truncate">{t.best?.name ?? '—'}</span>
          <span className={`font-display font-bold tabular-nums flex-none ${
            !t.best ? 'text-warm-400' : t.best.score < 0 ? 'text-birdie' : 'text-charcoal'
          }`}>
            {t.best ? formatScore(t.best.score) : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}
