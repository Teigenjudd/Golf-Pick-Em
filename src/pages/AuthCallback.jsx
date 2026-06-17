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
    if (joinCode) {
      navigate(`/join/${joinCode}`, { replace: true })
    } else {
      navigate('/dashboard', { replace: true })
    }
  }, [profile, loading, navigate, location.search])

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <p className="text-warm-400 text-sm">Signing you in…</p>
    </div>
  )
}
