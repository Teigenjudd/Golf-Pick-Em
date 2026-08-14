import { CFB_THEME } from '../../theme/cfb'

// Sticky bottom bar for the CFB weekly card builder (docs/CFB_UI_PLAN.md §7) — the
// CFB analogue of src/components/pool/PicksSubmitBar.jsx, CFB-styled. Pure
// presentational; the page owns all card state and validity.
//
// Props: atsCount, ddCount, dogCount, valid, warning, submitting, hasExistingCard, onSubmit
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
        <div className="flex items-center gap-3">
          <div
            className="flex-1 font-display font-bold text-[12.5px] uppercase tracking-[.04em]"
            style={{ color: valid ? CFB_THEME.positive : CFB_THEME.muted2 }}
          >
            ATS {atsCount}/5 · DD {ddCount}/1 · Dog {dogCount}/1
          </div>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || !valid}
            className="font-bold text-[14px] px-7 py-[13px] rounded-[12px] border-none transition-all duration-[150ms]"
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
    </div>
  )
}
