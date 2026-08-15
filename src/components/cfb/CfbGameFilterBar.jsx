import { CFB_THEME } from '../../theme/cfb'

// Search + conference filter + sort for the weekly picks game list (docs/CFB_UI_PLAN.md
// §7 follow-up). Purely a view-layer convenience — CfbPicks.jsx filters/sorts the games
// it renders, but pick state (slots, validity, submit payload) always stays keyed off the
// full, unfiltered game list. Presentational only.
//
// Props:
//   search, onSearchChange(value)
//   conferences        — string[], every conference in play this week (already deduped/sorted)
//   selectedConferences — Set<string>; empty set means "all"
//   onToggleConference(conf)
//   sortBy, onSortChange(value)         — 'kickoff' | 'alpha' | 'spread'

const SORT_OPTIONS = [
  { value: 'kickoff', label: 'Kickoff' },
  { value: 'alpha', label: 'A–Z' },
  { value: 'spread', label: 'Closest spread' },
]

export default function CfbGameFilterBar({
  search, onSearchChange,
  conferences, selectedConferences, onToggleConference,
  sortBy, onSortChange,
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-[8px]">
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search teams…"
          className="flex-1 min-w-0 rounded-[10px] px-3 py-[9px] text-[13px] outline-none border"
          style={{ background: CFB_THEME.cardWhite, borderColor: CFB_THEME.border, color: CFB_THEME.ink }}
        />
        <div
          className="flex items-center gap-[5px] rounded-[10px] pl-[8px] pr-[6px] py-[7px] border"
          style={{ background: CFB_THEME.cardWhite, borderColor: CFB_THEME.border }}
        >
          {/* Standard "sort" glyph (arrows pointing opposite ways) — reads as a sort
              control at a glance, rather than just another filter dropdown. */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={CFB_THEME.muted2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 16 4 4 4-4" />
            <path d="M7 20V4" />
            <path d="m21 8-4-4-4 4" />
            <path d="M17 4v16" />
          </svg>
          <select
            value={sortBy}
            onChange={e => onSortChange(e.target.value)}
            className="text-[12.5px] font-semibold outline-none border-none bg-transparent cursor-pointer"
            style={{ color: CFB_THEME.muted2 }}
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {conferences.length > 1 && (
        <div className="flex flex-wrap items-center gap-[6px] mt-[8px]">
          <button
            type="button"
            onClick={() => onToggleConference(null)}
            className="px-[10px] py-[5px] rounded-full border text-[11.5px] font-semibold cursor-pointer transition-colors"
            style={
              selectedConferences.size === 0
                ? { background: CFB_THEME.accent, borderColor: CFB_THEME.accent, color: CFB_THEME.cream }
                : { background: 'transparent', borderColor: CFB_THEME.border, color: CFB_THEME.muted2 }
            }
          >
            All
          </button>
          {conferences.map(conf => {
            const active = selectedConferences.has(conf)
            return (
              <button
                key={conf}
                type="button"
                onClick={() => onToggleConference(conf)}
                className="px-[10px] py-[5px] rounded-full border text-[11.5px] font-semibold cursor-pointer transition-colors"
                style={
                  active
                    ? { background: CFB_THEME.accent, borderColor: CFB_THEME.accent, color: CFB_THEME.cream }
                    : { background: 'transparent', borderColor: CFB_THEME.border, color: CFB_THEME.muted2 }
                }
              >
                {conf}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
