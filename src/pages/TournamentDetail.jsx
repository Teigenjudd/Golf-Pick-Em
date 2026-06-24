import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { computeScores, assignRanks, unwrapNumber } from '../utils/scoring'
import Standings from '../components/leaderboard/Standings'
import { PGALeadersWidget, MostPopularWidget, TierValueWidget, PrizePoolWidget } from '../components/leaderboard/Widgets'
import SportBadge from '../components/SportBadge'

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
  const [badge, setBadge] = useState(null)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    const [
      { data: t, error: tErr },
      { data: picks },
      { data: cache },
    ] = await Promise.all([
      supabase
        .from('tournaments')
        .select('id, name, pga_name, course_name, status, scores_to_keep, pick_count, join_code, lock_time, latitude, longitude, stake_amount, payout_structure, slash_golf_tournament_id')
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
    if (!tournament?.slash_golf_tournament_id) return
    supabase
      .from('pga_event_badges')
      .select('badge_config')
      .eq('tourn_id', tournament.slash_golf_tournament_id)
      .maybeSingle()
      .then(({ data }) => { if (data) setBadge(data.badge_config) })
  }, [tournament?.slash_golf_tournament_id])

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
      <div className="min-h-screen flex items-center justify-center bg-[#F4EFE4]">
        <p className="text-warm-400 text-sm">Loading…</p>
      </div>
    )
  }

  if (error || !tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4EFE4]">
        <div className="text-center">
          <p className="text-charcoal font-medium mb-2">Tournament not found</p>
          <Link to="/dashboard" className="text-sm text-brand font-medium no-underline">
            ← Go to dashboard
          </Link>
        </div>
      </div>
    )
  }

  const isAdmin = profile?.role === 'admin'
  const isDraft = tournament.status === 'draft'
  const isLocked = tournament.status === 'locked' || (tournament.lock_time && new Date(tournament.lock_time) <= new Date())
  const hasCache = fetchedAt !== null
  const userHasPicks = rawPicks.some(p => p.user_id === user?.id)

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
    ? `R${roundNum}${lbStatus === 'In Progress' ? ' · In Progress' : lbStatus === 'Official' ? ' · Final' : ''}`
    : null

  const heroName = tournament.course_name ?? tournament.name
  const subLabel = tournament.pga_name ?? (tournament.course_name ? tournament.name : null)
  const participantCount = new Set(rawPicks.map(p => p.user_id)).size
  const hasPrize = tournament.stake_amount && tournament.payout_structure?.length

  const weatherStr = weather
    ? `${weather.temp}°F · ${weather.description} · ${weather.wind}mph`
    : null

  const metaParts = [
    weatherStr,
    tournament.scores_to_keep && tournament.pick_count
      ? `Best ${tournament.scores_to_keep} of ${tournament.pick_count}`
      : null,
    participantCount ? `${participantCount} players` : null,
  ].filter(Boolean)

  return (
    <div className="min-h-screen bg-[#F4EFE4] pb-8">

      {/* ── Golf gradient header ── */}
      <div style={{ background: 'linear-gradient(165deg,#1B4332 0%,#0F241B 100%)', paddingBottom: 24 }}>

        {/* Top bar */}
        <div className="flex items-center justify-between px-5 pt-4">
          <Link
            to="/dashboard"
            className="text-[14px] font-medium no-underline"
            style={{ color: 'rgba(248,245,238,.65)' }}
          >
            ← Dashboard
          </Link>
          {isAdmin && (
            <button
              onClick={copyJoinLink}
              className="text-[13px] font-semibold px-[14px] py-2 rounded-[10px] cursor-pointer border-none"
              style={{
                background: 'rgba(201,163,104,.16)',
                border: '1px solid rgba(201,163,104,.45)',
                color: '#E8CE9A',
              }}
            >
              {copied ? 'Copied!' : 'Share invite'}
            </button>
          )}
        </div>

        {/* Hero */}
        <div className="flex items-end justify-between gap-4 flex-wrap px-5 pt-5">
          <div className="flex items-center gap-[14px]">
            <SportBadge config={badge} size="lg" />

            <div>
              {subLabel && (
                <div className="font-display font-bold text-[11px] uppercase tracking-[.2em] text-gold mb-0.5">
                  {subLabel}
                </div>
              )}
              <h1 className="font-display font-extrabold text-[38px] text-cream leading-[.9] tracking-tight">
                {heroName}
              </h1>
              {metaParts.length > 0 && (
                <div className="text-[12.5px] mt-1.5" style={{ color: 'rgba(248,245,238,.5)' }}>
                  {metaParts.join(' · ')}
                </div>
              )}
            </div>
          </div>

          <div className="text-right pb-0.5">
            {roundBadge && (
              <div className="font-display font-bold text-[11px] uppercase tracking-[.16em] text-gold">
                {roundBadge}
              </div>
            )}
            {lastUpdatedLabel && (
              <div className="text-[12px] mt-[3px]" style={{ color: 'rgba(248,245,238,.45)' }}>
                Updated {lastUpdatedLabel}{refreshing ? ' · Refreshing…' : ''}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-[640px] mx-auto px-[18px] pt-[22px]">

        {/* Picks status banner */}
        {!isDraft && (
          <div className="bg-white border border-[#E4DDD0] rounded-[12px] px-[14px] py-[11px] flex items-center justify-between mb-[18px]">
            <div className="flex items-center gap-[9px]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1B4332" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-[13px] text-[#1C1610]">
                {userHasPicks
                  ? isLocked ? 'Your picks are locked in.' : 'Your card is in.'
                  : isLocked ? 'Picks are locked for this tournament.' : "You haven't submitted picks yet."}
              </span>
            </div>
            {!isLocked && (
              <Link
                to={`/tournament/${id}/picks`}
                className="text-[12.5px] font-semibold text-brand no-underline"
              >
                {userHasPicks ? 'Edit picks →' : 'Make picks →'}
              </Link>
            )}
          </div>
        )}

        {/* Standings section label */}
        <div className="font-display font-bold text-[10px] uppercase tracking-[.22em] text-warm-400 mb-[10px]">
          Pick&apos;em Standings
        </div>

        {/* Standings card */}
        <div
          className="bg-[#FFFDF8] border border-[#E4DDD0] rounded-2xl overflow-hidden mb-4"
          style={{ boxShadow: '0 12px 36px -24px rgba(20,48,38,.35)' }}
        >
          {isDraft ? (
            <div className="p-12 text-center">
              <p className="text-[13px] text-warm-400">This tournament hasn&apos;t opened yet.</p>
            </div>
          ) : !hasCache ? (
            <div className="p-12 text-center">
              <p className="text-[13px] text-warm-500">Leaderboard opens once the first tee times go off.</p>
              <p className="text-[12px] text-warm-400 mt-1.5">Check back once the round is underway.</p>
            </div>
          ) : standings.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-[13px] text-warm-400">No cards in yet.</p>
            </div>
          ) : (
            <Standings
              standings={standings}
              currentUserId={user?.id}
              pickCount={tournament.pick_count}
            />
          )}
        </div>

        {/* Widget grid — 2 columns, most popular + tier value span full width */}
        <div className="grid grid-cols-2 gap-3">
          {hasPrize && <PrizePoolWidget stakeAmount={tournament.stake_amount} participantCount={participantCount} payoutStructure={tournament.payout_structure} />}
          <div className={hasPrize ? '' : 'col-span-2'}>
            <PGALeadersWidget leaderboardData={leaderboardData} />
          </div>
          <div className="col-span-2">
            <MostPopularWidget picks={rawPicks} />
          </div>
          <div className="col-span-2">
            <TierValueWidget picks={rawPicks} leaderboardData={leaderboardData} />
          </div>
        </div>

      </div>
    </div>
  )
}
