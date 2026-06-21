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
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { getTournaments, getTournamentField, getRankings } from '../../lib/slashGolf'
import { getGolfOdds, GOLF_SPORT_KEYS } from '../../lib/oddsApi'
import { buildTiers } from '../../utils/tierBuilder'
import { ordinal } from '../../utils/format'

function unwrapNumber(val) {
  if (val == null) return null
  if (typeof val === 'number') return val
  if (val.$numberInt !== undefined) return parseInt(val.$numberInt, 10)
  if (val.$numberDouble !== undefined) return parseFloat(val.$numberDouble)
  return val
}

function formatOdds(odds) {
  if (odds == null) return 'N/A'
  return odds > 0 ? `+${odds}` : `${odds}`
}

function normalizeName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function generateJoinCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PlayerCard({ player, isDragging = false }) {
  return (
    <div className={`flex justify-between items-center px-3 py-2 bg-white border rounded-lg text-sm select-none ${
      isDragging ? 'shadow-lg border-fairway/40' : 'border-warm-200'
    }`}>
      <span className="text-charcoal">{player.player_name}</span>
      <span className="text-warm-400 font-mono text-xs">{formatOdds(player.odds)}</span>
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
      className={`bg-white border border-warm-200 rounded-lg text-sm select-none cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-30' : ''}`}
    >
      <div className="flex justify-between items-center px-3 py-2">
        <span className="text-charcoal">{player.player_name}</span>
        <span className="text-warm-400 font-mono text-xs">
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
      className={`rounded-lg border-2 transition-colors min-h-[60px] overflow-hidden ${
        isOver ? 'border-fairway/40 bg-fairway/5' : 'border-warm-200 bg-warm-100'
      }`}
    >
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-warm-200 bg-white">
        <span className="w-5 h-5 rounded-full bg-fairway flex items-center justify-center text-[10px] font-display font-bold text-cream leading-none shrink-0">
          {tier.tier_number}
        </span>
        <h3 className="font-display font-bold text-sm uppercase tracking-wide text-charcoal flex-1">{tier.label}</h3>
        <span className="text-xs text-warm-400">{tier.players.length}</span>
      </div>
      <div className="p-3 space-y-1.5">
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

    const oddsMap = {}
    oddsOutcomes.forEach(o => { oddsMap[normalizeName(o.name)] = o.price })

    const rankMap = {}
    const rawRankings = rankingsData?.rankings ?? []
    rawRankings.forEach(r => {
      rankMap[normalizeName(`${r.firstName} ${r.lastName}`)] = unwrapNumber(r.rank)
    })

    const players = fieldPlayers.map(p => ({
      ...p,
      odds: oddsMap[normalizeName(p.player_name)] ?? null,
      owgr_rank: rankMap[normalizeName(p.player_name)] ?? null,
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
      const geoQuery = loc?.city && loc?.state ? `${loc.city}, ${loc.state}` : (hostCourse?.courseName || '')

      const [oddsOutcomes, rankingsData, geoResult] = await Promise.all([
        sportKey ? getGolfOdds(sportKey).catch(() => []) : Promise.resolve([]),
        getRankings().catch(() => null),
        geoQuery
          ? fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(geoQuery)}&count=1`)
              .then(r => r.json()).then(d => d.results?.[0] ?? null).catch(() => null)
          : Promise.resolve(null),
      ])
      setGeoCoords({ lat: geoResult?.latitude ?? null, lon: geoResult?.longitude ?? null })
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
      const { data: tournament, error: tErr } = await supabase
        .from('tournaments')
        .insert({
          name,
          pga_name: selectedPgaName || null,
          course_name: courseName.trim() || null,
          slash_golf_tournament_id: selectedSlashId,
          pick_count: pickCount,
          scores_to_keep: scoresToKeep,
          stake_amount: Number(stakeAmount) > 0 ? Number(stakeAmount) : null,
          payout_structure: Number(stakeAmount) > 0 ? payouts.map(Number) : null,
          lock_time: lockTime ? new Date(lockTime).toISOString() : null,
          latitude: geoCoords.lat,
          longitude: geoCoords.lon,
          join_code: generateJoinCode(),
          status: 'open',
          created_by: user.id,
        })
        .select()
        .single()
      if (tErr) throw tErr

      for (const tier of tiers) {
        const { data: tierRow, error: tierErr } = await supabase
          .from('tiers')
          .insert({ tournament_id: tournament.id, tier_number: tier.tier_number, label: tier.label })
          .select()
          .single()
        if (tierErr) throw tierErr
        if (tier.players.length > 0) {
          const { error: pErr } = await supabase.from('tier_players').insert(
            tier.players.map(p => ({
              tier_id: tierRow.id,
              player_id: p.player_id,
              player_name: p.player_name,
              odds: p.odds,
            }))
          )
          if (pErr) throw pErr
        }
      }
      navigate(`/tournament/${tournament.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const inputClass = "w-full px-3 py-2.5 border border-warm-300 rounded-lg text-sm text-charcoal bg-white focus:outline-none focus:ring-2 focus:ring-fairway/20 focus:border-fairway transition-colors disabled:opacity-50"
  const labelClass = "block text-xs font-medium text-warm-500 uppercase tracking-wider mb-1.5"

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="bg-fairway px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link to="/dashboard" className="text-cream/50 hover:text-cream transition-colors text-sm">← Dashboard</Link>
          <span className="text-cream/20 select-none">|</span>
          <span className="font-display font-bold text-cream text-xl tracking-tight">Create Tournament</span>
          <span className="text-cream/40 text-sm">Step {step} of 2</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-5 p-4 bg-birdie/5 border border-birdie/20 rounded-lg text-sm text-birdie">
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="bg-white border border-warm-200 rounded-lg p-8 space-y-5 max-w-xl">
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
              <div className="rounded-lg border border-warm-200 bg-warm-100/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-warm-500 uppercase tracking-wider">Payout Structure</p>
                  <span className={`text-xs font-medium ${payoutSum === 100 ? 'text-fairway' : 'text-birdie'}`}>
                    {payoutSum}% {payoutSum === 100 ? '✓' : 'of 100%'}
                  </span>
                </div>
                {payouts.map((pct, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sm text-charcoal w-14 shrink-0">{ordinal(i + 1)}</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={pct}
                      onChange={e => updatePayout(i, e.target.value)}
                      placeholder="%"
                      className="flex-1 px-3 py-2 border border-warm-300 rounded-lg text-sm text-charcoal bg-white focus:outline-none focus:ring-2 focus:ring-fairway/20 focus:border-fairway transition-colors"
                    />
                    <span className="text-warm-400 text-sm w-4">%</span>
                    <button
                      type="button"
                      onClick={() => removePayout(i)}
                      className="text-warm-400 hover:text-birdie transition-colors text-sm px-1.5"
                      aria-label={`Remove ${ordinal(i + 1)} place`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addPayout}
                  className="text-sm text-fairway font-medium hover:text-fairway/80 transition-colors"
                >
                  + Add placement
                </button>
              </div>
            )}

            {oddsWarning ? (
              <div className="rounded-lg border border-gold/30 bg-gold/5 p-4 space-y-3">
                <p className="text-sm font-medium text-charcoal">
                  Odds unavailable — the market may not be open yet.
                </p>
                <p className="text-sm text-warm-500">
                  Tiers will fall back to OWGR rankings. You can retry now or wait for odds to post.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleRetryOdds}
                    disabled={buildingTiers || retryIn > 0}
                    className="flex-1 bg-fairway hover:bg-fairway/90 disabled:opacity-50 text-cream text-sm font-medium py-2 rounded-lg transition-colors"
                  >
                    {buildingTiers ? 'Checking…' : retryIn > 0 ? `Retry in ${retryIn}s` : 'Try Again'}
                  </button>
                  <button
                    onClick={handleContinueWithOwgr}
                    disabled={buildingTiers}
                    className="flex-1 border border-warm-300 text-warm-600 hover:bg-warm-100 disabled:opacity-50 text-sm font-medium py-2 rounded-lg transition-colors"
                  >
                    Continue with OWGR Rankings
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleNext}
                disabled={buildingTiers || !name || !selectedSlashId}
                className="w-full bg-fairway hover:bg-fairway/90 disabled:opacity-50 text-cream font-medium py-2.5 rounded-lg transition-colors text-sm"
              >
                {buildingTiers ? 'Fetching field & odds…' : 'Next →'}
              </button>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="text-sm text-warm-400 mb-4">Drag players between tiers to adjust.</p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="grid grid-cols-2 gap-4 mb-5">
                {tiers.map(tier => (
                  <DroppableTier key={tier.tier_number} tier={tier} />
                ))}
              </div>
              <DragOverlay>
                {activePlayer ? <PlayerCard player={activePlayer} isDragging /> : null}
              </DragOverlay>
            </DndContext>

            <div className="flex gap-3">
              <button
                onClick={() => { setStep(1); setError(null) }}
                className="px-6 py-2.5 border border-warm-300 rounded-lg text-sm text-warm-500 hover:bg-warm-100 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 bg-fairway hover:bg-fairway/90 disabled:opacity-50 text-cream font-medium py-2.5 rounded-lg transition-colors text-sm"
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
