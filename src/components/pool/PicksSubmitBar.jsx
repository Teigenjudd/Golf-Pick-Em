// Shared sticky submit bar for the picks page.
// Rendered by both the live Picks page and the demo (change once, both update).
export default function PicksSubmitBar({
  selectedCount,
  totalCount,
  onSubmit,
  submitting = false,
  hasExistingPicks = false,
}) {
  const allSelected = selectedCount === totalCount && totalCount > 0

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-10"
      style={{ background: '#F4EFE4', borderTop: '1px solid #E4DDD0', padding: '12px 18px 20px' }}
    >
      <div className="max-w-[560px] mx-auto flex items-center gap-3">
        <div className="flex-1 text-[12px] text-warm-400">
          {selectedCount} of {totalCount} tiers selected
        </div>
        <button
          onClick={onSubmit}
          disabled={submitting || !allSelected}
          className="font-bold text-[14px] text-cream px-7 py-[13px] rounded-[12px] border-none transition-all duration-[150ms]"
          style={{
            background: allSelected ? '#1B4332' : '#9E9488',
            opacity: submitting ? 0.6 : 1,
            cursor: allSelected ? 'pointer' : 'default',
          }}
        >
          {submitting
            ? 'Submitting…'
            : allSelected
              ? (hasExistingPicks ? 'Update Picks →' : 'Submit Picks →')
              : `${selectedCount} of ${totalCount} selected`}
        </button>
      </div>
    </div>
  )
}
