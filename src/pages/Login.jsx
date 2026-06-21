import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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
    <div className="min-h-screen flex flex-col items-center justify-center bg-cream px-6">
      <div className="w-full max-w-sm">
        {/* Wordmark */}
        <div className="text-center mb-8">
          <h1 className="font-display font-bold text-5xl text-fairway tracking-tight">PICK'EM</h1>
          <p className="text-warm-400 text-sm mt-1">PGA Golf · Friends Edition</p>
        </div>

        <div className="bg-white border border-warm-200 rounded-lg p-8">
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
                We sent a sign-in link — no password needed.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-warm-500 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2.5 border border-warm-300 rounded-lg text-sm text-charcoal bg-white placeholder:text-warm-300 focus:outline-none focus:ring-2 focus:ring-fairway/20 focus:border-fairway transition-colors"
                />
              </div>
              {error && <p className="text-sm text-birdie">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-fairway hover:bg-fairway/90 disabled:opacity-50 text-cream font-medium py-2.5 rounded-lg transition-colors text-sm"
              >
                {loading ? 'Sending…' : 'Send Magic Link'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-warm-400 mt-6">
          Just looking around?{' '}
          <Link to="/demo" className="text-fairway hover:text-fairway/80 font-medium transition-colors">
            Try the demo →
          </Link>
        </p>
      </div>
    </div>
  )
}
