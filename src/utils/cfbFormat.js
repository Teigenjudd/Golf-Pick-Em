// Display helpers shared by the CFB pool-detail + picks screens. Pure formatting —
// no data access, no scoring (that's src/utils/cfbScoring.js).

// A spread in the picked team's sign convention → a display string.
//   negative (laying points) → "−7.5"   positive (getting points) → "+3"
//   zero → "PK" (pick'em). Uses the real minus glyph (−) to match the design.
export function formatSpread(n) {
  const v = Number(n)
  if (!Number.isFinite(v) || v === 0) return 'PK'
  return `${v < 0 ? '−' : '+'}${Math.abs(v)}`
}

// "Team −7.5" — a pick rendered as team + its line.
export function pickLine(team, spread) {
  return `${team} ${formatSpread(spread)}`
}

// A kickoff timestamp → a short local label like "Sat 3:30 PM". Null-safe.
export function formatKick(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    weekday: 'short', hour: 'numeric', minute: '2-digit',
  })
}
