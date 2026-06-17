import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Navigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const { user, profile, loading, signOut } = useAuth()
  const [myTournaments, setMyTournaments] = useState([])
  const [adminTournaments, setAdminTournaments] = useState([])

  useEffect(() => {
    if (!user) return
    supabase
      .from('picks')
      .select('tournament_id, status, tournaments(id, name)')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (!data) return
        const map = {}
        data.forEach(row => {
          const tid = row.tournament_id
          if (!map[tid]) map[tid] = { ...row.tournaments, statuses: [] }
          map[tid].statuses.push(row.status)
        })
        setMyTournaments(
          Object.values(map).map(t => ({
            id: t.id,
            name: t.name,
            pickStatus: t.statuses.every(s => s === 'confirmed') ? 'confirmed' : 'pending',
          }))
        )
      })
  }, [user])

  useEffect(() => {
    if (!user || profile?.role !== 'admin') return
    supabase
      .from('tournaments')
      .select('id, name, status, join_code')
      .order('created_at', { ascending: false })
      .then(({ data }) => setAdminTournaments(data ?? []))
  }, [user, profile])

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

        {myTournaments.length > 0 && (
          <div className="border border-gray-200 rounded-xl p-4 bg-white mb-4">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">My Picks</h2>
            <div className="space-y-2">
              {myTournaments.map(t => (
                <div key={t.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Link
                      to={`/tournament/${t.id}`}
                      className="text-sm text-gray-800 hover:text-green-700 transition-colors"
                    >
                      {t.name}
                    </Link>
                    <Link
                      to={`/tournament/${t.id}/picks`}
                      className="text-xs text-gray-400 hover:text-green-600 transition-colors"
                    >
                      view picks →
                    </Link>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    t.pickStatus === 'confirmed'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {t.pickStatus}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {profile?.role === 'admin' && (
          <div className="border border-gray-200 rounded-xl p-4 bg-white">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Admin</h2>
            {adminTournaments.length > 0 && (
              <div className="space-y-2 mb-4">
                {adminTournaments.map(t => (
                  <div key={t.id} className="flex items-center justify-between">
                    <Link
                      to={`/tournament/${t.id}`}
                      className="text-sm text-gray-800 hover:text-green-700 transition-colors"
                    >
                      {t.name}
                    </Link>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      t.status === 'open'   ? 'bg-green-100 text-green-700' :
                      t.status === 'locked' ? 'bg-amber-100 text-amber-700' :
                                              'bg-gray-100 text-gray-500'
                    }`}>
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-4">
              <Link
                to="/admin"
                className="text-sm text-green-700 font-medium hover:text-green-800 transition-colors"
              >
                Admin Panel →
              </Link>
              <Link
                to="/admin/create-tournament"
                className="text-sm text-green-700 font-medium hover:text-green-800 transition-colors"
              >
                + Create Tournament
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
