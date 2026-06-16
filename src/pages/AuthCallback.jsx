import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AuthCallback() {
  const { profile, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    if (profile?.status === 'approved' || profile?.role === 'admin') {
      navigate('/dashboard', { replace: true })
    } else {
      navigate('/pending', { replace: true })
    }
  }, [profile, loading, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500 text-sm">Signing you in…</p>
    </div>
  )
}
