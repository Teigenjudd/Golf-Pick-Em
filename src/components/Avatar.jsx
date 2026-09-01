import { getInitials } from '../utils/format'

// Shared avatar: the uploaded photo if avatarUrl is set, else the existing
// initials-on-a-plain-background circle. One component so every surface that
// shows a player (Profile, header, admin, leaderboards) can't drift.
export default function Avatar({ name, avatarUrl, size = 36, bg = '#9E9488', textColor = '#F8F5EE', className = '' }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        width={size}
        height={size}
        className={`rounded-full object-cover flex-none ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      className={`rounded-full flex items-center justify-center flex-none font-display font-bold leading-none ${className}`}
      style={{ width: size, height: size, background: bg, color: textColor, fontSize: Math.round(size * 0.4) }}
    >
      {getInitials(name)}
    </span>
  )
}
