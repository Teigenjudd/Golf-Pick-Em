// Shared tier/player selection grid, used by the live Picks page and the demo.
// Presentational only: `tiers` is the tier list (each with tier_players),
// `selections` is keyed by tier.id → { player_id, player_name }, and
// `onSelect(tier, player)` reports a choice.

function formatOdds(odds) {
  if (odds == null) return null
  return odds > 0 ? `+${odds}` : `${odds}`
}

export default function TierPicker({ tiers, selections, onSelect }) {
  return (
    <div className="space-y-4">
      {tiers.map(tier => {
        const selected = selections[tier.id]
        return (
          <div key={tier.id} className="bg-white border border-warm-200 rounded-lg overflow-hidden">
            {/* Tier header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-warm-200 bg-warm-100">
              <span className="w-5 h-5 rounded-full bg-fairway flex items-center justify-center shrink-0 text-[10px] font-display font-bold text-cream leading-none">
                {tier.tier_number}
              </span>
              <h2 className="font-display font-bold text-sm uppercase tracking-wide text-charcoal flex-1">
                {tier.label}
              </h2>
              {selected && (
                <span className="text-xs text-fairway font-medium">
                  {selected.player_name} ✓
                </span>
              )}
            </div>

            {/* Player grid */}
            <div className="p-4 grid grid-cols-2 gap-2">
              {(tier.tier_players ?? []).map(player => {
                const isSelected = selected?.player_id === player.player_id
                const odds = formatOdds(player.odds)
                return (
                  <button
                    key={player.id}
                    onClick={() => onSelect(tier, player)}
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
        )
      })}
    </div>
  )
}
