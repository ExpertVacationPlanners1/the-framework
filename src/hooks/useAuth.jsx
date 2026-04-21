import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) await loadProfile(session.user.id)
      else {
        setProfile(null)
        setSettings(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadProfile = async (userId) => {
    try {
      const [profileRes, settingsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('user_settings').select('*').eq('user_id', userId).single()
      ])
      setProfile(profileRes.data)
      setSettings(settingsRes.data)
    } catch (err) {
      console.error('Profile load error:', err)
    } finally {
      setLoading(false)
    }
  }

  const refreshProfile = () => user && loadProfile(user.id)

  return (
    <AuthContext.Provider value={{ user, profile, settings, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
