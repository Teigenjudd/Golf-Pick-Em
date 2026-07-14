import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getPoolViewByCode } from '../lib/golf'
import { useAuth } from '../context/AuthContext'
import SportBadge from '../components/SportBadge'
import Footer from '../components/Footer'

export default function Join() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [tournament, setTournament] = useState(null)
  const [tournamentLoading, setTournamentLoading] = useState(false)
  const [tournamentError, setTournamentError] = useState(null)
  const [badge, setBadge] = useState(null)

  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [emailError, setEmailError] = useState(null)

  useEffect(() => {
    if (authLoading || !user) return
    setTournamentLoading(true)
    getPoolViewByCode(code)
      .then(pool => {
        if (!pool) {
          setTournamentError('Invalid or expired join code.')
        } else {
          setTournament(pool)
          setBadge(pool.badge_config ?? null)
        }
      })
      .finally(() => setTournamentLoading(false))
  }, [user, authLoading, code])

  async function handleEmailSubmit(e) {
    e.preventDefault()
    setSending(true)
    setEmailError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?join=${code}` },
    })
    if (error) {
      setEmailError(error.message)
    } else {
      setSent(true)
    }
    setSending(false)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sand">
        <p className="text-warm-400 text-sm">Loading…</p>
      </div>
    )
  }

  /* ── Unauthenticated: show magic link form ── */
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-sand px-5 py-10">
        <div className="w-full max-w-[360px]">

          <div className="text-center mb-7">
            <div className="font-display font-extrabold text-[54px] text-brand tracking-[.08em] leading-none">POOLD</div>
            <div className="font-display italic font-semibold text-[15px] text-warm-400 mt-[5px]">Make it interesting.</div>
          </div>

          <div className="bg-white border border-[#EAD8C4] rounded-2xl px-6 py-7 shadow-[0_4px_24px_rgba(28,22,16,.07)]">
            <div className="text-[13px] text-warm-400 mb-1">Sign in to join with code</div>
            <div className="font-display font-extrabold text-[22px] text-[#1C1610] tracking-[.06em] mb-5">{code}</div>

            {sent ? (
              <div className="text-center">
                <div className="w-11 h-11 rounded-full bg-brand/10 flex items-center justify-center mx-auto mb-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C14A18" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className="font-display font-extrabold text-[22px] text-[#1C1610]">Check your email</div>
                <div className="text-[13px] text-warm-400 mt-1.5 leading-[1.5]">
                  Clicking the link will drop you right into the pool.
                </div>
              </div>
            ) : (
              <form onSubmit={handleEmailSubmit}>
                <div className="mb-[14px]">
                  <div className="text-[11px] font-semibold uppercase tracking-[.12em] text-warm-400 mb-[7px]">
                    Email address
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-[15px] py-[13px] border-[1.5px] border-[#EAD8C4] rounded-[11px] text-[15px] text-[#1C1610] bg-[#FFFAF6] outline-none placeholder:text-warm-300"
                  />
                </div>
                {emailError && <p className="text-sm text-birdie mb-3">{emailError}</p>}
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full bg-brand text-white font-bold text-[15px] py-[14px] rounded-[11px] border-none cursor-pointer disabled:opacity-50"
                >
                  {sending ? 'Sending…' : 'Send Magic Link'}
                </button>
                <p className="text-[11px] text-warm-300 leading-[1.5] text-center mt-3 mb-0">
                  By signing in you agree to our{' '}
                  <Link to="/terms" className="text-warm-400 underline">Terms</Link> and{' '}
                  <Link to="/privacy" className="text-warm-400 underline">Privacy Policy</Link>.
                </p>
              </form>
            )}
          </div>

          <Footer />

        </div>
      </div>
    )
  }

  if (tournamentLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sand">
        <p className="text-warm-400 text-sm">Looking up tournament…</p>
      </div>
    )
  }

  if (tournamentError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sand px-5">
        <div className="w-full max-w-[360px]">
          <div className="text-center mb-7">
            <div className="font-display font-extrabold text-[54px] text-brand tracking-[.08em] leading-none">POOLD</div>
          </div>
          <div className="bg-white border border-[#EAD8C4] rounded-2xl px-6 py-7 text-center shadow-[0_4px_24px_rgba(28,22,16,.07)]">
            <div className="font-display font-extrabold text-[22px] text-[#1C1610] mb-2">Invalid code</div>
            <p className="text-[13px] text-warm-400 leading-[1.5] mb-6">
              The code <span className="font-semibold text-[#1C1610]">{code}</span> doesn&apos;t match any active tournament.
            </p>
            <Link to="/dashboard" className="text-[12.5px] text-warm-400 no-underline">
              <span className="text-brand font-semibold">Go to dashboard →</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!tournament) return null

  const isLocked =
    tournament.status === 'locked' ||
    (tournament.lock_time && new Date(tournament.lock_time) <= new Date())

  /* ── Authenticated: tournament invite card ── */
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-sand px-5 py-10">
      <div className="w-full max-w-[360px]">

        <div className="text-center mb-7">
          <div className="font-display font-extrabold text-[54px] text-brand tracking-[.08em] leading-none">POOLD</div>
        </div>

        <div className="bg-white border border-[#EAD8C4] rounded-2xl px-6 py-7 text-center shadow-[0_4px_24px_rgba(28,22,16,.07)]">
          <div className="font-display font-bold text-[11px] uppercase tracking-[.2em] text-gold mb-1.5">
            You&apos;re invited
          </div>
          <div className="font-display font-extrabold text-[30px] text-[#1C1610] leading-none mb-1">
            {tournament.name}
          </div>
          <div className="text-[13px] text-warm-400 mb-6 leading-[1.5]">
            Pick {tournament.pick_count} player{tournament.pick_count !== 1 ? 's' : ''}, one from each tier
          </div>

          {/* Golf badge preview strip */}
          <div className="rounded-[12px] px-4 py-3.5 flex items-center gap-3 mb-5" style={{ background: 'linear-gradient(105deg,#1B4332,#0D1F18)' }}>
            <SportBadge config={badge} size="sm" />
            <div className="flex-1 text-left">
              <div className="font-display font-bold text-[9px] uppercase tracking-[.14em] text-gold">
                {isLocked ? 'PICKS LOCKED' : 'PICKS OPEN'}
              </div>
              <div className="font-display font-extrabold text-[17px] text-cream leading-[1.1]">
                {tournament.name}
              </div>
            </div>
          </div>

          {isLocked ? (
            <div className="rounded-[12px] bg-warm-100 border border-warm-200 px-4 py-3 text-[13px] text-warm-500 mb-3">
              Picks are locked for this tournament.
            </div>
          ) : (
            <button
              onClick={() => navigate(`/tournament/${tournament.id}/picks`)}
              className="block w-full bg-brand text-white font-bold text-[15px] py-[14px] rounded-[12px] border-none cursor-pointer mb-3"
            >
              Make Your Picks →
            </button>
          )}

          <Link to="/dashboard" className="text-[12.5px] text-warm-400 no-underline">
            Go to dashboard
          </Link>
        </div>

        <Footer />

      </div>
    </div>
  )
}
