import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { signOut } from '../lib/supabase'

const TIERS = [
  { min: 0,  label: 'GET MOVING', color: '#f43f5e', bg: '#1c000a' },
  { min: 25, label: 'WARMING UP', color: '#a78bfa', bg: '#1e0050' },
  { min: 45, label: 'BUILDING',   color: '#f97316', bg: '#1c0a00' },
  { min: 60, label: 'SOLID',      color: '#3b82f6', bg: '#0f1e35' },
  { min: 75, label: 'STRONG',     color: '#22c55e', bg: '#052e16' },
  { min: 90, label: 'ELITE',      color: '#f59e0b', bg: '#1c1200' },
]
const PRI_PTS = { high: 8, medium: 5, low: 3 }
const getTier = (pct) => TIERS.reduce((a, t) => pct >= t.min ? t : a, TIERS[0])
const TODAY = new Date().toISOString().split('T')[0]
const DOW = new Date().getDay()
const IS_WEEKEND = DOW === 0 || DOW === 6
const GREETING = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Home() {
  const { user, profile, settings } = useAuth()
  const navigate = useNavigate()
  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  const [score, setScore] = useState({ pct: 0, earned: 0, max: 0, tier: TIERS[0] })
  const [tasks, setTasks] = useState([])
  const [completedIds, setCompletedIds] = useState([])
  const [habits, setHabits] = useState([])
  const [completedHabitIds, setCompletedHabitIds] = useState([])
  const [focus, setFocus] = useState('')
  const [focusInput, setFocusInput] = useState('')
  const [coachMsg, setCoachMsg] = useState('')
  const [coachLoading, setCoachLoading] = useState(false)
  const [briefing, setBriefing] = useState(null)
  const [weeklyReport, setWeeklyReport] = useState(null)
  const [wins, setWins] = useState([])
  const [confidence, setConfidence] = useState(5)
  const [memory, setMemory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const coachGenRef = useRef(false)

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  useEffect(() => { if (user) loadAll() }, [user])

  const loadAll = async () => {
    const [tasksRes, compRes, habitsRes, habCompRes, focusRes, winsRes, confRes, briefingRes, memRes, reportRes] = await Promise.all([
      supabase.from('user_tasks').select('*').eq('user_id', user.id).eq('is_active', true),
      supabase.from('daily_task_completions').select('task_id').eq('user_id', user.id).eq('completed_date', TODAY),
      supabase.from('user_habits').select('*').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
      supabase.from('habit_completions').select('habit_id').eq('user_id', user.id).eq('completed_date', TODAY),
      supabase.from('daily_focus').select('task_text').eq('user_id', user.id).eq('focus_date', TODAY).single(),
      supabase.from('user_logs').select('*').eq('user_id', user.id).eq('log_type', 'win').order('logged_at', {ascending:false}).limit(5),
      supabase.from('confidence_logs').select('score').eq('user_id', user.id).eq('logged_date', TODAY).single(),
      supabase.from('daily_briefings').select('*').eq('user_id', user.id).eq('briefing_date', TODAY).single(),
      supabase.from('coach_memory').select('*').eq('user_id', user.id).single(),
      supabase.from('weekly_reports').select('*').eq('user_id', user.id).order('week_start',{ascending:false}).limit(1).single(),
    ])

    const t = tasksRes.data || []
    const cIds = (compRes.data || []).map(c => c.task_id)
    const h = habitsRes.data || []
    const hIds = (habCompRes.data || []).map(c => c.habit_id)
    const f = focusRes.data?.task_text || ''
    const w = winsRes.data || []
    const conf = confRes.data?.score || 5

    setTasks(t); setCompletedIds(cIds); setHabits(h); setCompletedHabitIds(hIds)
    setFocus(f); setFocusInput(f); setWins(w); setConfidence(conf)
    setBriefing(briefingRes.data || null)
    setMemory(memRes.data || null)
    setWeeklyReport(reportRes.data || null)

    const sc = computeScore(t, cIds, h, hIds, !!f, w.length, conf)
    setScore(sc)
    setLoading(false)

    // Generate coach message once
    if (!coachGenRef.current) {
      coachGenRef.current = true
      setTimeout(() => generateCoach(t, cIds, h, hIds, f, w.length, conf, memRes.data), 800)
    }
  }

  const computeScore = (tasks, cIds, habits, hIds, hasFocus, winsCount, conf) => {
    const cats = IS_WEEKEND ? ['personal','financial','health','family'] : ['work','personal','financial','health','family']
    const active = tasks.filter(t => cats.includes(t.category))
    const earned = active.filter(t => cIds.includes(t.id)).reduce((a,t) => a+(PRI_PTS[t.priority]||5), 0)
    const max = active.reduce((a,t) => a+(PRI_PTS[t.priority]||5), 0)
    const habPts = hIds.length * 10
    const focusPts = hasFocus ? 5 : 0
    const winPts = Math.min(winsCount, 2) * 3
    const confPts = conf > 0 ? Math.min(4, Math.round(conf/2.5)) : 0
    const totalEarned = earned + habPts + focusPts + winPts + confPts
    const totalMax = (max||0) + habits.length*10 + 5 + 6 + 4
    const pct = totalMax > 0 ? Math.round(totalEarned/totalMax*100) : 0
    return { pct, earned: totalEarned, max: totalMax, tier: getTier(pct) }
  }

  const generateCoach = async (tasks, cIds, habits, hIds, focus, winsCount, conf, mem) => {
    setCoachLoading(true)
    const sc = computeScore(tasks, cIds, habits, hIds, !!focus, winsCount, conf)
    const h = new Date().getHours()
    const tod = h<9?'morning':h<13?'mid-morning':h<17?'afternoon':h<20?'evening':'night'
    const catBreakdown = ['work','personal','financial'].map(c => {
      const ct = tasks.filter(t=>t.category===c)
      return `${c}: ${ct.filter(t=>cIds.includes(t.id)).length}/${ct.length}`
    }).join(', ')

    const memContext = mem ? `Past patterns: avg score ${mem.avg_weekly_score || 'unknown'}, strongest category: ${mem.strongest_category || 'unknown'}, weakest: ${mem.weakest_category || 'unknown'}, days logged: ${mem.total_days_logged || 0}. Recurring blockers: ${(mem.recurring_blockers||[]).join(', ')||'none noted'}.` : ''

    try {
      const r = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: `You are ${firstName}'s personal AI life coach. You know them well and remember their patterns. Be direct, specific, and personal — never generic. 3-4 sentences max. End with one sharp action or challenge.`,
          messages: [{ role: 'user', content: `${tod} check-in. Score: ${sc.pct}/100 (${sc.tier.label}) — ${sc.earned}/${sc.max} pts. Tasks: ${catBreakdown}. Habits done: ${hIds.length}/${habits.length}. Confidence: ${conf}/10. Goal: "${settings?.primary_goal||'not set'}". ${memContext} Give a direct, personalized coaching message.` }]
        })
      })
      const d = await r.json()
      setCoachMsg(d.reply || '')
    } catch { setCoachMsg('Show up. Do the work. Your score is waiting.') }
    setCoachLoading(false)
  }

  const toggleTask = async (taskId) => {
    const isOn = completedIds.includes(taskId)
    const newIds = isOn ? completedIds.filter(id=>id!==taskId) : [...completedIds, taskId]
    setCompletedIds(newIds)
    if (isOn) {
      await supabase.from('daily_task_completions').delete().eq('user_id',user.id).eq('task_id',taskId).eq('completed_date',TODAY)
    } else {
      await supabase.from('daily_task_completions').upsert({user_id:user.id,task_id:taskId,completed_date:TODAY})
      showToast('Task done ✓')
    }
    const newSc = computeScore(tasks, newIds, habits, completedHabitIds, !!focus, wins.length, confidence)
    setScore(newSc)
    saveScore(newIds, completedHabitIds, focus, wins.length, confidence)
  }

  const toggleHabit = async (habitId) => {
    const isOn = completedHabitIds.includes(habitId)
    const newIds = isOn ? completedHabitIds.filter(id=>id!==habitId) : [...completedHabitIds, habitId]
    setCompletedHabitIds(newIds)
    if (isOn) await supabase.from('habit_completions').delete().eq('user_id',user.id).eq('habit_id',habitId).eq('completed_date',TODAY)
    else { await supabase.from('habit_completions').upsert({user_id:user.id,habit_id:habitId,completed_date:TODAY}); showToast('Habit logged 🔥') }
    const newSc = computeScore(tasks, completedIds, habits, newIds, !!focus, wins.length, confidence)
    setScore(newSc)
    saveScore(completedIds, newIds, focus, wins.length, confidence)
  }

  const saveFocus = async () => {
    if (!focusInput.trim()) return
    setFocus(focusInput)
    await supabase.from('daily_focus').upsert({user_id:user.id,focus_date:TODAY,task_text:focusInput.trim()})
    showToast('Focus locked in ✓')
    const newSc = computeScore(tasks, completedIds, habits, completedHabitIds, true, wins.length, confidence)
    setScore(newSc)
    saveScore(completedIds, completedHabitIds, focusInput, wins.length, confidence)
  }

  const saveScore = async (cIds, hIds, f, wCount, conf) => {
    const sc = computeScore(tasks, cIds, habits, hIds, !!f, wCount, conf)
    await supabase.from('daily_scores').upsert({
      user_id: user.id, score_date: TODAY,
      score: sc.pct, tier: sc.tier.label,
      earned_points: sc.earned, max_points: sc.max
    })
  }

  const catSummary = ['work','personal','financial'].map(c => {
    const ct = tasks.filter(t=>t.category===c)
    const done = ct.filter(t=>completedIds.includes(t.id)).length
    return { cat: c, done, total: ct.length }
  }).filter(s => s.total > 0)

  const NEXT_TIER = TIERS[TIERS.findIndex(t=>t.label===score.tier.label)+1]
  const ptsToNext = NEXT_TIER ? Math.round((NEXT_TIER.min/100)*score.max) - score.earned : 0

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'60vh',flexDirection:'column',gap:16}}>
      <div style={{fontSize:32}}>🎯</div>
      <div className="spinner spinner-dark" style={{width:28,height:28}}/>
    </div>
  )

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <p style={{fontSize:13,color:'var(--text-3)',marginBottom:2}}>{GREETING()},</p>
          <h1 style={{fontFamily:"'Fraunces',serif",fontSize:'clamp(24px,5vw,32px)',fontWeight:900,color:'var(--text)',lineHeight:1.1}}>{firstName}</h1>
          <p style={{fontSize:12,color:'var(--text-3)',marginTop:3}}>
            {new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}
            {IS_WEEKEND && <span style={{marginLeft:8,background:'#fff7ed',color:'#c2410c',border:'1px solid #fed7aa',borderRadius:20,padding:'2px 8px',fontSize:11,fontWeight:700}}>🏖️ Weekend</span>}
          </p>
        </div>
        <button onClick={async()=>{await signOut();navigate('/')}} style={{width:38,height:38,borderRadius:'50%',background:'var(--primary)',color:'#fff',border:'none',fontSize:14,fontWeight:800,cursor:'pointer',fontFamily:"'Nunito Sans',sans-serif"}}>
          {firstName.charAt(0).toUpperCase()}
        </button>
      </div>

      {/* Score card */}
      <div className="card" style={{background:score.tier.bg,border:`2px solid ${score.tier.color}30`,padding:0,overflow:'hidden'}}>
        <div style={{padding:'20px 20px 0'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div>
              <div style={{fontSize:10,fontWeight:800,letterSpacing:2,color:score.tier.color,textTransform:'uppercase',marginBottom:8,fontFamily:"'Nunito Sans',sans-serif"}}>🏆 Today's Score</div>
              <div style={{display:'flex',alignItems:'baseline',gap:6}}>
                <span style={{fontFamily:"'Fraunces',serif",fontSize:'clamp(52px,12vw,72px)',fontWeight:900,color:score.tier.color,lineHeight:1}}>{score.pct}</span>
                <span style={{fontSize:22,color:score.tier.color,opacity:.5,fontWeight:700}}>/100</span>
              </div>
              <div style={{fontSize:12,fontWeight:800,letterSpacing:2.5,color:score.tier.color,marginTop:4,fontFamily:"'Nunito Sans',sans-serif"}}>{score.tier.label}</div>
              {NEXT_TIER && ptsToNext > 0 && (
                <div style={{marginTop:6,fontSize:11,color:'rgba(255,255,255,.5)',fontFamily:"'Nunito Sans',sans-serif"}}>
                  {ptsToNext} pts to <span style={{color:NEXT_TIER.color,fontWeight:700}}>{NEXT_TIER.label}</span>
                </div>
              )}
            </div>
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="6"/>
              <circle cx="40" cy="40" r="32" fill="none" stroke={score.tier.color} strokeWidth="6"
                strokeDasharray={2*Math.PI*32} strokeDashoffset={2*Math.PI*32*(1-score.pct/100)}
                strokeLinecap="round" transform="rotate(-90 40 40)" style={{transition:'stroke-dashoffset 1s ease'}}/>
              <text x="40" y="45" textAnchor="middle" fill={score.tier.color} fontSize="16" fontWeight="900" fontFamily="sans-serif">{score.pct}%</text>
            </svg>
          </div>
        </div>

        {/* Category mini bars */}
        <div style={{display:'grid',gridTemplateColumns:`repeat(${catSummary.length},1fr)`,padding:'16px 20px',gap:12,borderTop:'1px solid rgba(255,255,255,.08)',marginTop:16}}>
          {catSummary.map(s => {
            const colors={work:'#1c3d2e',personal:'#7c3d00',financial:'#1e3a5f'}
            const pct = s.total ? Math.round(s.done/s.total*100) : 0
            return (
              <Link key={s.cat} to={`/${s.cat}`} style={{textDecoration:'none'}}>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:'clamp(16px,4vw,20px)',fontWeight:900,color:colors[s.cat]||'#fff',fontFamily:"'Fraunces',serif"}}>{s.done}<span style={{fontSize:11,color:'rgba(255,255,255,.3)',fontWeight:600}}>/{s.total}</span></div>
                  <div style={{fontSize:9,fontWeight:800,letterSpacing:1,color:'rgba(255,255,255,.4)',textTransform:'uppercase',fontFamily:"'Nunito Sans',sans-serif",marginBottom:4}}>{s.cat}</div>
                  <div style={{height:3,background:'rgba(255,255,255,.1)',borderRadius:2}}>
                    <div style={{height:'100%',borderRadius:2,background:colors[s.cat]||'#fff',width:pct+'%',transition:'width .5s'}}/>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Coach message */}
      <div className="card" style={{padding:18}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
          <div style={{width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,var(--primary),#2d5a3d)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>🧠</div>
          <div>
            <div style={{fontSize:13,fontWeight:800,color:'var(--text)',fontFamily:"'Nunito Sans',sans-serif"}}>Your Coach</div>
            <div style={{fontSize:11,color:'var(--text-3)'}}>Personalized to your progress</div>
          </div>
        </div>
        {coachLoading ? (
          <div style={{display:'flex',gap:10,alignItems:'center',padding:'8px 0'}}>
            <div className="spinner spinner-dark"/><span style={{fontSize:13,color:'var(--text-3)'}}>Reading your data...</span>
          </div>
        ) : coachMsg ? (
          <div style={{background:'var(--surface)',borderRadius:10,padding:'12px 14px',borderLeft:`4px solid ${score.tier.color}`}}>
            <p style={{fontSize:14,lineHeight:1.75,color:'var(--text)',fontWeight:500,fontFamily:"'Nunito Sans',sans-serif"}}>{coachMsg}</p>
          </div>
        ) : null}
        <div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}>
          <Link to="/coach" style={{padding:'7px 14px',borderRadius:20,background:'var(--primary-light)',color:'var(--primary)',fontSize:12,fontWeight:700,border:'1px solid var(--primary)',textDecoration:'none',fontFamily:"'Nunito Sans',sans-serif"}}>💬 Talk to coach</Link>
          <Link to="/voice" style={{padding:'7px 14px',borderRadius:20,background:'var(--surface)',color:'var(--text-2)',fontSize:12,fontWeight:700,border:'1px solid var(--border)',textDecoration:'none',fontFamily:"'Nunito Sans',sans-serif"}}>🎙️ Voice session</Link>
        </div>
      </div>

      {/* Focus task */}
      <div className="card" style={{padding:18}}>
        <div className="eyebrow" style={{marginBottom:10}}>⚡ Today's #1 Non-Negotiable</div>
        <div style={{display:'flex',gap:8}}>
          <input className="input-field" value={focusInput} onChange={e=>setFocusInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&saveFocus()} placeholder="What MUST happen today?"/>
          <button className="btn btn-primary btn-sm" onClick={saveFocus}>Lock In</button>
        </div>
        {focus && <p style={{marginTop:8,fontSize:14,fontWeight:700,color:'var(--primary)'}}>→ {focus}</p>}
      </div>

      {/* Habits */}
      <div className="card" style={{padding:18}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <div>
            <div className="eyebrow" style={{marginBottom:3}}>🔥 Daily Habits</div>
            <div style={{fontSize:15,fontWeight:900,color:'var(--primary)',fontFamily:"'Fraunces',serif"}}>{completedHabitIds.length}/{habits.length} done</div>
          </div>
          <div style={{display:'flex',gap:6}}>
            {habits.slice(0,4).map(h => (
              <button key={h.id} onClick={()=>toggleHabit(h.id)} title={h.name} style={{
                width:46,height:46,borderRadius:'50%',border:`3px solid ${completedHabitIds.includes(h.id)?'var(--primary)':'var(--border)'}`,
                background:completedHabitIds.includes(h.id)?'var(--primary-light)':'var(--card)',
                fontSize:20,cursor:'pointer',transition:'all .2s',display:'flex',alignItems:'center',justifyContent:'center'
              }}>{h.icon}</button>
            ))}
          </div>
        </div>
        <div style={{height:4,background:'var(--surface-2)',borderRadius:2,overflow:'hidden'}}>
          <div style={{height:'100%',background:'var(--primary)',borderRadius:2,width:(habits.length?Math.round(completedHabitIds.length/habits.length*100):0)+'%',transition:'width .5s'}}/>
        </div>
      </div>

      {/* Today's top tasks - first 3 across categories */}
      <div className="card" style={{padding:18}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <div className="eyebrow">📋 Today's Tasks</div>
          <Link to={IS_WEEKEND?'/personal':'/work'} style={{fontSize:12,fontWeight:700,color:'var(--primary)',textDecoration:'none',fontFamily:"'Nunito Sans',sans-serif"}}>See all →</Link>
        </div>
        {tasks.filter(t=>!IS_WEEKEND||t.category!=='work').filter(t=>t.priority==='high').slice(0,5).map(task => (
          <div key={task.id} className="task-row" onClick={()=>toggleTask(task.id)}>
            <div className={`check-circle${completedIds.includes(task.id)?' checked':''}`}/>
            <div style={{width:6,height:6,borderRadius:'50%',background:task.category==='work'?'#1c3d2e':task.category==='personal'?'#7c3d00':'#1e3a5f',flexShrink:0,marginTop:7}}/>
            <div style={{flex:1}}>
              <span style={{fontSize:14,lineHeight:1.5,textDecoration:completedIds.includes(task.id)?'line-through':'none',opacity:completedIds.includes(task.id)?.5:1}}>{task.text}</span>
              <span style={{display:'inline-block',marginLeft:8,fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase'}}>{task.category}</span>
            </div>
          </div>
        ))}
        {tasks.filter(t=>t.priority==='high').length === 0 && (
          <p style={{fontSize:13,color:'var(--text-3)',textAlign:'center',padding:'12px 0'}}>No tasks yet — go to Work, Personal, or Financial to add some.</p>
        )}
      </div>

      {/* Weekly report preview */}
      {weeklyReport && (
        <div className="card" style={{padding:18,background:'var(--surface)'}}>
          <div className="eyebrow" style={{marginBottom:10}}>📊 Last Week</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:12}}>
            {[
              {l:'Avg Score',v:weeklyReport.avg_score,c:'var(--primary)'},
              {l:'Best Day',v:weeklyReport.best_score,c:'#f59e0b'},
              {l:'Habits',v:Math.round(weeklyReport.habit_completion_rate||0)+'%',c:'#065f46'}
            ].map(s=>(
              <div key={s.l} style={{textAlign:'center',padding:10,background:'#fff',borderRadius:10}}>
                <div style={{fontSize:20,fontWeight:900,color:s.c,fontFamily:"'Fraunces',serif"}}>{s.v}</div>
                <div className="eyebrow" style={{fontSize:9,marginTop:3}}>{s.l}</div>
              </div>
            ))}
          </div>
          {weeklyReport.coach_summary && <p style={{fontSize:13,color:'var(--text-2)',lineHeight:1.65,fontStyle:'italic'}}>{weeklyReport.coach_summary}</p>}
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
