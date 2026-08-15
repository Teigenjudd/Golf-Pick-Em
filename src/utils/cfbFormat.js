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

// The favored team + its line, from a game's home-perspective spread. Shared by the
// slate widget and the standalone slate page (CfbSlate.jsx).
export function favoriteLine(game) {
  const s = Number(game.home_spread)
  if (!Number.isFinite(s) || s === 0) return { team: game.home_team, line: 'PK' }
  return s < 0
    ? { team: game.home_team, line: formatSpread(s) }
    : { team: game.away_team, line: formatSpread(-s) }
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

// formatKick plus a zero-padded MM/DD date — for the weekly picks list, where a
// single week's slate can span several different calendar days and "Sat" alone
// (with no date) doesn't disambiguate which Saturday, especially once the list is
// sorted by kickoff. Null-safe.
export function formatKickWithDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const weekday = d.toLocaleDateString(undefined, { weekday: 'short' })
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${weekday} ${mm}/${dd} ${time}`
}

// A lock timestamp → a full local label like "Sat, Sep 21, 12:00 PM PDT" for the
// picks-page "Locks …" subtitle. Includes date + local tz so a player knows exactly
// which deadline. Null-safe. Viewer's own timezone (not hardcoded ET).
export function formatLockLabel(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  })
}
