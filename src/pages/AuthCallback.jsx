import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AuthCallback() {
  const { user, profile, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [stalled, setStalled] = useState(false)

  useEffect(() => {
    if (loading) return

    // Auth resolved but there's no session — the link was bad, expired, or was
    // opened in a different browser than it was requested from. Back to login.
    if (!user) {
      navigate('/', { replace: true })
      return
    }

    const joinCode = new URLSearchParams(location.search).get('join')
    const destination = joinCode ? `/join/${joinCode}` : '/dashboard'

    // Signed in. We advance on `user`, not `profile`: on a fresh signup the
    // profile row can lag behind the session, and blocking on it is exactly what
    // used to strand people on this spinner (backlog C1). If we already have the
    // profile and it's unnamed, jump straight to onboarding; otherwise head to
    // the destination and let ProtectedRoute enforce the display-name gate once
    // the row loads.
    if (profile && !profile.display_name) {
      navigate(`/welcome?next=${encodeURIComponent(destination)}`, { replace: true })
    } else {
      navigate(destination, { replace: true })
    }
  }, [user, profile, loading, navigate, location.search])

  // Safety net: if auth never resolves at all, don't spin in silence — surface
  // a way out after a few seconds.
  useEffect(() => {
    const t = setTimeout(() => setStalled(true), 8000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-cream px-6 text-center">
      <p className="text-warm-400 text-sm">Signing you in…</p>
      {stalled && (
        <div className="text-sm text-warm-500">
          <p>Taking longer than expected.</p>
          <button
            onClick={() => window.location.assign('/')}
            className="mt-2 border border-warm-300 text-charcoal hover:bg-warm-100 py-2 px-3 rounded-lg transition-colors"
          >
            Back to sign in
          </button>
        </div>
      )}
    </div>
  )
}
