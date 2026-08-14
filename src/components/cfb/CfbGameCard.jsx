import { CFB_THEME } from '../../theme/cfb'
import { formatSpread, formatKick } from '../../utils/cfbFormat'
import { doubleDownWinBy, underdogTier } from '../../utils/cfbScoring'

// One game in the weekly card builder (docs/CFB_UI_PLAN.md §7). Pure presentational —
// no data access. The page owns all card state and hands this component just what it
// needs to render this one game's slice of it.
//
// Props:
//   game              — { id, home_team, away_team, home_conference, away_conference,
//                         kickoff_at, home_spread, underdog_team, underdog_spread }
//   atsSelectedTeam   — this game's current ATS pick (a team name), or null
//   isDoubleDown      — is this game the flagged double-down?
//   isUnderdogPick    — is this game the mandatory underdog pick?
//   atsFull           — true when 5 ATS slots are already used elsewhere (globally)
//   dogFilled         — true when the underdog slot is already used elsewhere (globally)
//   onPickAts(gameId, team)
//   onToggleDoubleDown(gameId)
//   onPickUnderdog(gameId)

// The double-down bonus condition, sign-general per agents/pm/DECISIONS.md 2026-08-12:
// a favorite reads "win by N+"; an underdog ATS pick reads "cover — lose by ≤N or win".
// Never render doubleDownWinBy's raw (possibly negative) number.
function ddBonusCopy(teamSpread) {
  const n = doubleDownWinBy(teamSpread)
  if (n > 0) return `Win by ${n}+ for the bonus`
  const cushion = -n
  if (cushion <= 0) return 'Win outright for the bonus'
  return `Cover — lose by ≤${cushion} or win — for the bonus`
}

function TeamChip({ team, line, selected, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 text-left rounded-[10px] px-3 py-[10px] border cursor-pointer transition-colors"
      style={
        selected
          ? { background: CFB_THEME.accent, borderColor: CFB_THEME.accent, color: CFB_THEME.cream }
          : disabled
            ? { background: CFB_THEME.rankBg, borderColor: CFB_THEME.border, color: CFB_THEME.muted, cursor: 'default' }
            : { background: CFB_THEME.cardWhite, borderColor: CFB_THEME.border, color: CFB_THEME.ink }
      }
    >
      <div className="font-semibold text-[13.5px] truncate">{team}</div>
      <div
        className="font-display font-bold tabular-nums text-[12px] mt-[1px]"
        style={{ color: selected ? 'rgba(248,245,238,.85)' : CFB_THEME.muted2 }}
      >
        {line}
      </div>
    </button>
  )
}

export default function CfbGameCard({
  game,
  atsSelectedTeam,
  isDoubleDown,
  isUnderdogPick,
  atsFull,
  dogFilled,
  onPickAts,
  onToggleDoubleDown,
  onPickUnderdog,
}) {
  const homeLine = formatSpread(game.home_spread)
  const awayLine = formatSpread(-Number(game.home_spread))

  const atsChipsDisabled = isUnderdogPick || (atsFull && !atsSelectedTeam)
  const dogActionDisabled = !!atsSelectedTeam || (dogFilled && !isUnderdogPick)

  const tier = underdogTier(game.underdog_spread)

  return (
    <div
      className="rounded-[14px] p-4"
      style={{
        background: CFB_THEME.cardWhite,
        border: `1px solid ${isDoubleDown ? CFB_THEME.accent : CFB_THEME.border}`,
      }}
    >
      <div className="flex items-center justify-between text-[11px] mb-[8px]" style={{ color: CFB_THEME.muted }}>
        <span>
          {game.away_conference && game.home_conference
            ? `${game.away_conference} @ ${game.home_conference}`
            : `${game.away_team} @ ${game.home_team}`}
        </span>
        <span className="tabular-nums">{formatKick(game.kickoff_at)}</span>
      </div>

      <div className="flex gap-[8px]">
        <TeamChip
          team={game.away_team}
          line={awayLine}
          selected={atsSelectedTeam === game.away_team}
          disabled={atsChipsDisabled}
          onClick={() => onPickAts(game.id, game.away_team)}
        />
        <TeamChip
          team={game.home_team}
          line={homeLine}
          selected={atsSelectedTeam === game.home_team}
          disabled={atsChipsDisabled}
          onClick={() => onPickAts(game.id, game.home_team)}
        />
      </div>

      {atsSelectedTeam && (
        <button
          type="button"
          onClick={() => onToggleDoubleDown(game.id)}
          className="w-full mt-[8px] flex items-center justify-between rounded-[10px] px-3 py-[8px] border cursor-pointer transition-colors"
          style={
            isDoubleDown
              ? { background: CFB_THEME.accentSoft, borderColor: CFB_THEME.accent }
              : { background: 'transparent', borderColor: CFB_THEME.border }
          }
        >
          <span
            className="text-[12.5px] font-semibold"
            style={{ color: isDoubleDown ? CFB_THEME.accent : CFB_THEME.muted2 }}
          >
            {isDoubleDown ? '★ Double-down flagged' : '☆ Flag as double-down'}
          </span>
          {isDoubleDown && (
            <span className="text-[11px]" style={{ color: CFB_THEME.accent }}>
              {ddBonusCopy(atsSelectedTeam === game.home_team ? Number(game.home_spread) : -Number(game.home_spread))}
            </span>
          )}
        </button>
      )}

      <button
        type="button"
        onClick={() => onPickUnderdog(game.id)}
        disabled={dogActionDisabled}
        className="w-full mt-[8px] flex items-center justify-between rounded-[10px] px-3 py-[8px] border cursor-pointer transition-colors"
        style={
          isUnderdogPick
            ? { background: CFB_THEME.positiveSoft, borderColor: CFB_THEME.positive }
            : dogActionDisabled
              ? { background: CFB_THEME.rankBg, borderColor: CFB_THEME.border, cursor: 'default' }
              : { background: 'transparent', borderColor: CFB_THEME.border }
        }
      >
        <span
          className="text-[12.5px] font-semibold"
          style={{ color: isUnderdogPick ? CFB_THEME.positive : dogActionDisabled ? CFB_THEME.muted : CFB_THEME.muted2 }}
        >
          🐕 Take {game.underdog_team} outright
        </span>
        <span
          className="text-[11px]"
          style={{ color: isUnderdogPick ? CFB_THEME.positive : CFB_THEME.muted }}
        >
          +{tier} {tier === 1 ? 'pt' : 'pts'} if they win
        </span>
      </button>
    </div>
  )
}
