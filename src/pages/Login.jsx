import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Footer from '../components/Footer'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-sand px-5 py-10">
      <div className="w-full max-w-[360px]">

        <div className="text-center mb-9">
          <div className="font-display font-extrabold text-[60px] text-brand tracking-[.08em] leading-none">POOLD</div>
          <div className="font-display italic font-semibold text-base text-warm-400 mt-1.5">Make it interesting.</div>
        </div>

        <div className="bg-white border border-[#EAD8C4] rounded-2xl px-6 py-7 shadow-[0_4px_24px_rgba(28,22,16,.07)]">
          {sent ? (
            <div className="text-center py-2">
              <div className="w-[52px] h-[52px] rounded-full bg-brand/10 flex items-center justify-center mx-auto mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C14A18" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="font-display font-extrabold text-[26px] text-[#1C1610] mb-1.5">Check your email</div>
              <div className="text-[13.5px] text-warm-400 leading-[1.55]">
                We sent a sign-in link to<br />
                <strong className="text-[#1C1610]">{email}</strong>
              </div>
              <div className="text-[12px] text-[#C8B8A4] mt-2">Click the link — no password needed.</div>
              <button
                onClick={() => { setSent(false); setEmail('') }}
                className="mt-[18px] text-[12px] text-warm-400 bg-transparent border-none cursor-pointer underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <p className="text-[13px] text-warm-400 text-center mb-[22px] leading-[1.55]">
                Sign in with your email.<br />No password — we&apos;ll send a magic link.
              </p>
              <div className="mb-[14px]">
                <div className="text-[11px] font-semibold uppercase tracking-[.12em] text-warm-400 mb-[7px]">
                  Email address
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-[15px] py-[13px] border-[1.5px] border-[#EAD8C4] rounded-[11px] text-[15px] text-[#1C1610] bg-[#FFFAF6] outline-none placeholder:text-warm-300"
                />
              </div>
              {error && <p className="text-sm text-birdie mb-3">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand text-white font-bold text-[15px] py-[14px] rounded-[11px] border-none cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Send Magic Link'}
              </button>
              <p className="text-[11px] text-warm-300 leading-[1.5] text-center mt-3 mb-0">
                By signing in you agree to our{' '}
                <Link to="/terms" className="text-warm-400 underline">Terms</Link> and{' '}
                <Link to="/privacy" className="text-warm-400 underline">Privacy Policy</Link>.
              </p>
            </form>
          )}
        </div>

        <div className="text-center mt-5">
          <Link to="/demo" className="text-[12.5px] text-warm-400 no-underline">
            Just looking?{' '}
            <span className="text-brand font-semibold">Try the demo →</span>
          </Link>
        </div>

        <Footer />

      </div>
    </div>
  )
}
