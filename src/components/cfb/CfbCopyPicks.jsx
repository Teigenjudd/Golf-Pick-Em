import { CFB_THEME } from '../../theme/cfb'

// "Copy picks from another pool" — for a player in more than one CFB pool on the same
// real week, offers to carry the same team selections over from a pool where they've
// already built a full card. It only ever copies TEAM CHOICES, never lines/spreads:
// CfbPicks.jsx maps each source pick onto this pool's own games (by cfbd_game_id) and
// drops the result into the normal builder state, so the player reviews this pool's own
// live lines — same as any manually-built card — before submitting.
export default function CfbCopyPicks({ sources, onCopy, notice }) {
  if (!sources.length) return null

  return (
    <div
      className="rounded-[10px] px-3 py-[10px] mb-3"
      style={{ background: CFB_THEME.cardWhite, border: `1px solid ${CFB_THEME.border}` }}
    >
      <div className="text-[11.5px] font-semibold mb-[6px]" style={{ color: CFB_THEME.muted2 }}>
        Already built this week's card elsewhere?
      </div>
      <div className="flex flex-wrap gap-[6px]">
        {sources.map(source => (
          <button
            key={source.poolId}
            type="button"
            onClick={() => onCopy(source)}
            className="rounded-full px-3 py-[6px] text-[12px] font-semibold cursor-pointer border-none"
            style={{ background: CFB_THEME.accentSoft, color: CFB_THEME.accent }}
          >
            Copy picks from {source.poolName}
          </button>
        ))}
      </div>
      {notice && (
        <div className="text-[11.5px] mt-[8px]" style={{ color: CFB_THEME.warnInk }}>{notice}</div>
      )}
    </div>
  )
}
