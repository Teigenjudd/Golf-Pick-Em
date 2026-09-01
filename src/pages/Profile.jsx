import { useState, useRef } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  saveDisplayName, validateDisplayName, randomNamePlaceholder, NAME_MAX,
  savePassword, validatePassword,
  uploadAvatarForUser, saveAvatarUrl,
} from '../lib/profile'
import Avatar from '../components/Avatar'
import AvatarCropModal from '../components/AvatarCropModal'
import Footer from '../components/Footer'

export default function Profile() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth()

  // null = untouched, so the field tracks the profile until the user types into
  // it. Saving resets to null, which re-syncs it to whatever the DB now holds.
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [placeholder] = useState(randomNamePlaceholder)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState(null)
  const [pwSaving, setPwSaving] = useState(false)
  const [pwSaved, setPwSaved] = useState(false)

  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState(null)
  const [cropFile, setCropFile] = useState(null)
  const fileInputRef = useRef(null)

  if (loading) return null
  if (!user) return <Navigate to="/" replace />

  const name = draft ?? profile?.display_name ?? ''
  const dirty = name.trim() !== (profile?.display_name ?? '')
  // Pre-onboarding accounts still wear the local-part of their email as a name.
  const neverChosen = profile && !profile.display_name_set_at

  async function handleSubmit(e) {
    e.preventDefault()
    const invalid = validateDisplayName(name)
    if (invalid) { setError(invalid); return }

    setSaving(true)
    setError(null)
    const saveError = await saveDisplayName(user.id, name)
    setSaving(false)
    if (saveError) { setError(saveError.message); return }

    await refreshProfile()
    setDraft(null)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    const invalid = validatePassword(password)
    if (invalid) { setPwError(invalid); return }
    if (password !== confirmPassword) { setPwError("Passwords don't match."); return }

    setPwSaving(true)
    setPwError(null)
    const saveError = await savePassword(password)
    setPwSaving(false)
    if (saveError) { setPwError(saveError.message); return }

    setPassword('')
    setConfirmPassword('')
    setPwSaved(true)
    setTimeout(() => setPwSaved(false), 2500)
  }

  function handleFilePicked(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // lets the user re-pick the same file later if they retry
    if (!file) return
    setAvatarError(null)
    setCropFile(file)
  }

  async function handleCropped(blob) {
    setCropFile(null)
    setAvatarUploading(true)
    setAvatarError(null)
    const { url, error: uploadError } = await uploadAvatarForUser(user.id, blob)
    if (uploadError) { setAvatarError(uploadError.message); setAvatarUploading(false); return }

    const saveError = await saveAvatarUrl(user.id, url)
    setAvatarUploading(false)
    if (saveError) { setAvatarError(saveError.message); return }

    await refreshProfile()
  }

  return (
    <div className="min-h-screen bg-sand pb-10 flex flex-col">

      <div className="bg-white border-b border-[#EAD8C4] px-[18px] h-14 flex items-center justify-between sticky top-0 z-10">
        <Link to="/dashboard" className="font-display font-extrabold text-[26px] text-brand tracking-[.07em] no-underline">POOLD</Link>
      </div>

      <div className="max-w-[480px] mx-auto px-[18px] pt-[22px]">

        {/* Identity block */}
        <div className="flex items-center gap-[13px] mb-[10px]">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
            title="Change photo"
            className="relative rounded-full border-none bg-transparent p-0 cursor-pointer flex-none disabled:opacity-60"
          >
            <Avatar name={profile?.display_name} avatarUrl={profile?.avatar_url} size={54} bg="#C14A18" textColor="#FFFFFF" />
            <span className="absolute -bottom-[2px] -right-[2px] w-[20px] h-[20px] rounded-full bg-charcoal border-2 border-sand flex items-center justify-center">
              <span className="font-display font-bold text-[13px] text-white leading-none">+</span>
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFilePicked}
            className="hidden"
          />
          <div className="min-w-0">
            <div className="font-display font-extrabold text-[30px] text-[#1C1610] leading-none truncate">
              {profile?.display_name ?? 'You'}
            </div>
            <div className="text-[12px] text-warm-400 mt-[3px]">
              {profile?.role === 'admin' ? 'Admin' : 'Player'}
            </div>
          </div>
        </div>

        <div className="mb-[22px]">
          {avatarUploading && <p className="text-[12px] text-warm-400 m-0">Uploading…</p>}
          {avatarError && <p className="text-[12px] text-birdie m-0">{avatarError}</p>}
        </div>

        <div className="font-display font-bold text-[10px] uppercase tracking-[.22em] text-warm-400 mb-[10px]">
          Display Name
        </div>

        <div className="bg-white border border-[#EAD8C4] rounded-2xl px-[18px] py-5 mb-5">
          {neverChosen && (
            <div className="rounded-[11px] bg-gold/10 border border-gold/30 px-[13px] py-[10px] mb-4">
              <p className="text-[12.5px] text-warm-500 leading-[1.45] m-0">
                Your display name is currently your email address. You can change it to anything you want.
              </p>
            </div>
          )}

          <p className="text-[13px] text-warm-400 leading-[1.5] mt-0 mb-[14px]">
            This is the only thing other players see on the leaderboard and on your card.
          </p>

          <form onSubmit={handleSubmit}>
            <input
              value={name}
              maxLength={NAME_MAX}
              onChange={e => { setDraft(e.target.value); setError(null); setSaved(false) }}
              placeholder={placeholder}
              className="w-full px-[15px] py-[13px] border-[1.5px] border-[#EAD8C4] rounded-[11px] text-[15px] text-[#1C1610] bg-[#FFFAF6] outline-none placeholder:text-warm-300"
            />
            {error && <p className="text-[13px] text-birdie mt-2.5 mb-0">{error}</p>}

            <div className="flex items-center gap-3 mt-[14px]">
              <button
                type="submit"
                disabled={saving || !dirty}
                className="bg-brand text-white font-bold text-[14px] py-3 px-5 rounded-[11px] border-none cursor-pointer disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              {saved && <span className="text-[12.5px] font-semibold text-fairway">Saved.</span>}
            </div>
          </form>
        </div>

        <div className="font-display font-bold text-[10px] uppercase tracking-[.22em] text-warm-400 mb-[10px]">
          Password
        </div>

        <div className="bg-white border border-[#EAD8C4] rounded-2xl px-[18px] py-5 mb-5">
          <p className="text-[13px] text-warm-400 leading-[1.5] mt-0 mb-[14px]">
            Set a password so you don&apos;t have to wait on an email every time. You can
            always fall back to a sign-in link — if you ever forget your password, sign
            in with a link and set a new one here.
          </p>

          <form onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={e => { setPassword(e.target.value); setPwError(null); setPwSaved(false) }}
              placeholder="New password"
              className="w-full px-[15px] py-[13px] border-[1.5px] border-[#EAD8C4] rounded-[11px] text-[15px] text-[#1C1610] bg-[#FFFAF6] outline-none placeholder:text-warm-300 mb-2.5"
            />
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setPwError(null); setPwSaved(false) }}
              placeholder="Confirm password"
              className="w-full px-[15px] py-[13px] border-[1.5px] border-[#EAD8C4] rounded-[11px] text-[15px] text-[#1C1610] bg-[#FFFAF6] outline-none placeholder:text-warm-300"
            />
            {pwError && <p className="text-[13px] text-birdie mt-2.5 mb-0">{pwError}</p>}

            <div className="flex items-center gap-3 mt-[14px]">
              <button
                type="submit"
                disabled={pwSaving || !password}
                className="bg-brand text-white font-bold text-[14px] py-3 px-5 rounded-[11px] border-none cursor-pointer disabled:opacity-40"
              >
                {pwSaving ? 'Saving…' : 'Save password'}
              </button>
              {pwSaved && <span className="text-[12.5px] font-semibold text-fairway">Saved.</span>}
            </div>
          </form>
        </div>

        <div className="text-right">
          <button onClick={signOut} className="text-[12px] text-[#C8B8A4] bg-transparent border-none cursor-pointer">
            Sign out
          </button>
        </div>

      </div>

      {/* mt-auto: sit at the foot of the page, not wherever the content happens to end */}
      <div className="mt-auto">
        <Footer />
      </div>

      {cropFile && (
        <AvatarCropModal
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onCropped={handleCropped}
        />
      )}
    </div>
  )
}
