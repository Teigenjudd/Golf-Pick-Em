import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getAdminCfbPools, getCfbPollingStatus, startCfbPolling, stopCfbPolling } from '../../../lib/cfb'
import AdminShell from '../../../components/admin/AdminShell'

// Admin: index of CFB (college football) pools. Entry point to create a new season
// pool and to open each pool's weekly ops. Kept separate from the golf-centric
// AdminDashboard (sport siloing). General admin register.

const STATUS_STYLES = {
  open: 'bg-fairway/10 text-fairway',
  locked: 'bg-gold/20 text-gold',
  complete: 'bg-warm-200 text-warm-400',
  draft: 'bg-warm-200 text-warm-400',
}

// Global on/off for the three CFB poller cron jobs (slate/lines, live scores,
// grading backstop). The CFB analogue of AdminDashboard's PollingControl — calls
// the admin-only RPCs in lib/cfb; the server re-checks is_admin() regardless of UI.
function CfbPollingControl() {
  const [on, setOn] = useState(null) // null = still loading status
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      setOn(await getCfbPollingStatus())
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
      if (on) await stopCfbPolling()
      else await startCfbPolling()
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const loading = on === null

  return (
    <div className="bg-white border border-[#EAD8C4] rounded-[14px] p-4 mb-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-[10px] min-w-0">
          <span className={`w-[9px] h-[9px] rounded-full shrink-0 ${on && !loading ? 'bg-fairway' : 'bg-warm-300'}`} />
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-[#1C1610]">CFB polling</p>
            <p className="text-[11.5px] text-warm-400 mt-[1px]">
              {loading
                ? 'Checking…'
                : on
                  ? 'On — slates, live scores, and grading are running on schedule'
                  : 'Off — slates and scores are not updating'}
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
        Arms the CFB slate, live-score, and grading pollers on their in-season game-day schedule. Turn off in the off-season.
      </p>
    </div>
  )
}

export default function CfbAdmin() {
  const [pools, setPools] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showClosed, setShowClosed] = useState(false)

  useEffect(() => {
    getAdminCfbPools()
      .then(setPools)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const closedCount = pools.filter(p => p.status === 'complete').length
  const visible = showClosed ? pools : pools.filter(p => p.status !== 'complete')

  return (
    <AdminShell activeSport="cfb">
      {error && (
        <div className="mb-5 p-4 bg-birdie/5 border border-birdie/20 rounded-[11px] text-[13px] text-birdie">
          {error}
        </div>
      )}

      <CfbPollingControl />

      <div className="flex items-center justify-between mb-5">
        <div className="font-display font-extrabold text-[28px] text-[#1C1610] leading-none">Pools</div>
        <Link
          to="/admin/cfb/create-pool"
          className="text-[13px] text-brand font-semibold no-underline hover:text-brand/80 transition-colors"
        >
          + New Pool
        </Link>
      </div>

      {!loading && pools.length > 0 && (
        <div className="flex items-center justify-between mb-[14px]">
          <p className="text-[13px] text-warm-400">
            {visible.length} pool{visible.length !== 1 ? 's' : ''}
          </p>
          {closedCount > 0 && (
            <button
              onClick={() => setShowClosed(s => !s)}
              className="text-[13px] text-warm-400 hover:text-charcoal transition-colors bg-transparent border-none cursor-pointer"
            >
              {showClosed ? 'Hide closed' : `Show closed (${closedCount})`}
            </button>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-warm-400 py-4">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-warm-400 py-4">No CFB pools yet. Create one to seed a season of weekly slates.</p>
      ) : (
        <div className="space-y-[10px]">
          {visible.map(p => (
            <Link
              key={p.id}
              to={`/admin/cfb/pool/${p.id}`}
              className="block bg-white border border-[#EAD8C4] rounded-[14px] p-4 no-underline hover:border-brand/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-[14.5px] font-semibold text-[#1C1610]">{p.name}</span>
                  <p className="text-[11.5px] text-warm-400 mt-[2px]">
                    {p.season_year} season · join code {p.join_code}
                  </p>
                </div>
                <span className={`text-[10px] font-display font-bold uppercase tracking-[.12em] px-2 py-[3px] rounded-full ${STATUS_STYLES[p.status] ?? STATUS_STYLES.draft}`}>
                  {p.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AdminShell>
  )
}
