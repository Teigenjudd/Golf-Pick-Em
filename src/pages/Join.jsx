import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Join() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [tournament, setTournament] = useState(null)
  const [tournamentLoading, setTournamentLoading] = useState(false)
  const [tournamentError, setTournamentError] = useState(null)

  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [emailError, setEmailError] = useState(null)

  useEffect(() => {
    if (authLoading || !user) return
    setTournamentLoading(true)
    supabase
      .from('tournaments')
      .select('id, name, status, lock_time, pick_count')
      .eq('join_code', code)
      .single()
      .then(({ data, error }) => {
        if (error || !data) setTournamentError('Invalid or expired join code.')
        else setTournament(data)
      })
      .finally(() => setTournamentLoading(false))
  }, [user, authLoading, code])

  async function handleEmailSubmit(e) {
    e.preventDefault()
    setSending(true)
    setEmailError(null)
    sessionStorage.setItem('pendingJoinCode', code)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setEmailError(error.message)
      sessionStorage.removeItem('pendingJoinCode')
    } else {
      setSent(true)
    }
    setSending(false)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Golf Pick'Em</h1>
          <p className="text-sm text-gray-500 mb-6">
            Sign in to join with code{' '}
            <span className="font-mono font-medium text-gray-700">{code}</span>
          </p>
          {sent ? (
            <div className="text-center">
              <div className="text-4xl mb-3">📬</div>
              <p className="text-gray-700 font-medium">Check your email for a login link</p>
              <p className="text-sm text-gray-400 mt-1">{email}</p>
            </div>
          ) : (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              {emailError && <p className="text-sm text-red-500">{emailError}</p>}
              <button
                type="submit"
                disabled={sending}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                {sending ? 'Sending…' : 'Send Magic Link'}
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  if (tournamentLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400 text-sm">Looking up tournament…</p>
      </div>
    )
  }

  if (tournamentError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-900 font-medium mb-2">Invalid join code</p>
          <p className="text-sm text-gray-500 mb-4">
            The code <span className="font-mono">{code}</span> doesn't match any active tournament.
          </p>
          <Link to="/dashboard" className="text-sm text-green-700 hover:text-green-800 font-medium">
            Go to dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (!tournament) return null

  const isLocked =
    tournament.status === 'locked' ||
    (tournament.lock_time && new Date(tournament.lock_time) <= new Date())

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
        <p className="text-sm text-green-600 font-medium mb-2">You're invited</p>
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">{tournament.name}</h1>
        <p className="text-sm text-gray-500 mb-6">
          Pick {tournament.pick_count} player{tournament.pick_count !== 1 ? 's' : ''}, one from each tier
        </p>

        {isLocked ? (
          <div className="rounded-lg bg-gray-100 p-4 text-sm text-gray-600">
            Picks are locked for this tournament.
          </div>
        ) : (
          <button
            onClick={() => navigate(`/tournament/${tournament.id}/picks`)}
            className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            Make Your Picks →
          </button>
        )}

        <Link to="/dashboard" className="block mt-4 text-sm text-gray-400 hover:text-gray-600 transition-colors">
          Go to dashboard
        </Link>
      </div>
    </div>
  )
}
