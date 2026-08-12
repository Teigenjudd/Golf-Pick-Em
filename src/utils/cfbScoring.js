// CFB scoring engine — pure, import-free (same discipline as src/utils/scoring.js).
// The rules-of-record are docs/CFB_FORMAT.md; this module implements them verbatim
// and is the tested source of truth. Authoritative grading runs server-side (the
// grade-cfb-week job, PR5), which mirrors this arithmetic in
// supabase/functions/_shared/cfbScoring.ts — keep the two in sync.
//
// Sign convention throughout: every spread is from the PICKED team's perspective,
// frozen at submit time as `locked_spread` (negative = your pick is favored / laying
// points; positive = your pick is the underdog / getting points). Margins are integer
// football margins from the picked team's perspective:
//
//   margin        = picked_team_score − opponent_score   (negative if your pick lost)
//   cover_margin  = margin + locked_spread               (how much they beat the spread by)
//
// A null margin means the game isn't final yet — every grader returns a null result
// and 0 points for it rather than guessing.

// ─────────────────────────────────────────────────────────────────────────────
// Double-down buffer
// ─────────────────────────────────────────────────────────────────────────────

// buffer = max(|spread| × 0.5, 4), rounded to the nearest 0.5 with quarter-point
// ties rounding UP. Because CFBD lines are at most half-points, |spread| × 0.5 is
// always an exact quarter-point (0.25/0.5/0.75/0.0 — all exact in binary float),
// so no epsilon guard is needed. Math.round rounds .5 toward +∞ for positive
// numbers, which is exactly the "ties up" rule: 4.25 → round(8.5)=9 → 4.5.
export function doubleDownBuffer(spread) {
  const raw = Math.max(Math.abs(spread) * 0.5, 4)
  return Math.round(raw * 2) / 2
}

// UI helper for the double-down copy. Returns the minimum INTEGER margin — from the
// PICKED team's perspective — needed to CLEAR the buffer and earn the +1 bonus. The
// bonus is a STRICT threshold (cover_margin > buffer), so this is the smallest
// integer strictly greater than (buffer − locked_spread); `Math.floor(t) + 1` is
// correct whether t is an integer or a half-integer (floor(13)+1 = floor(13.5)+1 = 14).
//
// Double-downs are legal on underdog ATS picks too (founder decision, see
// agents/pm/DECISIONS.md 2026-08-12), so the returned number must be read GENERALLY,
// not as a literal "win by" — its SIGN tells the UI how to phrase it:
//   • Favorite (e.g. −8.5): returns +14 → "win by 14+" (a 13-point win lands exactly
//     on the threshold and does NOT clear, which is why an inclusive "13+" is wrong).
//   • Underdog (e.g. +10):  returns −4  → the dog clears the buffer by losing by no
//     more than 4 (or winning) → phrase as "cover by more than N" / "keep it within 4".
// The number is the correct margin threshold in both cases; rendering a raw
// "win by −4" would be the UI bug the phrasing layer (PR6) must avoid.
export function doubleDownWinBy(lockedSpread) {
  const threshold = doubleDownBuffer(lockedSpread) - lockedSpread
  return Math.floor(threshold) + 1
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-pick grading
// ─────────────────────────────────────────────────────────────────────────────

// One of the 5 ATS picks. → { result: 'cover'|'push'|'miss'|null, points: 0|1 }
//   cover_margin > 0 → cover (+1);  = 0 → push (0, landed on the line);  < 0 → miss (0)
export function gradeAtsPick({ margin, lockedSpread }) {
  if (margin == null) return { result: null, points: 0 }
  const cover = margin + lockedSpread
  if (cover > 0) return { result: 'cover', points: 1 }
  if (cover === 0) return { result: 'push', points: 0 }
  return { result: 'miss', points: 0 }
}

// The bonus for the one flagged double-down ATS pick. → { bonus: 0|1 }
// +1 iff cover_margin > buffer (strictly greater); never negative — a double-down
// is pure upside. Clearing the buffer (≥ 4) implies covering, so no separate
// cover check is needed.
export function gradeDoubleDown({ margin, lockedSpread }) {
  if (margin == null) return { bonus: 0 }
  const cover = margin + lockedSpread
  return { bonus: cover > doubleDownBuffer(lockedSpread) ? 1 : 0 }
}

// Underdog tier by spread size (points on an outright win): 0 is not a real
// underdog (guards spreads below the +1.5 minimum — shouldn't occur).
//   +1.5 to +6.5 → 1 | +7 to +13.5 → 2 | +14 or more → 3
export function underdogTier(spread) {
  const s = Math.abs(spread)
  if (s >= 14) return 3
  if (s >= 7) return 2
  if (s >= 1.5) return 1
  return 0
}

// The mandatory 6th pick. Scored ONLY on an outright win (margin > 0); covering is
// irrelevant. Points are the tier value. → { result: 'win'|'loss'|null, points }
export function gradeUnderdogPick({ margin, spread }) {
  if (margin == null) return { result: null, points: 0 }
  if (margin > 0) return { result: 'win', points: underdogTier(spread) }
  return { result: 'loss', points: 0 }
}

// ─────────────────────────────────────────────────────────────────────────────
// Whole-card grading
// ─────────────────────────────────────────────────────────────────────────────

// Grade one user's full week card. `picks` is that user's rows, each enriched by
// the caller with the game's final margin from the picked team's perspective:
//   { pick_type: 'ats'|'underdog', is_double_down: bool, locked_spread, margin }
// (Computing `margin` from selected_team + game scores is the caller's join — see
// pickMargin — so this stays pure arithmetic.) Returns per-pick results carrying
// the DB's result/base_points/bonus_points columns, plus the point breakdown and
// week total.
export function gradeWeekCard(picks) {
  const graded = (picks ?? []).map(p => {
    if (p.pick_type === 'underdog') {
      const u = gradeUnderdogPick({ margin: p.margin, spread: p.locked_spread })
      return { ...p, result: u.result, base_points: u.points, bonus_points: 0 }
    }
    const a = gradeAtsPick({ margin: p.margin, lockedSpread: p.locked_spread })
    const bonus = p.is_double_down
      ? gradeDoubleDown({ margin: p.margin, lockedSpread: p.locked_spread }).bonus
      : 0
    return { ...p, result: a.result, base_points: a.points, bonus_points: bonus }
  })

  const sum = (rows, key) => rows.reduce((s, r) => s + (r[key] ?? 0), 0)
  const ats = graded.filter(g => g.pick_type === 'ats')
  const dogs = graded.filter(g => g.pick_type === 'underdog')
  const atsPoints = sum(ats, 'base_points')
  const bonusPoints = sum(graded, 'bonus_points')
  const underdogPoints = sum(dogs, 'base_points')

  return {
    picks: graded,
    atsPoints,
    bonusPoints,
    underdogPoints,
    total: atsPoints + bonusPoints + underdogPoints,
  }
}

// Caller helper: integer margin from the picked team's perspective, given a game's
// final scores. Returns null if the game isn't final or the team isn't in it.
export function pickMargin({ selectedTeam, homeTeam, awayTeam, homeScore, awayScore }) {
  if (homeScore == null || awayScore == null) return null
  if (selectedTeam === homeTeam) return homeScore - awayScore
  if (selectedTeam === awayTeam) return awayScore - homeScore
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Season standings — the shared public.pool_standings projection
// ─────────────────────────────────────────────────────────────────────────────

// Cumulative fold across every graded week → the neutral standings shape the shared
// dashboard/leaderboard render with zero sport-specific branches (Decision #3 in
// docs/CFB_BUILD_PLAN.md). CFB is higher-is-better (points accumulate), the OPPOSITE
// of golf, so this sorts DESCENDING. Ties share a rank (standard competition
// ranking: 1, 1, 3). `display` carries pre-rendered bits so the UI needs no CFB
// scoring knowledge — a name plus a subtitle like "142 pts · Week 9".
//
// entries: [{ user_id, display_name, weeks: [{ week_number, total }] }]
// throughWeek: latest graded week number, for the subtitle (optional)
// Returns rows { user_id, rank, total, display } — the caller stamps on pool_id.
export function projectSeasonStandings(entries, { throughWeek } = {}) {
  const totals = (entries ?? []).map(e => ({
    user_id: e.user_id,
    display_name: e.display_name,
    total: (e.weeks ?? []).reduce((s, w) => s + (w.total ?? 0), 0),
  }))

  totals.sort((a, b) => b.total - a.total)

  return totals.map((e, _i, arr) => ({
    user_id: e.user_id,
    rank: arr.findIndex(x => x.total === e.total) + 1,
    total: e.total,
    display: {
      name: e.display_name,
      subtitle:
        `${e.total} ${e.total === 1 ? 'pt' : 'pts'}` +
        (throughWeek != null ? ` · Week ${throughWeek}` : ''),
    },
  }))
}
