// Display helpers shared by the CFB pool-detail + picks screens. Pure formatting —
// no data access, no scoring (that's src/utils/cfbScoring.js).

// A spread in the picked team's sign convention → a display string.
//   negative (laying points) → "−7.5"   positive (getting points) → "+3"
//   zero → "PK" (pick'em). Uses the real minus glyph (−) to match the design.
export function formatSpread(n) {
  const v = Number(n)
  if (!Number.isFinite(v) || v === 0) return 'PK'
  const abs = Math.abs(v)
  const num = Number.isInteger(abs) ? String(abs) : String(abs)
  return `${v < 0 ? '−' : '+'}${num}`
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

// Score line for a game row: "31–17" (final/live) or "" (not started). The em-style
// en-dash separates the two scores.
export function scoreLine(awayScore, homeScore) {
  if (awayScore == null || homeScore == null) return ''
  return `${awayScore}–${homeScore}`
}
