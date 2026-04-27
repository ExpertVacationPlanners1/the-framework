import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      if (session?.user) {
        setUser(session.user)
        loadProfile(session.user.id, mounted)
      } else {
        setLoading(false)
      }
    }).catch(() => {
      if (mounted) setLoading(false)
    })

    // Listen for auth changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (session?.user) {
        setUser(session.user)
        if (event === 'SIGNED_IN') {
          loadProfile(session.user.id, mounted)
        }
      } else {
        setUser(null)
        setProfile(null)
        setSettings(null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const loadProfile = async (userId, mounted = true) => {
    try {
      const [profileRes, settingsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle()
      ])
      if (!mounted) return
      setProfile(profileRes.data || null)
      setSettings(settingsRes.data || null)
    } catch {
      // Profile may not exist yet — that's ok
    } finally {
      if (mounted) setLoading(false)
    }
  }

  const refreshProfile = async () => {
    if (!user) return
    await loadProfile(user.id)
  }

  return (
    <AuthContext.Provider value={{ user, profile, settings, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
