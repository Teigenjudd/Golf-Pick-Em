// Player name aliases — maps a name variant to a single canonical spelling.
//
// Slash Golf (the field/leaderboard) and The Odds API (the books) do not always
// use the same name for the same golfer. Most disagreements are mechanical and
// are handled without a table: accents and Nordic letters by `normalizeName`,
// and shortened first names or dropped middle names ("Matt"/"Matthew",
// "Eugenio Chacarra"/"Eugenio Lopez Chacarra") by the surname + first-initial
// fallback in `playerMatch.js`.
//
// This table exists ONLY for the residue those rules cannot reach: names where
// the first initial or the surname itself differs, so no amount of string
// manipulation gets you from one to the other. That is almost entirely players
// who compete under an English name unrelated to their legal name.
//
// Keys and values are already-normalized names (lowercase, unaccented, no
// punctuation) — i.e. the output of `normalizeName`, not raw display names.
// The canonical value is applied to BOTH sides of a join, so it does not matter
// which source's spelling you pick as canonical, only that it is used
// consistently. An entry is harmless if the sources happen to agree.
//
// HOW TO EXTEND THIS TABLE: see docs/NAME_MATCHING.md.
export const NAME_ALIASES = {
  // Korean players competing under an English given name.
  'tom kim': 'joohyung kim',       // Kim Joo-hyung
  'ben an': 'byeong hun an',       // An Byeong-hun
  'sung kang': 'sung hoon kang',   // Kang Sung-hoon
  'whee kim': 'meen whee kim',     // Kim Meen-whee

  // Players known by initials, which no fallback can expand.
  'kj choi': 'kyoung ju choi',     // Choi Kyung-ju
  'kh lee': 'kyoung hoon lee',     // Lee Kyoung-hoon
  'sh kim': 'seong hyeon kim',     // Kim Seong-hyeon
  'ye yang': 'yong eun yang',      // Yang Yong-eun
}
