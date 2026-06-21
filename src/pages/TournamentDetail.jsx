import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { computeScores, assignRanks } from '../utils/scoring'
import Standings from '../components/leaderboard/Standings'
import { PGALeadersWidget, MostPopularWidget, TierValueWidget } from '../components/leaderboard/Widgets'


// ── Helpers ───────────────────────────────────────────────────────────────────

function unwrapNumber(val) {
  if (val == null) return null
  if (typeof val === 'number') return val
  if (val.$numberInt !== undefined) return parseInt(val.$numberInt, 10)
  if (val.$numberDouble !== undefined) return parseFloat(val.$numberDouble)
  return null
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
  if (![4, 5, 6, 0].includes(dow)) return null
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes()
  const windowStart = 11 * 60
  const windowEnd = 24 * 60
  if (nowMin >= windowEnd) return null
  if (nowMin < windowStart) {
    const next = new Date(now)
    next.setUTCHours(11, 0, 0, 0)
    return next
  }
  const nextMin = Math.ceil((nowMin + 1) / 20) * 20
  if (nextMin >= windowEnd) return null
  const next = new Date(now)
  next.setUTCHours(Math.floor(nextMin / 60), nextMin % 60, 0, 0)
  return next
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
              {lastUpdatedLabel && (
                <p className="text-cream/50 text-sm flex items-center gap-1">
                  Updated {lastUpdatedLabel}
                  <span
                    title="Leaderboard updates every 20 minutes during tournament rounds"
                    className="cursor-help text-cream/30 hover:text-cream/60 transition-colors text-xs leading-none"
                  >
                    ⓘ
                  </span>
                </p>
              )}
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
              <Standings
                standings={standings}
                currentUserId={user?.id}
                pickCount={tournament.pick_count}
              />
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
