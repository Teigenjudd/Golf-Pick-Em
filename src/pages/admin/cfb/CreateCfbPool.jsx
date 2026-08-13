import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { createCfbPool } from '../../../lib/cfb'
import { useAuth } from '../../../context/AuthContext'
import { ordinal } from '../../../utils/format'

// Admin: create a CFB (college football) season pool. Unlike golf's create-once
// tournament, this spawns a whole season of weekly windows (seeds cfb.weeks). General
// admin register — no sport colorway. Slate import for each week happens afterward on
// the ops page. See docs/CFB_UI_PLAN.md §8.

function generateJoinCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

const CURRENT_YEAR = new Date().getFullYear()

export default function CreateCfbPool() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [name, setName] = useState('')
  const [seasonYear, setSeasonYear] = useState(String(CURRENT_YEAR))
  const [startWeek, setStartWeek] = useState('1')
  const [endWeek, setEndWeek] = useState('15')
  const [firstLockTime, setFirstLockTime] = useState('')
  const [stakeAmount, setStakeAmount] = useState('')
  const [payouts, setPayouts] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function addPayout() { setPayouts(p => [...p, '']) }
  function removePayout(i) { setPayouts(p => p.filter((_, idx) => idx !== i)) }
  function updatePayout(i, val) { setPayouts(p => p.map((x, idx) => (idx === i ? val : x))) }
  const payoutSum = payouts.reduce((s, p) => s + (parseFloat(p) || 0), 0)

  const weeksValid = Number(startWeek) >= 1 && Number(endWeek) >= Number(startWeek)
  const canSubmit = name.trim() && seasonYear && weeksValid && firstLockTime

  async function handleCreate() {
    if (!canSubmit) {
      setError('Fill in the pool name, season, a valid week range, and the first-week lock time.')
      return
    }
    if (Number(stakeAmount) > 0) {
      const nums = payouts.map(Number)
      if (!nums.length || nums.some(n => !(n > 0)) || nums.reduce((a, b) => a + b, 0) !== 100) {
        setError('Payout percentages must add up to exactly 100%.')
        return
      }
    }
    setSaving(true)
    setError(null)
    try {
      const { poolId } = await createCfbPool({
        name: name.trim(),
        seasonYear,
        startWeek,
        endWeek,
        firstLockTime,
        stakeAmount,
        payouts,
        createdBy: user.id,
        joinCode: generateJoinCode(),
      })
      navigate(`/admin/cfb/pool/${poolId}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const inputClass = "w-full px-[14px] py-3 border-[1.5px] border-[#EAD8C4] rounded-[11px] text-[14px] text-[#1C1610] bg-[#FFFAF6] outline-none disabled:opacity-50"
  const labelClass = "block text-[11px] font-semibold uppercase tracking-[.12em] text-warm-400 mb-[7px]"

  return (
    <div className="min-h-screen bg-sand pb-12">
      <div className="bg-white border-b border-[#EAD8C4] px-[18px] h-14 flex items-center gap-[14px] sticky top-0 z-10">
        <Link to="/admin/cfb" className="text-[13px] text-warm-400 no-underline">← CFB Admin</Link>
        <span className="text-[#EAD8C4] text-base select-none">|</span>
        <span className="font-display font-extrabold text-[22px] text-brand tracking-[.06em]">POOLD</span>
        <span className="font-display font-bold text-[16px] text-[#1C1610] tracking-[.04em]">New CFB Pool</span>
      </div>

      <div className="max-w-[520px] mx-auto px-[18px] py-6">
        {error && (
          <div className="mb-5 p-4 bg-birdie/5 border border-birdie/20 rounded-[11px] text-[13px] text-birdie">
            {error}
          </div>
        )}

        <div className="font-display font-extrabold text-[30px] text-[#1C1610] leading-none mb-6">Set up the season.</div>

        <div className="bg-white border-[1.5px] border-[#EAD8C4] rounded-[16px] p-[22px] flex flex-col gap-[18px]">
          <div>
            <label className={labelClass}>Pool Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. The Office League"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Season</label>
              <input
                type="number"
                value={seasonYear}
                onChange={e => setSeasonYear(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>First Week</label>
              <input
                type="number"
                min={1}
                max={20}
                value={startWeek}
                onChange={e => setStartWeek(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Last Week</label>
              <input
                type="number"
                min={1}
                max={20}
                value={endWeek}
                onChange={e => setEndWeek(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>
              Week 1 Lock <span className="normal-case font-normal text-warm-400">· required (each week steps +7 days; editable later)</span>
            </label>
            <input
              type="datetime-local"
              value={firstLockTime}
              onChange={e => setFirstLockTime(e.target.value)}
              className={inputClass}
            />
            <p className="text-[11.5px] text-warm-400 mt-[6px]">
              This is also the season <span className="font-semibold">join cutoff</span> — players must join before Week 1 locks.
            </p>
          </div>

          {/* Prize pool (optional) — shared season-long, paid on final standings */}
          <div>
            <label className={labelClass}>
              Stake per Player <span className="normal-case font-normal text-warm-400">(optional — $)</span>
            </label>
            <input
              type="number"
              min={0}
              step="1"
              value={stakeAmount}
              onChange={e => {
                setStakeAmount(e.target.value)
                if (Number(e.target.value) > 0 && payouts.length === 0) setPayouts([''])
              }}
              placeholder="e.g. 25"
              className={inputClass}
            />
          </div>

          {Number(stakeAmount) > 0 && (
            <div className="bg-sand border border-[#EAD8C4] rounded-[12px] px-4 py-[14px] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-warm-400">Payout Structure</p>
                <span className={`text-[12px] font-semibold ${payoutSum === 100 ? 'text-fairway' : 'text-birdie'}`}>
                  {payoutSum}% {payoutSum === 100 ? '✓' : 'of 100%'}
                </span>
              </div>
              {payouts.map((pct, i) => (
                <div key={i} className="flex items-center gap-[10px]">
                  <span className="text-[13px] text-[#1C1610] w-9 shrink-0">{ordinal(i + 1)}</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={pct}
                    onChange={e => updatePayout(i, e.target.value)}
                    placeholder="%"
                    className="flex-1 px-3 py-[9px] border-[1.5px] border-[#EAD8C4] rounded-[9px] text-[14px] text-[#1C1610] bg-white outline-none"
                  />
                  <span className="text-[13px] text-warm-400 w-4">%</span>
                  <button
                    type="button"
                    onClick={() => removePayout(i)}
                    className="text-[#C8B8A4] hover:text-birdie transition-colors text-sm px-1.5 bg-transparent border-none cursor-pointer"
                    aria-label={`Remove ${ordinal(i + 1)} place`}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addPayout}
                className="text-[13px] text-brand font-semibold bg-transparent border-none cursor-pointer text-left p-0 mt-[2px]"
              >
                + Add placement
              </button>
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={saving || !canSubmit}
            className={`w-full text-white font-bold text-[15px] py-[14px] rounded-[11px] border-none cursor-pointer transition-opacity ${
              !canSubmit ? 'bg-[#C8B8A4]' : 'bg-brand hover:opacity-90'
            } disabled:opacity-60`}
          >
            {saving ? 'Creating…' : 'Create CFB Pool →'}
          </button>
        </div>
      </div>
    </div>
  )
}
