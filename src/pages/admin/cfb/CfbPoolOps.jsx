import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getCfbPool, getCfbPoolWeeks, getCfbdUsage,
  updateWeekLockTime, refreshCfbSlates, refreshCfbScores,
  gradeCfbWeek, finalizeCfbWeek, weekIsLocked,
} from '../../../lib/cfb'

// Admin: the CFB season ops surface. Slates are imported AUTOMATICALLY by the
// poll-cfb-lines poller (hourly) — the admin never imports by hand. This page is for
// visibility (which weeks have loaded games, their status) + tuning lock times, with a
// manual "Refresh slates now" override. See docs/CFB_UI_PLAN.md §9b.

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
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState(null)

  const [refreshingScores, setRefreshingScores] = useState(false)
  const [scoresMsg, setScoresMsg] = useState(null)
  const [gradingWeek, setGradingWeek] = useState(null) // weekId currently grading/finalizing
  const [weekMsgs, setWeekMsgs] = useState({}) // weekId -> { text, isError }

  // Initial load. Async IIFE so setState only happens after an await (the lint-clean
  // effect pattern used elsewhere in the app); `active` guards against a late resolve
  // after unmount.
  useEffect(() => {
    let active = true
    ;(async () => {
      const p = await getCfbPool(poolId)
      if (!active) return
      if (!p) { setError('Pool not found.'); setLoading(false); return }
      setPool(p)
      const [w, u] = await Promise.all([getCfbPoolWeeks(p.event_id), getCfbdUsage()])
      if (!active) return
      setWeeks(w); setUsage(u); setLoading(false)
    })().catch(err => { if (active) { setError(err.message); setLoading(false) } })
    return () => { active = false }
  }, [poolId])

  // Refetch weeks + usage after an admin action (called from event handlers, not an
  // effect).
  async function reload() {
    if (!pool) return
    const [w, u] = await Promise.all([getCfbPoolWeeks(pool.event_id), getCfbdUsage()])
    setWeeks(w); setUsage(u)
  }

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
      await reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingWeek(null)
    }
  }

  async function handleRefreshSlates() {
    setRefreshing(true)
    setError(null)
    setRefreshMsg(null)
    try {
      const res = await refreshCfbSlates()
      setRefreshMsg(
        `Refreshed — ${res.game_rows_written ?? 0} game rows written, ` +
        `${res.spread_moves_logged ?? 0} spread moves logged (${res.cfbd_calls ?? 0} CFBD calls).`,
      )
      await reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setRefreshing(false)
    }
  }

  async function handleRefreshScores() {
    setRefreshingScores(true)
    setError(null)
    setScoresMsg(null)
    try {
      const res = await refreshCfbScores()
      setScoresMsg(res?.message ?? `Refreshed — ${res?.cfbd_calls ?? 0} CFBD calls spent.`)
      await reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setRefreshingScores(false)
    }
  }

  function setWeekMsg(weekId, text, isError = false) {
    setWeekMsgs(m => ({ ...m, [weekId]: { text, isError } }))
  }

  async function handleGradeWeek(w) {
    setGradingWeek(w.id)
    setWeekMsg(w.id, null)
    setError(null)
    try {
      const res = await gradeCfbWeek(w.id)
      const g = res?.graded?.[0]
      if (g?.error) {
        setWeekMsg(w.id, g.error, true)
      } else {
        setWeekMsg(w.id, `Graded — ${g?.picks_graded ?? 0} picks scored, week ${g?.final ? 'final' : 'partial (some games still not final)'}.`)
      }
      await reload()
    } catch (err) {
      setWeekMsg(w.id, err.message, true)
    } finally {
      setGradingWeek(null)
    }
  }

  async function handleFinalizeWeek(w) {
    const confirmed = window.confirm(
      `Finalize ${w.label} as-is? Games that haven't finished will be scored as no-contest pushes and the week will be marked graded.`,
    )
    if (!confirmed) return
    setGradingWeek(w.id)
    setWeekMsg(w.id, null)
    setError(null)
    try {
      const res = await finalizeCfbWeek(w.id)
      const g = res?.graded?.[0]
      if (g?.error) {
        setWeekMsg(w.id, g.error, true)
      } else {
        setWeekMsg(w.id, `Finalized — ${g?.picks_graded ?? 0} picks scored (unfinished games marked no-contest). Week is now graded.`)
      }
      await reload()
    } catch (err) {
      setWeekMsg(w.id, err.message, true)
    } finally {
      setGradingWeek(null)
    }
  }

  const inputClass = "px-[10px] py-[7px] border-[1.5px] border-[#EAD8C4] rounded-[9px] text-[13px] text-[#1C1610] bg-[#FFFAF6] outline-none"

  return (
    <div className="min-h-screen bg-sand pb-12">
      <div className="bg-white border-b border-[#EAD8C4] px-[18px] h-14 flex items-center gap-[14px] sticky top-0 z-10">
        <Link to="/admin/cfb" className="text-[13px] text-warm-400 no-underline">← CFB Admin</Link>
        <span className="text-[#EAD8C4] text-base select-none">|</span>
        <span className="font-display font-extrabold text-[22px] text-brand tracking-[.06em]">POOLD</span>
        <span className="font-display font-bold text-[16px] text-[#1C1610] tracking-[.04em]">Season Ops</span>
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
            <div className="flex items-end justify-between gap-4 mb-4 flex-wrap">
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

            {/* Automated-slate banner + manual override */}
            <div className="bg-white border border-[#EAD8C4] rounded-[14px] p-4 mb-5 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[240px]">
                <p className="text-[13px] text-[#1C1610] font-medium">Slates &amp; spreads update automatically every hour.</p>
                <p className="text-[12px] text-warm-400 mt-[3px]">
                  Games appear as CFBD posts lines — roughly 1–2 weeks before kickoff — so far-out weeks stay empty until then.
                  Each game&apos;s spread freezes at kickoff.
                </p>
                {refreshMsg && <p className="text-[12px] text-fairway mt-[6px]">{refreshMsg}</p>}
                {scoresMsg && <p className="text-[12px] text-fairway mt-[6px]">{scoresMsg}</p>}
              </div>
              <div className="flex items-center gap-[10px] flex-wrap">
                <button
                  onClick={handleRefreshScores}
                  disabled={refreshingScores}
                  className="text-[13px] font-semibold px-4 py-[9px] rounded-[9px] border-[1.5px] border-[#EAD8C4] text-warm-500 hover:bg-warm-100 disabled:opacity-50 bg-transparent cursor-pointer transition-colors"
                >
                  {refreshingScores ? 'Refreshing…' : 'Refresh scores'}
                </button>
                <button
                  onClick={handleRefreshSlates}
                  disabled={refreshing}
                  className="text-[13px] font-bold px-4 py-[9px] rounded-[9px] border-none text-white bg-brand hover:opacity-90 disabled:opacity-50 cursor-pointer transition-opacity"
                >
                  {refreshing ? 'Refreshing…' : 'Refresh slates now'}
                </button>
              </div>
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
                        {w.game_count} {w.game_count === 1 ? 'game' : 'games'} loaded
                      </span>
                    </div>

                    <div className="flex items-center gap-[10px] flex-wrap">
                      <label className="text-[11px] font-semibold uppercase tracking-[.1em] text-warm-400">Lock</label>
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

                      {w.status !== 'graded' && weekIsLocked(w) && (
                        <>
                          <button
                            onClick={() => handleGradeWeek(w)}
                            disabled={gradingWeek === w.id}
                            className="text-[13px] font-bold px-3 py-[7px] rounded-[9px] border-none text-white bg-brand hover:opacity-90 disabled:opacity-50 cursor-pointer transition-opacity"
                          >
                            {gradingWeek === w.id ? 'Working…' : 'Grade week'}
                          </button>
                          <button
                            onClick={() => handleFinalizeWeek(w)}
                            disabled={gradingWeek === w.id}
                            title="Escape hatch — grades finished games, marks the rest no-contest, forces the week graded"
                            className="text-[13px] font-semibold px-3 py-[7px] rounded-[9px] border-[1.5px] border-birdie/30 text-birdie hover:bg-birdie/5 disabled:opacity-40 bg-transparent cursor-pointer transition-colors"
                          >
                            Finalize as-is
                          </button>
                        </>
                      )}
                    </div>
                    {weekMsgs[w.id]?.text && (
                      <p className={`text-[12px] mt-[8px] ${weekMsgs[w.id].isError ? 'text-birdie' : 'text-fairway'}`}>
                        {weekMsgs[w.id].text}
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
