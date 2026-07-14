import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getInitials } from '../utils/format'

const NUDGE_DISMISSED_KEY = 'poold.nameNudgeDismissed'
const NUDGE_VISIBLE_MS = 9000

/**
 * Sticky bottom nav for the signed-in shell (Dashboard, Profile).
 *
 * The "You" tab also carries the display-name nudge: accounts created before
 * onboarding existed still wear their email local-part as a name, and most
 * people never see the login screen again (Supabase keeps the session alive and
 * they go straight to /dashboard), so the prompt has to find them here. It shows
 * once, briefly, and stops for good once they dismiss it or set a name.
 */
export default function BottomNav({ active }) {
  const { profile } = useAuth()
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem(NUDGE_DISMISSED_KEY))
  const [expired, setExpired] = useState(false)

  const needsName = !!profile && !profile.display_name_set_at
  const nudge = needsName && active !== 'you' && !dismissed && !expired

  // Short-lived on purpose: it says its piece and gets out of the way.
  useEffect(() => {
    if (!nudge) return
    const t = setTimeout(() => setExpired(true), NUDGE_VISIBLE_MS)
    return () => clearTimeout(t)
  }, [nudge])

  function dismissNudge() {
    localStorage.setItem(NUDGE_DISMISSED_KEY, '1')
    setDismissed(true)
  }

  const initials = getInitials(profile?.display_name)

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-sand border-t border-[#EAD8C4] flex justify-around items-start pt-2.5 z-10">

      <Link to="/dashboard" className="flex flex-col items-center gap-[3px] no-underline">
        <div
          className="w-[26px] h-[26px] rounded-[8px] flex items-center justify-center"
          style={
            active === 'pools'
              ? { background: 'rgba(193,74,24,.12)', border: '1px solid rgba(193,74,24,.28)' }
              : { border: '1px solid #C8B8A4' }
          }
        >
          <span className={`font-display font-extrabold text-[13px] ${active === 'pools' ? 'text-brand' : 'text-[#B8A890]'}`}>P</span>
        </div>
        <span className={`text-[10px] ${active === 'pools' ? 'font-semibold text-brand' : 'text-[#B8A890]'}`}>Pools</span>
      </Link>

      <div className="flex flex-col items-center gap-1 pt-0.5">
        <div className="flex flex-col gap-[3px] w-[22px]">
          <div className="h-[2.5px] bg-[#C8B8A4] rounded-sm" />
          <div className="h-[2.5px] bg-[#C8B8A4] rounded-sm w-4" />
          <div className="h-[2.5px] bg-[#C8B8A4] rounded-sm w-2.5" />
        </div>
        <span className="text-[10px] text-[#B8A890]">Board</span>
      </div>

      <div className="relative flex flex-col items-center">
        {nudge && (
          <div
            className="absolute bottom-[52px] right-0 w-[214px] bg-white border border-[#EAD8C4] rounded-[13px] px-[13px] py-[11px] text-left shadow-[0_6px_20px_rgba(28,22,16,.13)]"
            style={{ animation: 'nudgeIn .28s ease-out' }}
          >
            <button
              onClick={dismissNudge}
              aria-label="Dismiss"
              className="absolute top-[7px] right-[9px] text-[15px] leading-none text-warm-300 bg-transparent border-none cursor-pointer p-0"
            >
              ×
            </button>
            <div className="font-display font-bold text-[10px] uppercase tracking-[.16em] text-gold mb-[3px]">
              Still nameless
            </div>
            <p className="text-[12.5px] text-warm-500 leading-[1.45] m-0 pr-2">
              You haven&apos;t set a display name yet — tap here to set one.
            </p>
            {/* pointer into the You tab */}
            <div className="absolute -bottom-[6px] right-[18px] w-3 h-3 bg-white border-r border-b border-[#EAD8C4] rotate-45" />
          </div>
        )}

        <Link
          to="/profile"
          onClick={() => nudge && dismissNudge()}
          className="flex flex-col items-center gap-[3px] no-underline"
        >
          <div
            className={`w-[26px] h-[26px] rounded-full flex items-center justify-center ${
              active === 'you' ? 'bg-brand' : 'border-2 border-[#C8B8A4]'
            }`}
            style={nudge ? { animation: 'nudgePulse 1.6s ease-in-out infinite' } : undefined}
          >
            <span className={`font-display font-bold text-[10px] ${active === 'you' ? 'text-white' : 'text-[#B8A890]'}`}>
              {initials}
            </span>
          </div>
          <span className={`text-[10px] ${active === 'you' ? 'font-semibold text-brand' : 'text-[#B8A890]'}`}>You</span>
        </Link>
      </div>

    </div>
  )
}
