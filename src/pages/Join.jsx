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
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <p className="text-warm-400 text-sm">Loading…</p>
      </div>
    )
  }

  /* ── Unauthenticated: show magic link form ── */
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-cream px-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="font-display font-bold text-5xl text-fairway tracking-tight">PICK'EM</h1>
            <p className="text-warm-400 text-sm mt-1">PGA Golf · Friends Edition</p>
          </div>

          <div className="bg-white border border-warm-200 rounded-lg p-8">
            <p className="text-sm text-warm-400 mb-5">
              Sign in to join with code{' '}
              <span className="font-mono font-semibold text-charcoal">{code}</span>
            </p>

            {sent ? (
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-fairway/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-fairway" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="font-medium text-charcoal">Check your email</p>
                <p className="text-sm text-warm-400 mt-1">{email}</p>
                <p className="text-xs text-warm-400 mt-3 leading-relaxed">
                  We sent a sign-in link — clicking it will drop you right into the tournament.
                </p>
              </div>
            ) : (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-warm-500 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2.5 border border-warm-300 rounded-lg text-sm text-charcoal bg-white placeholder:text-warm-300 focus:outline-none focus:ring-2 focus:ring-fairway/20 focus:border-fairway transition-colors"
                  />
                </div>
                {emailError && <p className="text-sm text-birdie">{emailError}</p>}
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full bg-fairway hover:bg-fairway/90 disabled:opacity-50 text-cream font-medium py-2.5 rounded-lg transition-colors text-sm"
                >
                  {sending ? 'Sending…' : 'Send Magic Link'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (tournamentLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <p className="text-warm-400 text-sm">Looking up tournament…</p>
      </div>
    )
  }

  if (tournamentError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="text-center">
          <p className="text-charcoal font-medium mb-2">Invalid join code</p>
          <p className="text-sm text-warm-400 mb-4">
            The code <span className="font-mono font-semibold text-charcoal">{code}</span> doesn't match any active tournament.
          </p>
          <Link to="/dashboard" className="text-sm text-fairway hover:text-fairway/80 font-medium transition-colors">
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

  /* ── Authenticated: tournament card ── */
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-cream px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display font-bold text-5xl text-fairway tracking-tight">PICK'EM</h1>
        </div>

        <div className="bg-white border border-warm-200 rounded-lg p-8 text-center">
          <p className="text-xs font-semibold text-gold uppercase tracking-widest mb-2">You're invited</p>
          <h2 className="font-display font-bold text-2xl text-charcoal tracking-tight mb-1">
            {tournament.name}
          </h2>
          <p className="text-sm text-warm-400 mb-6">
            Pick {tournament.pick_count} player{tournament.pick_count !== 1 ? 's' : ''}, one from each tier
          </p>

          {isLocked ? (
            <div className="rounded-lg bg-warm-100 border border-warm-200 p-4 text-sm text-warm-500">
              Picks are locked for this tournament.
            </div>
          ) : (
            <button
              onClick={() => navigate(`/tournament/${tournament.id}/picks`)}
              className="w-full bg-fairway hover:bg-fairway/90 text-cream font-medium py-2.5 rounded-lg transition-colors text-sm"
            >
              Make Your Picks →
            </button>
          )}

          <Link
            to="/dashboard"
            className="block mt-4 text-xs text-warm-400 hover:text-warm-500 transition-colors"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
