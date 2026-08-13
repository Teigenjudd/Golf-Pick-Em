import { useState, useEffect, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getCfbPool, getCfbPoolWeeks, getCfbdUsage,
  updateWeekLockTime, importWeekSlate,
} from '../../../lib/cfb'

// Admin: the recurring CFB ops surface golf never needed — where a season is run week
// by week. Per-week: edit the lock time, import the CFBD slate, see the game count and
// status. Plus the shared Tier-2 CFBD usage meter. General admin register.
// See docs/CFB_UI_PLAN.md §9b.

function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const STATUS_STYLES = {
  scheduled: 'bg-warm-200 text-warm-500',
  open: 'bg-fairway/10 text-fairway',
  locked: 'bg-gold/20 text-gold',
  graded: 'bg-warm-200 text-warm-400',
}

function WeekStatus({ status }) {
  return (
    <span className={`text-[10px] font-display font-bold uppercase tracking-[.12em] px-2 py-[3px] rounded-full ${STATUS_STYLES[status] ?? STATUS_STYLES.scheduled}`}>
      {status}
    </span>
  )
}

export default function CfbPoolOps() {
  const { id: poolId } = useParams()
  const [pool, setPool] = useState(null)
  const [weeks, setWeeks] = useState([])
  const [usage, setUsage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [lockEdits, setLockEdits] = useState({}) // weekId -> local datetime string
  const [savingWeek, setSavingWeek] = useState(null)
  const [importingWeek, setImportingWeek] = useState(null)
  const [results, setResults] = useState({}) // weekId -> message

  const load = useCallback(async () => {
    try {
      const p = await getCfbPool(poolId)
      if (!p) { setError('Pool not found.'); setLoading(false); return }
      setPool(p)
      const [w, u] = await Promise.all([getCfbPoolWeeks(p.event_id), getCfbdUsage()])
      setWeeks(w)
      setUsage(u)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [poolId])

  useEffect(() => { load() }, [load])

  function lockValue(w) {
    return lockEdits[w.id] !== undefined ? lockEdits[w.id] : toLocalInput(w.lock_time)
  }
  function lockDirty(w) {
    return lockEdits[w.id] !== undefined && lockEdits[w.id] !== toLocalInput(w.lock_time)
  }

  async function handleSaveLock(w) {
    setSavingWeek(w.id)
    setError(null)
    try {
      await updateWeekLockTime(w.id, lockEdits[w.id] || null)
      setLockEdits(e => { const next = { ...e }; delete next[w.id]; return next })
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingWeek(null)
    }
  }

  async function handleImport(w) {
    if (!pool?.season_year) { setError('This pool has no season year set.'); return }
    setImportingWeek(w.id)
    setError(null)
    setResults(r => ({ ...r, [w.id]: null }))
    try {
      const res = await importWeekSlate({
        weekId: w.id,
        seasonYear: pool.season_year,
        weekNumber: w.week_number,
      })
      setResults(r => ({ ...r, [w.id]: `Imported ${res.imported} eligible of ${res.fetched} games` }))
      const [freshWeeks, freshUsage] = await Promise.all([getCfbPoolWeeks(pool.event_id), getCfbdUsage()])
      setWeeks(freshWeeks)
      setUsage(freshUsage)
    } catch (err) {
      setResults(r => ({ ...r, [w.id]: `Error: ${err.message}` }))
    } finally {
      setImportingWeek(null)
    }
  }

  const inputClass = "px-[10px] py-[7px] border-[1.5px] border-[#EAD8C4] rounded-[9px] text-[13px] text-[#1C1610] bg-[#FFFAF6] outline-none"

  return (
    <div className="min-h-screen bg-sand pb-12">
      <div className="bg-white border-b border-[#EAD8C4] px-[18px] h-14 flex items-center gap-[14px] sticky top-0 z-10">
        <Link to="/admin/cfb" className="text-[13px] text-warm-400 no-underline">← CFB Admin</Link>
        <span className="text-[#EAD8C4] text-base select-none">|</span>
        <span className="font-display font-extrabold text-[22px] text-brand tracking-[.06em]">POOLD</span>
        <span className="font-display font-bold text-[16px] text-[#1C1610] tracking-[.04em]">Weekly Ops</span>
      </div>

      <div className="max-w-3xl mx-auto px-[18px] py-6">
        {error && (
          <div className="mb-5 p-4 bg-birdie/5 border border-birdie/20 rounded-[11px] text-[13px] text-birdie">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-warm-400 py-4">Loading…</p>
        ) : pool ? (
          <>
            <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
              <div>
                <div className="font-display font-extrabold text-[28px] text-[#1C1610] leading-none">{pool.name}</div>
                <p className="text-[13px] text-warm-400 mt-[6px]">
                  {pool.season_year} season · join code <span className="font-semibold text-[#1C1610]">{pool.join_code}</span>
                </p>
              </div>
              {usage && (
                <div className="text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-warm-400">CFBD calls · {usage.month}</p>
                  <p className="text-[15px] font-display font-bold text-[#1C1610] tabular-nums">
                    {usage.calls.toLocaleString()} <span className="text-warm-400 font-normal">/ {usage.cap.toLocaleString()}</span>
                  </p>
                </div>
              )}
            </div>

            {weeks.length === 0 ? (
              <p className="text-sm text-warm-400 py-4">No weeks seeded for this pool.</p>
            ) : (
              <div className="space-y-[10px]">
                {weeks.map(w => (
                  <div key={w.id} className="bg-white border border-[#EAD8C4] rounded-[14px] p-4">
                    <div className="flex items-center justify-between gap-3 mb-[12px]">
                      <div className="flex items-center gap-[10px]">
                        <span className="font-display font-bold text-[15px] text-[#1C1610]">{w.label}</span>
                        <WeekStatus status={w.status} />
                      </div>
                      <span className="text-[12px] text-warm-400">
                        {w.game_count} {w.game_count === 1 ? 'game' : 'games'}
                      </span>
                    </div>

                    <div className="flex items-center gap-[10px] flex-wrap">
                      <input
                        type="datetime-local"
                        value={lockValue(w)}
                        onChange={e => setLockEdits(ed => ({ ...ed, [w.id]: e.target.value }))}
                        className={inputClass}
                      />
                      <button
                        onClick={() => handleSaveLock(w)}
                        disabled={!lockDirty(w) || savingWeek === w.id}
                        className="text-[13px] font-semibold px-3 py-[7px] rounded-[9px] border-[1.5px] border-[#EAD8C4] text-warm-500 hover:bg-warm-100 disabled:opacity-40 bg-transparent cursor-pointer transition-colors"
                      >
                        {savingWeek === w.id ? 'Saving…' : 'Save lock'}
                      </button>

                      <button
                        onClick={() => handleImport(w)}
                        disabled={importingWeek === w.id}
                        className="ml-auto text-[13px] font-bold px-4 py-[8px] rounded-[9px] border-none text-white bg-brand hover:opacity-90 disabled:opacity-50 cursor-pointer transition-opacity"
                      >
                        {importingWeek === w.id ? 'Importing…' : w.game_count > 0 ? 'Re-import slate' : 'Import slate'}
                      </button>
                    </div>

                    {results[w.id] && (
                      <p className={`text-[12px] mt-[10px] ${results[w.id].startsWith('Error') ? 'text-birdie' : 'text-fairway'}`}>
                        {results[w.id]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
