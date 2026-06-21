import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useDemo } from './DemoContext'
import { demoTournament, demoTiers } from './demoData'

function formatOdds(odds) {
  if (odds == null) return null
  return odds > 0 ? `+${odds}` : `${odds}`
}

export default function DemoPicks() {
  const navigate = useNavigate()
  const { selections, selectPlayer, submit } = useDemo()
  const [error, setError] = useState(null)

  function handleSubmit() {
    const missing = demoTiers.filter(t => !selections[t.tier_number])
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

        <div className="space-y-4">
          {demoTiers.map(tier => (
            <div key={tier.tier_number} className="bg-white border border-warm-200 rounded-lg overflow-hidden">
              {/* Tier header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-warm-200 bg-warm-100">
                <span className="w-5 h-5 rounded-full bg-fairway flex items-center justify-center shrink-0 text-[10px] font-display font-bold text-cream leading-none">
                  {tier.tier_number}
                </span>
                <h2 className="font-display font-bold text-sm uppercase tracking-wide text-charcoal flex-1">
                  {tier.label}
                </h2>
                {selections[tier.tier_number] && (
                  <span className="text-xs text-fairway font-medium">
                    {selections[tier.tier_number].player_name} ✓
                  </span>
                )}
              </div>

              {/* Player grid */}
              <div className="p-4 grid grid-cols-2 gap-2">
                {tier.tier_players.map(player => {
                  const isSelected = selections[tier.tier_number]?.player_id === player.player_id
                  const odds = formatOdds(player.odds)
                  return (
                    <button
                      key={player.id}
                      onClick={() => selectPlayer(tier.tier_number, player)}
                      className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                        isSelected
                          ? 'bg-fairway border-fairway text-cream'
                          : 'bg-white border-warm-200 text-charcoal hover:border-warm-300 hover:bg-warm-100'
                      }`}
                    >
                      <span className="block font-medium leading-snug">{player.player_name}</span>
                      {odds && (
                        <span className={`text-xs font-mono ${isSelected ? 'text-cream/60' : 'text-warm-400'}`}>
                          {odds}
                        </span>
                      )}
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
            className="w-full bg-fairway hover:bg-fairway/90 text-cream font-medium py-2.5 rounded-lg transition-colors text-sm"
          >
            Submit Picks
          </button>
        </div>
      </div>
    </div>
  )
}
