import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { signOut } from '../lib/supabase'
import ScoreHistory from '../components/ScoreHistory'
import CustomGoals from '../components/CustomGoals'
import ShareCard from '../components/ShareCard'
import Journal from '../components/Journal'

// Scoring engine
const PRI_PTS = { high: 8, medium: 5, low: 3 }
const TIERS = [
  { min: 0,  label: 'GET MOVING', color: '#f43f5e', bg: '#1c000a' },
  { min: 25, label: 'WARMING UP', color: '#a78bfa', bg: '#1e0050' },
  { min: 45, label: 'BUILDING',   color: '#f97316', bg: '#1c0a00' },
  { min: 60, label: 'SOLID',      color: '#3b82f6', bg: '#0f1e35' },
  { min: 75, label: 'STRONG',     color: '#22c55e', bg: '#052e16' },
  { min: 90, label: 'ELITE',      color: '#f59e0b', bg: '#1c1200' },
]

function getTier(pct) { return TIERS.reduce((a, t) => pct >= t.min ? t : a, TIERS[0]) }

function calcScore(tasks, completedIds, habits, completedHabitIds, hasFocus, winsCount, confidence, isWeekend) {
  const activeCats = isWeekend ? ['personal', 'financial', 'health', 'family'] : ['work', 'personal', 'financial', 'health', 'family']
  const activeTasks = tasks.filter(t => activeCats.includes(t.category))
  const earned = activeTasks.filter(t => completedIds.includes(t.id)).reduce((a, t) => a + (PRI_PTS[t.priority] || 5), 0)
  const max = activeTasks.reduce((a, t) => a + (PRI_PTS[t.priority] || 5), 0)
  const habEarned = completedHabitIds.length * 10
  const habMax = habits.length * 10
  const focusPts = hasFocus ? 5 : 0
  const winPts = Math.min(winsCount, 2) * 3
  const confPts = confidence > 0 ? Math.min(4, Math.round(confidence / 2.5)) : 0
  const totalEarned = earned + habEarned + focusPts + winPts + confPts
  const totalMax = max + habMax + 5 + 6 + 4
  const pct = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0

  const catBreakdown = {}
  const allCats = ['work', 'personal', 'financial', 'health', 'family']
  allCats.forEach(c => {
    const catTasks = tasks.filter(t => t.category === c)
    catBreakdown[c] = {
      done: catTasks.filter(t => completedIds.includes(t.id)).length,
      total: catTasks.length,
      pts: catTasks.filter(t => completedIds.includes(t.id)).reduce((a, t) => a + (PRI_PTS[t.priority] || 5), 0),
      maxPts: catTasks.reduce((a, t) => a + (PRI_PTS[t.priority] || 5), 0),
    }
  })

  return { pct, earned: totalEarned, max: totalMax, tier: getTier(pct), catBreakdown }
}

const TODAY = new Date().toISOString().split('T')[0]
const DOW = new Date().getDay()
const IS_WEEKEND = DOW === 0 || DOW === 6
const DAY_NAME = new Date().toLocaleDateString('en-US', { weekday: 'long' })
const DATE_STR = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

export default function Dashboard() {
  const { user, profile, settings, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [toast, setToast] = useState('')

  // Data state
  const [tasks, setTasks] = useState([])
  const [completedIds, setCompletedIds] = useState([])
  const [habits, setHabits] = useState([])
  const [completedHabitIds, setCompletedHabitIds] = useState([])
  const [focus, setFocus] = useState('')
  const [focusInput, setFocusInput] = useState('')
  const [wins, setWins] = useState([])
  const [winInput, setWinInput] = useState('')
  const [checkins, setCheckins] = useState([])
  const [ciInput, setCiInput] = useState('')
  const [confidence, setConfidence] = useState(5)
  const [confSaved, setConfSaved] = useState(false)
  const [budget, setBudget] = useState({ income: 0, fixed_costs: 0, variable_costs: 0, stability_target: 0 })
  const [savings, setSavings] = useState([])
  const [briefing, setBriefing] = useState(null)
  const [briefLoading, setBriefLoading] = useState(false)
  const [coachMsg, setCoachMsg] = useState('')
  const [coachLoading, setCoachLoading] = useState(false)
  const [coachTime, setCoachTime] = useState('')
  const [msgs, setMsgs] = useState([{ r: 'ai', t: `Hey ${profile?.full_name?.split(' ')[0] || 'there'} 👋 I'm your personal coach. Tell me what's on your mind — work stress, a decision you're avoiding, or how today's going. Direct, honest coaching.` }])
  const [chatIn, setChatIn] = useState('')
  const [chatLoad, setChatLoad] = useState(false)
  const [activeTab, setActiveTab] = useState(IS_WEEKEND ? 'personal' : 'work')
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('overview') // overview | history | goals | journal | share
  const [weeklyReport, setWeeklyReport] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const chatEndRef = useRef(null)
  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  // Load all data
  useEffect(() => {
    if (user) loadAll()
  }, [user])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  useEffect(() => {
    const t = setTimeout(() => { if (!loading) genCoach() }, 2000)
    return () => clearTimeout(t)
  }, [completedIds, completedHabitIds, confidence, focus, loading])

  const showToast = (m, d = 2500) => { setToast(m); setTimeout(() => setToast(''), d) }

  const loadAll = async () => {
    setLoading(true)
    try {
      const [
        tasksRes, completionsRes, habitsRes, habitCompRes,
        focusRes, winsRes, ciRes, confRes, budgetRes, savingsRes, briefingRes
      ] = await Promise.all([
        supabase.from('user_tasks').select('*').eq('user_id', user.id).eq('is_active', true).order('category').order('sort_order'),
        supabase.from('daily_task_completions').select('task_id').eq('user_id', user.id).eq('completed_date', TODAY),
        supabase.from('user_habits').select('*').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
        supabase.from('habit_completions').select('habit_id').eq('user_id', user.id).eq('completed_date', TODAY),
        supabase.from('daily_focus').select('task_text').eq('user_id', user.id).eq('focus_date', TODAY).single(),
        supabase.from('user_logs').select('*').eq('user_id', user.id).eq('log_type', 'win').order('logged_at', { ascending: false }).limit(20),
        supabase.from('user_logs').select('*').eq('user_id', user.id).eq('log_type', 'checkin').order('logged_at', { ascending: false }).limit(10),
        supabase.from('confidence_logs').select('score').eq('user_id', user.id).eq('logged_date', TODAY).single(),
        supabase.from('user_budget').select('*').eq('user_id', user.id).single(),
        supabase.from('savings_goals').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('daily_briefings').select('*').eq('user_id', user.id).eq('briefing_date', TODAY).single(),
      ])

      setTasks(tasksRes.data || [])
      setCompletedIds((completionsRes.data || []).map(c => c.task_id))
      setHabits(habitsRes.data || [])
      setCompletedHabitIds((habitCompRes.data || []).map(c => c.habit_id))
      setFocus(focusRes.data?.task_text || '')
      setFocusInput(focusRes.data?.task_text || '')
      setWins(winsRes.data || [])
      setCheckins(ciRes.data || [])
      setConfidence(confRes.data?.score || 5)
      setBudget(budgetRes.data || { income: 0, fixed_costs: 0, variable_costs: 0, stability_target: 0 })
      setSavings(savingsRes.data || [])

      if (briefingRes.data) {
        setBriefing(briefingRes.data)
      } else {
        fetchBriefing()
      }
    } catch (err) {
      console.error('Load error:', err)
    }
    setLoading(false)
  }

  const toggleTask = async (taskId) => {
    const isCompleted = completedIds.includes(taskId)
    if (isCompleted) {
      setCompletedIds(p => p.filter(id => id !== taskId))
      await supabase.from('daily_task_completions').delete()
        .eq('user_id', user.id).eq('task_id', taskId).eq('completed_date', TODAY)
    } else {
      setCompletedIds(p => [...p, taskId])
      await supabase.from('daily_task_completions').upsert({
        user_id: user.id, task_id: taskId, completed_date: TODAY
      })
      saveScore()
    }
  }

  const toggleHabit = async (habitId) => {
    const isCompleted = completedHabitIds.includes(habitId)
    if (isCompleted) {
      setCompletedHabitIds(p => p.filter(id => id !== habitId))
      await supabase.from('habit_completions').delete()
        .eq('user_id', user.id).eq('habit_id', habitId).eq('completed_date', TODAY)
    } else {
      setCompletedHabitIds(p => [...p, habitId])
      await supabase.from('habit_completions').upsert({
        user_id: user.id, habit_id: habitId, completed_date: TODAY
      })
      showToast('Habit logged 🔥')
    }
  }

  const saveFocus = async () => {
    if (!focusInput.trim()) return
    setFocus(focusInput)
    await supabase.from('daily_focus').upsert({
      user_id: user.id, focus_date: TODAY, task_text: focusInput.trim()
    })
    showToast('Focus saved ✓')
    saveScore()
  }

  const saveConf = async () => {
    setConfSaved(true)
    setTimeout(() => setConfSaved(false), 2000)
    await supabase.from('confidence_logs').upsert({
      user_id: user.id, logged_date: TODAY, score: confidence
    })
    showToast(`Confidence ${confidence}/10 logged`)
    saveScore()
  }

  const addWin = async () => {
    if (!winInput.trim()) return
    const { data } = await supabase.from('user_logs').insert({
      user_id: user.id, log_type: 'win', content: winInput.trim()
    }).select().single()
    if (data) setWins(p => [data, ...p])
    setWinInput('')
    showToast('Win logged 🏆')
    saveScore()
  }

  const addCheckin = async () => {
    if (!ciInput.trim()) return
    const { data } = await supabase.from('user_logs').insert({
      user_id: user.id, log_type: 'checkin', content: ciInput.trim()
    }).select().single()
    if (data) setCheckins(p => [data, ...p])
    setCiInput('')
    showToast('Check-in saved ✓')
  }

  const saveScore = async () => {
    const sc = calcScore(tasks, completedIds, habits, completedHabitIds, !!focus, wins.length, confidence, IS_WEEKEND)
    await supabase.from('daily_scores').upsert({
      user_id: user.id, score_date: TODAY,
      score: sc.pct, tier: sc.tier.label,
      earned_points: sc.earned, max_points: sc.max,
      breakdown: sc.catBreakdown
    })
  }

  const fetchBriefing = async (force = false) => {
    setBriefLoading(true)
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 6000)
      // Get current session JWT to pass for authenticated API call
      const { data: { session } } = await import('../lib/supabase').then(m => m.supabase.auth.getSession())
      const r = await fetch('/api/briefing-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          force,
          userJwt: session?.access_token,
          settings: settings,
          firstName: firstName
        }),
        signal: ctrl.signal
      })
      clearTimeout(t)
      if (r.ok) { const d = await r.json(); if (d.briefing) { setBriefing(d.briefing); setBriefLoading(false); return } }
    } catch {}
    // Fallback briefing
    const dow = new Date().toLocaleDateString('en-US', { weekday: 'long' })
    setBriefing({
      content: {
        greeting: `${dow}. New scorecard. Let's go.`,
        coachNote: IS_WEEKEND
          ? `It's ${dow} — your recovery day. Reflect, recharge, and make one financial move. Target: 65.`
          : `It's ${dow}. Your target is ${settings?.weekday_target || 75}+. Every task you complete moves the score. Win the day.`,
        challenges: [
          ...(!IS_WEEKEND ? [{ category: 'work', icon: '💼', label: 'WORK', color: '#1c3d2e', bg: '#f0fdf4', points: 20, challenge: 'Complete your single most important work task before noon.', why: 'One completed priority beats five half-started ones.' }] : []),
          { category: 'personal', icon: '🏠', label: 'PERSONAL', color: '#7c3d00', bg: '#fff7ed', points: 15, challenge: 'Protect your morning routine and be fully present with family.', why: 'Your morning sets the tone for everything.' },
          { category: 'financial', icon: '📈', label: 'FINANCIAL', color: '#1e3a5f', bg: '#eff6ff', points: 15, challenge: 'Review your bank balance and log one budget number.', why: 'Facing your numbers removes the anxiety of avoiding them.' },
        ]
      },
      challenges_completed: { work: false, personal: false, financial: false },
      target_score: IS_WEEKEND ? 65 : (settings?.weekday_target || 75)
    })
    setBriefLoading(false)
  }

  const completeChallenge = async (cat) => {
    const updated = {
      ...briefing,
      challenges_completed: { ...briefing.challenges_completed, [cat]: true }
    }
    setBriefing(updated)
    await supabase.from('daily_briefings').upsert({
      user_id: user.id, briefing_date: TODAY,
      content: updated.content,
      challenges_completed: updated.challenges_completed,
      target_score: updated.target_score
    })
    showToast(`${cat.charAt(0).toUpperCase() + cat.slice(1)} challenge done! ✓`)
  }

  const genCoach = async () => {
    if (loading) return
    setCoachLoading(true)
    const sc = calcScore(tasks, completedIds, habits, completedHabitIds, !!focus, wins.length, confidence, IS_WEEKEND)
    const h = new Date().getHours()
    const tod = h < 9 ? 'morning' : h < 13 ? 'mid-morning' : h < 17 ? 'afternoon' : h < 20 ? 'evening' : 'night'
    const catSummary = Object.entries(sc.catBreakdown)
      .filter(([c]) => !IS_WEEKEND || c !== 'work')
      .map(([c, v]) => `${c}: ${v.done}/${v.total}`).join(', ')

    try {
      const r = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: `You are a personal life coach in The Framework app. Direct, warm, athletic performance framing. 3-4 sentences max. Always reference the actual score number. End with one specific action or sharp question.`,
          messages: [{
            role: 'user',
            content: `User: ${firstName}. It's ${tod} on ${DAY_NAME}. Score: ${sc.pct}/100 (${sc.tier.label}) — ${sc.earned}/${sc.max} pts. Tasks: ${catSummary}. Habits: ${completedHabitIds.length}/${habits.length} done. Confidence: ${confidence}/10. Goal: "${settings?.primary_goal || 'not set'}". Give coaching that references this specific data.`
          }]
        })
      })
      if (r.ok) { const d = await r.json(); setCoachMsg(d.reply || ''); setCoachTime(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })) }
    } catch { setCoachMsg('Keep going. One task at a time.') }
    setCoachLoading(false)
  }

  const sendChat = useCallback(async () => {
    if (!chatIn.trim() || chatLoad) return
    const um = { r: 'user', t: chatIn.trim() }
    const nm = [...msgs, um]
    setMsgs(nm); setChatIn(''); setChatLoad(true)
    try {
      const r = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: `You are ${firstName}'s personal life coach. Their main goal: "${settings?.primary_goal || 'not set'}". Blockers: ${(settings?.main_blockers || []).join(', ')}. 3-5 sentences. Direct, warm, always end with one specific next move.`,
          messages: nm.map(m => ({ role: m.r === 'ai' ? 'assistant' : 'user', content: m.t }))
        })
      })
      if (r.ok) { const d = await r.json(); setMsgs(p => [...p, { r: 'ai', t: d.reply || 'Keep moving.' }]) }
    } catch { setMsgs(p => [...p, { r: 'ai', t: 'Trouble connecting. Try again.' }]) }
    setChatLoad(false)
  }, [chatIn, msgs, chatLoad, firstName, settings])

  // Computed
  const sc = calcScore(tasks, completedIds, habits, completedHabitIds, !!focus, wins.length, confidence, IS_WEEKEND)
  const activeTabs = IS_WEEKEND
    ? ['personal', 'financial', 'health', 'family'].filter(c => tasks.some(t => t.category === c))
    : ['work', 'personal', 'financial', 'health', 'family'].filter(c => tasks.some(t => t.category === c))
  const effTab = IS_WEEKEND && activeTab === 'work' ? 'personal' : activeTab
  const tabTasks = tasks.filter(t => t.category === effTab)
  const tabDone = tabTasks.filter(t => completedIds.includes(t.id)).length
  const tabPct = tabTasks.length ? Math.round(tabDone / tabTasks.length * 100) : 0
  const TAB_COLORS = { work: '#1c3d2e', personal: '#7c3d00', financial: '#1e3a5f', health: '#065f46', family: '#6d28d9' }
  const activeChallenges = briefing?.content?.challenges?.filter(c => !IS_WEEKEND || c.category !== 'work') || []
  const chalDone = activeChallenges.filter(c => briefing?.challenges_completed?.[c.category]).length
  const budgCalc = { spend: (+budget.fixed_costs || 0) + (+budget.variable_costs || 0), left: (+budget.income || 0) - (+budget.fixed_costs || 0) - (+budget.variable_costs || 0) }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 32 }}>🎯</div>
        <div className="spinner spinner-dark" style={{ width: 28, height: 28 }} />
        <p style={{ fontSize: 14, color: 'var(--text-3)' }}>Loading your dashboard...</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      {/* Navbar */}
      <nav className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🎯</span>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 900, color: 'var(--primary)' }}>The Framework</span>
          {IS_WEEKEND && <span style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>🏖️ Weekend</span>}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link to="/voice" style={{ padding: '7px 14px', borderRadius: 8, background: '#1c3d2e', color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: "'Nunito Sans', sans-serif", display: 'flex', alignItems: 'center', gap: 6 }}>
            🎙️ Voice Check-In
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={async () => { await signOut(); navigate('/') }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 800 }}>
              {firstName.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-3)', display: 'none' }}>Sign out</span>
          </div>
        </div>
      </nav>

      <div className="dashboard" style={{ paddingTop: 16 }}>
        {/* ── MAIN COLUMN ── */}
        <div className="dashboard-main">

          {/* Header */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div className="eyebrow" style={{ color: 'var(--primary)', marginBottom: 6 }}>🎯 Life Command Center</div>
                <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(22px,5vw,28px)', fontWeight: 900, marginBottom: 4 }}>
                  {firstName}'s Dashboard
                </h1>
                <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{DAY_NAME}, {DATE_STR}</p>
              </div>
              <svg width="72" height="72" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r="28" fill="none" stroke="#ede8e0" strokeWidth="5"/>
                <circle cx="36" cy="36" r="28" fill="none" stroke={sc.tier.color} strokeWidth="5"
                  strokeDasharray={2*Math.PI*28} strokeDashoffset={2*Math.PI*28*(1-sc.pct/100)}
                  strokeLinecap="round" transform="rotate(-90 36 36)" style={{ transition: 'stroke-dashoffset .8s' }}/>
                <text x="36" y="40" textAnchor="middle" fill={sc.tier.color} fontSize="15" fontWeight="900" fontFamily="'Fraunces',serif">{sc.pct}</text>
              </svg>
            </div>

            {/* Cat counts */}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              {activeTabs.map(c => {
                const { done, total } = sc.catBreakdown[c] || { done: 0, total: 0 }
                return (
                  <div key={c} onClick={() => setActiveTab(c)} style={{ flex: 1, minWidth: 70, padding: '9px 12px', background: c === effTab ? 'var(--surface)' : '#fafafa', borderRadius: 10, border: '1.5px solid', borderColor: c === effTab ? (TAB_COLORS[c] || '#1c3d2e') : 'transparent', cursor: 'pointer', transition: 'all .15s' }}>
                    <div style={{ fontSize: 'clamp(15px,3.5vw,20px)', fontWeight: 900, color: TAB_COLORS[c] || '#1c3d2e' }}>{done}<span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>/{total}</span></div>
                    <div className="eyebrow" style={{ color: 'var(--text-3)', fontSize: 9, marginTop: 2 }}>{c}</div>
                  </div>
                )
              })}
            </div>

            {/* Focus */}
            <div style={{ marginTop: 14, padding: 14, background: 'var(--surface)', borderRadius: 10 }}>
              <div className="eyebrow" style={{ color: 'var(--text-3)', marginBottom: 8 }}>⚡ Today's #1 Non-Negotiable</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="input-field" value={focusInput} onChange={e => setFocusInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveFocus()} placeholder="What MUST get done today?" style={{ fontSize: 14 }}/>
                <button className="btn btn-primary btn-sm" onClick={saveFocus} style={{ whiteSpace: 'nowrap' }}>Save</button>
              </div>
              {focus && <p style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>→ {focus}</p>}
            </div>
          </div>

          {/* Briefing */}
          <div className="card">
            <div style={{ background: 'linear-gradient(135deg,#1a2f4a,#0f1e35)', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="eyebrow" style={{ color: '#93c5fd', marginBottom: 4 }}>📋 Daily Briefing</div>
                <div style={{ fontFamily: "'Fraunces',serif", fontSize: 15, fontWeight: 700, color: '#fff' }}>
                  {briefing ? `${DAY_NAME}${IS_WEEKEND ? ' — Weekend 🏖️' : ' — ' + activeChallenges.length + ' Challenges'}` : 'Loading...'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {briefing && <span style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd' }}>Target: {briefing.target_score}</span>}
                <button onClick={() => fetchBriefing(true)} style={{ background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 6, padding: '5px 10px', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{briefLoading ? '...' : '↺'}</button>
              </div>
            </div>
            <div style={{ padding: 18 }}>
              {briefLoading && !briefing ? (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 0' }}>
                  <div className="spinner spinner-dark"/><span style={{ fontSize: 13, color: 'var(--text-3)' }}>Generating your challenges...</span>
                </div>
              ) : briefing ? (
                <>
                  <div style={{ background: '#f0f7ff', borderRadius: 10, padding: '12px 14px', borderLeft: '4px solid #1e3a5f', marginBottom: 14 }}>
                    <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text)', fontWeight: 500 }}>{briefing.content?.coachNote}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {activeChallenges.map(item => {
                      const isDone = briefing.challenges_completed?.[item.category]
                      return (
                        <div key={item.category} style={{ background: isDone ? item.bg : '#fafaf9', borderRadius: 12, padding: '12px 14px', border: '1.5px solid', borderColor: isDone ? item.color : 'var(--border)', transition: 'all .2s' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                <span style={{ fontSize: 13 }}>{item.icon}</span>
                                <span className="eyebrow" style={{ color: item.color, fontSize: 9 }}>{item.label}</span>
                                <span style={{ fontSize: 10, fontWeight: 700, color: item.color, background: item.bg, padding: '2px 6px', borderRadius: 4 }}>+{item.points} pts</span>
                                {isDone && <span style={{ fontSize: 11, fontWeight: 800, color: '#16a34a' }}>✓ DONE</span>}
                              </div>
                              <p style={{ fontSize: 13, fontWeight: 600, color: isDone ? 'var(--text-3)' : 'var(--text)', lineHeight: 1.5, textDecoration: isDone ? 'line-through' : 'none' }}>{item.challenge}</p>
                              {!isDone && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, fontStyle: 'italic' }}>→ {item.why}</p>}
                            </div>
                            {!isDone && (
                              <button onClick={() => completeChallenge(item.category)} style={{ background: item.color, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>Done ✓</button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--surface)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>{chalDone}/{activeChallenges.length} complete</span>
                    <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700 }}>
                      {activeChallenges.filter(c => briefing.challenges_completed?.[c.category]).reduce((a, c) => a + c.points, 0)} pts earned
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <button className="btn btn-primary" onClick={() => fetchBriefing()}>Generate Today's Briefing</button>
                </div>
              )}
            </div>
          </div>

          {/* Score Panel */}
          <div className="card" style={{ border: `2px solid ${sc.tier.color}` }}>
            <div style={{ background: sc.tier.bg, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="eyebrow" style={{ color: sc.tier.color, marginBottom: 6 }}>🏆 Daily Performance Score</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontFamily: "'Fraunces',serif", fontSize: 'clamp(44px,10vw,58px)', fontWeight: 900, color: sc.tier.color, lineHeight: 1 }}>{sc.pct}</span>
                  <span style={{ fontSize: 20, color: sc.tier.color, opacity: .6, fontWeight: 700 }}>/100</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: sc.tier.color, marginTop: 2 }}>{sc.tier.label}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="font-mono" style={{ fontSize: 11, color: sc.tier.color, opacity: .7, marginBottom: 4 }}>{sc.earned}/{sc.max} pts</div>
                <svg width="62" height="62" viewBox="0 0 62 62">
                  <circle cx="31" cy="31" r="25" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="5"/>
                  <circle cx="31" cy="31" r="25" fill="none" stroke={sc.tier.color} strokeWidth="5"
                    strokeDasharray={2*Math.PI*25} strokeDashoffset={2*Math.PI*25*(1-sc.pct/100)}
                    strokeLinecap="round" transform="rotate(-90 31 31)" style={{ transition: 'stroke-dashoffset .8s' }}/>
                  <text x="31" y="35" textAnchor="middle" fill={sc.tier.color} fontSize="13" fontWeight="900" fontFamily="'Fraunces',serif">{sc.pct}%</text>
                </svg>
              </div>
            </div>
            <div style={{ padding: '14px 20px', background: '#fff' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(90px,1fr))', gap: 10, marginBottom: 14 }}>
                {Object.entries(sc.catBreakdown).filter(([c]) => !IS_WEEKEND || c !== 'work').map(([cat, v]) => (
                  <div key={cat}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span className="eyebrow" style={{ fontSize: 9 }}>{cat}</span>
                      <span className="font-mono" style={{ fontSize: 10, color: TAB_COLORS[cat] || '#1c3d2e', fontWeight: 700 }}>{v.done}/{v.total}</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: (v.total ? Math.round(v.done/v.total*100) : 0) + '%', background: TAB_COLORS[cat] || '#1c3d2e' }}/>
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 2 }}>{v.pts} pts</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <span className="eyebrow" style={{ marginRight: 4, fontSize: 9 }}>TARGET →</span>
                {TIERS.map((t, i) => {
                  const next = TIERS[i + 1]
                  const isOn = sc.pct >= t.min && (!next || sc.pct < next.min)
                  return <span key={t.label} style={{ padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 800, letterSpacing: .5, background: isOn ? t.color : '#f0ebe3', color: isOn ? '#fff' : 'var(--text-3)' }}>{t.label}</span>
                })}
              </div>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span className="eyebrow">🧠 Coach Feedback</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {coachTime && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{coachTime}</span>}
                  <button className="btn btn-ghost btn-sm" onClick={genCoach}>{coachLoading ? '...' : '↺ Refresh'}</button>
                </div>
              </div>
              {coachLoading && !coachMsg ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><div className="spinner spinner-dark"/><span style={{ fontSize: 13, color: 'var(--text-3)' }}>Analyzing your score...</span></div>
              ) : coachMsg ? (
                <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '12px 14px', borderLeft: `4px solid ${sc.tier.color}` }}>
                  <p style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--text)', fontWeight: 500 }}>{coachMsg}</p>
                </div>
              ) : null}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                {['💬 Talk to coach', '🎙️ Voice check-in', '↺ New message'].map((l, i) => (
                  <button key={l} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '6px 12px', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif" }}
                    onClick={() => { if (i === 0) setChatIn('Coach me on my current score and how to improve'); if (i === 1) navigate('/voice'); if (i === 2) genCoach() }}>{l}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Goal Tracker */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div className="eyebrow" style={{ color: 'var(--text-3)', marginBottom: 4 }}>📋 Goal Tracker</div>
                <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 'clamp(16px,4vw,20px)' }}>{effTab.charAt(0).toUpperCase() + effTab.slice(1)} Goals{IS_WEEKEND && <span style={{ marginLeft: 8, background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>weekend</span>}</h2>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 'clamp(20px,5vw,26px)', fontWeight: 900, color: TAB_COLORS[effTab] || '#1c3d2e' }}>{tabPct}%</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{tabDone}/{tabTasks.length}</div>
              </div>
            </div>
            <div className="tab-list" style={{ marginBottom: 14 }}>
              {activeTabs.map(t => (
                <button key={t} className={`tab-item${effTab === t ? ' active' : ''}`} onClick={() => setActiveTab(t)}>
                  {t === 'work' ? '💼' : t === 'personal' ? '🏠' : t === 'financial' ? '📈' : t === 'health' ? '💪' : '👨‍👩‍👦'} {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <div className="progress-track" style={{ marginBottom: 16 }}>
              <div className="progress-fill" style={{ width: tabPct + '%', background: TAB_COLORS[effTab] || '#1c3d2e' }}/>
            </div>
            {tabTasks.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 13, padding: '16px 0' }}>No tasks yet for this category.</p>
            ) : tabTasks.map(task => (
              <div key={task.id} className="task-row" onClick={() => toggleTask(task.id)}>
                <div className={`check-circle${completedIds.includes(task.id) ? ' checked' : ''}`}/>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: task.priority === 'high' ? '#dc2626' : task.priority === 'medium' ? '#d97706' : '#16a34a', flexShrink: 0, marginTop: 7 }}/>
                <span style={{ flex: 1, fontSize: 14, lineHeight: 1.5, textDecoration: completedIds.includes(task.id) ? 'line-through' : 'none', opacity: completedIds.includes(task.id) ? .5 : 1 }}>{task.text}</span>
              </div>
            ))}
          </div>

          {/* Habits + Confidence */}
          <div className="grid-2">
            <div className="card" style={{ padding: 18 }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>🔥 Habits</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--primary)', marginBottom: 14 }}>{completedHabitIds.length}/{habits.length}<span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}> today</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {habits.map(h => (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button className={`habit-ring${completedHabitIds.includes(h.id) ? ' checked' : ''}`} onClick={() => toggleHabit(h.id)}>{h.icon}</button>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{h.name}</div>
                    </div>
                  </div>
                ))}
                {habits.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-3)' }}>No habits set up.</p>}
              </div>
            </div>
            <div className="card" style={{ padding: 18 }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>💪 Confidence</div>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 12, lineHeight: 1.5 }}>Rate honestly, not perfectly.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 4, marginBottom: 12 }}>
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <button key={n} onClick={() => setConfidence(n)} style={{ padding: '8px 0', borderRadius: 7, border: '1.5px solid', borderColor: confidence === n ? 'var(--primary)' : 'var(--border)', background: confidence === n ? 'var(--primary)' : '#fff', color: confidence === n ? '#fff' : 'var(--text-2)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif" }}>{n}</button>
                ))}
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 10, lineHeight: 1.5 }}>
                {confidence <= 3 ? 'Struggling — name one thing you can control.' : confidence <= 6 ? 'Middle ground. Push through.' : 'Strong energy — use it on the hardest task first.'}
              </p>
              <button className="btn btn-primary" onClick={saveConf} style={{ width: '100%', fontSize: 12 }}>{confSaved ? 'Saved ✓' : `Log ${confidence}/10`}</button>
            </div>
          </div>

          {/* Check-in + Wins */}
          <div className="grid-2">
            <div className="card" style={{ padding: 18 }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>📝 Check-In</div>
              <textarea className="input-field" value={ciInput} onChange={e => setCiInput(e.target.value)} placeholder="Status, blocker, or thought." rows={3} style={{ resize: 'none', fontSize: 13, marginBottom: 8 }}/>
              <button className="btn btn-primary" onClick={addCheckin} style={{ width: '100%', fontSize: 12 }}>Log</button>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 120, overflowY: 'auto' }}>
                {checkins.slice(0, 4).map(c => (
                  <div key={c.id} style={{ padding: '8px 10px', background: 'var(--surface)', borderRadius: 8 }}>
                    <p style={{ fontSize: 12, lineHeight: 1.4 }}>{c.content}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>{new Date(c.logged_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="card" style={{ padding: 18 }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>🏆 Wins</div>
              <input className="input-field" value={winInput} onChange={e => setWinInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addWin()} placeholder="What did you do right?" style={{ fontSize: 13, marginBottom: 8 }}/>
              <button className="btn btn-primary" onClick={addWin} style={{ width: '100%', fontSize: 12, marginBottom: 10 }}>Log Win</button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 120, overflowY: 'auto' }}>
                {wins.slice(0, 5).map(w => (
                  <div key={w.id} style={{ display: 'flex', gap: 8 }}>
                    <span>⭐</span>
                    <div>
                      <p style={{ fontSize: 12, lineHeight: 1.4 }}>{w.content}</p>
                      <p style={{ fontSize: 10, color: 'var(--text-3)' }}>{new Date(w.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                    </div>
                  </div>
                ))}
                {!wins.length && <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>No wins yet — add one.</p>}
              </div>
            </div>
          </div>

          {/* AI Coach Chat */}
          <div className="card" style={{ padding: 20 }}>
            <div className="eyebrow" style={{ color: 'var(--primary)', marginBottom: 6 }}>🤖 AI Coach Chat</div>
            <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 'clamp(16px,4vw,20px)', marginBottom: 4 }}>Talk to Your Coach</h2>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>Work stress, decisions, confidence, finances. Direct and honest.</p>
            <div style={{ height: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
              {msgs.map((m, i) => <div key={i} className={m.r === 'user' ? 'bubble-user' : 'bubble-ai'}>{m.t}</div>)}
              {chatLoad && <div className="bubble-ai" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><div className="spinner spinner-dark"/><span style={{ fontSize: 12, color: 'var(--text-3)' }}>Thinking...</span></div>}
              <div ref={chatEndRef}/>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input-field" value={chatIn} onChange={e => setChatIn(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()} placeholder="Type anything..."/>
              <button className="btn btn-primary" onClick={sendChat} disabled={chatLoad || !chatIn.trim()} style={{ opacity: chatLoad || !chatIn.trim() ? .5 : 1, minWidth: 64 }}>{chatLoad ? <span className="spinner"/> : 'Send'}</button>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {["I'm stressed about work", "Help me prioritize today", "I'm avoiding something", "Financial pressure"].map(p => (
                <button key={p} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '6px 12px', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif" }} onClick={() => setChatIn(p)}>{p}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)', overflowX: 'auto' }}>
            {[
              { id: 'overview', label: '📊 Overview' },
              { id: 'history', label: '📈 Progress' },
              { id: 'goals', label: '🎯 My Goals' },
              { id: 'journal', label: '📝 Journal' },
              { id: 'share', label: '🏆 Share' },
            ].map(s => (
              <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
                padding: '12px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, fontFamily: "'Nunito Sans',sans-serif", whiteSpace: 'nowrap',
                color: activeSection === s.id ? 'var(--primary)' : 'var(--text-3)',
                borderBottom: `2px solid ${activeSection === s.id ? 'var(--primary)' : 'transparent'}`,
                transition: 'all .15s'
              }}>{s.label}</button>
            ))}
          </div>
          <div style={{ padding: 20 }}>
            {activeSection === 'overview' && (
              <div>
                <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 14 }}>Your daily performance at a glance. Tap habits and tasks above to update your score.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
                  {[
                    { label: 'Tasks Done Today', val: `${Object.values(sc.catBreakdown).reduce((a,v)=>a+v.done,0)}/${Object.values(sc.catBreakdown).reduce((a,v)=>a+v.total,0)}`, color: 'var(--primary)' },
                    { label: 'Habits Done', val: `${completedHabitIds.length}/${habits.length}`, color: '#065f46' },
                    { label: 'Score', val: `${sc.pct}/100`, color: sc.tier.color },
                    { label: 'Confidence', val: `${confidence}/10`, color: 'var(--navy)' },
                  ].map(s => (
                    <div key={s.label} style={{ padding: 14, background: 'var(--surface)', borderRadius: 10, textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: s.color, fontFamily: "'Fraunces',serif" }}>{s.val}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeSection === 'history' && <ScoreHistory />}
            {activeSection === 'goals' && (
              <CustomGoals
                tasks={tasks}
                onTasksChange={(newTasks) => setTasks(newTasks)}
              />
            )}
            {activeSection === 'journal' && <Journal />}
            {activeSection === 'share' && (
              <ShareCard
                score={sc.pct}
                tier={sc.tier.label}
                tierColor={sc.tier.color}
                firstName={firstName}
                focus={focus}
              />
            )}
          </div>
        </div>

        {/* ── SIDEBAR ── */}
        <div className="dashboard-side">
          {/* Score summary */}
          <div className="card" style={{ background: `linear-gradient(135deg,${sc.tier.bg},${sc.tier.bg})`, border: `1px solid ${sc.tier.color}30`, padding: 18 }}>
            <div className="eyebrow" style={{ color: sc.tier.color, marginBottom: 8 }}>📊 Today At A Glance</div>
            {[
              { label: 'Tasks done', val: `${Object.values(sc.catBreakdown).reduce((a,v) => a+v.done,0)}/${Object.values(sc.catBreakdown).reduce((a,v) => a+v.total,0)}` },
              { label: 'Habits done', val: `${completedHabitIds.length}/${habits.length}` },
              { label: 'Wins logged', val: wins.length },
              { label: 'Confidence', val: `${confidence}/10` },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,.65)', fontFamily: "'Nunito Sans',sans-serif" }}>{item.label}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: sc.tier.color, fontFamily: "'JetBrains Mono',monospace" }}>{item.val}</span>
              </div>
            ))}
            <Link to="/voice" style={{ display: 'block', marginTop: 14, background: sc.tier.color, color: '#000', borderRadius: 10, padding: '11px 0', textAlign: 'center', fontFamily: "'Nunito Sans',sans-serif", fontSize: 13, fontWeight: 800 }}>
              🎙️ Start Voice Check-In
            </Link>
          </div>

          {/* Budget */}
          <div className="card" style={{ padding: 18 }}>
            <div className="eyebrow" style={{ color: 'var(--navy)', marginBottom: 10 }}>📈 Budget Snapshot</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {[{k:'income',l:'Income',ph:'Monthly income'},{k:'fixed_costs',l:'Fixed Costs',ph:'Rent, loans...'},{k:'variable_costs',l:'Variable',ph:'Food, gas...'},{k:'stability_target',l:'Target',ph:'Safety number'}].map(f => (
                <div key={f.k}>
                  <label className="input-label" style={{ fontSize: 9 }}>{f.l}</label>
                  <input className="input-field" value={budget[f.k] || ''} onChange={async e => { const n = {...budget,[f.k]:+e.target.value||0}; setBudget(n); await supabase.from('user_budget').upsert({user_id:user.id,...n}) }} placeholder={f.ph} style={{ fontSize: 13, padding: '8px 12px' }}/>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
              {[{l:'Spend',v:'$'+(budgCalc.spend||0).toLocaleString(),c:'#dc2626'},{l:'Left',v:'$'+(budgCalc.left||0).toLocaleString(),c:budgCalc.left>=0?'#16a34a':'#dc2626'},{l:'Target',v:budget.stability_target?'$'+Number(budget.stability_target).toLocaleString():'—',c:'var(--navy)'}].map(s => (
                <div key={s.l} style={{ padding: 8, background: 'var(--surface)', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: s.c }}>{s.v}</div>
                  <div className="eyebrow" style={{ fontSize: 8, marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Savings */}
          {savings.length > 0 && (
            <div className="card" style={{ padding: 18 }}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>💰 Savings Goals</div>
              {savings.map(sg => {
                const p = Math.min(100, sg.target_amount > 0 ? Math.round(sg.current_amount / sg.target_amount * 100) : 0)
                return (
                  <div key={sg.id} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{sg.name}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>${Number(sg.current_amount).toLocaleString()}/${Number(sg.target_amount).toLocaleString()}</span>
                    </div>
                    <div className="progress-track"><div className="progress-fill" style={{ width: p + '%', background: 'var(--navy)' }}/></div>
                    <input className="input-field" placeholder="Update current amount" style={{ marginTop: 6, fontSize: 12, padding: '6px 10px' }}
                      onBlur={async e => { const v = parseFloat(e.target.value); if (!isNaN(v)) { const n = savings.map(s => s.id === sg.id ? {...s,current_amount:v} : s); setSavings(n); await supabase.from('savings_goals').update({current_amount:v}).eq('id',sg.id); e.target.value=''; } }}/>
                  </div>
                )
              })}
            </div>
          )}

          {/* Settings reminder */}
          <div className="card" style={{ padding: 18, background: 'var(--surface)', border: '1px dashed var(--border)' }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>💡 Coach's Reminder</div>
            <p style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--text-2)', lineHeight: 1.75 }}>
              "You don't need certainty before action. You need self-trust. The goal isn't to solve your whole life. It's to stabilize the next step."
            </p>
            <p style={{ marginTop: 10, fontSize: 11, fontWeight: 800, color: 'var(--primary)' }}>WHAT ARE YOU GOING TO DO NEXT?</p>
          </div>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
