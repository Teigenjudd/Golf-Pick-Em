function formatOdds(odds) {
  if (odds == null) return null
  return odds > 0 ? `+${odds}` : `${odds}`
}

export default function TierPicker({ tiers, selections, onSelect }) {
  return (
    <div>
      {tiers.map(tier => {
        const selected = selections[tier.id]
        return (
          <div
            key={tier.id}
            className="bg-[#FFFDF8] border border-[#E4DDD0] rounded-[14px] overflow-hidden mb-3"
          >
            {/* Tier header */}
            <div
              className="flex items-center gap-[10px] px-[15px] py-3 border-b border-[#EFE8DA]"
              style={{ background: selected ? 'rgba(27,67,50,.06)' : 'transparent' }}
            >
              <span className="w-[22px] h-[22px] rounded-full bg-fairway flex items-center justify-center flex-none font-display font-bold text-[11px] text-cream leading-none">
                {tier.tier_number}
              </span>
              <span className="font-display font-bold text-[14px] tracking-[.04em] text-charcoal flex-1">
                {tier.label}
              </span>
              {selected && (
                <span className="text-[11.5px] font-semibold text-fairway">
                  {selected.player_name} ✓
                </span>
              )}
            </div>

            {/* Player grid */}
            <div className="grid grid-cols-2 gap-2 p-3">
              {(tier.tier_players ?? []).map(player => {
                const isSelected = selected?.player_id === player.player_id
                const odds = formatOdds(player.odds)
                return (
                  <button
                    key={player.id}
                    onClick={() => onSelect(tier, player)}
                    className="text-left px-[13px] py-[11px] rounded-[10px] border-[1.5px] transition-all duration-[120ms]"
                    style={{
                      background: isSelected ? '#1B4332' : '#FFFDF8',
                      borderColor: isSelected ? '#1B4332' : '#E4DDD0',
                    }}
                  >
                    <div
                      className="font-semibold text-[13.5px] leading-[1.2] mb-[3px]"
                      style={{ color: isSelected ? '#F8F5EE' : '#2D2D2A' }}
                    >
                      {player.player_name}
                    </div>
                    {odds && (
                      <div
                        className="text-[11.5px]"
                        style={{ color: isSelected ? 'rgba(248,245,238,.55)' : '#9E9488' }}
                      >
                        {odds}
                      </div>
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
