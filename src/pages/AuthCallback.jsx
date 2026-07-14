import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AuthCallback() {
  const { profile, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (loading) return
    if (!profile) return
    const joinCode = new URLSearchParams(location.search).get('join')
    const destination = joinCode ? `/join/${joinCode}` : '/dashboard'

    // Brand-new account (the signup trigger leaves display_name NULL): name
    // yourself first, then carry on to wherever the link was taking you.
    if (!profile.display_name) {
      navigate(`/welcome?next=${encodeURIComponent(destination)}`, { replace: true })
    } else {
      navigate(destination, { replace: true })
    }
  }, [profile, loading, navigate, location.search])

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <p className="text-warm-400 text-sm">Signing you in…</p>
    </div>
  )
}
