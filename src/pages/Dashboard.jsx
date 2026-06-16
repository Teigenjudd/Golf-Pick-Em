import { useAuth } from '../context/AuthContext'
import { Navigate, Link } from 'react-router-dom'

export default function Dashboard() {
  const { user, profile, loading, signOut } = useAuth()

  if (loading) return null
  if (!user) return <Navigate to="/" replace />

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <button
            onClick={signOut}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Sign out
          </button>
        </div>

        <p className="text-gray-600 mb-6">
          Welcome back, {profile?.display_name || user.email}
        </p>

        {profile?.role === 'admin' && (
          <div className="border border-gray-200 rounded-xl p-4 bg-white">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Admin</h2>
            <Link
              to="/admin/create-tournament"
              className="inline-flex items-center gap-2 text-sm text-green-700 font-medium hover:text-green-800 transition-colors"
            >
              + Create Tournament
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
