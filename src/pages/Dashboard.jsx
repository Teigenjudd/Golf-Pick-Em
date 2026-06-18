import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Navigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const { user, profile, loading, signOut } = useAuth()
  const [myTournaments, setMyTournaments] = useState([])
  const [adminTournaments, setAdminTournaments] = useState([])
  const [showClosed, setShowClosed] = useState(false)
  const [showClosedAdmin, setShowClosedAdmin] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('picks')
      .select('tournament_id, status, tournaments(id, name, status, lock_time)')
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
            tournamentStatus: t.status,
            lockTime: t.lock_time,
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

  const statusDot = {
    open:     'bg-fairway',
    locked:   'bg-gold',
    complete: 'bg-warm-300',
    draft:    'bg-warm-300',
  }

  const statusBadge = {
    open:     'bg-fairway/10 text-fairway',
    locked:   'bg-gold/20 text-gold',
    complete: 'bg-warm-200 text-warm-400',
    draft:    'bg-warm-200 text-warm-400',
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Top bar */}
      <div className="bg-fairway px-6 py-5">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span className="font-display font-bold text-cream text-xl tracking-tight">PICK'EM</span>
          <button
            onClick={signOut}
            className="text-sm text-cream/50 hover:text-cream/80 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <p className="text-sm text-warm-400 mb-8">
          Signed in as{' '}
          <span className="text-charcoal font-medium">{profile?.display_name || user.email}</span>
        </p>

        {/* My Picks */}
        {myTournaments.length > 0 && (() => {
          const visible = showClosed
            ? myTournaments
            : myTournaments.filter(t => t.tournamentStatus !== 'complete')
          const closedCount = myTournaments.filter(t => t.tournamentStatus === 'complete').length

          return (
            <section className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-bold text-xs uppercase tracking-widest text-warm-400">
                  My Picks
                </h2>
                {closedCount > 0 && (
                  <button
                    onClick={() => setShowClosed(s => !s)}
                    className="text-xs text-warm-400 hover:text-charcoal transition-colors"
                  >
                    {showClosed ? 'Hide closed' : `Show closed (${closedCount})`}
                  </button>
                )}
              </div>
              {visible.length > 0 ? (
                <div className="bg-white border border-warm-200 rounded-lg divide-y divide-warm-200">
                  {visible.map(t => {
                    const isComplete = t.tournamentStatus === 'complete'
                    const isLocked = t.tournamentStatus === 'locked' || (t.lockTime && new Date(t.lockTime) <= new Date())
                    const dotColor = isComplete ? 'bg-warm-300' : t.pickStatus === 'confirmed' ? 'bg-fairway' : 'bg-gold'
                    return (
                      <div key={t.id} className={`flex items-center gap-3 px-4 py-3.5 ${isComplete ? 'opacity-60' : ''}`}>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                        <Link to={`/tournament/${t.id}`} className="flex-1 text-sm font-medium text-charcoal hover:text-fairway transition-colors">{t.name}</Link>
                        {!isComplete && !isLocked && (
                          <Link
                            to={`/tournament/${t.id}/picks`}
                            className="text-xs text-warm-400 hover:text-fairway transition-colors shrink-0"
                          >
                            edit picks →
                          </Link>
                        )}
                        <Link
                          to={`/tournament/${t.id}`}
                          className="text-xs text-warm-400 hover:text-fairway transition-colors shrink-0"
                        >
                          leaderboard →
                        </Link>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                          isComplete ? 'bg-warm-200 text-warm-400' :
                          t.pickStatus === 'confirmed' ? 'bg-fairway/10 text-fairway' : 'bg-gold/20 text-gold'
                        }`}>
                          {isComplete ? 'closed' : t.pickStatus}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-warm-400">No active tournaments.</p>
              )}
            </section>
          )
        })()}

        {/* Empty state for players with no picks */}
        {myTournaments.length === 0 && profile?.role !== 'admin' && (
          <div className="text-center py-16">
            <p className="text-warm-400 text-sm">You haven't joined any tournaments yet.</p>
            <p className="text-xs text-warm-300 mt-1">Use a join link from your pool organizer to get started.</p>
          </div>
        )}

        {/* Admin */}
        {profile?.role === 'admin' && (() => {
          const adminClosedCount = adminTournaments.filter(t => t.status === 'complete').length
          const visibleAdmin = showClosedAdmin ? adminTournaments : adminTournaments.filter(t => t.status !== 'complete')
          return (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-bold text-xs uppercase tracking-widest text-warm-400">
                Admin
              </h2>
              {adminClosedCount > 0 && (
                <button
                  onClick={() => setShowClosedAdmin(s => !s)}
                  className="text-xs text-warm-400 hover:text-charcoal transition-colors"
                >
                  {showClosedAdmin ? 'Hide closed' : `Show closed (${adminClosedCount})`}
                </button>
              )}
            </div>
            <div className="bg-white border border-warm-200 rounded-lg">
              {visibleAdmin.length > 0 && (
                <div className="divide-y divide-warm-200">
                  {visibleAdmin.map(t => (
                    <div key={t.id} className={`flex items-center gap-3 px-4 py-3.5 ${t.status === 'complete' ? 'opacity-60' : ''}`}>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot[t.status] ?? 'bg-warm-300'}`} />
                      <Link
                        to={`/tournament/${t.id}`}
                        className="flex-1 text-sm font-medium text-charcoal hover:text-fairway transition-colors"
                      >
                        {t.name}
                      </Link>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${statusBadge[t.status] ?? 'bg-warm-200 text-warm-400'}`}>
                        {t.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className={`flex items-center gap-5 px-4 py-3.5 ${adminTournaments.length > 0 ? 'border-t border-warm-200' : ''}`}>
                <Link
                  to="/admin"
                  className="text-sm text-fairway font-medium hover:text-fairway/80 transition-colors"
                >
                  Admin Panel →
                </Link>
                <Link
                  to="/admin/create-tournament"
                  className="text-sm text-warm-400 hover:text-charcoal transition-colors"
                >
                  + New Tournament
                </Link>
              </div>
            </div>
          </section>
          )
        })()}
      </div>
    </div>
  )
}
