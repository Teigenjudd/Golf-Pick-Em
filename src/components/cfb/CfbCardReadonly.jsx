import { CFB_THEME } from '../../theme/cfb'
import CfbCardRows from './CfbCardRows'

// The read-only weekly card on the picks page (docs/CFB_UI_PLAN.md §7 locked/auto-
// filled/graded states). Once a week locks the card is frozen — this shows the user's
// 6 picks + locked spreads, with results + points once the games grade. Same rows as
// the pool-detail expand (CfbCardRows); the chrome here is the white card + the brick
// left-bar signature.
//
// card:     { total, picks: [...] } from shapeCard (utils/cfbCard.js)
// notice:   short human string shown above the card (locked / auto-filled copy)
// variant:  'autofilled' tints the notice as a heads-up; else neutral

export default function CfbCardReadonly({ card, notice, variant, weekLabel }) {
  const autofilled = variant === 'autofilled'
  return (
    <div>
      {notice && (
        <div
          className="rounded-[10px] px-4 py-3 mb-3 text-[12.5px] leading-snug"
          style={{
            background: autofilled ? CFB_THEME.rankBg : CFB_THEME.cardWhite,
            border: `1px solid ${autofilled ? CFB_THEME.border : CFB_THEME.divider}`,
            color: autofilled ? CFB_THEME.ink : CFB_THEME.muted,
          }}
        >
          {notice}
        </div>
      )}

      <div
        className="rounded-[10px] overflow-hidden flex"
        style={{ background: CFB_THEME.cardWhite, border: `1px solid ${CFB_THEME.border}` }}
      >
        <div className="w-[3px] flex-none" style={{ background: CFB_THEME.accent }} />
        <div className="flex-1 px-4 py-3">
          <CfbCardRows
            picks={card.picks}
            total={card.total}
            totalLabel={`Total · ${weekLabel}`}
          />
        </div>
      </div>
    </div>
  )
}
