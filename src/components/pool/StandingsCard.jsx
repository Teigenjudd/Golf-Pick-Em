// Shared standings section label + card shell. The label is prop-driven (golf:
// "Pick'em Standings"; CFB: "Season Standings"). `action` is an optional right-aligned
// slot next to the label (CFB uses it for the "How scoring works" rules button).
// Children are the card body (the standings table, or a page-specific empty state).
export default function StandingsCard({ children, label = "Pick'em Standings", action = null }) {
  return (
    <>
      <div className="flex items-center justify-between mb-[10px]">
        <div className="font-display font-bold text-[10px] uppercase tracking-[.22em] text-warm-400">
          {label}
        </div>
        {action}
      </div>
      <div
        className="bg-[#FFFDF8] border border-[#E4DDD0] rounded-2xl overflow-hidden mb-4"
        style={{ boxShadow: '0 12px 36px -24px rgba(20,48,38,.35)' }}
      >
        {children}
      </div>
    </>
  )
}
