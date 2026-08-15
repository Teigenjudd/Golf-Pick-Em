import { CFB_THEME } from '../../theme/cfb'

// Sticky bottom bar for the CFB weekly card builder (docs/CFB_UI_PLAN.md §7) — the
// CFB analogue of src/components/pool/PicksSubmitBar.jsx, CFB-styled. Pure
// presentational; the page owns all card state and validity.
//
// Props: atsCount, ddCount, dogCount, valid, warning, submitting, hasExistingCard, onSubmit

const TOTAL_SLOTS = 6 // 5 ATS + 1 underdog; double-down is an optional overlay, not a slot

function StatTile({ label, value, complete }) {
  return (
    <div className="flex-1 rounded-[10px] px-[10px] py-[8px]" style={{ background: CFB_THEME.rankBg }}>
      <div className="font-display font-bold uppercase tracking-[.06em] text-[9.5px]" style={{ color: CFB_THEME.muted }}>
        {label}
      </div>
      <div className="text-[13px] font-bold mt-[2px]" style={{ color: complete ? CFB_THEME.positive : CFB_THEME.ink }}>
        {value}
      </div>
    </div>
  )
}

export default function CfbCardTracker({
  atsCount,
  ddCount,
  dogCount,
  valid,
  warning,
  submitting = false,
  hasExistingCard = false,
  onSubmit,
}) {
  const totalSet = atsCount + dogCount

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-10"
      style={{ background: CFB_THEME.pageCard, borderTop: `1px solid ${CFB_THEME.border}`, padding: '10px 18px 20px' }}
    >
      <div className="max-w-[560px] mx-auto">
        {warning && (
          <p className="text-[11.5px] mb-[6px]" style={{ color: CFB_THEME.warnInk }}>
            {warning}
          </p>
        )}

        <div
          className="rounded-[12px] p-3 mb-[10px]"
          style={{ background: CFB_THEME.cardWhite, border: `1px solid ${CFB_THEME.border}` }}
        >
          <div className="flex items-center justify-between mb-[8px]">
            <span className="font-display font-bold text-[13px]" style={{ color: CFB_THEME.ink }}>
              Card progress
            </span>
            <span className="text-[11.5px]" style={{ color: valid ? CFB_THEME.positive : CFB_THEME.muted }}>
              {totalSet} of {TOTAL_SLOTS} set
            </span>
          </div>
          <div className="h-[4px] rounded-full mb-[10px] overflow-hidden" style={{ background: CFB_THEME.border }}>
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{ width: `${(totalSet / TOTAL_SLOTS) * 100}%`, background: CFB_THEME.accent }}
            />
          </div>
          <div className="flex gap-[8px]">
            <StatTile label="ATS Picks" value={`${atsCount} of 5`} complete={atsCount === 5} />
            <StatTile label="Double Down" value={ddCount ? 'Set' : 'Not set'} complete={!!ddCount} />
            <StatTile label="Underdog" value={`${dogCount} of 1`} complete={dogCount === 1} />
          </div>
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || !valid}
          className="w-full font-bold text-[14px] py-[13px] rounded-[12px] border-none transition-all duration-[150ms]"
          style={{
            background: valid ? CFB_THEME.accent : CFB_THEME.muted,
            color: CFB_THEME.cream,
            opacity: submitting ? 0.6 : 1,
            cursor: valid && !submitting ? 'pointer' : 'default',
          }}
        >
          {submitting
            ? 'Submitting…'
            : hasExistingCard
              ? 'Update card →'
              : 'Submit card →'}
        </button>
      </div>
    </div>
  )
}
