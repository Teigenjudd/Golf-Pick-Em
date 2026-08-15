import { useEffect } from 'react'

// Generic bottom-sheet modal — backdrop scrim + slide-up panel with a drag
// handle, matching the Claude Design "Join a pool" / "Add a pool" mockups.
// Closes on backdrop click or Escape. `title` renders in the panel header;
// everything else is `children`.
export default function BottomSheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return
    function onKeyDown(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-[#1C1610]/40"
        style={{ animation: 'sheetBackdropIn .2s ease-out' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[480px] bg-cream rounded-t-[22px] px-[22px] pt-[10px] pb-[28px]"
        style={{ animation: 'sheetUp .24s cubic-bezier(.2,.8,.2,1)' }}
      >
        <div className="w-9 h-[4px] bg-warm-300 rounded-full mx-auto mb-[18px]" />
        {title && (
          <div className="font-display font-extrabold text-[20px] text-[#1C1610] leading-none mb-[6px]">
            {title}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
