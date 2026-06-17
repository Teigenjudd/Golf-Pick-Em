import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function TournamentDetail() {
  const { id } = useParams()
  const { user, profile } = useAuth()

  const [tournament, setTournament] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    supabase
      .from('tournaments')
      .select('id, name, status, lock_time, pick_count, scores_to_keep, join_code, created_at')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) setError('Tournament not found.')
        else setTournament(data)
      })
      .finally(() => setLoading(false))
  }, [id])

  function copyJoinLink() {
    const url = `${window.location.origin}/join/${tournament.join_code}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
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

  const joinUrl = `${window.location.origin}/join/${tournament.join_code}`
  const isAdmin = profile?.role === 'admin'
  const lockDate = tournament.lock_time
    ? new Date(tournament.lock_time).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <Link to="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 transition-colors mb-4 inline-block">
          ← Dashboard
        </Link>

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
        </div>

        {/* Join link — shown to everyone but most useful for admin to share */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Join Link</h2>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 truncate">
              {joinUrl}
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

        {/* Tournament details */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Details</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Picks per participant</dt>
              <dd className="text-gray-900 font-medium">{tournament.pick_count}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Scores to keep</dt>
              <dd className="text-gray-900 font-medium">{tournament.scores_to_keep}</dd>
            </div>
            {lockDate && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Locks</dt>
                <dd className="text-gray-900 font-medium">{lockDate}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  )
}
