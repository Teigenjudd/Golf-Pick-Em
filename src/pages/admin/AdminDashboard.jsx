import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

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

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('tournaments')
      .select('id, name, status, lock_time, join_code, created_at, manual_refresh_count, slash_golf_tournament_id')
      .order('created_at', { ascending: false })
    setTournaments(data ?? [])
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
    await supabase.from('tournaments').update({ status }).eq('id', id)
    await load()
    setUpdating(null)
  }

  async function refreshScores(t) {
    setRefreshing(t.id)
    try {
      await supabase.functions.invoke('poll-leaderboard', { body: { tournament_id: t.id } })
      await supabase.from('tournaments').update({ manual_refresh_count: (t.manual_refresh_count ?? 0) + 1 }).eq('id', t.id)
      await load()
    } catch (err) {
      console.error('Refresh failed:', err)
    } finally {
      setRefreshing(null)
    }
  }

  if (loading) return <p className="text-sm text-warm-400 py-6">Loading…</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-warm-400">
          {tournaments.length} tournament{tournaments.length !== 1 ? 's' : ''}
        </p>
        <Link
          to="/admin/create-tournament"
          className="text-sm text-fairway font-medium hover:text-fairway/80 transition-colors"
        >
          + New Tournament
        </Link>
      </div>

      {tournaments.length === 0 ? (
        <p className="text-sm text-warm-400 py-4">No tournaments on the board yet.</p>
      ) : (
        <div className="space-y-3">
          {tournaments.map(t => {
            const lockDate = t.lock_time
              ? new Date(t.lock_time).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
              : null
            return (
              <div key={t.id} className="bg-white border border-warm-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <Link
                      to={`/tournament/${t.id}`}
                      className="text-sm font-medium text-charcoal hover:text-fairway transition-colors"
                    >
                      {t.name}
                    </Link>
                    {lockDate && (
                      <p className="text-xs text-warm-400 mt-0.5">Locks {lockDate}</p>
                    )}
                  </div>
                  <StatusBadge status={t.status} />
                </div>

                {/* Join link */}
                <div className="flex items-center gap-2 mb-3">
                  <code className="flex-1 bg-warm-100 border border-warm-200 rounded px-2 py-1 text-xs text-warm-500 truncate font-mono">
                    {window.location.origin}/join/{t.join_code}
                  </code>
                  <button
                    onClick={() => copyJoinLink(t)}
                    className={`shrink-0 text-xs px-2 py-1 rounded border font-medium transition-colors ${
                      copiedId === t.id
                        ? 'bg-fairway/10 border-fairway/30 text-fairway'
                        : 'bg-white border-warm-300 text-warm-500 hover:bg-warm-100'
                    }`}
                  >
                    {copiedId === t.id ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                {/* Score refresh */}
                {t.slash_golf_tournament_id && ['open', 'locked'].includes(t.status) && (() => {
                  const remaining = MANUAL_REFRESH_LIMIT - (t.manual_refresh_count ?? 0)
                  return (
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-warm-400">
                        {remaining}/{MANUAL_REFRESH_LIMIT} score refreshes left
                      </span>
                      <button
                        onClick={() => refreshScores(t)}
                        disabled={refreshing === t.id || remaining <= 0}
                        className={`text-xs px-2.5 py-1 rounded border font-medium transition-colors ${
                          remaining <= 0
                            ? 'border-warm-200 text-warm-300 cursor-not-allowed'
                            : 'border-fairway/40 text-fairway hover:bg-fairway/5 disabled:opacity-50'
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
                        className="text-xs px-3 py-1.5 rounded-lg border border-gold/40 text-gold hover:bg-gold/5 disabled:opacity-50 transition-colors"
                      >
                        Lock
                      </button>
                    )}
                    {t.status === 'locked' && (
                      <button
                        onClick={() => setStatus(t.id, 'open')}
                        disabled={updating === t.id}
                        className="text-xs px-3 py-1.5 rounded-lg border border-fairway/40 text-fairway hover:bg-fairway/5 disabled:opacity-50 transition-colors"
                      >
                        Re-open
                      </button>
                    )}
                    <button
                      onClick={() => setStatus(t.id, 'complete')}
                      disabled={updating === t.id}
                      className="text-xs px-3 py-1.5 rounded-lg border border-warm-300 text-warm-500 hover:bg-warm-100 disabled:opacity-50 transition-colors"
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
    supabase
      .from('tournaments')
      .select('id, name')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTournaments(data ?? [])
        setLoadingTournaments(false)
      })
  }, [])

  async function loadParticipants(tournamentId) {
    setLoadingParticipants(true)
    const { data } = await supabase
      .from('picks')
      .select('user_id, player_name, tiers(tier_number, label), profiles(display_name, email)')
      .eq('tournament_id', tournamentId)

    const map = {}
    ;(data ?? []).forEach(pick => {
      const uid = pick.user_id
      if (!map[uid]) {
        map[uid] = {
          user_id: uid,
          display_name: pick.profiles?.display_name ?? 'Participant',
          email: pick.profiles?.email ?? '',
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
    await supabase.from('picks').delete().eq('tournament_id', selectedId).eq('user_id', userId)
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
          className="w-full px-3 py-2.5 border border-warm-300 rounded-lg text-sm text-charcoal bg-white focus:outline-none focus:ring-2 focus:ring-fairway/20 focus:border-fairway disabled:opacity-50 transition-colors"
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
        <div className="space-y-3">
          <p className="text-sm text-warm-400">
            {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </p>
          {participants.map(p => (
            <div key={p.user_id} className="bg-white border border-warm-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-sm font-medium text-charcoal">{p.display_name}</p>
                  <p className="text-xs text-warm-400">{p.email}</p>
                </div>
                <button
                  onClick={() => removeParticipant(p.user_id, p.display_name)}
                  disabled={removing === p.user_id}
                  className="text-xs px-2.5 py-1 rounded-lg border border-birdie/30 text-birdie hover:bg-birdie/5 disabled:opacity-50 transition-colors shrink-0"
                >
                  {removing === p.user_id ? 'Removing…' : 'Remove'}
                </button>
              </div>
              <div className="space-y-1.5">
                {p.picks.map((pick, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-warm-400 w-14 shrink-0">{pick.label}</span>
                    <span className="text-charcoal">{pick.player_name}</span>
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
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, email, role, status, created_at')
      .order('created_at', { ascending: false })
    setUsers(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function approveUser(userId) {
    setUpdating(userId)
    await supabase.from('profiles').update({ status: 'approved' }).eq('id', userId)
    await load()
    setUpdating(null)
  }

  async function toggleRole(userId, currentRole) {
    const newRole = currentRole === 'admin' ? 'player' : 'admin'
    setUpdating(userId)
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    await load()
    setUpdating(null)
  }

  if (loading) return <p className="text-sm text-warm-400 py-6">Loading…</p>

  const pendingUsers = users.filter(u => u.status !== 'approved' && u.role !== 'admin')
  const approvedUsers = users.filter(u => u.status === 'approved' || u.role === 'admin')

  return (
    <div>
      <p className="text-sm text-warm-400 mb-4">
        {users.length} user{users.length !== 1 ? 's' : ''}
      </p>

      {pendingUsers.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-display font-bold uppercase tracking-widest text-gold mb-2">
            Pending approval ({pendingUsers.length})
          </p>
          <div className="space-y-2">
            {pendingUsers.map(u => (
              <div key={u.id} className="flex items-center gap-3 bg-white border border-warm-200 rounded-lg px-4 py-3 border-l-[3px] border-l-gold">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-charcoal truncate">{u.display_name || '—'}</p>
                  <p className="text-xs text-warm-400 truncate">{u.email}</p>
                </div>
                <button
                  onClick={() => approveUser(u.id)}
                  disabled={updating === u.id}
                  className="text-xs px-2.5 py-1 rounded-lg border border-fairway/40 text-fairway hover:bg-fairway/5 disabled:opacity-50 transition-colors shrink-0 font-medium"
                >
                  {updating === u.id ? '…' : 'Approve'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {approvedUsers.map(u => (
          <div key={u.id} className="bg-white border border-warm-200 rounded-lg px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-charcoal truncate">{u.display_name || '—'}</p>
              <p className="text-xs text-warm-400 truncate">{u.email}</p>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
              u.role === 'admin' ? 'bg-fairway/10 text-fairway' : 'bg-warm-200 text-warm-400'
            }`}>
              {u.role}
            </span>
            {u.id !== currentUser?.id && (
              <button
                onClick={() => toggleRole(u.id, u.role)}
                disabled={updating === u.id}
                className="text-xs px-2.5 py-1 rounded-lg border border-warm-300 text-warm-500 hover:bg-warm-100 disabled:opacity-50 transition-colors shrink-0"
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
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="bg-fairway px-6 py-5">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="text-cream/50 hover:text-cream/80 text-sm transition-colors">
              ← Dashboard
            </Link>
            <span className="font-display font-bold text-cream text-xl tracking-tight">Admin</span>
          </div>
          <button
            onClick={signOut}
            className="text-sm text-cream/50 hover:text-cream/80 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-0.5 bg-warm-200 rounded-lg p-0.5 mb-6">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${
                activeTab === tab
                  ? 'bg-white text-charcoal shadow-sm'
                  : 'text-warm-500 hover:text-charcoal'
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
