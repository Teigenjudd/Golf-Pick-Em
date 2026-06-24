import { useState } from 'react'
import { formatScore } from '../../utils/scoring'

function scoreColor(score, active = true) {
  if (score === null || !active) return 'text-warm-300'
  if (score < 0) return 'text-birdie'
  return 'text-charcoal'
}

export default function Standings({ standings, currentUserId, pickCount }) {
  const [expanded, setExpanded] = useState(new Set())

  function toggleExpanded(userId) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(userId) ? next.delete(userId) : next.add(userId)
      return next
    })
  }

  return (
    <div>
      {standings.map(entry => {
        const isExpanded = expanded.has(entry.user_id)
        const isMe = entry.user_id === currentUserId
        const totalColor = entry.total_score === null
          ? 'text-warm-400'
          : entry.total_score < 0 ? 'text-birdie' : 'text-charcoal'
        const countingCount = entry.picks.filter(p => p.used_in_total).length

        return (
          <div key={entry.user_id} className="border-b border-[#EFE8DA] last:border-0">
            <button
              onClick={() => toggleExpanded(entry.user_id)}
              className="w-full flex items-center gap-3 px-[18px] py-[14px] hover:bg-[#FAF6EE] transition-colors text-left cursor-pointer border-none bg-transparent"
            >
              {/* Rank circle */}
              <span
                className="w-9 h-9 rounded-full flex items-center justify-center flex-none font-display font-bold text-base tabular-nums leading-none"
                style={{
                  background: entry.rank === 1 ? 'rgba(201,163,104,.2)' : '#EBE3D4',
                  color: entry.rank === 1 ? '#C9A368' : '#736A5F',
                }}
              >
                {entry.rank ?? '—'}
              </span>

              {/* Name + subtitle */}
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-[7px] flex-wrap">
                  <span className="font-semibold text-[15px] text-charcoal leading-snug">
                    {entry.display_name}
                  </span>
                  {isMe && (
                    <span className="font-display font-bold text-[10px] tracking-[.08em] bg-gold px-[7px] py-[2px] rounded-full uppercase" style={{ color: '#15130F' }}>
                      YOU
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-warm-400 mt-[1px]">
                  {countingCount > 0
                    ? `${countingCount} of ${pickCount} counting`
                    : `${pickCount} picks`}
                </p>
              </div>

              {/* Score */}
              <span className={`font-display font-extrabold tabular-nums text-[26px] flex-none ${totalColor}`}>
                {entry.total_score === null ? '—' : formatScore(entry.total_score)}
              </span>

              {/* Chevron */}
              <svg
                className="flex-none transition-transform duration-[180ms]"
                style={{
                  width: 14, height: 14,
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
                fill="none" viewBox="0 0 24 24"
                stroke="#C9BFB0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Scorecard expand — gold left bar signature element */}
            {isExpanded && (
              <div className="flex border-t border-[#EFE8DA]">
                <div className="w-[3px] bg-gold flex-none" />
                <div className="flex-1 px-4 py-3" style={{ background: '#F8F3EC' }}>
                  <div className="space-y-[4px]">
                    {entry.picks.map((pick, i) => {
                      const inactive = pick.withdrawn || pick.cut
                      const pickColor = scoreColor(pick.score, !inactive && pick.used_in_total)
                      return (
                        <div key={i} className="flex items-center gap-[10px] py-[4px]">
                          <span
                            className="w-[19px] h-[19px] rounded-full flex items-center justify-center flex-none font-display font-bold text-[10px] text-cream leading-none"
                            style={{ background: 'rgba(27,67,50,.85)' }}
                          >
                            {i + 1}
                          </span>
                          <span className={`flex-1 text-[13.5px] leading-snug ${
                            inactive ? 'line-through text-warm-400' :
                            pick.used_in_total ? 'text-charcoal' : 'text-warm-400'
                          }`}>
                            {pick.player_name}
                          </span>
                          {pick.withdrawn && (
                            <span className="font-display font-bold text-[8px] text-birdie bg-birdie/10 px-[5px] py-[2px] rounded uppercase tracking-wide">WD</span>
                          )}
                          {pick.cut && (
                            <span className="font-display font-bold text-[8px] text-warm-500 bg-[#E4DDD0] px-[5px] py-[2px] rounded-[3px] uppercase">CUT</span>
                          )}
                          <span className={`font-display font-bold tabular-nums text-[14px] w-[28px] text-right ${pickColor}`}>
                            {pick.score === null ? '—' : formatScore(pick.score)}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Total row */}
                  <div className="flex items-center gap-[10px] pt-2 mt-[5px] border-t border-[#E4DDD0]">
                    <span className="w-[19px] flex-none" />
                    <span className="flex-1 font-display font-bold text-[9px] uppercase tracking-[.16em] text-warm-400">
                      Total · Best {pickCount}
                    </span>
                    <span className={`font-display font-bold tabular-nums text-[14px] w-[28px] text-right ${totalColor}`}>
                      {entry.total_score === null ? '—' : formatScore(entry.total_score)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
