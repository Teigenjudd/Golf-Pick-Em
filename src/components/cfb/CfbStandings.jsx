import { useState } from 'react'
import { CFB_THEME } from '../../theme/cfb'
import { formatKick } from '../../utils/cfbFormat'

// CFB season-standings hero + the scorecard-expand, the CFB analogue of golf's
// Standings.jsx (docs/CFB_UI_PLAN.md §6). Purely presentational: the page joins
// picks→games, grades the selected week with gradeWeekCard, and hands each row a
// fully display-ready shape (see CfbPoolDetail). Higher-is-better; points never
// negative. The expand's left-bar + accents are the brick CFB accent.
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

// ── result pill styling ──────────────────────────────────────────────────────
const HIT = new Set(['cover', 'win'])
const MISS = new Set(['miss', 'loss'])
function pillStyle(result) {
  if (HIT.has(result)) return { background: CFB_THEME.positiveSoft, color: CFB_THEME.positive }
  if (MISS.has(result)) return { background: 'rgba(138,59,34,.10)', color: CFB_THEME.warnInk }
  // push / anything else graded-but-neutral
  return { background: CFB_THEME.rankBg, color: CFB_THEME.muted2 }
}
const RESULT_LABEL = {
  cover: 'Cover', push: 'Push', miss: 'Miss', win: 'Win', loss: 'Loss',
}

// ── the live/final/scheduled context line under each pick ─────────────────────
function GameLine({ p }) {
  const hasScore = p.awayScore != null && p.homeScore != null
  if (p.status === 'in_progress') {
    const clock = p.live?.clock
    const per = p.live?.period
    const when = [per ? `Q${per}` : null, clock].filter(Boolean).join(' ')
    return (
      <span className="inline-flex items-center gap-[6px]">
        <span
          className="font-display font-bold text-[8px] uppercase tracking-[.1em] px-[5px] py-[1px] rounded"
          style={{ background: CFB_THEME.accent, color: CFB_THEME.cream }}
        >
          Live
        </span>
        {hasScore && <span>{p.awayTeam} {p.awayScore}–{p.homeScore} {p.homeTeam}</span>}
        {when && <span style={{ color: CFB_THEME.muted }}>· {when}</span>}
      </span>
    )
  }
  if (p.status === 'final' && hasScore) {
    return <span>{p.awayTeam} {p.awayScore}–{p.homeScore} {p.homeTeam} · Final</span>
  }
  return <span>{p.matchup}{p.status === 'scheduled' && formatKick(p.kickoffAt) ? ` · ${formatKick(p.kickoffAt)}` : ''}</span>
}

// ── one slot marker (1–5 ATS · ★ double-down · 🐕 underdog) ───────────────────
function SlotMarker({ p }) {
  const base =
    'w-[20px] h-[20px] rounded-full flex items-center justify-center flex-none font-display font-bold text-[10px] leading-none'
  if (p.pickType === 'underdog') {
    return (
      <span
        className={base}
        style={{ background: CFB_THEME.cardWhite, border: `1.5px solid ${CFB_THEME.accent}`, fontSize: 11 }}
      >
        🐕
      </span>
    )
  }
  if (p.isDoubleDown) {
    return <span className={base} style={{ background: CFB_THEME.accent, color: CFB_THEME.cream }}>★</span>
  }
  return <span className={base} style={{ background: CFB_THEME.navy, color: CFB_THEME.cream }}>{p.slot}</span>
}

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
                    <>
                      <div className="space-y-[3px]">
                        {wk.picks.map((p, i) => (
                          <div key={i} className="flex items-center gap-[10px] py-[5px]">
                            <SlotMarker p={p} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-[6px]">
                                <span className="text-[13.5px] font-semibold leading-tight truncate" style={{ color: CFB_THEME.ink }}>
                                  {p.line}
                                </span>
                                {p.isDoubleDown && (
                                  <span
                                    className="font-display font-bold text-[8px] uppercase tracking-[.08em] px-[4px] py-[1px] rounded flex-none"
                                    style={{ background: CFB_THEME.accentSoft, color: CFB_THEME.accent }}
                                  >
                                    DD
                                  </span>
                                )}
                                {p.autoFilled && (
                                  <span
                                    className="font-display font-bold text-[8px] uppercase tracking-[.08em] px-[4px] py-[1px] rounded flex-none"
                                    style={{ background: CFB_THEME.rankBg, color: CFB_THEME.muted2 }}
                                  >
                                    Auto
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] mt-[1px] truncate" style={{ color: CFB_THEME.muted2 }}>
                                <GameLine p={p} />
                              </div>
                            </div>

                            {/* Result pill */}
                            {p.result && (
                              <span
                                className="font-display font-bold text-[9px] uppercase tracking-[.06em] px-[7px] py-[3px] rounded-full flex-none"
                                style={pillStyle(p.result)}
                              >
                                {RESULT_LABEL[p.result]}
                              </span>
                            )}

                            {/* Points */}
                            <span
                              className="font-display font-bold tabular-nums text-[14px] w-[34px] text-right flex-none"
                              style={{
                                color: p.result == null ? CFB_THEME.muted
                                  : p.points > 0 ? CFB_THEME.positive : CFB_THEME.muted,
                              }}
                            >
                              {p.result == null ? '—' : `+${p.points}`}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Total row */}
                      <div className="flex items-center gap-[10px] pt-2 mt-[5px] border-t" style={{ borderColor: CFB_THEME.border }}>
                        <span className="w-[20px] flex-none" />
                        <span className="flex-1 font-display font-bold text-[9px] uppercase tracking-[.16em]" style={{ color: CFB_THEME.muted }}>
                          Total · {weekLabel}
                        </span>
                        <span className="font-display font-bold tabular-nums text-[14px] w-[34px] text-right flex-none" style={{ color: CFB_THEME.ink }}>
                          +{wk.total}
                        </span>
                      </div>
                    </>
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
