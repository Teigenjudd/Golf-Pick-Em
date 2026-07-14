// Joins players across data sources that spell names differently — in practice,
// the Slash Golf field against The Odds API's outright markets.
//
// Matching runs in layers, each only used when the one before it misses:
//   1. exact    — canonical names are identical
//   2. fallback — same surname AND same first initial ("Matt Fitzpatrick" →
//                 "Matthew Fitzpatrick"; also covers dropped middle names)
//   3. (aliases are folded into canonical(), so they resolve at layer 1)
//
// A fallback match is only accepted when exactly ONE candidate shares that
// surname + initial. If two players collide (a hypothetical second "M. Kim"),
// the match is REFUSED rather than guessed — a missing price shows as N/A,
// which is recoverable, while a wrong price silently mis-tiers the field.
//
// See docs/NAME_MATCHING.md.

import { normalizeName } from './scoring'
import { NAME_ALIASES } from './nameAliases'

export function canonicalName(name) {
  const normalized = normalizeName(name)
  return NAME_ALIASES[normalized] ?? normalized
}

// Surname + first initial, e.g. "matthew fitzpatrick" → "fitzpatrick|m".
// Null for single-token names, which are too weak to match on.
function surnameKey(canonical) {
  const tokens = canonical.split(' ').filter(Boolean)
  if (tokens.length < 2) return null
  return `${tokens[tokens.length - 1]}|${tokens[0][0]}`
}

// entries: [{ name, ...payload }] — the source being matched INTO (e.g. odds).
export function buildPlayerIndex(entries) {
  const exact = new Map()
  const bySurname = new Map()

  for (const entry of entries) {
    const canonical = canonicalName(entry.name)
    if (!canonical) continue
    if (!exact.has(canonical)) exact.set(canonical, entry)

    const key = surnameKey(canonical)
    if (!key) continue
    if (!bySurname.has(key)) bySurname.set(key, [])
    bySurname.get(key).push(entry)
  }

  return { exact, bySurname }
}

// Returns the matching entry, or null when there is no confident match.
export function resolvePlayer(name, index) {
  const canonical = canonicalName(name)
  if (!canonical) return null

  const exact = index.exact.get(canonical)
  if (exact) return exact

  const key = surnameKey(canonical)
  if (!key) return null

  const candidates = index.bySurname.get(key)
  // Exactly one candidate, or nothing — never pick between two.
  return candidates?.length === 1 ? candidates[0] : null
}
