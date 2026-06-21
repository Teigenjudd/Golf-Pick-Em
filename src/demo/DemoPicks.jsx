import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useDemo } from './DemoContext'
import { demoTournament, demoTiers } from './demoData'
import TierPicker from '../components/picks/TierPicker'

export default function DemoPicks() {
  const navigate = useNavigate()
  const { selections, selectPlayer, submit } = useDemo()
  const [error, setError] = useState(null)

  function handleSubmit() {
    const missing = demoTiers.filter(t => !selections[t.id])
    if (missing.length > 0) {
      setError('Select a player from every tier before submitting.')
      return
    }
    submit()
    navigate('/demo/tournament')
  }

  return (
    <div>
      {/* Header */}
      <div className="bg-fairway px-6 pt-8 pb-6">
        <div className="max-w-2xl mx-auto">
          <Link to="/demo/tournament" className="text-cream/50 hover:text-cream/80 text-sm transition-colors">
            ← Leaderboard
          </Link>
          <h1 className="font-display font-bold text-3xl text-cream tracking-tight leading-tight mt-4">
            {demoTournament.name}
          </h1>
          <p className="text-cream/50 text-sm mt-1">Pick one player from each tier</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-5 p-4 bg-birdie/5 border border-birdie/20 rounded-lg text-sm text-birdie">
            {error}
          </div>
        )}

        <TierPicker
          tiers={demoTiers}
          selections={selections}
          onSelect={(tier, player) => selectPlayer(tier.id, player)}
        />

        <div className="mt-6">
          <button
            onClick={handleSubmit}
            className="w-full bg-fairway hover:bg-fairway/90 text-cream font-medium py-2.5 rounded-lg transition-colors text-sm"
          >
            Submit Picks
          </button>
        </div>
      </div>
    </div>
  )
}
