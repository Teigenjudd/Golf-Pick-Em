import { CFB_THEME } from '../../theme/cfb'
import { formatSpread, formatKickWithDate, pickLine } from '../../utils/cfbFormat'
import { effectiveDoubleDownLine, underdogTier } from '../../utils/cfbScoring'
import TeamCrest from './TeamCrest'

// One game in the weekly card builder (docs/CFB_UI_PLAN.md §7). Pure presentational —
// no data access. The page owns all card state and hands this component just what it
// needs to render this one game's slice of it.
//
// Props:
//   game              — { id, home_team, away_team, home_team_logo, away_team_logo,
//                         home_conference, away_conference,
//                         kickoff_at, home_spread, underdog_team, underdog_spread }
//   atsSelectedTeam   — this game's current ATS pick (a team name), or null
//   isDoubleDown      — is this game the flagged double-down?
//   isUnderdogPick    — is this game the mandatory underdog pick?
//   atsFull           — true when 5 ATS slots are already used elsewhere (globally)
//   dogFilled         — true when the underdog slot is already used elsewhere (globally)
//   started           — true once this game's kickoff has passed — every pick control
//                        is disabled (an already-selected chip stays visibly selected,
//                        just not clickable); server-side backstop in the RPC
//   onPickAts(gameId, team)
//   onToggleDoubleDown(gameId)
//   onPickUnderdog(gameId)

function TeamChip({ team, logo, line, selected, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 min-w-[104px] text-center rounded-[10px] px-3 py-[10px] border cursor-pointer transition-colors"
      style={
        selected
          ? { background: CFB_THEME.accent, borderColor: CFB_THEME.accent, color: CFB_THEME.cream }
          : disabled
            ? { background: CFB_THEME.rankBg, borderColor: CFB_THEME.border, color: CFB_THEME.muted, cursor: 'default' }
            : { background: CFB_THEME.cardWhite, borderColor: CFB_THEME.border, color: CFB_THEME.ink }
      }
    >
      <div className="flex items-center justify-center gap-[6px]">
        <TeamCrest src={logo} alt={team} />
        <div className="font-semibold text-[13.5px] truncate">{team}</div>
      </div>
      <div
        className="font-display font-bold tabular-nums text-[12px] mt-[1px]"
        style={{ color: selected ? 'rgba(248,245,238,.85)' : CFB_THEME.muted2 }}
      >
        {line}
      </div>
    </button>
  )
}

// The underdog-outright option, styled as a visibly different bet type: dashed
// border, centered content, dog icon on top instead of a spread number. Same
// flex-1/min-w footprint as the two TeamChips beside it so all three are always
// the same size — a long team name truncates (single line, fixed height) rather
// than growing the cell or wrapping to a second line.
function UnderdogChip({ team, logo, tier, selected, disabled, onClick }) {
  const ink = selected ? CFB_THEME.positive : disabled ? CFB_THEME.muted : CFB_THEME.ink
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 min-w-[104px] text-center rounded-[10px] px-2 py-[10px] border border-dashed cursor-pointer transition-colors"
      style={
        selected
          ? { background: CFB_THEME.positiveSoft, borderColor: CFB_THEME.positive }
          : disabled
            ? { background: CFB_THEME.rankBg, borderColor: CFB_THEME.border, cursor: 'default' }
            : { background: 'transparent', borderColor: CFB_THEME.border }
      }
    >
      {logo
        ? <div className="flex justify-center mb-[4px]"><TeamCrest src={logo} alt={team} /></div>
        : <div className="text-[13px] leading-none mb-[4px]">🐕</div>}
      <div className="font-semibold text-[12.5px] truncate" style={{ color: ink }}>{team}</div>
      <div className="flex items-center justify-center gap-[4px] mt-[2px]">
        <span
          className="font-display font-bold uppercase tracking-[.06em] text-[9px]"
          style={{ color: selected ? CFB_THEME.positive : CFB_THEME.muted }}
        >
          Underdog ·
        </span>
        <span
          className="font-display font-extrabold tabular-nums text-[11px]"
          style={{ color: CFB_THEME.positive }}
        >
          {tier} {tier === 1 ? 'pt' : 'pts'}
        </span>
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
  started,
  onPickAts,
  onToggleDoubleDown,
  onPickUnderdog,
}) {
  const homeLine = formatSpread(game.home_spread)
  const awayLine = formatSpread(-Number(game.home_spread))

  const atsChipsDisabled = started || isUnderdogPick || (atsFull && !atsSelectedTeam)

  const tier = underdogTier(game.underdog_spread)
  // Pick'em games (spread 0) have no underdog side — underdog_team is null and
  // tier is 0. No third chip at all in that case, rather than a dead "outright" option.
  const dogEligible = !!game.underdog_team && tier > 0
  const dogChipDisabled = started || !!atsSelectedTeam || (dogFilled && !isUnderdogPick)

  // Shown on the double-down toggle whether or not it's flagged yet, so the effective
  // line is visible up front rather than only after committing to the flag.
  const ddPreviewLine = atsSelectedTeam
    ? pickLine(
        atsSelectedTeam,
        effectiveDoubleDownLine(atsSelectedTeam === game.home_team ? Number(game.home_spread) : -Number(game.home_spread)),
      )
    : null

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
        <span className="tabular-nums" style={started ? { color: CFB_THEME.warnInk } : null}>
          {started ? 'Started' : formatKickWithDate(game.kickoff_at)}
        </span>
      </div>

      {/* flex-wrap: on a narrow card, the third (underdog) chip drops to its own row
          instead of squeezing all three into one. */}
      <div className="flex flex-wrap gap-[8px]">
        <TeamChip
          team={game.away_team}
          logo={game.away_team_logo}
          line={awayLine}
          selected={atsSelectedTeam === game.away_team}
          disabled={atsChipsDisabled}
          onClick={() => onPickAts(game.id, game.away_team)}
        />
        <TeamChip
          team={game.home_team}
          logo={game.home_team_logo}
          line={homeLine}
          selected={atsSelectedTeam === game.home_team}
          disabled={atsChipsDisabled}
          onClick={() => onPickAts(game.id, game.home_team)}
        />
        {dogEligible && (
          <UnderdogChip
            team={game.underdog_team}
            logo={game.underdog_team === game.home_team ? game.home_team_logo : game.away_team_logo}
            tier={tier}
            selected={isUnderdogPick}
            disabled={dogChipDisabled}
            onClick={() => onPickUnderdog(game.id)}
          />
        )}
      </div>

      {atsSelectedTeam && (
        <button
          type="button"
          onClick={() => onToggleDoubleDown(game.id)}
          disabled={started}
          className="w-full mt-[8px] flex items-center justify-between rounded-[10px] px-3 py-[8px] border cursor-pointer transition-colors"
          style={{
            ...(isDoubleDown
              ? { background: CFB_THEME.accentSoft, borderColor: CFB_THEME.accent }
              : { background: 'transparent', borderColor: CFB_THEME.border }),
            ...(started ? { cursor: 'default', opacity: 0.7 } : null),
          }}
        >
          <span
            className="text-[12.5px] font-semibold"
            style={{ color: isDoubleDown ? CFB_THEME.accent : CFB_THEME.muted2 }}
          >
            {isDoubleDown ? '★ Double-down' : '☆ Double-down'}
          </span>
          <span
            className="text-[11px] font-display font-bold tabular-nums"
            style={{ color: isDoubleDown ? CFB_THEME.accent : CFB_THEME.muted2 }}
          >
            {ddPreviewLine}
          </span>
        </button>
      )}
    </div>
  )
}
