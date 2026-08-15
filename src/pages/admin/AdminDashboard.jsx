import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import AdminShell from '../../components/admin/AdminShell'
import {
  getAdminPools, bumpRefreshCount,
  getPollingStatus, startPolling, stopPolling,
} from '../../lib/golf'
import { setPoolStatus } from '../../lib/pools'

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

// ── Pools ─────────────────────────────────────────────────────────────────────

const MANUAL_REFRESH_LIMIT = 3

// Global on/off for the tournament-weekend leaderboard cron jobs. Replaces the
// old ritual of pasting cron.schedule / cron.unschedule SQL by hand. Calls the
// admin-only RPCs in lib/golf; the server re-checks is_admin() regardless of UI.
function PollingControl() {
  const [on, setOn] = useState(null) // null = still loading status
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      setOn(await getPollingStatus())
    } catch (e) {
      setError(e.message)
      setOn(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function toggle() {
    setBusy(true)
    setError(null)
    try {
      if (on) await stopPolling()
      else await startPolling()
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const loading = on === null

  return (
    <div className="bg-white border border-[#EAD8C4] rounded-[14px] p-4 mb-[14px]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-[10px] min-w-0">
          <span className={`w-[9px] h-[9px] rounded-full shrink-0 ${on && !loading ? 'bg-fairway' : 'bg-warm-300'}`} />
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-[#1C1610]">Leaderboard polling</p>
            <p className="text-[11.5px] text-warm-400 mt-[1px]">
              {loading
                ? 'Checking…'
                : on
                  ? 'On — pulling scores every 20 min, Thu–Sun'
                  : 'Off — scores are not updating'}
            </p>
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={loading || busy}
          className={`shrink-0 text-[12px] font-semibold px-[14px] py-[6px] rounded-[8px] border cursor-pointer transition-colors disabled:opacity-50 ${
            on
              ? 'border-birdie/30 text-birdie hover:bg-birdie/5'
              : 'border-fairway/35 text-fairway hover:bg-fairway/5'
          }`}
        >
          {busy ? '…' : on ? 'Turn off' : 'Turn on'}
        </button>
      </div>

      {error && (
        <p className="text-[11.5px] text-birdie border border-birdie/30 bg-birdie/5 rounded-[8px] px-3 py-2 mt-3">
          {error}
        </p>
      )}

      <p className="text-[11px] text-warm-400 mt-3 leading-snug">
        Turn on the morning of the first round; turn off after the final round. While on, it spends Slash Golf API calls on the 20-minute cadence.
      </p>
    </div>
  )
}

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
      <PollingControl />

      <div className="flex items-center justify-between mb-[14px]">
        <p className="text-[13px] text-warm-400">
          {visible.length} pool{visible.length !== 1 ? 's' : ''}
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
            + New Pool
          </Link>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-warm-400 py-4">
          {tournaments.length === 0 ? 'No pools on the board yet.' : 'All pools are closed.'}
        </p>
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
                      Close Pool
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

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  return (
    <AdminShell activeSport="golf">
      <TournamentsTab />
    </AdminShell>
  )
}
