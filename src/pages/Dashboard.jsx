import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Navigate, Link } from 'react-router-dom'
import { getMyPickRows, getPoolViewsByIds, getPoolPicks, getLatestLeaderboard, getAllPools } from '../lib/golf'
import { computeScores, assignRanks, formatScore } from '../utils/scoring'
import { getInitials } from '../utils/format'
import SportBadge from '../components/SportBadge'
import BottomNav from '../components/BottomNav'
import Footer from '../components/Footer'

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

  useEffect(() => {
    if (!user) return
    getMyPickRows(user.id).then(rows => {
      const statusesByPool = {}
      rows.forEach(r => {
        if (!statusesByPool[r.pool_id]) statusesByPool[r.pool_id] = []
        statusesByPool[r.pool_id].push(r.status)
      })
      const poolIds = Object.keys(statusesByPool)
      if (!poolIds.length) { setMyTournaments([]); return }

      getPoolViewsByIds(poolIds).then(pools => {
        setMyTournaments(pools.map(p => ({
          id: p.id,
          eventId: p.event_id,
          name: p.name,
          tournamentStatus: p.status,
          lockTime: p.lock_time,
          scoresToKeep: p.scores_to_keep,
          badgeConfig: p.badge_config,
          pickStatus: statusesByPool[p.id].every(s => s === 'confirmed') ? 'confirmed' : 'pending',
        })))
      })
    })
  }, [user])

  // Fetch rank + score for locked/complete tournaments
  useEffect(() => {
    const targets = myTournaments.filter(t => {
      const pastLockTime = t.lockTime && new Date(t.lockTime) <= new Date()
      return t.tournamentStatus === 'locked' || t.tournamentStatus === 'complete' || pastLockTime
    })
    if (!targets.length || !user) return

    targets.forEach(async t => {
      const [allPicks, cache] = await Promise.all([
        getPoolPicks(t.id),
        getLatestLeaderboard(t.eventId),
      ])

      if (!allPicks?.length || !cache) return

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
    getAllPools().then(setAdminTournaments)
  }, [user, profile])

  if (loading) return null
  if (!user) return <Navigate to="/" replace />

  const initials = getInitials(profile?.display_name)
  const closedTournaments = myTournaments.filter(t => t.tournamentStatus === 'complete')
  const visibleTournaments = showClosed ? myTournaments : myTournaments.filter(t => t.tournamentStatus !== 'complete')

  return (
    <div className="min-h-screen bg-sand pb-20 flex flex-col">

      {/* Sticky top nav */}
      <div className="bg-white border-b border-[#EAD8C4] px-[18px] h-14 flex items-center justify-between sticky top-0 z-10">
        <span className="font-display font-extrabold text-[26px] text-brand tracking-[.07em]">POOLD</span>
        <div className="flex items-center gap-[13px]">
          {profile?.role === 'admin' && (
            <Link to="/admin/create-tournament" className="text-[12px] font-medium text-warm-400 no-underline">+ New</Link>
          )}
          <Link to="/profile" className="w-[34px] h-[34px] rounded-full bg-brand flex items-center justify-center no-underline">
            <span className="font-display font-bold text-[13px] text-white">{initials}</span>
          </Link>
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
                <SportBadge config={t.badgeConfig} size="md" />
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

      {/* mt-auto: sit at the foot of the page, not wherever the content happens to end */}
      <div className="mt-auto">
        <Footer />
      </div>

      <BottomNav active="pools" />

    </div>
  )
}
