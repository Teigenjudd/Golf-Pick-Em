const SIZES = {
  sm:   { w: 36, h: 42, r: '8px 8px 18px 18px' },
  md:   { w: 40, h: 46, r: '9px 9px 20px 20px' },
  pick: { w: 44, h: 50, r: '10px 10px 22px 22px' },
  lg:   { w: 52, h: 60, r: '13px 13px 26px 26px', shadow: '0 8px 18px -8px rgba(0,0,0,.4)' },
}

// Fallback font sizes when no config is stored
const DEFAULT_SIZES = { sm: [13, 6.5], md: [14, 7], pick: [16, 7], lg: [19, 8] }

const COLOR_MAP = {
  cream:    '#F8F5EE',
  gold:     '#C9A368',
  fairway:  '#1B4332',
  charcoal: '#2D2D2A',
  white:    '#FFFFFF',
}

function resolveColor(color) {
  if (!color) return '#F8F5EE'
  return COLOR_MAP[color] ?? color   // falls through to raw hex
}

// config: array of { text, size, weight, color }
// Falls back to GO/GOLF in container-appropriate sizes when config is absent.
export default function SportBadge({ config, size = 'md' }) {
  const c = SIZES[size] ?? SIZES.md
  const defaults = DEFAULT_SIZES[size] ?? DEFAULT_SIZES.md

  const lines = config ?? [
    { text: 'GO',   size: defaults[0], weight: 800, color: 'cream' },
    { text: 'GOLF', size: defaults[1], weight: 700, color: 'gold'  },
  ]

  return (
    <div
      className="flex-none flex flex-col items-center justify-center"
      style={{
        width: c.w, height: c.h,
        background: '#1F6F47',
        border: '2px solid #E6C66B',
        borderRadius: c.r,
        boxShadow: c.shadow,
      }}
    >
      {lines.map((line, i) => (
        <span
          key={i}
          className="font-display"
          style={{
            fontSize: line.size ?? defaults[Math.min(i, defaults.length - 1)],
            fontWeight: line.weight ?? 700,
            color: resolveColor(line.color),
            lineHeight: i === 0 ? '.85' : 'normal',
            letterSpacing: i > 0 ? '.04em' : undefined,
          }}
        >
          {line.text}
        </span>
      ))}
    </div>
  )
}
