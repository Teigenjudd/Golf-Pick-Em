import { CFB_THEME } from '../../theme/cfb'
import { formatSpread, formatKick } from '../../utils/cfbFormat'
import { PrizePoolWidget } from '../leaderboard/Widgets'

// CFB widget row (docs/CFB_UI_PLAN.md §6a) — the sport-specific analogue of golf's
// Widgets.jsx. All presentational and scoped to the SELECTED week (except Prize Pool,
// which is season-long and reused from golf as-is). Rendered inside the shared
// WidgetGrid via `children`. The page shapes every input; these just render.
//
// Props:
//   games          — selected week's cfb.games [{ home_team, away_team, home_spread,
//                    kickoff_at, status, home_score, away_score, underdog_team,
//                    underdog_spread }]
//   weekPicks      — enriched picks for the week [{ user_id, name, pickType,
//                    selectedTeam, lockedSpread, result, points }] (others hidden
//                    pre-lock, so this may be just the current user's before lock)
//   weeklyPoints   — [{ user_id, name, points }] for the selected week
//   participantCount, stakeAmount, payoutStructure — for Prize Pool
//   weekLabel      — "Week 4"

function WidgetCard({ title, children }) {
  return (
    <div
      className="rounded-[14px] p-4"
      style={{ background: CFB_THEME.cardWhite, border: `1px solid ${CFB_THEME.border}` }}
    >
      <div className="font-display font-bold text-[10px] uppercase tracking-[.16em] mb-[10px]" style={{ color: CFB_THEME.label }}>
        {title}
      </div>
      {children}
    </div>
  )
}

// favorite team + line from home-perspective spread
function favorite(g) {
  const s = Number(g.home_spread)
  if (!Number.isFinite(s) || s === 0) return { team: g.home_team, line: 'PK' }
  return s < 0
    ? { team: g.home_team, line: formatSpread(s) }
    : { team: g.away_team, line: formatSpread(-s) }
}

function Bar({ pct, color }) {
  return (
    <div className="flex-1 h-[6px] rounded-[3px] overflow-hidden" style={{ background: CFB_THEME.divider }}>
      <div className="h-full rounded-[3px]" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

// ── This Week's Slate ─────────────────────────────────────────────────────────
function SlateWidget({ games, weekLabel }) {
  if (!games?.length) {
    return (
      <WidgetCard title="This Week's Slate">
        <p className="text-[12.5px]" style={{ color: CFB_THEME.muted }}>Lines for {weekLabel} post soon.</p>
      </WidgetCard>
    )
  }
  return (
    <WidgetCard title="This Week's Slate">
      <div className="space-y-[2px]">
        {games.map((g, i) => {
          const fav = favorite(g)
          const live = g.status === 'in_progress'
          const done = g.status === 'final'
          const hasScore = g.away_score != null && g.home_score != null
          return (
            <div
              key={g.id ?? i}
              className="flex items-center gap-2 py-[6px] text-[12.5px]"
              style={{ borderBottom: i < games.length - 1 ? `1px solid ${CFB_THEME.divider}` : 'none' }}
            >
              <span className="flex-1 min-w-0 truncate" style={{ color: CFB_THEME.ink }}>
                {g.away_team} @ {g.home_team}
              </span>
              {live && (
                <span className="font-display font-bold text-[8px] uppercase px-[4px] py-[1px] rounded flex-none" style={{ background: CFB_THEME.accent, color: CFB_THEME.cream }}>
                  Live
                </span>
              )}
              {hasScore && (live || done) ? (
                <span className="font-display font-bold tabular-nums flex-none" style={{ color: CFB_THEME.ink }}>
                  {g.away_score}–{g.home_score}
                </span>
              ) : (
                <span className="flex-none text-[11.5px]" style={{ color: CFB_THEME.muted2 }}>
                  {fav.team} {fav.line}
                </span>
              )}
              {!live && !done && (
                <span className="flex-none text-[10.5px] tabular-nums" style={{ color: CFB_THEME.muted }}>
                  {formatKick(g.kickoff_at)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </WidgetCard>
  )
}

// ── Weekly Points ─────────────────────────────────────────────────────────────
function WeeklyPointsWidget({ weeklyPoints, weekLabel }) {
  const rows = (weeklyPoints ?? []).slice().sort((a, b) => b.points - a.points).slice(0, 6)
  const max = Math.max(1, ...rows.map(r => r.points))
  const anyGraded = rows.some(r => r.points > 0)
  if (!rows.length) return null
  return (
    <WidgetCard title={`Weekly Points · ${weekLabel}`}>
      {!anyGraded ? (
        <p className="text-[12.5px]" style={{ color: CFB_THEME.muted }}>No points in yet — games haven&apos;t graded.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={r.user_id ?? i} className="flex items-center gap-[10px]">
              <span className="text-[12.5px] w-[110px] flex-none truncate" style={{ color: CFB_THEME.ink }}>{r.name}</span>
              <Bar pct={Math.round((r.points / max) * 100)} color={i === 0 ? CFB_THEME.accent : CFB_THEME.positive} />
              <span className="text-[11px] w-[26px] text-right tabular-nums flex-none" style={{ color: CFB_THEME.muted2 }}>+{r.points}</span>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  )
}

// ── Most-Backed Teams ─────────────────────────────────────────────────────────
function MostBackedWidget({ weekPicks }) {
  const participants = new Set((weekPicks ?? []).map(p => p.user_id)).size
  if (!participants) return null
  const counts = {}
  ;(weekPicks ?? []).forEach(p => { counts[p.selectedTeam] = (counts[p.selectedTeam] ?? 0) + 1 })
  const top = Object.entries(counts)
    .map(([team, count]) => ({ team, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
  if (!top.length) return null
  return (
    <WidgetCard title="Most-Backed Teams">
      <div className="space-y-2">
        {top.map((t) => (
          <div key={t.team} className="flex items-center gap-[10px]">
            <span className="text-[12.5px] w-[110px] flex-none truncate" style={{ color: CFB_THEME.ink }}>{t.team}</span>
            <Bar pct={Math.round((t.count / participants) * 100)} color={CFB_THEME.accent} />
            <span className="text-[11px] w-[30px] text-right tabular-nums flex-none" style={{ color: CFB_THEME.muted }}>{t.count}/{participants}</span>
          </div>
        ))}
      </div>
    </WidgetCard>
  )
}

// ── Underdog Board ────────────────────────────────────────────────────────────
function UnderdogWidget({ weekPicks }) {
  const dogs = (weekPicks ?? []).filter(p => p.pickType === 'underdog')
  if (!dogs.length) return null
  return (
    <WidgetCard title="Underdog Board">
      <div className="space-y-[2px]">
        {dogs.map((d, i) => {
          const hit = d.result === 'win'
          const graded = d.result != null
          return (
            <div
              key={d.user_id ?? i}
              className="flex items-center gap-2 py-[6px] text-[12.5px]"
              style={{ borderBottom: i < dogs.length - 1 ? `1px solid ${CFB_THEME.divider}` : 'none' }}
            >
              <span className="flex-none" style={{ color: CFB_THEME.muted2 }}>🐕</span>
              <span className="w-[96px] flex-none truncate" style={{ color: CFB_THEME.ink }}>{d.name}</span>
              <span className="flex-1 min-w-0 truncate" style={{ color: CFB_THEME.muted2 }}>
                {d.selectedTeam} {formatSpread(d.lockedSpread)}
              </span>
              {graded ? (
                <span
                  className="font-display font-bold text-[9px] uppercase tracking-[.06em] px-[7px] py-[3px] rounded-full flex-none"
                  style={hit
                    ? { background: CFB_THEME.positiveSoft, color: CFB_THEME.positive }
                    : { background: CFB_THEME.rankBg, color: CFB_THEME.muted2 }}
                >
                  {hit ? `+${d.points}` : 'Loss'}
                </span>
              ) : (
                <span className="text-[11px] flex-none" style={{ color: CFB_THEME.muted }}>—</span>
              )}
            </div>
          )
        })}
      </div>
    </WidgetCard>
  )
}

export default function CfbWidgets({
  games, weekPicks, weeklyPoints, weekLabel, locked,
  stakeAmount, participantCount, payoutStructure,
}) {
  const hasPrize = stakeAmount && payoutStructure?.length
  return (
    <>
      {hasPrize && (
        <div className="col-span-2">
          <PrizePoolWidget stakeAmount={stakeAmount} participantCount={participantCount} payoutStructure={payoutStructure} />
        </div>
      )}
      <div className="col-span-2">
        <SlateWidget games={games} weekLabel={weekLabel} />
      </div>
      {/* The three pick-derived widgets only make sense once everyone's cards are
          visible — before the week locks, RLS hides other players' picks so they'd
          show just your own ("1/1"). Hold them behind a note until lock. */}
      {locked ? (
        <>
          <div className="col-span-2">
            <WeeklyPointsWidget weeklyPoints={weeklyPoints} weekLabel={weekLabel} />
          </div>
          <div className="col-span-2">
            <MostBackedWidget weekPicks={weekPicks} />
          </div>
          <div className="col-span-2">
            <UnderdogWidget weekPicks={weekPicks} />
          </div>
        </>
      ) : (
        <div className="col-span-2">
          <div
            className="rounded-[14px] p-4 text-center"
            style={{ background: CFB_THEME.cardWhite, border: `1px solid ${CFB_THEME.border}` }}
          >
            <p className="text-[12.5px]" style={{ color: CFB_THEME.muted }}>
              Weekly points, most-backed teams, and the underdog board reveal when {weekLabel} locks.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
