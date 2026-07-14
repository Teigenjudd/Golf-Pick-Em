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
