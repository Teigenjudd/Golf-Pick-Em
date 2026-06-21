import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import TierPicker from '../components/picks/TierPicker'

export default function Picks() {
  const { id } = useParams()
  const { user } = useAuth()

  const [tournament, setTournament] = useState(null)
  const [tiers, setTiers] = useState([])
  const [existingPicks, setExistingPicks] = useState([])
  const [selections, setSelections] = useState({})
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

  const hasExistingPicks = existingPicks.length > 0
  const isReadOnly = isLocked

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
      await supabase.from('picks').delete().eq('tournament_id', id).eq('user_id', user.id)
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
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <p className="text-warm-400 text-sm">Loading…</p>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="text-center">
          <p className="text-charcoal font-medium mb-2">Tournament not found</p>
          <Link to="/dashboard" className="text-sm text-fairway hover:text-fairway/80 font-medium transition-colors">
            Go to dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream px-6">
        <div className="w-full max-w-sm bg-white border border-warm-200 rounded-lg p-8 text-center">
          <div className="w-12 h-12 bg-fairway/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-fairway" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-display font-bold text-xl text-charcoal tracking-tight mb-2">Picks submitted</h2>
          <p className="text-sm text-warm-400 mb-6">
            Your card is in. You can update your picks any time before the round locks.
          </p>
          <Link
            to="/dashboard"
            className="block w-full bg-fairway hover:bg-fairway/90 text-cream font-medium py-2.5 rounded-lg transition-colors text-sm text-center"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="bg-fairway px-6 pt-8 pb-6">
        <div className="max-w-2xl mx-auto">
          <Link to="/dashboard" className="text-cream/50 hover:text-cream/80 text-sm transition-colors">
            ← Dashboard
          </Link>
          <h1 className="font-display font-bold text-3xl text-cream tracking-tight leading-tight mt-4">
            {tournament.name}
          </h1>
          <p className="text-cream/50 text-sm mt-1">Pick one player from each tier</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-6">
        {isLocked && (
          <div className="mb-5 p-4 bg-warm-100 border border-warm-200 rounded-lg text-sm text-warm-500 font-medium">
            Picks are locked for this tournament.
          </div>
        )}

        {!isLocked && hasExistingPicks && (
          <div className="mb-5 p-4 bg-fairway/5 border border-fairway/20 rounded-lg text-sm text-fairway">
            Your picks are in — you can still update them before the round locks.
          </div>
        )}

        {error && (
          <div className="mb-5 p-4 bg-birdie/5 border border-birdie/20 rounded-lg text-sm text-birdie">
            {error}
          </div>
        )}

        {isReadOnly ? (
          <div className="space-y-2">
            {tiers.map(tier => {
              const pick = existingPicks.find(p => p.tier_id === tier.id)
              return (
                <div key={tier.id} className="bg-white border border-warm-200 rounded-lg flex items-center gap-4 px-4 py-3.5">
                  <span className="w-5 h-5 rounded-full bg-fairway/80 flex items-center justify-center shrink-0 text-[10px] font-display font-bold text-cream leading-none">
                    {tier.tier_number}
                  </span>
                  <div>
                    <p className="text-xs text-warm-400 leading-none mb-0.5">{tier.label}</p>
                    <p className="text-sm font-medium text-charcoal">{pick?.player_name ?? '—'}</p>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <>
            <TierPicker
              tiers={tiers}
              selections={selections}
              onSelect={(tier, player) => selectPlayer(tier.id, player)}
            />

            <div className="mt-6">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full bg-fairway hover:bg-fairway/90 disabled:opacity-50 text-cream font-medium py-2.5 rounded-lg transition-colors text-sm"
              >
                {submitting ? 'Submitting…' : hasExistingPicks ? 'Update Picks' : 'Submit Picks'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
