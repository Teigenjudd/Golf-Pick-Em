import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import AdminSportSwitcher from './AdminSportSwitcher'

// Shared chrome for every admin surface — golf Pools, CFB Pools, and the
// sport-agnostic Users & Settings page — so the three read as one admin area
// with a sport dimension, not three disconnected panels. One container width
// (max-w-3xl) across all three is the "unified look": each page still owns its
// own body content, only the shell (nav + sport switcher) is shared.
//
// `activeSport` — 'golf' | 'cfb' | null. Null on Users & Settings (a
// sport-agnostic page): AdminSportSwitcher renders both segments unselected,
// and the current page reads as a plain label instead of a link to itself.
export default function AdminShell({ activeSport = null, children }) {
  const { signOut } = useAuth()

  return (
    <div className="min-h-screen bg-sand pb-12">
      <div className="bg-white border-b border-[#EAD8C4] px-[18px] h-14 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-[14px]">
          <Link to="/dashboard" className="text-[13px] text-warm-400 no-underline">← Dashboard</Link>
          <span className="text-[#EAD8C4] text-base select-none">|</span>
          <span className="font-display font-extrabold text-[22px] text-brand tracking-[.06em]">POOLD</span>
          <span className="font-display font-bold text-[16px] text-[#1C1610] tracking-[.04em]">Admin</span>
        </div>
        <button onClick={signOut} className="text-[12px] text-[#C8B8A4] bg-transparent border-none cursor-pointer">
          Sign out
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-[18px] pt-[22px]">
        <div className="flex items-center justify-between gap-3 mb-[18px] flex-wrap">
          <AdminSportSwitcher active={activeSport} size="lg" />
          {activeSport ? (
            <Link
              to="/admin/users"
              className="text-[13px] font-semibold text-warm-400 hover:text-charcoal no-underline transition-colors"
            >
              Users & Settings →
            </Link>
          ) : (
            <span className="text-[13px] font-semibold text-[#1C1610]">Users & Settings</span>
          )}
        </div>

        {children}
      </div>
    </div>
  )
}
