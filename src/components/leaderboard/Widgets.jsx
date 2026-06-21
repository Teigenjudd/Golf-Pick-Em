import { formatScore } from '../../utils/scoring'
import { ordinal, formatMoney } from '../../utils/format'

// Shared leaderboard widgets, used by the live TournamentDetail page and the demo.
// Presentational only — all data comes in via props.

function parseScore(total) {
  if (!total || total === '-' || total === '') return null
  if (total === 'E') return 0
  const n = parseInt(total, 10)
  return isNaN(n) ? null : n
}

function normalizeName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function WidgetHeader({ children }) {
  return (
    <h2 className="font-display font-bold text-xs uppercase tracking-widest text-warm-500 mb-2">
      {children}
    </h2>
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
    <div>
      <WidgetHeader>PGA Leaders</WidgetHeader>
      <div className="bg-white border border-warm-200 rounded-lg overflow-hidden">
        {leaders.map((l, i) => (
          <div
            key={i}
            className={`flex items-center px-4 py-2.5 text-sm ${i < leaders.length - 1 ? 'border-b border-warm-200' : ''}`}
          >
            <span className="w-8 text-xs text-warm-400 shrink-0">{l.position}</span>
            <span className="flex-1 text-charcoal">{l.name}</span>
            <span className={`font-display font-bold tabular-nums ${
              l.score < 0 ? 'text-birdie' : l.score === 0 ? 'font-medium text-charcoal' : 'text-charcoal'
            }`}>
              {l.total}
            </span>
          </div>
        ))}
      </div>
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
    <div>
      <WidgetHeader>Most Popular Picks</WidgetHeader>
      <div className="bg-white border border-warm-200 rounded-lg px-4 py-3 space-y-3">
        {top.map((p, i) => (
          <div key={i}>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-sm text-charcoal">{p.name}</span>
              <span className="text-xs text-warm-400 ml-2 shrink-0 tabular-nums">{p.count}/{participants}</span>
            </div>
            <div className="h-1.5 bg-warm-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gold rounded-full"
                style={{ width: `${Math.round((p.count / participants) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PrizePoolWidget({ stakeAmount, participantCount, payoutStructure }) {
  if (!stakeAmount || !payoutStructure?.length || !participantCount) return null

  const total = Math.round(stakeAmount * participantCount)
  // Whole-dollar payouts; rounding remainder goes to 1st so the parts sum to total.
  const payouts = payoutStructure.map(pct => Math.round((total * pct) / 100))
  const diff = total - payouts.reduce((a, b) => a + b, 0)
  if (payouts.length) payouts[0] += diff

  return (
    <div>
      <WidgetHeader>Prize Pool</WidgetHeader>
      <div className="bg-white border border-warm-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-warm-200 bg-warm-100 flex items-baseline justify-between">
          <span className="font-display font-bold tabular-nums text-lg text-fairway">{formatMoney(total)}</span>
          <span className="text-xs text-warm-400">{participantCount} × {formatMoney(stakeAmount)}</span>
        </div>
        {payouts.map((amount, i) => (
          <div
            key={i}
            className={`flex items-center px-4 py-2.5 text-sm ${i < payouts.length - 1 ? 'border-b border-warm-200' : ''}`}
          >
            <span className="w-12 text-xs text-warm-400 shrink-0">{ordinal(i + 1)}</span>
            <span className="flex-1 text-xs text-warm-400 tabular-nums">{payoutStructure[i]}%</span>
            <span className="font-display font-bold tabular-nums text-charcoal">{formatMoney(amount)}</span>
          </div>
        ))}
      </div>
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
    <div>
      <WidgetHeader>Tier Value</WidgetHeader>
      <div className="bg-white border border-warm-200 rounded-lg overflow-hidden">
        {tiers.map((t, i) => (
          <div
            key={t.tier_number}
            className={`flex items-center px-4 py-2.5 text-sm ${i % 2 === 1 ? 'bg-warm-100' : ''} ${i < tiers.length - 1 ? 'border-b border-warm-200' : ''}`}
          >
            <span className="w-16 text-xs text-warm-400 shrink-0">{t.label}</span>
            <span className="flex-1 text-charcoal truncate">{t.best?.name ?? '—'}</span>
            <span className={`font-display font-bold tabular-nums shrink-0 ${
              !t.best ? 'text-warm-400' : t.best.score < 0 ? 'text-birdie' : 'text-charcoal'
            }`}>
              {t.best ? formatScore(t.best.score) : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
