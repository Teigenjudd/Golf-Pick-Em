import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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

// Slash Golf returns MongoDB Extended JSON — unwrap { $numberInt } / { $numberDouble }
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
    <div
      className={`flex justify-between items-center px-3 py-2 bg-white border rounded-lg text-sm select-none
        ${isDragging ? 'shadow-lg border-green-400' : 'border-gray-200'}`}
    >
      <span className="text-gray-800">{player.player_name}</span>
      <span className="text-gray-400 font-mono text-xs">{formatOdds(player.odds)}</span>
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
      className={`bg-white border border-gray-200 rounded-lg text-sm select-none cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-30' : ''}`}
    >
      <div className="flex justify-between items-center px-3 py-2">
        <span className="text-gray-800">{player.player_name}</span>
        <span className="text-gray-400 font-mono text-xs">
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
      className={`rounded-xl p-4 border-2 transition-colors min-h-[60px]
        ${isOver ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-gray-50'}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-700 text-sm">{tier.label}</h3>
        <span className="text-xs text-gray-400">{tier.players.length} players</span>
      </div>
      <div className="space-y-1.5">
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

  // Step 1
  const [name, setName] = useState('')
  const [slashTournaments, setSlashTournaments] = useState([])
  const [selectedSlashId, setSelectedSlashId] = useState('')
  const [sportKey, setSportKey] = useState('')
  const [pickCount, setPickCount] = useState(8)
  const [scoresToKeep, setScoresToKeep] = useState(5)
  const [lockTime, setLockTime] = useState('')
  const [loadingTournaments, setLoadingTournaments] = useState(true)
  const [buildingTiers, setBuildingTiers] = useState(false)

  // Step 2
  const [tiers, setTiers] = useState([])
  const [activePlayer, setActivePlayer] = useState(null)
  const [saving, setSaving] = useState(false)

  const [error, setError] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  useEffect(() => {
    getTournaments()
      .then(data => setSlashTournaments(data.schedule ?? data.tournaments ?? data ?? []))
      .catch(err => setError(err.message))
      .finally(() => setLoadingTournaments(false))
  }, [])

  async function handleNext() {
    if (!name || !selectedSlashId) {
      setError('Please fill in all required fields.')
      return
    }
    setBuildingTiers(true)
    setError(null)
    try {
      const [fieldData, oddsOutcomes, rankingsData] = await Promise.all([
        getTournamentField(selectedSlashId),
        sportKey ? getGolfOdds(sportKey).catch(() => []) : Promise.resolve([]),
        getRankings().catch(() => null),
      ])

      // /tournament returns { players: [{ playerId, firstName, lastName, ... }] }
      const rawField = fieldData.players ?? []
      const fieldPlayers = rawField
        .filter(entry => entry?.playerId)
        .map(p => ({
          player_id: String(unwrapNumber(p.playerId) ?? p.playerId),
          player_name: `${p.firstName} ${p.lastName}`.trim(),
        }))

      const oddsMap = {}
      oddsOutcomes.forEach(o => { oddsMap[normalizeName(o.name)] = o.price })

      // OWGR rankings have no playerId — match by normalized name
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
      setStep(2)
    } catch (err) {
      setError(err.message)
    } finally {
      setBuildingTiers(false)
    }
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

  async function handleCreate() {
    setSaving(true)
    setError(null)
    try {
      const { data: tournament, error: tErr } = await supabase
        .from('tournaments')
        .insert({
          name,
          slash_golf_tournament_id: selectedSlashId,
          pick_count: pickCount,
          scores_to_keep: scoresToKeep,
          lock_time: lockTime || null,
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

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Create Tournament</h1>
          <span className="text-sm text-gray-400">Step {step} of 2</span>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tournament Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. 2026 US Open"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slash Golf Tournament</label>
              <select
                value={selectedSlashId}
                onChange={e => setSelectedSlashId(e.target.value)}
                disabled={loadingTournaments}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white disabled:opacity-50"
              >
                <option value="">{loadingTournaments ? 'Loading…' : 'Select a tournament'}</option>
                {slashTournaments.map(t => (
                  <option key={t.tournId ?? t.id} value={t.tournId ?? t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Odds Market <span className="text-gray-400 font-normal">(optional — majors only)</span>
              </label>
              <select
                value={sportKey}
                onChange={e => setSportKey(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                <option value="">None (no odds)</option>
                {GOLF_SPORT_KEYS.map(k => (
                  <option key={k.key} value={k.key}>{k.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Picks per Participant</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={pickCount}
                  onChange={e => setPickCount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scores to Keep</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={scoresToKeep}
                  onChange={e => setScoresToKeep(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lock Time</label>
              <input
                type="datetime-local"
                value={lockTime}
                onChange={e => setLockTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <button
              onClick={handleNext}
              disabled={buildingTiers || !name || !selectedSlashId}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              {buildingTiers ? 'Fetching field & odds…' : 'Next →'}
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="text-sm text-gray-500 mb-4">Drag players between tiers to adjust.</p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="grid grid-cols-2 gap-4 mb-4">
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
                className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
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
