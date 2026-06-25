import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import {
  getAdminPools, getAllPools, setPoolStatus, bumpRefreshCount,
  getPoolPicks, removePoolParticipant,
} from '../../lib/golf'

const STATUS_BADGE = {
  open:     'bg-fairway/10 text-fairway',
  locked:   'bg-gold/20 text-gold',
  complete: 'bg-warm-200 text-warm-500',
  draft:    'bg-warm-200 text-warm-400',
}

function StatusBadge({ status }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[status] ?? 'bg-warm-200 text-warm-400'}`}>
      {status}
    </span>
  )
}

// ── Tournaments ───────────────────────────────────────────────────────────────

const MANUAL_REFRESH_LIMIT = 3

function TournamentsTab() {
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState(null)
  const [updating, setUpdating] = useState(null)
  const [refreshing, setRefreshing] = useState(null)
  const [showClosed, setShowClosed] = useState(false)

  const load = useCallback(async () => {
    setTournaments(await getAdminPools())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function copyJoinLink(t) {
    navigator.clipboard.writeText(`${window.location.origin}/join/${t.join_code}`)
    setCopiedId(t.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  async function setStatus(id, status) {
    setUpdating(id)
    await setPoolStatus(id, status)
    await load()
    setUpdating(null)
  }

  async function refreshScores(t) {
    setRefreshing(t.id)
    try {
      await supabase.functions.invoke('poll-leaderboard', { body: { event_id: t.event_id } })
      await bumpRefreshCount(t.event_id, t.manual_refresh_count)
      await load()
    } catch (err) {
      console.error('Refresh failed:', err)
    } finally {
      setRefreshing(null)
    }
  }

  if (loading) return <p className="text-sm text-warm-400 py-6">Loading…</p>

  const closedCount = tournaments.filter(t => t.status === 'complete').length
  const visible = showClosed ? tournaments : tournaments.filter(t => t.status !== 'complete')

  return (
    <div>
      <div className="flex items-center justify-between mb-[14px]">
        <p className="text-[13px] text-warm-400">
          {visible.length} tournament{visible.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-4">
          {closedCount > 0 && (
            <button
              onClick={() => setShowClosed(s => !s)}
              className="text-[13px] text-warm-400 hover:text-charcoal transition-colors bg-transparent border-none cursor-pointer"
            >
              {showClosed ? 'Hide closed' : `Show closed (${closedCount})`}
            </button>
          )}
          <Link
            to="/admin/create-tournament"
            className="text-[13px] text-brand font-semibold no-underline hover:text-brand/80 transition-colors"
          >
            + New Tournament
          </Link>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-warm-400 py-4">No tournaments on the board yet.</p>
      ) : (
        <div className="space-y-[10px]">
          {visible.map(t => {
            const lockDate = t.lock_time
              ? new Date(t.lock_time).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
              : null
            return (
              <div key={t.id} className="bg-white border border-[#EAD8C4] rounded-[14px] p-4">
                <div className="flex items-start justify-between gap-3 mb-[11px]">
                  <div>
                    <Link
                      to={`/tournament/${t.id}`}
                      className="text-[14.5px] font-semibold text-[#1C1610] no-underline hover:text-brand transition-colors"
                    >
                      {t.name}
                    </Link>
                    {lockDate && (
                      <p className="text-[11.5px] text-warm-400 mt-[2px]">Locks {lockDate}</p>
                    )}
                  </div>
                  <StatusBadge status={t.status} />
                </div>

                {/* Join link */}
                <div className="flex items-center gap-2 mb-[11px]">
                  <div className="flex-1 bg-sand border border-[#EAD8C4] rounded-[7px] px-[10px] py-[7px] text-[11px] text-warm-400 truncate">
                    {window.location.origin}/join/{t.join_code}
                  </div>
                  <button
                    onClick={() => copyJoinLink(t)}
                    className={`shrink-0 text-[11.5px] font-semibold px-3 py-[7px] rounded-[7px] border cursor-pointer transition-colors ${
                      copiedId === t.id
                        ? 'bg-fairway/10 border-fairway/30 text-fairway'
                        : 'bg-white border-[#EAD8C4] text-warm-400 hover:bg-warm-100'
                    }`}
                  >
                    {copiedId === t.id ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                {/* Score refresh */}
                {t.slash_golf_tournament_id && ['open', 'locked'].includes(t.status) && (() => {
                  const remaining = MANUAL_REFRESH_LIMIT - (t.manual_refresh_count ?? 0)
                  return (
                    <div className="flex items-center justify-between mb-[11px]">
                      <span className="text-[11.5px] text-warm-400">
                        {remaining}/{MANUAL_REFRESH_LIMIT} score refreshes left
                      </span>
                      <button
                        onClick={() => refreshScores(t)}
                        disabled={refreshing === t.id || remaining <= 0}
                        className={`text-[11.5px] font-semibold px-3 py-[5px] rounded-[7px] border cursor-pointer transition-colors ${
                          remaining <= 0
                            ? 'border-warm-200 text-warm-300 cursor-not-allowed'
                            : 'border-fairway/30 text-fairway hover:bg-fairway/5 disabled:opacity-50'
                        }`}
                      >
                        {refreshing === t.id ? 'Refreshing…' : 'Refresh Scores'}
                      </button>
                    </div>
                  )
                })()}

                {/* Status controls */}
                {t.status !== 'complete' && (
                  <div className="flex items-center gap-2">
                    {t.status === 'open' && (
                      <button
                        onClick={() => setStatus(t.id, 'locked')}
                        disabled={updating === t.id}
                        className="text-[12px] font-semibold px-[14px] py-[6px] rounded-[8px] border border-gold/50 text-gold hover:bg-gold/5 disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        Lock
                      </button>
                    )}
                    {t.status === 'locked' && (
                      <button
                        onClick={() => setStatus(t.id, 'open')}
                        disabled={updating === t.id}
                        className="text-[12px] font-semibold px-[14px] py-[6px] rounded-[8px] border border-fairway/35 text-fairway hover:bg-fairway/5 disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        Re-open
                      </button>
                    )}
                    <button
                      onClick={() => setStatus(t.id, 'complete')}
                      disabled={updating === t.id}
                      className="text-[12px] px-[14px] py-[6px] rounded-[8px] border border-[#EAD8C4] text-warm-400 hover:bg-warm-100 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      Close Tournament
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Participants ──────────────────────────────────────────────────────────────

function ParticipantsTab() {
  const [tournaments, setTournaments] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [participants, setParticipants] = useState([])
  const [loadingTournaments, setLoadingTournaments] = useState(true)
  const [loadingParticipants, setLoadingParticipants] = useState(false)
  const [removing, setRemoving] = useState(null)

  useEffect(() => {
    getAllPools().then(data => {
      setTournaments(data)
      setLoadingTournaments(false)
    })
  }, [])

  async function loadParticipants(poolId) {
    setLoadingParticipants(true)
    // Email is column-restricted on profiles, so pull it from the admin RPC and
    // merge it in by user_id rather than embedding it on the picks query.
    const [data, { data: users }] = await Promise.all([
      getPoolPicks(poolId, { confirmedOnly: false }),
      supabase.rpc('admin_list_users'),
    ])

    const emailById = {}
    ;(users ?? []).forEach(u => { emailById[u.id] = u.email })

    const map = {}
    ;(data ?? []).forEach(pick => {
      const uid = pick.user_id
      if (!map[uid]) {
        map[uid] = {
          user_id: uid,
          display_name: pick.profiles?.display_name ?? 'Participant',
          email: emailById[uid] ?? '',
          picks: [],
        }
      }
      map[uid].picks.push({
        player_name: pick.player_name,
        tier_number: pick.tiers?.tier_number ?? 0,
        label: pick.tiers?.label ?? '',
      })
    })

    setParticipants(
      Object.values(map).map(u => ({
        ...u,
        picks: u.picks.sort((a, b) => a.tier_number - b.tier_number),
      }))
    )
    setLoadingParticipants(false)
  }

  function handleSelectTournament(id) {
    setSelectedId(id)
    setParticipants([])
    if (id) loadParticipants(id)
  }

  async function removeParticipant(userId, displayName) {
    if (!window.confirm(`Remove ${displayName}'s picks from this tournament? This cannot be undone.`)) return
    setRemoving(userId)
    await removePoolParticipant(selectedId, userId)
    setParticipants(prev => prev.filter(p => p.user_id !== userId))
    setRemoving(null)
  }

  return (
    <div>
      <div className="mb-4">
        <select
          value={selectedId}
          onChange={e => handleSelectTournament(e.target.value)}
          disabled={loadingTournaments}
          className="w-full px-[14px] py-[11px] border-[1.5px] border-[#EAD8C4] rounded-[11px] text-[14px] text-[#1C1610] bg-white outline-none appearance-none disabled:opacity-50"
        >
          <option value="">{loadingTournaments ? 'Loading…' : 'Select a tournament'}</option>
          {tournaments.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {!selectedId && (
        <p className="text-sm text-warm-400 py-4">Select a tournament to view participants.</p>
      )}
      {selectedId && loadingParticipants && (
        <p className="text-sm text-warm-400 py-4">Loading…</p>
      )}
      {selectedId && !loadingParticipants && participants.length === 0 && (
        <p className="text-sm text-warm-400 py-4">No cards in yet.</p>
      )}

      {participants.length > 0 && (
        <div className="space-y-[9px]">
          <p className="text-[13px] text-warm-400 mb-3">
            {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </p>
          {participants.map(p => (
            <div key={p.user_id} className="bg-white border border-[#EAD8C4] rounded-[13px] px-4 py-[14px]">
              <div className="flex items-start justify-between gap-3 mb-[11px]">
                <div>
                  <p className="text-[14px] font-semibold text-[#1C1610]">{p.display_name}</p>
                  <p className="text-[12px] text-warm-400 mt-[1px]">{p.email}</p>
                </div>
                <button
                  onClick={() => removeParticipant(p.user_id, p.display_name)}
                  disabled={removing === p.user_id}
                  className="text-[11.5px] px-[11px] py-[5px] rounded-[7px] border border-birdie/30 text-birdie hover:bg-birdie/5 disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
                >
                  {removing === p.user_id ? 'Removing…' : 'Remove'}
                </button>
              </div>
              <div className="flex flex-col gap-[5px]">
                {p.picks.map((pick, i) => (
                  <div key={i} className="flex items-center gap-[10px]">
                    <span className="text-[11px] text-warm-400 w-[50px] shrink-0">{pick.label}</span>
                    <span className="text-[13px] text-[#1C1610]">{pick.player_name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Users ─────────────────────────────────────────────────────────────────────

function UsersTab() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)

  const load = useCallback(async () => {
    // Email is column-restricted on profiles; admins read it via this RPC.
    const { data } = await supabase.rpc('admin_list_users')
    setUsers(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleRole(userId, currentRole) {
    const newRole = currentRole === 'admin' ? 'player' : 'admin'
    setUpdating(userId)
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    await load()
    setUpdating(null)
  }

  if (loading) return <p className="text-sm text-warm-400 py-6">Loading…</p>

  return (
    <div>
      <p className="text-[13px] text-warm-400 mb-3">
        {users.length} user{users.length !== 1 ? 's' : ''}
      </p>

      <div className="flex flex-col gap-2">
        {users.map(u => (
          <div key={u.id} className="bg-white border border-[#EAD8C4] rounded-[13px] px-4 py-[13px] flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-[#1C1610] truncate">{u.display_name || '—'}</p>
              <p className="text-[12px] text-warm-400 mt-[1px] truncate">{u.email}</p>
            </div>
            <span className={`text-[11px] font-semibold px-[9px] py-[3px] rounded-full shrink-0 ${
              u.role === 'admin' ? 'bg-fairway/10 text-fairway' : 'bg-[#EBE3D4] text-warm-400'
            }`}>
              {u.role}
            </span>
            {u.id !== currentUser?.id && (
              <button
                onClick={() => toggleRole(u.id, u.role)}
                disabled={updating === u.id}
                className="text-[12px] px-3 py-[6px] rounded-[8px] border border-[#EAD8C4] text-warm-400 hover:bg-warm-100 disabled:opacity-50 transition-colors shrink-0 cursor-pointer whitespace-nowrap"
              >
                {updating === u.id ? '…' : u.role === 'admin' ? 'Make Player' : 'Make Admin'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

const TABS = ['Tournaments', 'Participants', 'Users']

export default function AdminDashboard() {
  const { signOut } = useAuth()
  const [activeTab, setActiveTab] = useState('Tournaments')

  return (
    <div className="min-h-screen bg-sand pb-12">
      {/* Sticky nav */}
      <div className="bg-white border-b border-[#EAD8C4] px-[18px] h-14 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-[14px]">
          <Link to="/dashboard" className="text-[13px] text-warm-400 no-underline">← Dashboard</Link>
          <span className="text-[#EAD8C4] text-base select-none">|</span>
          <span className="font-display font-extrabold text-[22px] text-brand tracking-[.06em]">POOLD</span>
          <span className="font-display font-bold text-[16px] text-[#1C1610] tracking-[.04em]">Admin</span>
        </div>
        <button
          onClick={signOut}
          className="text-[12px] text-[#C8B8A4] bg-transparent border-none cursor-pointer"
        >
          Sign out
        </button>
      </div>

      <div className="max-w-[620px] mx-auto px-[18px] pt-[22px]">
        {/* Tabs */}
        <div className="flex gap-[2px] bg-[#EAD8C4] rounded-[10px] p-[3px] mb-[22px]">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 text-[13.5px] font-medium py-2 rounded-[8px] border-none cursor-pointer transition-colors ${
                activeTab === tab
                  ? 'bg-white text-[#1C1610]'
                  : 'bg-transparent text-[#7A6858]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'Tournaments'  && <TournamentsTab />}
        {activeTab === 'Participants' && <ParticipantsTab />}
        {activeTab === 'Users'        && <UsersTab />}
      </div>
    </div>
  )
}
