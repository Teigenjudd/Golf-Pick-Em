import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId, { retries = 5, delay = 400 } = {}) {
    // On a brand-new signup the profiles row is created by a DB trigger a beat
    // after the auth user exists, so the first read can come back empty. Retry
    // through that gap instead of settling on null — a null profile is what used
    // to strand new users on the "Signing you in…" spinner forever (backlog C1).
    for (let attempt = 0; attempt <= retries; attempt++) {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, display_name_set_at, role, status, created_at')
        .eq('id', userId)
        .maybeSingle()
      if (data) {
        setProfile(data)
        return data
      }
      if (attempt < retries) await new Promise((r) => setTimeout(r, delay))
    }
    setProfile(null)
    return null
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
