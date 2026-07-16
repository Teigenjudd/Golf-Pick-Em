import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCenter,
} from '@dnd-kit/core'
import { createGolfPool } from '../../lib/golf'
import { useAuth } from '../../context/AuthContext'
import { getTournaments, getTournamentField, getRankings } from '../../lib/slashGolf'
import { getGolfOdds, GOLF_SPORT_KEYS } from '../../lib/oddsApi'
import { buildTiers } from '../../utils/tierBuilder'
import { ordinal } from '../../utils/format'
import { unwrapNumber } from '../../utils/scoring'
import { buildPlayerIndex, resolvePlayer } from '../../utils/playerMatch'

function formatOdds(odds) {
  if (odds == null) return 'N/A'
  return odds > 0 ? `+${odds}` : `${odds}`
}

function generateJoinCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PlayerCard({ player, isDragging = false }) {
  return (
    <div className={`flex justify-between items-center px-[11px] py-2 bg-white border rounded-[8px] select-none ${
      isDragging ? 'shadow-lg border-fairway/40' : 'border-[#EAD8C4]'
    }`}>
      <span className="text-[13px] text-[#1C1610]">{player.player_name}</span>
      <span className="text-[11px] text-warm-400">{formatOdds(player.odds)}</span>
    </div>
  )
}

function DraggablePlayer({ player }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: player.player_id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`bg-white border border-[#EAD8C4] rounded-[8px] text-sm select-none cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-30' : ''}`}
    >
      <div className="flex justify-between items-center px-[11px] py-2">
        <span className="text-[13px] text-[#1C1610]">{player.player_name}</span>
        <span className="text-[11px] text-warm-400">
          {formatOdds(player.odds)} · #{player.owgr_rank ?? '—'}
        </span>
      </div>
    </div>
  )
}

function DroppableTier({ tier }) {
  const { setNodeRef, isOver } = useDroppable({ id: `tier-${tier.tier_number}` })
  return (
    <div
      ref={setNodeRef}
      className={`rounded-[13px] border-2 transition-colors min-h-[60px] overflow-hidden ${
        isOver ? 'border-fairway/40 bg-fairway/5' : 'border-[#EAD8C4]'
      }`}
    >
      <div className="flex items-center gap-[9px] px-[14px] py-[10px] border-b border-[#EAD8C4] bg-white">
        <span className="w-5 h-5 rounded-full bg-fairway flex items-center justify-center shrink-0">
          <span className="font-display font-bold text-[10px] text-cream leading-none">{tier.tier_number}</span>
        </span>
        <h3 className="font-display font-bold text-[13px] tracking-[.04em] text-[#1C1610] flex-1">{tier.label}</h3>
        <span className="text-[11px] text-warm-400">{tier.players.length}</span>
      </div>
      <div className="bg-sand p-[9px] flex flex-col gap-[5px]">
        {tier.players.map(player => (
          <DraggablePlayer key={player.player_id} player={player} />
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CreateTournament() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [step, setStep] = useState(1)

  const [name, setName] = useState('')
  const [slashTournaments, setSlashTournaments] = useState([])
  const [selectedSlashId, setSelectedSlashId] = useState('')
  const [selectedPgaName, setSelectedPgaName] = useState('')
  const [sportKey, setSportKey] = useState('')
  const [pickCount, setPickCount] = useState(8)
  const [scoresToKeep, setScoresToKeep] = useState(5)
  const [lockTime, setLockTime] = useState('')
  const [stakeAmount, setStakeAmount] = useState('')
  const [payouts, setPayouts] = useState([]) // array of percent strings, one per placement
  const [courseName, setCourseName] = useState('')
  const [geoCoords, setGeoCoords] = useState({ lat: null, lon: null })
  const [loadingTournaments, setLoadingTournaments] = useState(true)
  const [buildingTiers, setBuildingTiers] = useState(false)

  const [tiers, setTiers] = useState([])
  const [activePlayer, setActivePlayer] = useState(null)
  const [saving, setSaving] = useState(false)

  const [error, setError] = useState(null)
  const [oddsWarning, setOddsWarning] = useState(false)
  const [retryIn, setRetryIn] = useState(0)
  const [cachedData, setCachedData] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  useEffect(() => {
    getTournaments()
      .then(data => setSlashTournaments(data.schedule ?? data.tournaments ?? data ?? []))
      .catch(err => setError(err.message))
      .finally(() => setLoadingTournaments(false))
  }, [])

  useEffect(() => {
    if (retryIn <= 0) return
    const id = setTimeout(() => setRetryIn(r => r - 1), 1000)
    return () => clearTimeout(id)
  }, [retryIn])

  function proceedToStep2(fieldData, rankingsData, oddsOutcomes) {
    const rawField = fieldData.players ?? []
    const fieldPlayers = rawField
      .filter(entry => entry?.playerId)
      .map(p => ({
        player_id: String(unwrapNumber(p.playerId) ?? p.playerId),
        player_name: `${p.firstName} ${p.lastName}`.trim(),
      }))

    // The books and Slash Golf spell plenty of names differently, so both joins go
    // through the resolver rather than a raw name lookup. See docs/NAME_MATCHING.md.
    const oddsIndex = buildPlayerIndex(oddsOutcomes)

    const rankIndex = buildPlayerIndex(
      (rankingsData?.rankings ?? []).map(r => ({
        name: `${r.firstName} ${r.lastName}`.trim(),
        rank: unwrapNumber(r.rank),
      }))
    )

    const players = fieldPlayers.map(p => ({
      ...p,
      odds: resolvePlayer(p.player_name, oddsIndex)?.price ?? null,
      owgr_rank: resolvePlayer(p.player_name, rankIndex)?.rank ?? null,
    }))

    const { tiers: builtTiers } = buildTiers(players, pickCount)
    setTiers(builtTiers)
    setOddsWarning(false)
    setCachedData(null)
    setRetryIn(0)
    setStep(2)
  }

  async function handleNext() {
    if (!name || !selectedSlashId) {
      setError('Please fill in all required fields.')
      return
    }
    if (Number(stakeAmount) > 0) {
      const nums = payouts.map(Number)
      if (!nums.length || nums.some(n => !(n > 0)) || nums.reduce((a, b) => a + b, 0) !== 100) {
        setError('Payout percentages must add up to exactly 100%.')
        return
      }
    }
    setBuildingTiers(true)
    setError(null)
    setOddsWarning(false)
    try {
      const fieldData = await getTournamentField(selectedSlashId)

      const hostCourse = fieldData.courses?.find(c => c.host === 'Yes') ?? fieldData.courses?.[0]
      if (hostCourse?.courseName && !courseName.trim()) setCourseName(hostCourse.courseName)

      const loc = hostCourse?.location
      // Nominatim free-text search: the most specific query (course + city + state) pins the
      // course itself, and gracefully falls back to the town when the course is unknown.
      // Replaces Open-Meteo's name-only geocoder, which couldn't resolve course names or
      // "City, State" strings — it returned nothing for UK links courses (docs/BACKLOG.md F3).
      const geoQuery = [hostCourse?.courseName, loc?.city, loc?.state].filter(Boolean).join(', ')

      const [oddsOutcomes, rankingsData, geoResult] = await Promise.all([
        sportKey ? getGolfOdds(sportKey).catch(() => []) : Promise.resolve([]),
        getRankings().catch(() => null),
        geoQuery
          ? fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(geoQuery)}&format=json&limit=1`)
              .then(r => r.json()).then(d => d?.[0] ?? null).catch(() => null)
          : Promise.resolve(null),
      ])
      const geoLat = geoResult ? parseFloat(geoResult.lat) : NaN
      const geoLon = geoResult ? parseFloat(geoResult.lon) : NaN
      setGeoCoords({
        lat: Number.isFinite(geoLat) ? geoLat : null,
        lon: Number.isFinite(geoLon) ? geoLon : null,
      })
      if (sportKey && oddsOutcomes.length === 0) {
        setCachedData({ fieldData, rankingsData })
        setRetryIn(180)
        setOddsWarning(true)
        return
      }
      proceedToStep2(fieldData, rankingsData, oddsOutcomes)
    } catch (err) {
      setError(err.message)
    } finally {
      setBuildingTiers(false)
    }
  }

  async function handleRetryOdds() {
    if (!cachedData) return
    setBuildingTiers(true)
    setError(null)
    try {
      const oddsOutcomes = await getGolfOdds(sportKey).catch(() => [])
      if (oddsOutcomes.length === 0) { setRetryIn(180); return }
      proceedToStep2(cachedData.fieldData, cachedData.rankingsData, oddsOutcomes)
    } catch (err) {
      setError(err.message)
    } finally {
      setBuildingTiers(false)
    }
  }

  function handleContinueWithOwgr() {
    if (!cachedData) return
    proceedToStep2(cachedData.fieldData, cachedData.rankingsData, [])
  }

  function handleDragStart({ active }) {
    setActivePlayer(tiers.flatMap(t => t.players).find(p => p.player_id === active.id) ?? null)
  }

  function handleDragEnd({ active, over }) {
    setActivePlayer(null)
    if (!over) return
    const playerId = active.id
    const targetTierNum = parseInt(over.id.replace('tier-', ''), 10)
    setTiers(prev => {
      const srcIdx = prev.findIndex(t => t.players.some(p => p.player_id === playerId))
      const dstIdx = prev.findIndex(t => t.tier_number === targetTierNum)
      if (srcIdx === -1 || dstIdx === -1 || srcIdx === dstIdx) return prev
      const next = prev.map(t => ({ ...t, players: [...t.players] }))
      const player = next[srcIdx].players.find(p => p.player_id === playerId)
      next[srcIdx].players = next[srcIdx].players.filter(p => p.player_id !== playerId)
      next[dstIdx].players.push(player)
      return next
    })
  }

  function addPayout() { setPayouts(p => [...p, '']) }
  function removePayout(i) { setPayouts(p => p.filter((_, idx) => idx !== i)) }
  function updatePayout(i, val) { setPayouts(p => p.map((x, idx) => (idx === i ? val : x))) }
  const payoutSum = payouts.reduce((s, p) => s + (parseFloat(p) || 0), 0)

  async function handleCreate() {
    setSaving(true)
    setError(null)
    try {
      const { poolId } = await createGolfPool({
        name,
        pgaName: selectedPgaName,
        courseName: courseName.trim(),
        slashId: selectedSlashId,
        pickCount,
        scoresToKeep,
        stakeAmount,
        payouts,
        lockTime,
        geoCoords,
        tiers,
        createdBy: user.id,
        joinCode: generateJoinCode(),
      })
      navigate(`/tournament/${poolId}`)
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
      {/* Sticky nav */}
      <div className="bg-white border-b border-[#EAD8C4] px-[18px] h-14 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-[14px]">
          <Link to="/admin" className="text-[13px] text-warm-400 no-underline">← Admin</Link>
          <span className="text-[#EAD8C4] text-base select-none">|</span>
          <span className="font-display font-extrabold text-[22px] text-brand tracking-[.06em]">POOLD</span>
          <span className="font-display font-bold text-[16px] text-[#1C1610] tracking-[.04em]">Create Tournament</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-brand flex items-center justify-center">
            <span className="font-display font-bold text-[11px] text-white">{step}</span>
          </div>
          <span className="text-[12px] text-warm-400">of 2</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-[3px] bg-[#EAD8C4]">
        <div
          className="h-full bg-brand rounded-r-[2px] transition-[width] duration-300"
          style={{ width: step === 1 ? '50%' : '100%' }}
        />
      </div>

      <div className="max-w-4xl mx-auto px-[18px] py-6">
        {error && (
          <div className="mb-5 p-4 bg-birdie/5 border border-birdie/20 rounded-[11px] text-[13px] text-birdie">
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="max-w-[520px]">
            <div className="font-display font-extrabold text-[30px] text-[#1C1610] leading-none mb-6">Set it up.</div>
          <div className="bg-white border-[1.5px] border-[#EAD8C4] rounded-[16px] p-[22px] flex flex-col gap-[18px]">
            <div>
              <label className={labelClass}>Tournament Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. 2026 US Open"
                className={inputClass}
              />
            </div>


            <div>
              <label className={labelClass}>Slash Golf Tournament</label>
              <select
                value={selectedSlashId}
                onChange={e => {
                  setSelectedSlashId(e.target.value)
                  const t = slashTournaments.find(t => (t.tournId ?? t.id) === e.target.value)
                  setSelectedPgaName(t?.name ?? '')
                }}
                disabled={loadingTournaments}
                className={inputClass}
              >
                <option value="">{loadingTournaments ? 'Loading…' : 'Select a tournament'}</option>
                {slashTournaments.map(t => (
                  <option key={t.tournId ?? t.id} value={t.tournId ?? t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>
                Odds Market <span className="normal-case font-normal text-warm-400">(optional — majors only)</span>
              </label>
              <select
                value={sportKey}
                onChange={e => setSportKey(e.target.value)}
                className={inputClass}
              >
                <option value="">None (no odds)</option>
                {GOLF_SPORT_KEYS.map(k => (
                  <option key={k.key} value={k.key}>{k.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Picks per Participant</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={pickCount}
                  onChange={e => setPickCount(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Scores to Keep</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={scoresToKeep}
                  onChange={e => setScoresToKeep(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Lock Time</label>
              <input
                type="datetime-local"
                value={lockTime}
                onChange={e => setLockTime(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Prize pool (optional) */}
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

            {oddsWarning ? (
              <div className="rounded-[11px] border border-gold/30 bg-gold/5 p-4 flex flex-col gap-3">
                <p className="text-[14px] font-medium text-[#1C1610]">
                  Odds unavailable — the market may not be open yet.
                </p>
                <p className="text-[13px] text-warm-500">
                  Tiers will fall back to OWGR rankings. You can retry now or wait for odds to post.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleRetryOdds}
                    disabled={buildingTiers || retryIn > 0}
                    className="flex-1 bg-fairway hover:bg-fairway/90 disabled:opacity-50 text-cream text-[14px] font-medium py-2.5 rounded-[11px] transition-colors border-none cursor-pointer"
                  >
                    {buildingTiers ? 'Checking…' : retryIn > 0 ? `Retry in ${retryIn}s` : 'Try Again'}
                  </button>
                  <button
                    onClick={handleContinueWithOwgr}
                    disabled={buildingTiers}
                    className="flex-1 border-[1.5px] border-[#EAD8C4] text-warm-500 hover:bg-warm-100 disabled:opacity-50 text-[14px] font-medium py-2.5 rounded-[11px] transition-colors bg-transparent cursor-pointer"
                  >
                    Continue with OWGR Rankings
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleNext}
                disabled={buildingTiers || !name || !selectedSlashId}
                className={`w-full text-white font-bold text-[15px] py-[14px] rounded-[11px] border-none cursor-pointer transition-opacity ${
                  !name || !selectedSlashId ? 'bg-[#C8B8A4]' : 'bg-brand hover:opacity-90'
                } disabled:opacity-60`}
              >
                {buildingTiers ? 'Fetching field & odds…' : 'Fetch field & odds →'}
              </button>
            )}
          </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="font-display font-extrabold text-[30px] text-[#1C1610] leading-none mb-[6px]">Set the tiers.</div>
            <p className="text-[13px] text-warm-400 mb-[22px]">Drag players between tiers to adjust. Field auto-built from OWGR + odds.</p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="grid grid-cols-2 gap-[14px] mb-[22px]">
                {tiers.map(tier => (
                  <DroppableTier key={tier.tier_number} tier={tier} />
                ))}
              </div>
              <DragOverlay>
                {activePlayer ? <PlayerCard player={activePlayer} isDragging /> : null}
              </DragOverlay>
            </DndContext>

            <div className="flex gap-[10px]">
              <button
                onClick={() => { setStep(1); setError(null) }}
                className="px-[22px] py-[13px] border-[1.5px] border-[#EAD8C4] rounded-[11px] text-[14px] text-warm-400 hover:bg-warm-100 bg-transparent transition-colors cursor-pointer"
              >
                ← Back
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 bg-fairway hover:bg-fairway/90 disabled:opacity-50 text-cream font-bold text-[15px] py-[13px] rounded-[11px] border-none cursor-pointer transition-colors"
              >
                {saving ? 'Creating…' : 'Create Tournament'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
