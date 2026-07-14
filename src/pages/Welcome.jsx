import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { saveDisplayName, validateDisplayName, randomNamePlaceholder, NAME_MAX } from '../lib/profile'

// Only ever bounce back to a path inside the app — "//evil.com" is a valid URL,
// so checking for a leading "/" alone is not enough.
function safeNext(raw) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/dashboard'
  return raw
}

export default function Welcome() {
  const { user, profile, loading, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [placeholder] = useState(randomNamePlaceholder)

  if (loading) return null
  if (!user) return <Navigate to="/" replace />
  // Already named — nothing to do here (e.g. someone typing /welcome by hand).
  if (profile?.display_name) return <Navigate to={safeNext(params.get('next'))} replace />

  async function handleSubmit(e) {
    e.preventDefault()
    const invalid = validateDisplayName(name)
    if (invalid) { setError(invalid); return }

    setSaving(true)
    setError(null)
    const saveError = await saveDisplayName(user.id, name)
    if (saveError) {
      setError(saveError.message)
      setSaving(false)
      return
    }
    await refreshProfile()
    navigate(safeNext(params.get('next')), { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-sand px-5 py-10">
      <div className="w-full max-w-[360px]">

        <div className="text-center mb-7">
          <div className="font-display font-extrabold text-[54px] text-brand tracking-[.08em] leading-none">POOLD</div>
          <div className="font-display italic font-semibold text-[15px] text-warm-400 mt-[5px]">Make it interesting.</div>
        </div>

        <div className="bg-white border border-[#EAD8C4] rounded-2xl px-6 py-7 shadow-[0_4px_24px_rgba(28,22,16,.07)]">
          <div className="font-display font-bold text-[11px] uppercase tracking-[.2em] text-gold mb-1.5">
            One thing first
          </div>
          <div className="font-display font-extrabold text-[26px] text-[#1C1610] leading-none mb-1.5">
            What should we call you?
          </div>
          <p className="text-[13px] text-warm-400 leading-[1.5] mb-5">
            This is the name on your card — it&apos;s what everyone else in the pool sees on the leaderboard.
          </p>

          <form onSubmit={handleSubmit}>
            <input
              autoFocus
              value={name}
              maxLength={NAME_MAX}
              onChange={e => { setName(e.target.value); setError(null) }}
              placeholder={placeholder}
              className="w-full px-[15px] py-[13px] border-[1.5px] border-[#EAD8C4] rounded-[11px] text-[15px] text-[#1C1610] bg-[#FFFAF6] outline-none placeholder:text-warm-300"
            />
            {error && <p className="text-[13px] text-birdie mt-2.5 mb-0">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-brand text-white font-bold text-[15px] py-[14px] rounded-[11px] border-none cursor-pointer disabled:opacity-50 mt-[14px]"
            >
              {saving ? 'Saving…' : 'Jump in →'}
            </button>
          </form>

          <p className="text-[11.5px] text-warm-300 leading-[1.5] mt-3.5 mb-0 text-center">
            You can change it any time from the You tab.
          </p>
        </div>

      </div>
    </div>
  )
}
