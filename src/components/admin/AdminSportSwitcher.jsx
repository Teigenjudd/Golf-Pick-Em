import { Link } from 'react-router-dom'

// Sport navigation for the admin area — a segmented Golf | CFB control shared by the
// golf AdminDashboard and the CFB CfbAdmin header so the two read as one admin area
// with a sport dimension (rather than two disconnected panels). `active` is the sport
// being viewed ('golf' | 'cfb'); the other segment links to that sport's admin panel.
// Sport-agnostic admin chrome (general register). When a third sport lands, add a row
// here and both panels pick it up.

const SPORTS = [
  { key: 'golf', label: 'Golf', to: '/admin' },
  { key: 'cfb', label: 'CFB', to: '/admin/cfb' },
]

const SIZES = {
  sm: { wrap: 'rounded-[9px] p-[3px]',  seg: 'px-[13px] py-[4px] rounded-[7px] text-[12.5px]' },
  lg: { wrap: 'rounded-[11px] p-[4px]', seg: 'px-[20px] py-[7px] rounded-[8px] text-[14px]' },
}

export default function AdminSportSwitcher({ active, size = 'sm' }) {
  const s = SIZES[size] ?? SIZES.sm
  return (
    <div className={`inline-flex gap-[2px] bg-[#EAD8C4] ${s.wrap}`}>
      {SPORTS.map(sport =>
        sport.key === active ? (
          <span
            key={sport.key}
            className={`${s.seg} font-semibold bg-white text-[#1C1610]`}
          >
            {sport.label}
          </span>
        ) : (
          <Link
            key={sport.key}
            to={sport.to}
            className={`${s.seg} font-semibold text-[#7A6858] no-underline hover:text-[#1C1610] transition-colors`}
          >
            {sport.label}
          </Link>
        ),
      )}
    </div>
  )
}
