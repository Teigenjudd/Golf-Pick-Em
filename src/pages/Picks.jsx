import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import TierPicker from '../components/picks/TierPicker'
import SportBadge from '../components/SportBadge'

export default function Picks() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [tournament, setTournament] = useState(null)
  const [tiers, setTiers] = useState([])
  const [existingPicks, setExistingPicks] = useState([])
  const [selections, setSelections] = useState({})
  const [badge, setBadge] = useState(null)
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
            id, name, pga_name, status, lock_time, pick_count, scores_to_keep,
            slash_golf_tournament_id,
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

      if (t.slash_golf_tournament_id) {
        supabase
          .from('pga_event_badges')
          .select('badge_line1, badge_line2')
          .eq('tourn_id', t.slash_golf_tournament_id)
          .maybeSingle()
          .then(({ data: b }) => { if (b) setBadge({ line1: b.badge_line1, line2: b.badge_line2 }) })
      }
    }
    load()
  }, [user, id])

  const isLocked =
    tournament?.status === 'locked' ||
    (tournament?.lock_time && new Date(tournament.lock_time) <= new Date())

  const hasExistingPicks = existingPicks.length > 0
  const selectedCount = Object.keys(selections).length
  const allSelected = selectedCount === tiers.length && tiers.length > 0

  function selectPlayer(tierId, player) {
    setSelections(prev => ({
      ...prev,
      [tierId]: { player_id: player.player_id, player_name: player.player_name },
    }))
  }

  async function handleSubmit() {
    if (!allSelected) return
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
      <div className="min-h-screen flex items-center justify-center bg-[#F4EFE4]">
        <p className="text-warm-400 text-sm">Loading…</p>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4EFE4]">
        <div className="text-center">
          <p className="text-charcoal font-medium mb-2">Tournament not found</p>
          <Link to="/dashboard" className="text-sm text-fairway font-medium no-underline">
            Go to dashboard
          </Link>
        </div>
      </div>
    )
  }

  /* ── Success state ── */
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4EFE4] px-5">
        <div
          className="w-full max-w-[360px] bg-[#FFFDF8] border border-[#E4DDD0] rounded-2xl px-7 py-8 text-center"
          style={{ boxShadow: '0 12px 36px -20px rgba(20,48,38,.3)' }}
        >
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(27,67,50,.1)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1B4332" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="font-display font-extrabold text-[30px] text-fairway leading-none mb-1.5">
            Picks submitted
          </div>
          <div className="text-[13.5px] text-warm-400 leading-[1.55] mb-6">
            Your card is in. You can update your picks any time before the round locks.
          </div>
          <Link
            to={`/tournament/${id}`}
            className="block bg-fairway text-cream rounded-[12px] py-[14px] text-center font-bold text-[14px] no-underline mb-[10px]"
          >
            View leaderboard →
          </Link>
          <Link to="/dashboard" className="text-[12.5px] text-warm-400 no-underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  const poolLabel = tournament.pga_name ?? tournament.name
  const subtitle = [
    'Pick one from each tier',
    tournament.scores_to_keep && tournament.pick_count
      ? `Best ${tournament.scores_to_keep} of ${tournament.pick_count} count`
      : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="min-h-screen bg-[#F4EFE4] pb-24">

      {/* Golf gradient header */}
      <div style={{ background: 'linear-gradient(165deg,#1B4332 0%,#0F241B 100%)', padding: '16px 20px 24px' }}>
        <Link
          to={`/tournament/${id}`}
          className="no-underline"
          style={{ fontFamily: 'Inter', fontSize: 14, fontWeight: 500, color: 'rgba(248,245,238,.65)' }}
        >
          ← Leaderboard
        </Link>

        <div className="flex items-center gap-3 mt-4">
          <SportBadge line1={badge?.line1} line2={badge?.line2} size="pick" />
          <div>
            <div
              className="font-display font-bold uppercase mb-[2px]"
              style={{ fontSize: 10, letterSpacing: '.18em', color: '#C9A368' }}
            >
              {tournament.name}
            </div>
            <div className="font-display font-extrabold text-cream leading-[.95]" style={{ fontSize: 28 }}>
              Make your picks
            </div>
            <div className="mt-[5px]" style={{ fontFamily: 'Inter', fontSize: 12, color: 'rgba(248,245,238,.5)' }}>
              {subtitle}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[560px] mx-auto px-[18px] pt-5">

        {isLocked && (
          <div className="mb-4 px-4 py-3 bg-[#FFFDF8] border border-[#E4DDD0] rounded-[12px] text-[13px] text-warm-500">
            Picks are locked for this tournament.
          </div>
        )}

        {!isLocked && hasExistingPicks && (
          <div className="mb-4 px-4 py-3 rounded-[12px] text-[13px] text-fairway" style={{ background: 'rgba(27,67,50,.06)', border: '1px solid rgba(27,67,50,.15)' }}>
            Your picks are in — you can still update them before the round locks.
          </div>
        )}

        {error && (
          <div className="mb-4 px-4 py-3 rounded-[12px] text-[13px] text-birdie" style={{ background: 'rgba(178,58,45,.05)', border: '1px solid rgba(178,58,45,.2)' }}>
            {error}
          </div>
        )}

        {isLocked ? (
          /* Read-only: show picks as non-interactive tier cards */
          <div>
            {tiers.map(tier => {
              const pick = existingPicks.find(p => p.tier_id === tier.id)
              return (
                <div key={tier.id} className="bg-[#FFFDF8] border border-[#E4DDD0] rounded-[14px] overflow-hidden mb-3">
                  <div className="flex items-center gap-[10px] px-[15px] py-3 border-b border-[#EFE8DA]">
                    <span className="w-[22px] h-[22px] rounded-full bg-fairway flex items-center justify-center flex-none font-display font-bold text-[11px] text-cream leading-none">
                      {tier.tier_number}
                    </span>
                    <span className="font-display font-bold text-[14px] tracking-[.04em] text-charcoal flex-1">
                      {tier.label}
                    </span>
                  </div>
                  <div className="px-[15px] py-3">
                    <span className="text-[14px] font-semibold text-charcoal">
                      {pick?.player_name ?? '—'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <TierPicker
            tiers={tiers}
            selections={selections}
            onSelect={(tier, player) => selectPlayer(tier.id, player)}
          />
        )}

      </div>

      {/* Sticky submit bar */}
      {!isLocked && (
        <div
          className="fixed bottom-0 left-0 right-0 z-10"
          style={{ background: '#F4EFE4', borderTop: '1px solid #E4DDD0', padding: '12px 18px 20px' }}
        >
          <div className="max-w-[560px] mx-auto flex items-center gap-3">
            <div className="flex-1 text-[12px] text-warm-400">
              {selectedCount} of {tiers.length} tiers selected
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting || !allSelected}
              className="font-bold text-[14px] text-cream px-7 py-[13px] rounded-[12px] border-none transition-all duration-[150ms]"
              style={{
                background: allSelected ? '#1B4332' : '#9E9488',
                opacity: submitting ? 0.6 : 1,
                cursor: allSelected ? 'pointer' : 'default',
              }}
            >
              {submitting ? 'Submitting…' : allSelected ? (hasExistingPicks ? 'Update Picks →' : 'Submit Picks →') : `${selectedCount} of ${tiers.length} selected`}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
