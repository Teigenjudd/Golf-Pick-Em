import { useState } from 'react'
import { CFB_THEME } from '../../theme/cfb'
import CfbCardRows from './CfbCardRows'

// CFB season-standings hero + the scorecard-expand, the CFB analogue of golf's
// Standings.jsx (docs/CFB_UI_PLAN.md §6). Purely presentational: the page joins
// picks→games, grades the selected week with shapeCard, and hands each row a
// fully display-ready shape (see CfbPoolDetail). Higher-is-better; points never
// negative. The expand's left-bar + accents are the brick CFB accent. The 6 pick
// rows + total inside the expand are the shared CfbCardRows (also used by the
// read-only picks view).
//
// entries: [{
//   user_id, display_name, rank, total,      // season rank + season points
//   week: {
//     state,   // 'card' | 'nocard' | 'hidden' (others' picks before the week locks)
//     total,                                 // this selected week's points
//     picks: [{                              // ordered: 5 ATS then the underdog
//       slot, pickType, isDoubleDown, autoFilled, line, matchup,
//       awayTeam, homeTeam, awayScore, homeScore, status, live, kickoffAt,
//       result, points,
//     }]
//   }
// }]

export default function CfbStandings({ entries, currentUserId, weekLabel }) {
  const [expanded, setExpanded] = useState(new Set())
  function toggle(uid) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(uid) ? next.delete(uid) : next.add(uid)
      return next
    })
  }

  return (
    <div>
      {entries.map(entry => {
        const isOpen = expanded.has(entry.user_id)
        const isMe = entry.user_id === currentUserId
        const leader = entry.rank === 1 && entry.total > 0
        const wk = entry.week

        return (
          <div key={entry.user_id} className="border-b last:border-0" style={{ borderColor: CFB_THEME.divider }}>
            <button
              onClick={() => toggle(entry.user_id)}
              className="w-full flex items-center gap-3 px-[18px] py-[14px] text-left cursor-pointer border-none bg-transparent transition-colors hover:brightness-[.99]"
            >
              {/* Rank */}
              <span
                className="w-9 h-9 rounded-full flex items-center justify-center flex-none font-display font-bold text-base tabular-nums leading-none"
                style={{
                  background: leader ? CFB_THEME.accentSoft : CFB_THEME.rankBg,
                  color: leader ? CFB_THEME.accent : CFB_THEME.muted2,
                }}
              >
                {entry.rank ?? '—'}
              </span>

              {/* Name + week subtitle */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-[7px] flex-wrap">
                  <span className="font-semibold text-[15px] leading-snug" style={{ color: CFB_THEME.ink }}>
                    {entry.display_name}
                  </span>
                  {isMe && (
                    <span
                      className="font-display font-bold text-[10px] tracking-[.08em] px-[7px] py-[2px] rounded-full uppercase"
                      style={{ background: CFB_THEME.accent, color: CFB_THEME.cream }}
                    >
                      YOU
                    </span>
                  )}
                </div>
                <p className="text-[12px] mt-[1px]" style={{ color: CFB_THEME.muted }}>
                  {wk.state === 'card'
                    ? `+${wk.total} this week`
                    : wk.state === 'nocard'
                      ? `No card · ${weekLabel}`
                      : weekLabel}
                </p>
              </div>

              {/* Season total */}
              <span
                className="font-display font-extrabold tabular-nums text-[26px] flex-none"
                style={{ color: leader ? CFB_THEME.accent : CFB_THEME.ink }}
              >
                {entry.total}
              </span>

              {/* Chevron */}
              <svg
                className="flex-none transition-transform duration-[180ms]"
                style={{ width: 14, height: 14, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                fill="none" viewBox="0 0 24 24" stroke={CFB_THEME.muted} strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Expand — brick left-bar signature */}
            {isOpen && (
              <div className="flex border-t" style={{ borderColor: CFB_THEME.divider }}>
                <div className="w-[3px] flex-none" style={{ background: CFB_THEME.accent }} />
                <div className="flex-1 px-4 py-3" style={{ background: CFB_THEME.expandTint }}>
                  {wk.state === 'nocard' ? (
                    <p className="text-[12.5px] py-2" style={{ color: CFB_THEME.muted }}>
                      No card in for {weekLabel}.
                    </p>
                  ) : wk.state === 'hidden' ? (
                    <p className="text-[12.5px] py-2" style={{ color: CFB_THEME.muted }}>
                      Picks are hidden until {weekLabel} locks.
                    </p>
                  ) : (
                    <CfbCardRows picks={wk.picks} total={wk.total} totalLabel={`Total · ${weekLabel}`} />
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
