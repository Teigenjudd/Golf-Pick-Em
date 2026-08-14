import { CFB_THEME } from '../../theme/cfb'

// Horizontal segmented week scroller for the CFB pool-detail page. Rendered INSIDE
// the navy PoolHeader band (via its `children`), so it's styled for a dark ground:
// cream-on-navy chips, the active week filled with the brick accent. It scopes the
// standings expand + the widgets to a chosen week — it does NOT re-rank the season
// standings (docs/CFB_UI_PLAN.md §6). Selection lives in the page's `?week=N` param.
//
// Props:
//   weeks           — [{ id, week_number, label, status }] in week order
//   selectedNumber  — the currently selected week_number
//   onSelect(week)  — called with the week row when a chip is tapped
export default function CfbWeekSelector({ weeks, selectedNumber, onSelect }) {
  if (!weeks?.length) return null

  return (
    <div className="px-5 pt-4">
      <div
        className="flex gap-1.5 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {weeks.map(w => {
          const active = w.week_number === selectedNumber
          const graded = w.status === 'graded'
          return (
            <button
              key={w.id}
              onClick={() => onSelect(w)}
              className="flex-none font-display font-bold text-[12px] uppercase tracking-[.06em] px-[11px] py-[6px] rounded-[8px] cursor-pointer transition-colors border"
              style={
                active
                  ? { background: CFB_THEME.accent, color: CFB_THEME.cream, borderColor: CFB_THEME.accent }
                  : {
                      background: 'rgba(248,245,238,.06)',
                      color: graded ? 'rgba(248,245,238,.85)' : 'rgba(248,245,238,.55)',
                      borderColor: 'rgba(248,245,238,.14)',
                    }
              }
            >
              W{w.week_number}
            </button>
          )
        })}
      </div>
    </div>
  )
}
