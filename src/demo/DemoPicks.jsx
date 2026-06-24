import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDemo } from './DemoContext'
import { demoTournament, demoTiers } from './demoData'
import TierPicker from '../components/picks/TierPicker'
import PicksHeader from '../components/pool/PicksHeader'
import PicksSubmitBar from '../components/pool/PicksSubmitBar'

export default function DemoPicks() {
  const navigate = useNavigate()
  const { selections, selectPlayer, submit } = useDemo()
  const [error, setError] = useState(null)

  const selectedCount = Object.keys(selections).length

  function handleSubmit() {
    const missing = demoTiers.filter(t => !selections[t.id])
    if (missing.length > 0) {
      setError('Select a player from every tier before submitting.')
      return
    }
    submit()
    navigate('/demo/tournament')
  }

  const subtitle = [
    'Pick one from each tier',
    demoTournament.scores_to_keep && demoTournament.pick_count
      ? `Best ${demoTournament.scores_to_keep} of ${demoTournament.pick_count} count`
      : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="min-h-screen bg-[#F4EFE4] pb-24">

      <PicksHeader
        backTo="/demo/tournament"
        eyebrow={demoTournament.name}
        subtitle={subtitle}
      />

      <div className="max-w-[560px] mx-auto px-[18px] pt-5">
        {error && (
          <div className="mb-4 px-4 py-3 rounded-[12px] text-[13px] text-birdie" style={{ background: 'rgba(178,58,45,.05)', border: '1px solid rgba(178,58,45,.2)' }}>
            {error}
          </div>
        )}

        <TierPicker
          tiers={demoTiers}
          selections={selections}
          onSelect={(tier, player) => selectPlayer(tier.id, player)}
        />
      </div>

      <PicksSubmitBar
        selectedCount={selectedCount}
        totalCount={demoTiers.length}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
