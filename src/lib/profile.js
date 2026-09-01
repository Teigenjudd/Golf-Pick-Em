import { supabase } from './supabase'

export const NAME_MIN = 2
export const NAME_MAX = 24

// Mirrors the profiles_display_name_length CHECK constraint. Keep the two in step:
// the DB is the real gate, this is just so the user hears about it before saving.
export function validateDisplayName(raw) {
  const name = (raw ?? '').trim()
  if (name.length < NAME_MIN) return 'Give yourself at least 2 characters.'
  if (name.length > NAME_MAX) return `Keep it under ${NAME_MAX} characters.`
  return null
}

// Placeholder only — never saved. One is picked at random each time the field
// mounts, so the empty state has a bit of the group-chat energy the pools do.
// Keep every entry inside NAME_MAX so it can't suggest a name that won't save.
const NAME_PLACEHOLDERS = [
  'Tiger Woods',
  'Scottie Scheffler',
  'Arnold Palmer',
  'Jack Nicklaus',
  'Rory McIlroy',
  'Annika Sorenstam',
  'Phil Mickelson',
  'Seve Ballesteros',
  'Nelly Korda',
  'Ben Hogan',
]

export function randomNamePlaceholder() {
  return NAME_PLACEHOLDERS[Math.floor(Math.random() * NAME_PLACEHOLDERS.length)]
}

// display_name is the only column a user may write on their own row
// (GRANT UPDATE (display_name), migration 20260714000000). display_name_set_at is
// stamped by a DB trigger, so it is deliberately not sent from here.
export async function saveDisplayName(userId, raw) {
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: raw.trim() })
    .eq('id', userId)
  return error
}

export const PASSWORD_MIN = 8

// Client-side heads-up only -- the real gate is whatever minimum length is
// configured in the Supabase Dashboard (Authentication > Policies). Keep this at
// least as strict as that setting.
export function validatePassword(raw) {
  if ((raw ?? '').length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`
  return null
}

// Sets/replaces the password on the signed-in user's own account. No "current
// password" step: being signed in at all (via a sign-in link or an existing
// password) is enough to set a new one. This doubles as the password-reset path --
// forgot it, sign in with a link, come back here and set a new one.
export async function savePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  return error
}

const AVATAR_MAX_BYTES = 5 * 1024 * 1024
const AVATAR_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

// Client-side heads-up only -- the avatars bucket enforces both server-side too
// (20260831020000_profile_avatars.sql), so a request that skips this never
// actually gets through.
export function validateAvatarFile(file) {
  if (!AVATAR_TYPES[file.type]) return 'Use a JPEG, PNG, or WebP image.'
  if (file.size > AVATAR_MAX_BYTES) return 'Keep it under 5MB.'
  return null
}

// Uploads to a fixed per-user path (userId/avatar.<ext>) with upsert so a
// re-upload replaces the old file instead of piling up orphans, and stamps a
// cache-busting query param onto the stored URL so the new photo shows up
// immediately instead of whatever was cached at that same path/filename.
// targetUserId is a separate param from the caller's own id so an admin can
// upload on someone else's behalf -- the avatars bucket's storage policies
// (same migration) allow that for admins, self-only otherwise.
export async function uploadAvatarForUser(targetUserId, file) {
  const invalid = validateAvatarFile(file)
  if (invalid) return { url: null, error: new Error(invalid) }

  const ext = AVATAR_TYPES[file.type]
  const path = `${targetUserId}/avatar.${ext}`
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (uploadError) return { url: null, error: uploadError }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return { url: `${data.publicUrl}?v=${Date.now()}`, error: null }
}

// Self-service write -- same GRANT UPDATE (avatar_url) path as display_name.
export async function saveAvatarUrl(userId, url) {
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: url })
    .eq('id', userId)
  return error
}
