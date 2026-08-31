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
