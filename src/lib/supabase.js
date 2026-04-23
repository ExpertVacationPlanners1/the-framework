import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // CRITICAL: stops it looking for auth tokens in URL
    flowType: 'pkce'
  }
})

export const signUp = (email, password, fullName) =>
  supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${window.location.origin}/dashboard`
    }
  })

export const signIn = (email, password) =>
  supabase.auth.signInWithPassword({ email, password })

export const signOut = () => supabase.auth.signOut()

export const getUser = () => supabase.auth.getUser()

export const getSession = () => supabase.auth.getSession()

// Default tasks per pillar
export const DEFAULT_TASKS = {
  work: [
    { text: "Complete your #1 priority work task before noon", priority: "high" },
    { text: "Send one message that moves a stuck situation forward", priority: "high" },
    { text: "Block 90 minutes for deep focused work — phone off", priority: "high" },
    { text: "Identify the one thing at work causing the most stress", priority: "medium" },
    { text: "Deliver one visible result your leadership will notice", priority: "high" },
    { text: "Evaluate your growth path — decide, don't float", priority: "medium" },
  ],
  personal: [
    { text: "Morning routine — protect the first hour of your day", priority: "high" },
    { text: "Exercise — protect this commitment every day", priority: "high" },
    { text: "No phone for the first 15 minutes of your morning", priority: "high" },
    { text: "Be fully present with family — 15 minutes minimum", priority: "high" },
    { text: "Write down 3 things you did right today", priority: "medium" },
    { text: "Read or learn something that moves you forward", priority: "medium" },
  ],
  financial: [
    { text: "Write down your exact monthly stability number", priority: "high" },
    { text: "Check your bank balance — no avoiding it", priority: "high" },
    { text: "Identify one recurring expense to cut or reduce", priority: "high" },
    { text: "Review your budget vs actual spending", priority: "high" },
    { text: "Identify one income growth action this month", priority: "high" },
    { text: "Add $25 to your emergency fund today", priority: "medium" },
  ],
  health: [
    { text: "Hit your daily exercise goal", priority: "high" },
    { text: "Sleep 7-8 hours tonight", priority: "high" },
    { text: "Drink 8 glasses of water today", priority: "medium" },
    { text: "Eat a protein-first breakfast", priority: "medium" },
  ],
  family: [
    { text: "One meaningful conversation with a family member", priority: "high" },
    { text: "Put the phone down during family time", priority: "high" },
    { text: "Express appreciation to someone you care about", priority: "medium" },
  ],
}

export const DEFAULT_HABITS = [
  { name: "Exercise", icon: "🏋️" },
  { name: "Sleep on time", icon: "😴" },
  { name: "No phone 15min AM", icon: "📵" },
  { name: "Read / Learn", icon: "📚" },
]
