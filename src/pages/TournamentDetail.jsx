import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { computeScores, assignRanks, formatScore } from '../utils/scoring'

const POLL_SCHEDULE = { 4: 60, 5: 60, 6: 30, 0: 15 }
const MANUAL_REFRESH_LIMIT = 3

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

function scoreColor(score, used = true) {
  if (score === null || !used) return 'text-warm-300'
  if (score < 0) return 'text-birdie'
  return 'text-charcoal'
}

export default function TournamentDetail() {
  const { id } = useParams()
  const { user, profile } = useAuth()

  const [tournament, setTournament] = useState(null)
  const [standings, setStandings] = useState([])
  const [fetchedAt, setFetchedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [manualRefreshing, setManualRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(new Set())
  const [copied, setCopied] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    const [
      { data: t, error: tErr },
      { data: picks },
      { data: cache },
    ] = await Promise.all([
      supabase
        .from('tournaments')
        .select('id, name, status, scores_to_keep, pick_count, join_code, lock_time, manual_refresh_count')
        .eq('id', id)
        .single(),
      supabase
        .from('picks')
        .select('user_id, player_id, player_name, status, profiles(display_name)')
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
    if (cache) {
      setFetchedAt(cache.fetched_at)
      const raw = computeScores({ picks: picks ?? [], leaderboardData: cache.data, scoresToKeep: t.scores_to_keep })
      setStandings(assignRanks(raw))
    } else {
      setStandings([])
    }
    setLoading(false)
    setRefreshing(false)
  }, [id])

  useEffect(() => { load() }, [load])

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

  async function handleManualRefresh() {
    setManualRefreshing(true)
    try {
      const { error: fnError } = await supabase.functions.invoke('poll-leaderboard', {
        body: { tournament_id: id },
      })
      if (fnError) throw fnError
      await supabase
        .from('tournaments')
        .update({ manual_refresh_count: tournament.manual_refresh_count + 1 })
        .eq('id', id)
      await load(true)
    } catch (err) {
      console.error('Manual refresh failed:', err)
    } finally {
      setManualRefreshing(false)
    }
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

  const lastUpdated = fetchedAt
    ? new Date(fetchedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : null

  const nextPoll = getNextPollTime()
  const nextPollLabel = nextPoll
    ? nextPoll.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : null
  const refreshesRemaining = MANUAL_REFRESH_LIMIT - (tournament.manual_refresh_count ?? 0)

  const statusLabel = { open: 'Open', locked: 'Locked', complete: 'Final', draft: 'Draft' }[tournament.status] ?? tournament.status
  const statusBadgeClass = {
    open:     'bg-fairway/10 text-fairway',
    locked:   'bg-gold/20 text-gold',
    complete: 'bg-warm-200 text-warm-500',
    draft:    'bg-warm-200 text-warm-400',
  }[tournament.status] ?? 'bg-warm-200 text-warm-400'

  return (
    <div className="min-h-screen bg-cream">
      {/* Fairway header */}
      <div className="bg-fairway px-6 pt-8 pb-6">
        <div className="max-w-2xl mx-auto">
          <Link to="/dashboard" className="text-cream/50 hover:text-cream/80 text-sm transition-colors">
            ← Dashboard
          </Link>
          <div className="flex items-end justify-between mt-4 gap-4">
            <div>
              <h1 className="font-display font-bold text-3xl text-cream tracking-tight leading-tight">
                {tournament.name}
              </h1>
              <span className={`inline-block mt-2 text-xs font-medium px-2.5 py-0.5 rounded-full ${statusBadgeClass}`}>
                {statusLabel}
              </span>
            </div>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="text-sm text-cream/50 hover:text-cream/80 disabled:opacity-40 transition-colors shrink-0 pb-1"
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-6 space-y-4">
        {/* Admin: join link */}
        {isAdmin && (
          <div className="bg-white border border-warm-200 rounded-lg p-5">
            <h2 className="font-display font-bold text-xs uppercase tracking-widest text-warm-400 mb-3">
              Join Link
            </h2>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-warm-100 border border-warm-200 rounded px-3 py-2 text-sm text-charcoal truncate font-mono">
                {window.location.origin}/join/{tournament.join_code}
              </code>
              <button
                onClick={copyJoinLink}
                className={`shrink-0 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  copied
                    ? 'bg-fairway/10 border-fairway/30 text-fairway'
                    : 'bg-white border-warm-300 text-charcoal hover:bg-warm-100'
                }`}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-warm-400 mt-2">
              Code: <span className="font-mono font-medium text-warm-500">{tournament.join_code}</span>
            </p>
          </div>
        )}

        {/* Leaderboard card */}
        <div className="bg-white border border-warm-200 rounded-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-warm-200">
            <h2 className="font-display font-bold text-base uppercase tracking-widest text-charcoal">
              Leaderboard
            </h2>
            <div className="flex flex-col items-end gap-0.5">
              {lastUpdated && (
                <span className="text-xs text-warm-400">Updated {lastUpdated}</span>
              )}
              {nextPollLabel && (
                <span className="text-xs text-warm-400">Next update {nextPollLabel}</span>
              )}
            </div>
          </div>

          {/* Admin: manual refresh */}
          {isAdmin && (
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-warm-200 bg-warm-100">
              <span className="text-xs text-warm-400">
                {refreshesRemaining} of {MANUAL_REFRESH_LIMIT} manual refreshes remaining
              </span>
              <button
                onClick={handleManualRefresh}
                disabled={manualRefreshing || refreshesRemaining <= 0}
                title={refreshesRemaining <= 0 ? 'Manual refresh limit reached (3/3)' : undefined}
                className={`text-xs px-2.5 py-1 rounded border font-medium transition-colors ${
                  refreshesRemaining <= 0
                    ? 'border-warm-200 text-warm-300 cursor-not-allowed'
                    : 'border-fairway/40 text-fairway hover:bg-fairway/5 disabled:opacity-50'
                }`}
              >
                {manualRefreshing ? 'Refreshing…' : 'Refresh Now'}
              </button>
            </div>
          )}

          {/* States */}
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
                  : entry.total_score < 0
                    ? 'text-birdie'
                    : 'text-charcoal'

                return (
                  <div key={entry.user_id} className="border-b border-warm-200 last:border-0">
                    {/* Main row */}
                    <button
                      onClick={() => toggleExpanded(entry.user_id)}
                      className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-warm-100 transition-colors text-left"
                    >
                      <span className="w-6 text-right font-display font-bold text-warm-400 tabular-nums shrink-0 text-sm">
                        {entry.rank ?? '—'}
                      </span>

                      <span className="flex-1 text-sm font-medium text-charcoal">
                        {entry.display_name}
                        {isMe && (
                          <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gold/20 text-gold uppercase tracking-wide">
                            you
                          </span>
                        )}
                      </span>

                      <span className={`font-display font-bold tabular-nums text-base shrink-0 ${totalColor}`}>
                        {entry.total_score === null ? '—' : formatScore(entry.total_score)}
                      </span>

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
                            <span className="flex-1 text-xs text-warm-400">
                              Best {tournament.scores_to_keep} of {tournament.pick_count} scores
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
    </div>
  )
}
