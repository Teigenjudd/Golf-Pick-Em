// Shared "Pick'em Standings" section label + card shell.
// Rendered by both the live TournamentDetail and the demo. Children are the card
// body (the <Standings> table, or a page-specific empty state).
export default function StandingsCard({ children }) {
  return (
    <>
      <div className="font-display font-bold text-[10px] uppercase tracking-[.22em] text-warm-400 mb-[10px]">
        Pick&apos;em Standings
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
