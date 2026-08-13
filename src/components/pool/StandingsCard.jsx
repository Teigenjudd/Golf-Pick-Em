// Shared standings section label + card shell. The label is prop-driven (golf:
// "Pick'em Standings"; CFB: "Season Standings"). Children are the card body (the
// standings table, or a page-specific empty state).
export default function StandingsCard({ children, label = "Pick'em Standings" }) {
  return (
    <>
      <div className="font-display font-bold text-[10px] uppercase tracking-[.22em] text-warm-400 mb-[10px]">
        {label}
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
