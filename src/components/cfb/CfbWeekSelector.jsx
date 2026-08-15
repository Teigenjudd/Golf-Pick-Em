import { CFB_THEME } from '../../theme/cfb'

// Week selector for the CFB pool-detail page. Rendered INSIDE the navy PoolHeader
// band (via its `children`), so it's styled to sit quietly on that dark ground —
// translucent cream-on-navy, same treatment the old chip row used for its unselected
// state, no high-contrast fill. It scopes the standings expand + the widgets to a
// chosen week — it does NOT re-rank the season standings (docs/CFB_UI_PLAN.md §6).
// Selection lives in the page's `?week=N` param.
//
// Props:
//   weeks           — [{ id, week_number, label, status }] in week order
//   selectedNumber  — the currently selected week_number
//   onSelect(week)  — called with the week row when a new week is chosen
export default function CfbWeekSelector({ weeks, selectedNumber, onSelect }) {
  if (!weeks?.length) return null

  function handleChange(e) {
    const w = weeks.find(wk => wk.week_number === Number(e.target.value))
    if (w) onSelect(w)
  }

  return (
    <div className="px-5 pt-4">
      <div className="relative inline-block">
        <select
          value={selectedNumber ?? ''}
          onChange={handleChange}
          className="appearance-none font-display font-bold text-[12px] uppercase tracking-[.06em] pl-[11px] pr-[30px] py-[7px] rounded-[8px] cursor-pointer border outline-none"
          style={{
            background: 'rgba(248,245,238,.06)',
            color: 'rgba(248,245,238,.85)',
            borderColor: 'rgba(248,245,238,.14)',
          }}
        >
          {weeks.map(w => (
            // The popup renders on the OS's native white/light background, not the navy
            // header — an option only inherits the <select>'s translucent cream text
            // color if left unstyled, which is invisible there. Set an explicit dark
            // color + white background so the open list is actually readable.
            <option key={w.id} value={w.week_number} style={{ color: CFB_THEME.ink, background: CFB_THEME.cardWhite }}>
              {w.label ?? `Week ${w.week_number}`}{w.status === 'graded' ? ' · Final' : ''}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-[9px] top-1/2 -translate-y-1/2"
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="rgba(248,245,238,.55)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  )
}
