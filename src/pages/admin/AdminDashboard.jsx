import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const STATUS_COLORS = {
  open:     'bg-green-100 text-green-700',
  locked:   'bg-amber-100 text-amber-700',
  complete: 'bg-gray-100 text-gray-500',
  draft:    'bg-gray-100 text-gray-400',
}

function StatusBadge({ status }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  )
}

// ── Tournaments ───────────────────────────────────────────────────────────────

function TournamentsTab() {
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState(null)
  const [updating, setUpdating] = useState(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('tournaments')
      .select('id, name, status, lock_time, join_code, created_at')
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

  if (loading) return <p className="text-sm text-gray-400 py-6">Loading…</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{tournaments.length} tournament{tournaments.length !== 1 ? 's' : ''}</p>
        <Link
          to="/admin/create-tournament"
          className="text-sm text-green-700 font-medium hover:text-green-800 transition-colors"
        >
          + Create Tournament
        </Link>
      </div>

      {tournaments.length === 0 ? (
        <p className="text-sm text-gray-400 py-4">No tournaments yet.</p>
      ) : (
        <div className="space-y-3">
          {tournaments.map(t => {
            const lockDate = t.lock_time
              ? new Date(t.lock_time).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
              : null
            return (
              <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <Link
                      to={`/tournament/${t.id}`}
                      className="text-sm font-medium text-gray-900 hover:text-green-700 transition-colors"
                    >
                      {t.name}
                    </Link>
                    {lockDate && (
                      <p className="text-xs text-gray-400 mt-0.5">Locks {lockDate}</p>
                    )}
                  </div>
                  <StatusBadge status={t.status} />
                </div>

                {/* Join link */}
                <div className="flex items-center gap-2 mb-3">
                  <code className="flex-1 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs text-gray-600 truncate">
                    {window.location.origin}/join/{t.join_code}
                  </code>
                  <button
                    onClick={() => copyJoinLink(t)}
                    className={`shrink-0 text-xs px-2 py-1 rounded border font-medium transition-colors ${
                      copiedId === t.id
                        ? 'bg-green-50 border-green-300 text-green-700'
                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {copiedId === t.id ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                {/* Status controls */}
                {t.status !== 'complete' && (
                  <div className="flex items-center gap-2">
                    {t.status === 'open' && (
                      <button
                        onClick={() => setStatus(t.id, 'locked')}
                        disabled={updating === t.id}
                        className="text-xs px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-50 transition-colors"
                      >
                        Lock
                      </button>
                    )}
                    {t.status === 'locked' && (
                      <button
                        onClick={() => setStatus(t.id, 'open')}
                        disabled={updating === t.id}
                        className="text-xs px-3 py-1.5 rounded-lg border border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-50 transition-colors"
                      >
                        Re-open
                      </button>
                    )}
                    <button
                      onClick={() => setStatus(t.id, 'complete')}
                      disabled={updating === t.id}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      Mark Complete
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
    await supabase
      .from('picks')
      .delete()
      .eq('tournament_id', selectedId)
      .eq('user_id', userId)
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
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white disabled:opacity-50"
        >
          <option value="">{loadingTournaments ? 'Loading…' : 'Select a tournament'}</option>
          {tournaments.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {!selectedId && (
        <p className="text-sm text-gray-400 py-4">Select a tournament to view participants.</p>
      )}

      {selectedId && loadingParticipants && (
        <p className="text-sm text-gray-400 py-4">Loading…</p>
      )}

      {selectedId && !loadingParticipants && participants.length === 0 && (
        <p className="text-sm text-gray-400 py-4">No participants yet.</p>
      )}

      {participants.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{participants.length} participant{participants.length !== 1 ? 's' : ''}</p>
          {participants.map(p => (
            <div key={p.user_id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.display_name}</p>
                  <p className="text-xs text-gray-400">{p.email}</p>
                </div>
                <button
                  onClick={() => removeParticipant(p.user_id, p.display_name)}
                  disabled={removing === p.user_id}
                  className="text-xs px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors shrink-0"
                >
                  {removing === p.user_id ? 'Removing…' : 'Remove'}
                </button>
              </div>
              <div className="space-y-1">
                {p.picks.map((pick, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="text-gray-400 w-14 shrink-0">{pick.label}</span>
                    <span>{pick.player_name}</span>
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
      .select('id, display_name, email, role, created_at')
      .order('created_at', { ascending: false })
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

  if (loading) return <p className="text-sm text-gray-400 py-6">Loading…</p>

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">{users.length} user{users.length !== 1 ? 's' : ''}</p>
      <div className="space-y-2">
        {users.map(u => (
          <div key={u.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{u.display_name || '—'}</p>
              <p className="text-xs text-gray-400 truncate">{u.email}</p>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
              u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {u.role}
            </span>
            {u.id !== currentUser?.id && (
              <button
                onClick={() => toggleRole(u.id, u.role)}
                disabled={updating === u.id}
                className="text-xs px-2.5 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors shrink-0"
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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-semibold text-gray-900">Admin</h1>
          </div>
          <button
            onClick={signOut}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Sign out
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-200 rounded-lg p-1 mb-6">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${
                activeTab === tab
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
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
