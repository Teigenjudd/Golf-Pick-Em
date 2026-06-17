import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function formatOdds(odds) {
  if (odds == null) return null
  return odds > 0 ? `+${odds}` : `${odds}`
}

export default function Picks() {
  const { id } = useParams()
  const { user } = useAuth()

  const [tournament, setTournament] = useState(null)
  const [tiers, setTiers] = useState([])
  const [existingPicks, setExistingPicks] = useState([])
  const [selections, setSelections] = useState({}) // { [tier_id]: { player_id, player_name } }
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) return
    async function load() {
      const [{ data: t, error: tErr }, { data: picks }] = await Promise.all([
        supabase
          .from('tournaments')
          .select(`
            id, name, status, lock_time, pick_count,
            tiers (
              id, tier_number, label,
              tier_players ( id, player_id, player_name, odds )
            )
          `)
          .eq('id', id)
          .single(),
        supabase
          .from('picks')
          .select('id, tier_id, player_id, player_name, status')
          .eq('tournament_id', id)
          .eq('user_id', user.id),
      ])

      if (tErr || !t) {
        setError('Tournament not found.')
        setLoading(false)
        return
      }

      const sortedTiers = (t.tiers ?? []).sort((a, b) => a.tier_number - b.tier_number)
      setTournament(t)
      setTiers(sortedTiers)

      const existingPickList = picks ?? []
      setExistingPicks(existingPickList)

      const initSelections = {}
      existingPickList.forEach(p => {
        initSelections[p.tier_id] = { player_id: p.player_id, player_name: p.player_name }
      })
      setSelections(initSelections)

      setLoading(false)
    }
    load()
  }, [user, id])

  const isLocked =
    tournament?.status === 'locked' ||
    (tournament?.lock_time && new Date(tournament.lock_time) <= new Date())

  const anyConfirmed = existingPicks.some(p => p.status === 'confirmed')
  const allConfirmed = existingPicks.length > 0 && existingPicks.every(p => p.status === 'confirmed')
  const hasPending = existingPicks.some(p => p.status === 'pending')
  const isReadOnly = isLocked || anyConfirmed

  function selectPlayer(tierId, player) {
    setSelections(prev => ({
      ...prev,
      [tierId]: { player_id: player.player_id, player_name: player.player_name },
    }))
  }

  async function handleSubmit() {
    const missing = tiers.filter(t => !selections[t.id])
    if (missing.length > 0) {
      setError('Select a player from every tier before submitting.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await supabase
        .from('picks')
        .delete()
        .eq('tournament_id', id)
        .eq('user_id', user.id)

      const { error: insertErr } = await supabase.from('picks').insert(
        tiers.map(tier => ({
          tournament_id: id,
          tier_id: tier.id,
          user_id: user.id,
          player_id: selections[tier.id].player_id,
          player_name: selections[tier.id].player_name,
          status: 'confirmed',
        }))
      )
      if (insertErr) throw insertErr
      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-900 font-medium mb-2">Tournament not found</p>
          <Link to="/dashboard" className="text-sm text-green-700 hover:text-green-800 font-medium">
            Go to dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Picks submitted</h2>
          <p className="text-sm text-gray-500 mb-6">
            Your picks have been submitted.
          </p>
          <Link
            to="/dashboard"
            className="block w-full bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <Link to="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 transition-colors mb-4 inline-block">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">{tournament.name}</h1>
        <p className="text-sm text-gray-500 mb-6">Pick one player from each tier</p>

        {isLocked && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 font-medium">
            Picks are locked for this tournament.
          </div>
        )}

        {!isLocked && allConfirmed && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 font-medium">
            Your picks are confirmed.
          </div>
        )}

        {!isLocked && anyConfirmed && !allConfirmed && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 font-medium">
            Some of your picks are confirmed — picks are now locked for editing.
          </div>
        )}

        {!isReadOnly && hasPending && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            You have pending picks — you can update them until the tournament locks.
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {isReadOnly ? (
          <div className="space-y-3">
            {tiers.map(tier => {
              const pick = existingPicks.find(p => p.tier_id === tier.id)
              return (
                <div
                  key={tier.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">{tier.label}</p>
                    <p className="text-sm font-medium text-gray-900">{pick?.player_name ?? '—'}</p>
                  </div>
                  {pick?.status === 'confirmed' && (
                    <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                      confirmed
                    </span>
                  )}
                  {pick?.status === 'pending' && (
                    <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                      pending
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <>
            <div className="space-y-6">
              {tiers.map(tier => (
                <div key={tier.id} className="bg-white rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-medium text-gray-900">{tier.label}</h2>
                    {selections[tier.id] && (
                      <span className="text-xs text-green-600 font-medium">
                        {selections[tier.id].player_name} selected
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(tier.tier_players ?? []).map(player => {
                      const isSelected = selections[tier.id]?.player_id === player.player_id
                      const odds = formatOdds(player.odds)
                      return (
                        <button
                          key={player.id}
                          onClick={() => selectPlayer(tier.id, player)}
                          className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-colors
                            ${isSelected
                              ? 'bg-green-50 border-green-400 text-green-900'
                              : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                          <span className="block font-medium leading-snug">{player.player_name}</span>
                          {odds && <span className="text-xs text-gray-400 font-mono">{odds}</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                {submitting ? 'Submitting…' : hasPending ? 'Update Picks' : 'Submit Picks'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
