import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { computeScores, assignRanks, formatScore } from '../utils/scoring'

export default function TournamentDetail() {
  const { id } = useParams()
  const { user, profile } = useAuth()

  const [tournament, setTournament] = useState(null)
  const [standings, setStandings] = useState([])
  const [fetchedAt, setFetchedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
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
        .select('id, name, status, scores_to_keep, pick_count, join_code, lock_time')
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
      const raw = computeScores({
        picks: picks ?? [],
        leaderboardData: cache.data,
        scoresToKeep: t.scores_to_keep,
      })
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    )
  }

  if (error || !tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-900 font-medium mb-2">Tournament not found</p>
          <Link to="/dashboard" className="text-sm text-green-700 hover:text-green-800 font-medium">
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

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <Link to="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 transition-colors mb-4 inline-block">
          ← Dashboard
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{tournament.name}</h1>
            <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${
              tournament.status === 'open'   ? 'bg-green-100 text-green-700' :
              tournament.status === 'locked' ? 'bg-amber-100 text-amber-700' :
                                               'bg-gray-100 text-gray-500'
            }`}>
              {tournament.status}
            </span>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {/* Admin: join link */}
        {isAdmin && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Join Link</h2>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 truncate">
                {window.location.origin}/join/{tournament.join_code}
              </code>
              <button
                onClick={copyJoinLink}
                className={`shrink-0 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  copied
                    ? 'bg-green-50 border-green-300 text-green-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Code: <span className="font-mono font-medium text-gray-600">{tournament.join_code}</span>
            </p>
          </div>
        )}

        {/* Leaderboard */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-medium text-gray-900">Leaderboard</h2>
            {lastUpdated && (
              <span className="text-xs text-gray-400">Updated {lastUpdated}</span>
            )}
          </div>

          {isDraft ? (
            <div className="p-10 text-center">
              <p className="text-sm text-gray-500">This tournament hasn't opened yet.</p>
            </div>
          ) : !hasCache ? (
            <div className="p-10 text-center">
              <p className="text-sm text-gray-500">No leaderboard data yet.</p>
              <p className="text-xs text-gray-400 mt-1">Check back once the tournament is underway.</p>
            </div>
          ) : standings.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-gray-500">No picks submitted yet.</p>
            </div>
          ) : (
            <div>
              {standings.map(entry => {
                const isExpanded = expanded.has(entry.user_id)
                const isMe = entry.user_id === user?.id
                const score = formatScore(entry.total_score)
                const scoreColor =
                  entry.total_score === null ? 'text-gray-400' :
                  entry.total_score < 0     ? 'text-red-500'  :
                  entry.total_score > 0     ? 'text-gray-700' :
                                              'text-gray-900'

                return (
                  <div key={entry.user_id} className="border-b border-gray-100 last:border-0">
                    <button
                      onClick={() => toggleExpanded(entry.user_id)}
                      className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
                    >
                      {/* Rank */}
                      <span className="w-5 shrink-0 text-sm text-gray-400 font-medium tabular-nums">
                        {entry.rank ?? '–'}
                      </span>

                      {/* Name */}
                      <span className="flex-1 text-sm font-medium text-gray-900">
                        {entry.display_name}
                        {isMe && (
                          <span className="ml-2 text-xs font-normal text-green-600">you</span>
                        )}
                      </span>

                      {/* Score */}
                      <span className={`text-sm font-mono font-semibold tabular-nums ${scoreColor}`}>
                        {score}
                      </span>

                      {/* Chevron */}
                      <svg
                        className={`w-4 h-4 text-gray-300 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Expanded picks detail */}
                    {isExpanded && (
                      <div className="bg-gray-50 border-t border-gray-100 px-5 py-3">
                        <div className="space-y-2">
                          {entry.picks.map((pick, i) => {
                            const pickScore = formatScore(pick.score)
                            const inactive = pick.withdrawn || pick.cut
                            const pickScoreColor =
                              inactive || !pick.used_in_total ? 'text-gray-300' :
                              pick.score < 0               ? 'text-red-500'  :
                              pick.score > 0               ? 'text-gray-500' :
                                                             'text-gray-700'
                            return (
                              <div key={i} className="flex items-center gap-2 text-sm">
                                <span className={`flex-1 ${inactive ? 'text-gray-400 line-through' : pick.used_in_total ? 'text-gray-800' : 'text-gray-400'}`}>
                                  {pick.player_name}
                                </span>

                                {pick.withdrawn && (
                                  <span className="text-xs font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded">WD</span>
                                )}
                                {pick.cut && (
                                  <span className="text-xs font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">CUT</span>
                                )}
                                {!inactive && pick.thru === 'F' && (
                                  <span className="text-xs text-gray-400">F</span>
                                )}
                                {!inactive && pick.thru && pick.thru !== 'F' && pick.thru !== '' && (
                                  <span className="text-xs text-gray-400">thru {pick.thru}</span>
                                )}

                                <span className={`font-mono text-xs w-8 text-right tabular-nums ${pickScoreColor}`}>
                                  {pick.score === null ? '–' : pickScore}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                        <p className="text-xs text-gray-400 mt-3 pt-2 border-t border-gray-200">
                          Best {tournament.scores_to_keep} of {tournament.pick_count} scores count toward total
                        </p>
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
