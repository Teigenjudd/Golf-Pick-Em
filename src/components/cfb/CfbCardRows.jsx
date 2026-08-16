import { CFB_THEME } from '../../theme/cfb'
import { formatKick, formatSpread } from '../../utils/cfbFormat'
import { effectiveDoubleDownLine } from '../../utils/cfbScoring'
import TeamCrest from './TeamCrest'

// The shared renderer for a CFB weekly card's 6 pick rows + TOTAL row (5 ATS then the
// underdog). Used by both the pool-detail standings expand (CfbStandings) and the
// read-only locked/graded view on the picks page (CfbCardReadonly) so the two can't
// drift. Purely presentational — the page grades the card with shapeCard (utils/
// cfbCard.js) and hands each row a display-ready shape:
//   { slot, pickType, isDoubleDown, autoFilled, line, matchup, awayTeam, homeTeam,
//     awayScore, homeScore, status, live, kickoffAt, result, points, selectedTeamLogo }

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

// One pick row. Exported so a caller can render a single row if needed; CfbCardRows
// renders the whole card (all 6 + total) which is the common case. On a double-down
// the DD chip shows the EFFECTIVE line (the base line shifted by the buffer) — e.g.
// a +8.5 pick reads "DD → +4" — so it's visually clear the bonus must clear a tougher
// number without spelling it out in a sentence.
export function CfbPickRow({ p }) {
  const ddLine = p.isDoubleDown && p.lockedSpread != null
    ? formatSpread(effectiveDoubleDownLine(Number(p.lockedSpread)))
    : null
  return (
    <div className="flex items-center gap-[10px] py-[5px]">
      <SlotMarker p={p} />
      <TeamCrest src={p.selectedTeamLogo} alt={p.selectedTeam} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-[6px]">
          <span className="text-[13.5px] font-semibold leading-tight truncate" style={{ color: CFB_THEME.ink }}>
            {p.line}
          </span>
          {p.isDoubleDown && (
            <span
              className="font-display font-bold text-[8px] uppercase tracking-[.08em] px-[5px] py-[1px] rounded flex-none tabular-nums"
              style={{ background: CFB_THEME.accentSoft, color: CFB_THEME.accent }}
            >
              {ddLine ? `DD → ${ddLine}` : 'DD'}
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
  )
}

// The full card: the 6 pick rows + the TOTAL row. `totalLabel` is the left-hand label
// on the total row (e.g. "Total · Week 4").
export default function CfbCardRows({ picks, total, totalLabel }) {
  return (
    <>
      <div className="space-y-[3px]">
        {picks.map((p, i) => <CfbPickRow key={i} p={p} />)}
      </div>

      {/* Total row */}
      <div className="flex items-center gap-[10px] pt-2 mt-[5px] border-t" style={{ borderColor: CFB_THEME.border }}>
        <span className="w-[20px] flex-none" />
        <span className="w-[20px] flex-none" />
        <span className="flex-1 font-display font-bold text-[9px] uppercase tracking-[.16em]" style={{ color: CFB_THEME.muted }}>
          {totalLabel}
        </span>
        <span className="font-display font-bold tabular-nums text-[14px] w-[34px] text-right flex-none" style={{ color: CFB_THEME.ink }}>
          +{total}
        </span>
      </div>
    </>
  )
}
