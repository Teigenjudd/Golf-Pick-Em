// CFB "Varsity Navy" theme — the locked colorway for the two sport-specific CFB
// screens (Pool Detail + Weekly Picks), from the Claude Design comp
// "CFB Pool Detail and Picks - Full States". Golf keeps its fairway/gold register;
// this is applied ONLY on the CFB pool-detail + picks pages (see the theme-system note
// in CLAUDE.md). Kept as plain constants (not Tailwind tokens) because these hexes are
// CFB-specific and used inline by the CFB components + passed into the shared shells.

export const CFB_THEME = {
  // Header band (navy gradient) + the 3-segment "rib" stripe under it.
  headerGradient: 'linear-gradient(165deg,#101C3D 0%,#0A1229 100%)',
  navy: '#101C3D',
  navyDeep: '#0A1229',
  rib: ['#D6291B', '#F8F5EE', '#D6291B'],

  accent: '#D6291B',            // brick — eyebrow, expand bar, DD flag, selected pick,
                                //         week-selector active, submit, YOU tag, badge border
  accentSoft: 'rgba(214,41,27,.09)',
  accentBorder: 'rgba(214,41,27,.4)',

  positive: '#2E8F4F',          // cover / win / leader
  positiveSoft: 'rgba(46,143,79,.15)',

  // Warm-cream neutrals (shared with the rest of Poold; listed so CFB components read
  // from one place).
  pageCard: '#F4EFE4',          // the card-page background inside a pool surface
  cream: '#F8F5EE',
  cardWhite: '#FFFDF8',
  border: '#E4DDD0',
  divider: '#EFE8DA',
  rowTint: '#FAF6EE',           // "your" row highlight
  expandTint: '#F8F3EC',        // scorecard-expand background
  rankBg: '#EBE3D4',            // rank-circle background
  muted: '#9E9488',
  muted2: '#736A5F',
  label: '#8A7D6C',
  ink: '#1C1610',
  warnInk: '#8A3B22',
}

// CFB SportBadge config. line2 is the 2-digit season; keep it derivable so a 2027 pool
// reads "27". Shape matches golf's badge_config ({ line1, line2, bg, border }).
export function cfbBadge(seasonYear) {
  return {
    line1: 'CFB',
    line2: seasonYear ? String(seasonYear).slice(-2) : '26',
    bg: CFB_THEME.navy,
    border: CFB_THEME.accent,
  }
}

// Static default (matches the design comp's badgeNavy).
export const CFB_BADGE = cfbBadge(2026)
