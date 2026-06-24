const SIZES = {
  sm:   { w: 36, h: 42, r: '8px 8px 18px 18px',   l1: 13, l2: 6.5 },
  md:   { w: 40, h: 46, r: '9px 9px 20px 20px',   l1: 14, l2: 7 },
  pick: { w: 44, h: 50, r: '10px 10px 22px 22px', l1: 16, l2: 7 },
  lg:   { w: 52, h: 60, r: '13px 13px 26px 26px', l1: 19, l2: 8, shadow: '0 8px 18px -8px rgba(0,0,0,.4)' },
}

export default function SportBadge({ line1 = 'GO', line2 = 'GOLF', size = 'md' }) {
  const c = SIZES[size] ?? SIZES.md
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
      <span
        className="font-display font-extrabold text-cream leading-[.85]"
        style={{ fontSize: c.l1 }}
      >
        {line1}
      </span>
      <span
        className="font-display font-bold text-gold tracking-[.04em]"
        style={{ fontSize: c.l2 }}
      >
        {line2}
      </span>
    </div>
  )
}
