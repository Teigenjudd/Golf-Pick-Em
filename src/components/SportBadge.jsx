// Badge art is stored per-event in `badge_config`:
//   { line1: 'THE', line2: 'OPEN', bg: '#162258', border: '#C9A368' }
// Shape and type never change — only the copy and the two colors do. Line 1 always
// renders cream; line 2 always renders in the border color. Color encodes prestige +
// geography (majors get signature palettes, tour events follow a regional system).

const SIZES = {
  sm:   { w: 36, h: 42, r: '8px 8px 18px 18px',   base: 13, sub: 5.5 },
  md:   { w: 40, h: 46, r: '10px 10px 20px 20px', base: 14, sub: 6 },
  pick: { w: 44, h: 50, r: '11px 11px 22px 22px', base: 16, sub: 7 },
  lg:   { w: 52, h: 60, r: '13px 13px 26px 26px', base: 19, sub: 8,
          shadow: '0 8px 18px -8px rgba(0,0,0,.4)' },
}

const DEFAULT_BADGE = { line1: 'GO', line2: 'GOLF', bg: '#1F6F47', border: '#E6C66B' }

const TEXT = '#F8F5EE'

// Longer abbreviations shrink so a 4-char code still fits the shield.
const LENGTH_SCALE = { 2: 1, 3: 0.86, 4: 0.77 }

function line1Size(text, base) {
  const scale = LENGTH_SCALE[Math.max(text.length, 2)] ?? 0.64
  return Math.round(base * scale * 2) / 2
}

export default function SportBadge({ config, size = 'md' }) {
  const c = SIZES[size] ?? SIZES.md

  // Pre-color-system rows stored an array of text lines. Render them the old way so a
  // half-migrated database degrades to the old badge instead of blanking out.
  if (Array.isArray(config)) return <LegacyBadge lines={config} c={c} />

  const badge = config ?? DEFAULT_BADGE
  const bg = badge.bg ?? DEFAULT_BADGE.bg
  const border = badge.border ?? DEFAULT_BADGE.border

  return (
    <div
      className="flex-none flex flex-col items-center justify-center"
      style={{
        width: c.w, height: c.h,
        background: bg,
        border: `2px solid ${border}`,
        borderRadius: c.r,
        boxShadow: c.shadow,
        gap: 1,
      }}
    >
      <span
        className="font-display"
        style={{
          fontSize: line1Size(badge.line1 ?? '', c.base),
          fontWeight: 800,
          color: TEXT,
          lineHeight: '.82',
          letterSpacing: '.02em',
        }}
      >
        {badge.line1}
      </span>
      {badge.line2 && (
        <span
          className="font-display"
          style={{ fontSize: c.sub, fontWeight: 700, color: border, letterSpacing: '.06em' }}
        >
          {badge.line2}
        </span>
      )}
    </div>
  )
}

const LEGACY_COLORS = {
  cream:    '#F8F5EE',
  gold:     '#C9A368',
  fairway:  '#1B4332',
  charcoal: '#2D2D2A',
  white:    '#FFFFFF',
}

function LegacyBadge({ lines, c }) {
  return (
    <div
      className="flex-none flex flex-col items-center justify-center"
      style={{
        width: c.w, height: c.h,
        background: DEFAULT_BADGE.bg,
        border: `2px solid ${DEFAULT_BADGE.border}`,
        borderRadius: c.r,
        boxShadow: c.shadow,
      }}
    >
      {lines.map((line, i) => (
        <span
          key={i}
          className="font-display"
          style={{
            fontSize: line.size ?? (i === 0 ? c.base : c.sub),
            fontWeight: line.weight ?? 700,
            color: LEGACY_COLORS[line.color] ?? line.color ?? TEXT,
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
