import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Navigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { computeScores, assignRanks, formatScore } from '../utils/scoring'
import SportBadge from '../components/SportBadge'

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning.'
  if (h < 17) return 'Good afternoon.'
  return 'Good evening.'
}

function getDateStr() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function ordinal(n) {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

export default function Dashboard() {
  const { user, profile, loading, signOut } = useAuth()
  const [myTournaments, setMyTournaments] = useState([])
  const [adminTournaments, setAdminTournaments] = useState([])
  const [showClosed, setShowClosed] = useState(false)
  const [showClosedAdmin, setShowClosedAdmin] = useState(false)
  const [myStandings, setMyStandings] = useState({})
  const [badges, setBadges] = useState({})

  useEffect(() => {
    if (!user) return
    supabase
      .from('picks')
      .select('tournament_id, status, tournaments(id, name, status, lock_time, scores_to_keep, slash_golf_tournament_id)')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (!data) return
        const map = {}
        data.forEach(row => {
          const tid = row.tournament_id
          if (!map[tid]) map[tid] = { ...row.tournaments, statuses: [] }
          map[tid].statuses.push(row.status)
        })
        const tournaments = Object.values(map).map(t => ({
          id: t.id,
          name: t.name,
          tournamentStatus: t.status,
          lockTime: t.lock_time,
          scoresToKeep: t.scores_to_keep,
          slashId: t.slash_golf_tournament_id,
          pickStatus: t.statuses.every(s => s === 'confirmed') ? 'confirmed' : 'pending',
        }))
        setMyTournaments(tournaments)

        const slashIds = tournaments.map(t => t.slashId).filter(Boolean)
        if (slashIds.length) {
          supabase
            .from('pga_event_badges')
            .select('tourn_id, badge_line1, badge_line2')
            .in('tourn_id', slashIds)
            .then(({ data }) => {
              if (!data) return
              const map = {}
              data.forEach(b => { map[b.tourn_id] = { line1: b.badge_line1, line2: b.badge_line2 } })
              setBadges(map)
            })
        }
      })
  }, [user])

  // Fetch rank + score for locked/complete tournaments
  useEffect(() => {
    const targets = myTournaments.filter(t =>
      t.tournamentStatus === 'locked' || t.tournamentStatus === 'complete'
    )
    if (!targets.length || !user) return

    targets.forEach(async t => {
      const [{ data: allPicks }, { data: cache }] = await Promise.all([
        supabase
          .from('picks')
          .select('user_id, player_id, player_name, profiles(display_name)')
          .eq('tournament_id', t.id)
          .eq('status', 'confirmed'),
        supabase
          .from('leaderboard_cache')
          .select('data')
          .eq('tournament_id', t.id)
          .order('fetched_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      if (!allPicks || !cache) return

      const standings = assignRanks(computeScores({
        picks: allPicks,
        leaderboardData: cache.data,
        scoresToKeep: t.scoresToKeep,
      }))

      const mine = standings.find(s => s.user_id === user.id)
      if (!mine) return

      setMyStandings(prev => ({
        ...prev,
        [t.id]: { rank: mine.rank, total: mine.total_score, rankOf: standings.length },
      }))
    })
  }, [myTournaments, user])

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

  const initials = getInitials(profile?.display_name)
  const closedTournaments = myTournaments.filter(t => t.tournamentStatus === 'complete')
  const visibleTournaments = showClosed ? myTournaments : myTournaments.filter(t => t.tournamentStatus !== 'complete')

  return (
    <div className="min-h-screen bg-sand pb-20">

      {/* Sticky top nav */}
      <div className="bg-white border-b border-[#EAD8C4] px-[18px] h-14 flex items-center justify-between sticky top-0 z-10">
        <span className="font-display font-extrabold text-[26px] text-brand tracking-[.07em]">POOLD</span>
        <div className="flex items-center gap-[13px]">
          {profile?.role === 'admin' && (
            <Link to="/admin/create-tournament" className="text-[12px] font-medium text-warm-400 no-underline">+ New</Link>
          )}
          <div className="w-[34px] h-[34px] rounded-full bg-brand flex items-center justify-center">
            <span className="font-display font-bold text-[13px] text-white">{initials}</span>
          </div>
        </div>
      </div>

      <div className="max-w-[480px] mx-auto px-[18px] pt-[22px] pb-3">

        {/* Greeting */}
        <div className="text-[12px] text-warm-400 mb-0.5">{getDateStr()}</div>
        <div className="font-display font-extrabold text-[38px] text-[#1C1610] leading-none mb-[18px]">{getGreeting()}</div>

        {/* Section label */}
        {myTournaments.length > 0 && (
          <div className="font-display font-bold text-[10px] uppercase tracking-[.22em] text-warm-400 mb-[10px]">
            Your Active Pools
          </div>
        )}

        {/* Pool cards */}
        {visibleTournaments.map(t => {
          const isComplete = t.tournamentStatus === 'complete'
          const isLocked = t.tournamentStatus === 'locked' || (t.lockTime && new Date(t.lockTime) <= new Date())
          const isActive = !isComplete && !isLocked
          const standing = myStandings[t.id]
          const showStanding = (isLocked || isComplete) && standing

          return (
            <div
              key={t.id}
              className="bg-white border border-[#EAD8C4] rounded-2xl overflow-hidden mb-[10px]"
              style={{ opacity: isComplete ? 0.55 : 1 }}
            >
              {/* Sport strip */}
              <div
                className="flex items-center gap-3 px-[15px] py-[13px]"
                style={{ background: 'linear-gradient(105deg,#1B4332,#0D1F18)' }}
              >
                {(() => { const b = badges[t.slashId] ?? {}; return <SportBadge line1={b.line1} line2={b.line2} size="md" /> })()}
                <div className="flex-1">
                  <div className="font-display font-bold text-[9.5px] uppercase tracking-[.14em] text-gold">
                    {isComplete ? 'COMPLETE' : isLocked ? 'IN PROGRESS' : 'PICKS OPEN'}
                  </div>
                  <div className="font-display font-extrabold text-[18px] text-cream leading-[1.05]">{t.name}</div>
                </div>
                {!isComplete && isLocked && (
                  <div className="flex items-center gap-1">
                    <div className="w-[7px] h-[7px] rounded-full bg-[#4ADE80]" style={{ animation: 'liveDot 1.4s ease-in-out infinite' }} />
                    <span className="text-[10.5px] text-cream/60">Live</span>
                  </div>
                )}
              </div>

              {/* Locked/complete: rank + score row */}
              {showStanding ? (
                <div className="px-[15px] py-[13px] flex items-center gap-[11px]">
                  <div className="w-[30px] h-[30px] rounded-full flex-none flex items-center justify-center" style={{ background: 'rgba(193,74,24,.1)' }}>
                    <span className="font-display font-extrabold text-[15px] text-brand">{standing.rank}</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-[13.5px] font-semibold text-[#1C1610]">
                      {ordinal(standing.rank)} of {standing.rankOf}
                    </div>
                    <div className="text-[11.5px] text-warm-400 mt-[1px]">
                      {isComplete ? 'Final' : 'In progress'}
                    </div>
                  </div>
                  <span
                    className="font-display font-extrabold text-[26px] tabular-nums"
                    style={{ color: standing.total < 0 ? '#B23A2D' : '#1C1610' }}
                  >
                    {formatScore(standing.total)}
                  </span>
                  <Link
                    to={`/tournament/${t.id}`}
                    className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-none no-underline border border-[#EAD8C4]"
                    title="View leaderboard"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A08870" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                      <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                    </svg>
                  </Link>
                </div>
              ) : (isLocked || isComplete) ? (
                /* Still loading standings — compact placeholder */
                <div className="px-[15px] py-[13px] flex items-center justify-between">
                  <div className="text-[13px] text-warm-400">Loading standings…</div>
                  <Link to={`/tournament/${t.id}`} className="w-9 h-9 rounded-[10px] flex items-center justify-center border border-[#EAD8C4] no-underline">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A08870" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                      <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                    </svg>
                  </Link>
                </div>
              ) : (
                /* Open: pick status row */
                <div className="px-[15px] py-[13px] flex items-center gap-[11px]">
                  <div className={`w-2 h-2 rounded-full flex-none ${t.pickStatus === 'confirmed' ? 'bg-fairway' : 'bg-gold'}`} />
                  <div className="flex-1">
                    <div className="text-[13.5px] font-semibold text-[#1C1610]">
                      {t.pickStatus === 'confirmed' ? 'Your card is in.' : 'No picks submitted yet.'}
                    </div>
                    {t.lockTime && (
                      <div className="text-[11.5px] text-warm-400 mt-[1px]">
                        Locks {new Date(t.lockTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* CTAs — open tournaments only */}
              {isActive && (
                <div className="px-[15px] pb-[13px] flex gap-[9px]">
                  <Link
                    to={`/tournament/${t.id}`}
                    className="flex-1 bg-brand rounded-[10px] py-3 text-center font-bold text-[13.5px] text-white no-underline"
                  >
                    View leaderboard →
                  </Link>
                  <Link
                    to={`/tournament/${t.id}/picks`}
                    className="border border-[#EAD8C4] rounded-[10px] py-3 px-[14px] text-center font-medium text-[13px] text-warm-400 no-underline whitespace-nowrap"
                  >
                    {t.pickStatus === 'confirmed' ? 'Edit picks' : 'Make picks'}
                  </Link>
                </div>
              )}
            </div>
          )
        })}

        {/* Show/hide closed */}
        {closedTournaments.length > 0 && (
          <button
            onClick={() => setShowClosed(s => !s)}
            className="text-[12px] text-warm-400 bg-transparent border-none cursor-pointer mb-[10px] underline"
          >
            {showClosed ? 'Hide closed pools' : `Show ${closedTournaments.length} closed pool${closedTournaments.length !== 1 ? 's' : ''}`}
          </button>
        )}

        {/* Empty state */}
        {myTournaments.length === 0 && profile?.role !== 'admin' && (
          <div className="text-center py-16">
            <p className="text-[13px] text-warm-400">You haven&apos;t joined any pools yet.</p>
            <p className="text-[12px] text-warm-300 mt-1">Use a join link from your pool organizer to get started.</p>
          </div>
        )}

        {/* Dashed join card */}
        <div className="border-[1.5px] border-dashed border-[#D0BCA8] rounded-[13px] py-[14px] text-center mb-5">
          <span className="font-display font-bold text-[14px] text-warm-400">+ Join another pool</span>
        </div>

        {/* Admin section */}
        {profile?.role === 'admin' && (() => {
          const adminClosedCount = adminTournaments.filter(t => t.status === 'complete').length
          const visibleAdmin = showClosedAdmin ? adminTournaments : adminTournaments.filter(t => t.status !== 'complete')
          return (
            <div className="mt-2 mb-5">
              <div className="flex items-center justify-between mb-[10px]">
                <div className="font-display font-bold text-[10px] uppercase tracking-[.22em] text-warm-400">Admin</div>
                {adminClosedCount > 0 && (
                  <button onClick={() => setShowClosedAdmin(s => !s)} className="text-[11px] text-warm-400 bg-transparent border-none cursor-pointer underline">
                    {showClosedAdmin ? 'Hide closed' : `Show closed (${adminClosedCount})`}
                  </button>
                )}
              </div>
              <div className="bg-white border border-[#EAD8C4] rounded-2xl overflow-hidden">
                {visibleAdmin.map(t => (
                  <div key={t.id} className={`flex items-center gap-3 px-4 py-3.5 border-b border-[#EAD8C4] ${t.status === 'complete' ? 'opacity-50' : ''}`}>
                    <Link to={`/tournament/${t.id}`} className="flex-1 text-[13.5px] font-semibold text-[#1C1610] no-underline">{t.name}</Link>
                    <span className={`text-[11px] font-semibold px-[9px] py-[3px] rounded-full ${
                      t.status === 'open'   ? 'bg-fairway/10 text-fairway' :
                      t.status === 'locked' ? 'bg-gold/20 text-gold' :
                                              'bg-warm-200 text-warm-400'
                    }`}>{t.status}</span>
                  </div>
                ))}
                <div className="flex items-center gap-5 px-4 py-3.5">
                  <Link to="/admin" className="text-[13px] text-brand font-semibold no-underline">Admin Panel →</Link>
                  <Link to="/admin/create-tournament" className="text-[13px] text-warm-400 no-underline">+ New Tournament</Link>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Sign out */}
        <div className="text-right">
          <button onClick={signOut} className="text-[12px] text-[#C8B8A4] bg-transparent border-none cursor-pointer">
            Sign out
          </button>
        </div>

      </div>

      {/* Sticky bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-sand border-t border-[#EAD8C4] flex justify-around items-start pt-2.5 z-10">
        <Link to="/dashboard" className="flex flex-col items-center gap-[3px] no-underline">
          <div
            className="w-[26px] h-[26px] rounded-[8px] flex items-center justify-center"
            style={{ background: 'rgba(193,74,24,.12)', border: '1px solid rgba(193,74,24,.28)' }}
          >
            <span className="font-display font-extrabold text-[13px] text-brand">P</span>
          </div>
          <span className="font-semibold text-[10px] text-brand">Pools</span>
        </Link>
        <div className="flex flex-col items-center gap-1 pt-0.5">
          <div className="flex flex-col gap-[3px] w-[22px]">
            <div className="h-[2.5px] bg-[#C8B8A4] rounded-sm" />
            <div className="h-[2.5px] bg-[#C8B8A4] rounded-sm w-4" />
            <div className="h-[2.5px] bg-[#C8B8A4] rounded-sm w-2.5" />
          </div>
          <span className="text-[10px] text-[#B8A890]">Board</span>
        </div>
        <div className="flex flex-col items-center gap-[3px]">
          <div className="w-[26px] h-[26px] rounded-full border-2 border-[#C8B8A4] flex items-center justify-center">
            <span className="font-display font-bold text-[10px] text-[#B8A890]">{initials}</span>
          </div>
          <span className="text-[10px] text-[#B8A890]">You</span>
        </div>
      </div>

    </div>
  )
}
