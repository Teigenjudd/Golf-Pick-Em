import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Navigate, Link, useNavigate } from 'react-router-dom'
import { getMyPickRows, getPoolViewsByIds, getPoolPicks, getLatestLeaderboard } from '../lib/golf'
import { getMyCfbPools } from '../lib/cfb'
import { computeScores, assignRanks, formatScore } from '../utils/scoring'
import { getInitials } from '../utils/format'
import SportBadge from '../components/SportBadge'
import Footer from '../components/Footer'
import CfbPoolTile from '../components/cfb/CfbPoolTile'
import BottomSheet from '../components/BottomSheet'

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

// Sheet content: join-code entry, submitted to the real join flow at
// /join/:code (which already handles invalid/expired codes) rather than
// duplicating that logic here. Shared by the "Join another pool" dashed card
// and the "+" header button's Add-a-pool sheet.
function JoinPoolSheetContent({ onClose }) {
  const navigate = useNavigate()
  const [code, setCode] = useState('')

  function submit(e) {
    e.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) return
    navigate(`/join/${trimmed.toUpperCase()}`)
    onClose()
  }

  return (
    <>
      <p className="text-[13.5px] text-warm-400 leading-snug mb-[16px]">
        Enter the invite code your commissioner sent you.
      </p>
      <form onSubmit={submit}>
        <input
          autoFocus
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="e.g. AB12CD"
          className="w-full border border-warm-300 rounded-[12px] px-[15px] py-[13px] text-[15px] text-charcoal bg-white placeholder:text-warm-300 outline-none focus:ring-2 focus:ring-fairway/20 focus:border-fairway transition-colors mb-[14px]"
        />
        <button
          type="submit"
          disabled={!code.trim()}
          className="w-full bg-brand text-white font-bold text-[15px] py-[14px] rounded-[12px] border-none cursor-pointer disabled:opacity-40 transition-colors"
        >
          Join pool
        </button>
      </form>
    </>
  )
}

// Sheet content for admins only — non-admins have just one option (join), so
// they skip straight to JoinPoolSheetContent instead of a chooser (see
// header "+" and the dashed card, both branch on role before picking a
// sheet). Side-by-side buttons so the two don't read as one field+submit pair.
function AddPoolSheetContent({ onJoinWithCode }) {
  return (
    <div className="flex gap-[10px] mt-[10px]">
      <button
        onClick={onJoinWithCode}
        className="flex-1 bg-brand text-white font-bold text-[14.5px] py-[14px] rounded-[12px] border-none cursor-pointer text-center"
      >
        Join with code
      </button>
      <Link
        to="/admin/create"
        className="flex-1 text-center bg-brand text-white font-bold text-[14.5px] py-[14px] rounded-[12px] no-underline"
      >
        Create pool
      </Link>
    </div>
  )
}

// Header avatar. Non-admins go straight to /profile as before. Admins get a
// small dropdown (Profile / Admin) anchored under the avatar instead of a
// separate always-visible "Admin Panel" row taking up space on the dashboard.
function ProfileMenu({ initials, needsName, isAdmin }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  const badge = needsName && (
    <span className="absolute -top-[1px] -right-[1px] w-[10px] h-[10px] rounded-full bg-gold border-2 border-white" />
  )

  if (!isAdmin) {
    return (
      <Link to="/profile" className="relative w-[34px] h-[34px] rounded-full bg-brand flex items-center justify-center no-underline">
        <span className="font-display font-bold text-[13px] text-white">{initials}</span>
        {badge}
      </Link>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative w-[34px] h-[34px] rounded-full bg-brand flex items-center justify-center border-none cursor-pointer"
      >
        <span className="font-display font-bold text-[13px] text-white">{initials}</span>
        {badge}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-[42px] right-0 z-50 w-[168px] bg-white border border-[#EAD8C4] rounded-[12px] shadow-[0_8px_24px_rgba(28,22,16,.12)] overflow-hidden">
            <Link
              to="/profile"
              onClick={() => setOpen(false)}
              className="block px-4 py-[11px] text-[13.5px] font-medium text-[#1C1610] no-underline hover:bg-warm-100 transition-colors border-b border-[#EAD8C4]"
            >
              Profile
            </Link>
            <Link
              to="/admin"
              onClick={() => setOpen(false)}
              className="block px-4 py-[11px] text-[13.5px] font-medium text-[#1C1610] no-underline hover:bg-warm-100 transition-colors"
            >
              Admin
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

// A labeled row with a count pill + chevron that toggles a section below it
// (Closed pools). Matches the design-tool proposal's declutter pattern.
function CollapsibleRow({ label, count, open, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between py-[9px] bg-transparent border-none cursor-pointer"
    >
      <span className="font-display font-bold text-[10px] uppercase tracking-[.22em] text-warm-400">{label}</span>
      <span className="flex items-center gap-[6px]">
        <span className="text-[11px] font-semibold text-warm-400 bg-warm-100 rounded-full w-5 h-5 flex items-center justify-center">
          {count}
        </span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9E9488" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .18s ease-out' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </span>
    </button>
  )
}

// One golf pool card (open/locked/complete). Extracted so it can render in
// two separate spots — the always-visible open list and the closed-pools
// expand — without duplicating ~100 lines of markup.
function PoolCard({ t, standing }) {
  const isComplete = t.tournamentStatus === 'complete'
  const isLocked = t.tournamentStatus === 'locked' || (t.lockTime && new Date(t.lockTime) <= new Date())
  const isActive = !isComplete && !isLocked
  const showStanding = (isLocked || isComplete) && standing

  return (
    <div
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
            className="flex-1 bg-brand rounded-[10px] py-3 px-[14px] text-center font-bold text-[13.5px] text-white no-underline"
          >
            Leaderboard →
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
}

export default function Dashboard() {
  const { user, profile, loading, signOut } = useAuth()
  const [myTournaments, setMyTournaments] = useState([])
  const [showClosed, setShowClosed] = useState(false)
  const [myStandings, setMyStandings] = useState({})
  const [sheet, setSheet] = useState(null) // null | 'join' | 'add'
  const [cfbPools, setCfbPools] = useState([])

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
    if (!user) return
    getMyCfbPools(user.id).then(setCfbPools)
  }, [user])

  if (loading) return null
  if (!user) return <Navigate to="/" replace />

  const initials = getInitials(profile?.display_name)
  const needsName = !!profile && !profile.display_name_set_at
  const openTournaments = myTournaments.filter(t => t.tournamentStatus !== 'complete')
  const closedTournaments = myTournaments.filter(t => t.tournamentStatus === 'complete')
  const openCfbPools = cfbPools.filter(p => p.status !== 'complete')
  const closedCfbPools = cfbPools.filter(p => p.status === 'complete')

  return (
    <div className="min-h-screen bg-sand pb-10 flex flex-col">

      {/* Sticky top nav */}
      <div className="bg-white border-b border-[#EAD8C4] px-[18px] h-14 flex items-center justify-between sticky top-0 z-10">
        <span className="font-display font-extrabold text-[26px] text-brand tracking-[.07em]">POOLD</span>
        <div className="flex items-center gap-[13px]">
          <button
            onClick={() => setSheet(profile?.role === 'admin' ? 'add' : 'join')}
            title="Add a pool"
            className="w-[34px] h-[34px] rounded-full bg-white border border-[#EAD8C4] flex items-center justify-center hover:bg-warm-100 transition-colors cursor-pointer"
          >
            <span className="font-display font-bold text-[17px] text-brand leading-none">+</span>
          </button>
          <ProfileMenu initials={initials} needsName={needsName} isAdmin={profile?.role === 'admin'} />
        </div>
      </div>

      <div className="max-w-[480px] mx-auto px-[18px] pt-[22px] pb-3">

        {/* Greeting */}
        <div className="text-[12px] text-warm-400 mb-0.5">{getDateStr()}</div>
        <div className="font-display font-extrabold text-[38px] text-[#1C1610] leading-none mb-[18px]">{getGreeting()}</div>

        {/* Section label */}
        {(myTournaments.length > 0 || cfbPools.length > 0) && (
          <div className="flex items-center justify-between mb-[10px]">
            <div className="font-display font-bold text-[10px] uppercase tracking-[.22em] text-warm-400">
              Active Pools
            </div>
            <span className="text-[11px] font-semibold text-warm-400 bg-warm-100 rounded-full w-5 h-5 flex items-center justify-center">
              {openTournaments.length + openCfbPools.length}
            </span>
          </div>
        )}

        {/* Pool cards — always the open ones; closed ones live in their own
            expand below, so this list never reshuffles or grows past the
            closed-pools toggle. */}
        {openTournaments.map(t => (
          <PoolCard key={t.id} t={t} standing={myStandings[t.id]} />
        ))}

        {/* CFB pool tiles — after golf tiles, per docs/CFB_UI_PLAN.md §4 */}
        {openCfbPools.map(tile => <CfbPoolTile key={tile.poolId} tile={tile} />)}

        {/* Join card — admins get both join + create via the Add-a-pool chooser */}
        <button
          onClick={() => setSheet(profile?.role === 'admin' ? 'add' : 'join')}
          className="w-full border-[1.5px] border-dashed border-[#D0BCA8] rounded-[13px] py-[14px] text-center mb-5 bg-transparent cursor-pointer"
        >
          <span className="font-display font-bold text-[14px] text-warm-400">
            {profile?.role === 'admin' ? '+ Join or Create Pool' : '+ Join another pool'}
          </span>
        </button>

        {/* Closed pools — the toggle stays put; expanded cards render right
            below it, not interleaved above, so collapsing it never requires
            scrolling. */}
        {(closedTournaments.length > 0 || closedCfbPools.length > 0) && (
          <div className="mb-5">
            <CollapsibleRow label="Closed pools" count={closedTournaments.length + closedCfbPools.length} open={showClosed} onToggle={() => setShowClosed(s => !s)} />
            {showClosed && (
              <div className="mt-[10px]">
                {closedTournaments.map(t => (
                  <PoolCard key={t.id} t={t} standing={myStandings[t.id]} />
                ))}
                {closedCfbPools.map(tile => (
                  <CfbPoolTile key={tile.poolId} tile={tile} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {myTournaments.length === 0 && cfbPools.length === 0 && profile?.role !== 'admin' && (
          <div className="text-center py-16">
            <p className="text-[13px] text-warm-400">You haven&apos;t joined any pools yet.</p>
            <p className="text-[12px] text-warm-300 mt-1">Use a join link from your pool organizer to get started.</p>
          </div>
        )}

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

      <BottomSheet open={sheet === 'join'} onClose={() => setSheet(null)} title="Join a pool">
        <JoinPoolSheetContent onClose={() => setSheet(null)} />
      </BottomSheet>

      <BottomSheet open={sheet === 'add'} onClose={() => setSheet(null)} title="Add a pool">
        <AddPoolSheetContent onJoinWithCode={() => setSheet('join')} />
      </BottomSheet>

    </div>
  )
}
