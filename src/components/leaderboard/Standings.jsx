import { useState } from 'react'
import { formatScore } from '../../utils/scoring'

// Shared Pick'em standings list with the scorecard-expand interaction.
// Used by the live TournamentDetail page and the demo. Presentational only:
// `standings` is the output of computeScores+assignRanks, `currentUserId`
// highlights the viewer's row, `pickCount` labels the counting line.

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
          <div
            key={entry.user_id}
            className={`border-b border-warm-200 last:border-0 ${isMe ? 'border-l-[3px] border-l-gold' : ''}`}
          >
            <button
              onClick={() => toggleExpanded(entry.user_id)}
              className={`w-full flex items-center gap-4 px-5 py-4 hover:bg-warm-100 transition-colors text-left ${isMe ? 'bg-warm-100/40' : ''}`}
            >
              {/* Rank badge — 40px */}
              <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-display font-bold text-base tabular-nums leading-none ${
                entry.rank === 1 ? 'bg-gold/20 text-gold' : 'bg-warm-200 text-warm-600'
              }`}>
                {entry.rank ?? '—'}
              </span>

              {/* Name + subtitle */}
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-medium text-charcoal leading-snug">
                    {entry.display_name}
                  </span>
                  {isMe && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gold/20 text-gold uppercase tracking-wide shrink-0">
                      you
                    </span>
                  )}
                </div>
                <p className="text-xs text-warm-400 mt-0.5">
                  {countingCount > 0
                    ? `${countingCount} of ${pickCount} counting`
                    : `${pickCount} picks`}
                  {!isExpanded && (
                    <span className="text-warm-300"> · tap to expand</span>
                  )}
                </p>
              </div>

              {/* Score */}
              <span className={`font-display font-bold tabular-nums text-2xl shrink-0 ${totalColor}`}>
                {entry.total_score === null ? '—' : formatScore(entry.total_score)}
              </span>

              {/* Chevron */}
              <svg
                className={`w-4 h-4 text-warm-300 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Scorecard expand — gold left bar is the signature element */}
            {isExpanded && (
              <div className="flex border-t border-warm-200">
                <div className="w-[3px] bg-gold shrink-0" />
                <div className="flex-1 bg-warm-100 px-5 py-3">
                  <div className="space-y-2">
                    {entry.picks.map((pick, i) => {
                      const inactive = pick.withdrawn || pick.cut
                      const pickColor = scoreColor(pick.score, !inactive && pick.used_in_total)
                      return (
                        <div key={i} className="flex items-center gap-3 text-sm">
                          <span className="w-5 h-5 rounded-full bg-fairway/80 flex items-center justify-center shrink-0 text-[10px] font-display font-bold text-cream leading-none">
                            {i + 1}
                          </span>
                          <span className={`flex-1 leading-snug ${
                            inactive ? 'line-through text-warm-400' :
                            pick.used_in_total ? 'text-charcoal' : 'text-warm-400'
                          }`}>
                            {pick.player_name}
                          </span>
                          {pick.withdrawn && (
                            <span className="text-[10px] font-bold text-birdie bg-birdie/10 px-1.5 py-0.5 rounded uppercase tracking-wide">WD</span>
                          )}
                          {pick.cut && (
                            <span className="text-[10px] font-bold text-warm-500 bg-warm-200 px-1.5 py-0.5 rounded uppercase tracking-wide">CUT</span>
                          )}
                          {!inactive && pick.thru === 'F' && (
                            <span className="text-xs text-warm-400">F</span>
                          )}
                          {!inactive && pick.thru && pick.thru !== 'F' && pick.thru !== '' && (
                            <span className="text-xs text-warm-400">thru {pick.thru}</span>
                          )}
                          <span className={`font-display font-bold tabular-nums text-sm w-8 text-right ${pickColor}`}>
                            {pick.score === null ? '—' : formatScore(pick.score)}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Total row */}
                  <div className="flex items-center gap-3 pt-2.5 mt-2.5 border-t border-warm-200">
                    <span className="w-5 shrink-0" />
                    <span className="flex-1 font-display font-bold text-xs uppercase tracking-widest text-warm-400">
                      Total
                    </span>
                    <span className={`font-display font-bold tabular-nums text-sm w-8 text-right ${totalColor}`}>
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
