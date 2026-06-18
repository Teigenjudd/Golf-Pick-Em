import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { computeScores, assignRanks, formatScore } from '../utils/scoring'

const POLL_SCHEDULE = { 4: 60, 5: 60, 6: 30, 0: 15 }

// ── Helpers ───────────────────────────────────────────────────────────────────

function unwrapNumber(val) {
  if (val == null) return null
  if (typeof val === 'number') return val
  if (val.$numberInt !== undefined) return parseInt(val.$numberInt, 10)
  if (val.$numberDouble !== undefined) return parseFloat(val.$numberDouble)
  return null
}

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

function weatherDescription(code) {
  if (code === 0) return 'Clear'
  if (code <= 3) return 'Partly cloudy'
  if (code <= 48) return 'Foggy'
  if (code <= 55) return 'Drizzle'
  if (code <= 65) return 'Rain'
  if (code <= 77) return 'Snow'
  if (code <= 82) return 'Showers'
  return 'Thunderstorm'
}

function getNextPollTime() {
  const now = new Date()
  const dow = now.getUTCDay()
  const interval = POLL_SCHEDULE[dow]
  if (interval === undefined) return null
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes()
  const windowStart = 11 * 60
  const windowEnd = 24 * 60
  if (nowMin >= windowEnd) return null
  if (nowMin < windowStart) {
    const next = new Date(now)
    next.setUTCHours(11, 0, 0, 0)
    return next
  }
  const nextMin = Math.ceil((nowMin + 1) / interval) * interval
  if (nextMin >= windowEnd) return null
  const next = new Date(now)
  next.setUTCHours(Math.floor(nextMin / 60), nextMin % 60, 0, 0)
  return next
}

function scoreColor(score, active = true) {
  if (score === null || !active) return 'text-warm-300'
  if (score < 0) return 'text-birdie'
  return 'text-charcoal'
}

// ── Widgets ───────────────────────────────────────────────────────────────────

function WidgetHeader({ children }) {
  return (
    <h2 className="font-display font-bold text-xs uppercase tracking-widest text-warm-500 mb-2">
      {children}
    </h2>
  )
}

function PGALeadersWidget({ leaderboardData }) {
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

function MostPopularWidget({ picks }) {
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

function TierValueWidget({ picks, leaderboardData }) {
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

// ── Main ──────────────────────────────────────────────────────────────────────

export default function TournamentDetail() {
  const { id } = useParams()
  const { user, profile } = useAuth()

  const [tournament, setTournament] = useState(null)
  const [standings, setStandings] = useState([])
  const [leaderboardData, setLeaderboardData] = useState(null)
  const [rawPicks, setRawPicks] = useState([])
  const [fetchedAt, setFetchedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(new Set())
  const [copied, setCopied] = useState(false)
  const [weather, setWeather] = useState(null)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    const [
      { data: t, error: tErr },
      { data: picks },
      { data: cache },
    ] = await Promise.all([
      supabase
        .from('tournaments')
        .select('id, name, pga_name, course_name, status, scores_to_keep, pick_count, join_code, lock_time, latitude, longitude')
        .eq('id', id)
        .single(),
      supabase
        .from('picks')
        .select('user_id, player_id, player_name, status, tier_id, profiles(display_name), tiers(tier_number, label)')
        .eq('tournament_id', id)
        .eq('status', 'confirmed'),
      supabase
        .from('leaderboard_cache')
        .select('data, fetched_at')
        .eq('tournament_id', id)
        .order('fetched_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (tErr || !t) {
      setError('Tournament not found.')
      setLoading(false)
      setRefreshing(false)
      return
    }

    setTournament(t)
    setRawPicks(picks ?? [])

    if (cache) {
      setFetchedAt(cache.fetched_at)
      setLeaderboardData(cache.data)
      setStandings(assignRanks(computeScores({
        picks: picks ?? [],
        leaderboardData: cache.data,
        scoresToKeep: t.scores_to_keep,
      })))
    } else {
      setFetchedAt(null)
      setLeaderboardData(null)
      setStandings([])
    }

    setLoading(false)
    setRefreshing(false)
  }, [id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!tournament?.latitude || !tournament?.longitude) return
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${tournament.latitude}&longitude=${tournament.longitude}&current=temperature_2m,wind_speed_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph`
    )
      .then(r => r.json())
      .then(d => {
        const c = d.current
        setWeather({
          temp: Math.round(c.temperature_2m),
          wind: Math.round(c.wind_speed_10m),
          description: weatherDescription(c.weather_code),
        })
      })
      .catch(() => {})
  }, [tournament?.latitude, tournament?.longitude])

  function toggleExpanded(userId) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(userId) ? next.delete(userId) : next.add(userId)
      return next
    })
  }

  function copyJoinLink() {
    navigator.clipboard.writeText(`${window.location.origin}/join/${tournament.join_code}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <p className="text-warm-400 text-sm">Loading…</p>
      </div>
    )
  }

  if (error || !tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="text-center">
          <p className="text-charcoal font-medium mb-2">Tournament not found</p>
          <Link to="/dashboard" className="text-sm text-fairway hover:text-fairway/80 font-medium transition-colors">
            Go to dashboard
          </Link>
        </div>
      </div>
    )
  }

  const isAdmin = profile?.role === 'admin'
  const isDraft = tournament.status === 'draft'
  const hasCache = fetchedAt !== null

  const nextPoll = getNextPollTime()
  const minutesUntilPoll = nextPoll
    ? Math.max(1, Math.ceil((nextPoll - new Date()) / 60000))
    : null

  const lastUpdatedLabel = fetchedAt
    ? (() => {
        const diffMin = Math.round((Date.now() - new Date(fetchedAt).getTime()) / 60000)
        if (diffMin < 1) return 'just now'
        if (diffMin < 60) return `${diffMin}m ago`
        return new Date(fetchedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
      })()
    : null

  const roundNum = unwrapNumber(leaderboardData?.roundId)
  const lbStatus = leaderboardData?.status ?? ''
  const roundBadge = roundNum
    ? `Round ${roundNum}${lbStatus === 'In Progress' ? ' · In Progress' : lbStatus === 'Official' ? ' · Final' : ''}`
    : null

  const heroName = tournament.course_name ?? tournament.name
  const subLabel = tournament.pga_name ?? (tournament.course_name ? tournament.name : null)

  return (
    <div className="min-h-screen bg-cream">

      {/* ── Header ── */}
      <div className="bg-fairway px-6 pt-6 pb-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <Link to="/dashboard" className="text-cream/40 hover:text-cream/70 text-sm transition-colors">
              ← Dashboard
            </Link>
            {isAdmin && (
              <button
                onClick={copyJoinLink}
                className="text-xs text-cream/40 hover:text-cream/70 border border-cream/20 hover:border-cream/40 px-3 py-1.5 rounded-lg transition-colors"
              >
                {copied ? 'Link copied!' : 'Share invite'}
              </button>
            )}
          </div>

          <div className="flex items-end justify-between mt-4 gap-6">
            {/* Left: course name + weather inline */}
            <div>
              {subLabel && (
                <p className="font-display font-bold text-xs uppercase tracking-widest text-gold mb-1">
                  {subLabel}
                </p>
              )}
              <div className="flex items-baseline gap-3 flex-wrap">
                <h1 className="font-display font-bold text-3xl sm:text-4xl text-cream tracking-tight leading-tight">
                  {heroName}
                </h1>
                {weather && (
                  <>
                    <span className="text-cream/20 text-xl font-light select-none">|</span>
                    <span className="text-cream/50 text-sm">
                      {weather.temp}°F · {weather.description} · {weather.wind}mph
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Right: round + update info */}
            <div className="text-right shrink-0 pb-0.5 space-y-0.5">
              {roundBadge && (
                <p className="font-display font-bold text-xs uppercase tracking-widest text-gold">
                  {roundBadge}
                </p>
              )}
              {minutesUntilPoll ? (
                <p className="text-cream/50 text-sm">Next update in {minutesUntilPoll} min</p>
              ) : lastUpdatedLabel ? (
                <p className="text-cream/50 text-sm">Updated {lastUpdatedLabel}</p>
              ) : null}
              {refreshing && (
                <p className="text-cream/40 text-xs">Refreshing…</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Pick'em Standings — full width ── */}
        <div>
          <h2 className="font-display font-bold text-xs uppercase tracking-widest text-warm-500 mb-2">
            Pick'em Standings
          </h2>
          <div className="bg-white border border-warm-200 rounded-lg overflow-hidden">
            {isDraft ? (
              <div className="p-12 text-center">
                <p className="text-sm text-warm-400">This tournament hasn't opened yet.</p>
              </div>
            ) : !hasCache ? (
              <div className="p-12 text-center">
                <p className="text-sm text-warm-500">Leaderboard opens once the first tee times go off.</p>
                <p className="text-xs text-warm-400 mt-1.5">Check back once the round is underway.</p>
              </div>
            ) : standings.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-sm text-warm-400">No cards in yet.</p>
              </div>
            ) : (
              <div>
                {standings.map(entry => {
                  const isExpanded = expanded.has(entry.user_id)
                  const isMe = entry.user_id === user?.id
                  const totalColor = entry.total_score === null
                    ? 'text-warm-400'
                    : entry.total_score < 0 ? 'text-birdie' : 'text-charcoal'
                  const countingCount = entry.picks.filter(p => p.used_in_total).length

                  return (
                    <div
                      key={entry.user_id}
                      className={`border-b border-warm-200 last:border-0 ${isMe ? 'border-l-[3px] border-l-gold' : ''}`}
                    >
                      <button
                        onClick={() => toggleExpanded(entry.user_id)}
                        className={`w-full flex items-center gap-4 px-5 py-4 hover:bg-warm-100 transition-colors text-left ${isMe ? 'bg-warm-100/40' : ''}`}
                      >
                        {/* Rank badge — 40px */}
                        <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-display font-bold text-base tabular-nums leading-none ${
                          entry.rank === 1 ? 'bg-gold/20 text-gold' : 'bg-warm-200 text-warm-600'
                        }`}>
                          {entry.rank ?? '—'}
                        </span>

                        {/* Name + subtitle */}
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base font-medium text-charcoal leading-snug">
                              {entry.display_name}
                            </span>
                            {isMe && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gold/20 text-gold uppercase tracking-wide shrink-0">
                                you
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-warm-400 mt-0.5">
                            {countingCount > 0
                              ? `${countingCount} of ${tournament.pick_count} counting`
                              : `${tournament.pick_count} picks`}
                            {!isExpanded && (
                              <span className="text-warm-300"> · tap to expand</span>
                            )}
                          </p>
                        </div>

                        {/* Score */}
                        <span className={`font-display font-bold tabular-nums text-2xl shrink-0 ${totalColor}`}>
                          {entry.total_score === null ? '—' : formatScore(entry.total_score)}
                        </span>

                        {/* Chevron */}
                        <svg
                          className={`w-4 h-4 text-warm-300 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* Scorecard expand — gold left bar is the signature element */}
                      {isExpanded && (
                        <div className="flex border-t border-warm-200">
                          <div className="w-[3px] bg-gold shrink-0" />
                          <div className="flex-1 bg-warm-100 px-5 py-3">
                            <div className="space-y-2">
                              {entry.picks.map((pick, i) => {
                                const inactive = pick.withdrawn || pick.cut
                                const pickColor = scoreColor(pick.score, !inactive && pick.used_in_total)
                                return (
                                  <div key={i} className="flex items-center gap-3 text-sm">
                                    <span className="w-5 h-5 rounded-full bg-fairway/80 flex items-center justify-center shrink-0 text-[10px] font-display font-bold text-cream leading-none">
                                      {i + 1}
                                    </span>
                                    <span className={`flex-1 leading-snug ${
                                      inactive ? 'line-through text-warm-400' :
                                      pick.used_in_total ? 'text-charcoal' : 'text-warm-400'
                                    }`}>
                                      {pick.player_name}
                                    </span>
                                    {pick.withdrawn && (
                                      <span className="text-[10px] font-bold text-birdie bg-birdie/10 px-1.5 py-0.5 rounded uppercase tracking-wide">WD</span>
                                    )}
                                    {pick.cut && (
                                      <span className="text-[10px] font-bold text-warm-500 bg-warm-200 px-1.5 py-0.5 rounded uppercase tracking-wide">CUT</span>
                                    )}
                                    {!inactive && pick.thru === 'F' && (
                                      <span className="text-xs text-warm-400">F</span>
                                    )}
                                    {!inactive && pick.thru && pick.thru !== 'F' && pick.thru !== '' && (
                                      <span className="text-xs text-warm-400">thru {pick.thru}</span>
                                    )}
                                    <span className={`font-display font-bold tabular-nums text-sm w-8 text-right ${pickColor}`}>
                                      {pick.score === null ? '—' : formatScore(pick.score)}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>

                            {/* Total row */}
                            <div className="flex items-center gap-3 pt-2.5 mt-2.5 border-t border-warm-200">
                              <span className="w-5 shrink-0" />
                              <span className="flex-1 font-display font-bold text-xs uppercase tracking-widest text-warm-400">
                                Total
                              </span>
                              <span className={`font-display font-bold tabular-nums text-sm w-8 text-right ${totalColor}`}>
                                {entry.total_score === null ? '—' : formatScore(entry.total_score)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Three-column widget row ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PGALeadersWidget leaderboardData={leaderboardData} />
          <MostPopularWidget picks={rawPicks} />
          <TierValueWidget picks={rawPicks} leaderboardData={leaderboardData} />
        </div>
      </div>
    </div>
  )
}
