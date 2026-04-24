import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const PRI_PTS = { high: 8, medium: 5, low: 3 }
const TODAY = new Date().toISOString().split('T')[0]

const PILLAR_CONFIG = {
  work: {
    label: 'Work', icon: '💼', color: '#1c3d2e', light: '#f0fdf4', border: '#86efac',
    emoji: '💼',
    coachPersonality: 'career and performance coach. Focus on productivity, advancement, output, managing stress at work, and building professional momentum.',
    prompts: ["What's blocking me at work?","How do I handle my boss?","I'm burnt out","How do I get promoted?","My workload is too much"]
  },
  personal: {
    label: 'Personal', icon: '🏃', color: '#7c3d00', light: '#fff7ed', border: '#fdba74',
    emoji: '🏠',
    coachPersonality: 'personal development and lifestyle coach. Focus on habits, morning routine, mental health, relationships, family, and building a consistent daily practice.',
    prompts: ["Help me build a morning routine","I keep skipping the gym","Family stress is getting to me","How do I build better habits?","I need more energy"]
  },
  financial: {
    label: 'Financial', icon: '💰', color: '#1e3a5f', light: '#eff6ff', border: '#93c5fd',
    emoji: '📈',
    coachPersonality: 'financial accountability coach. Focus on budgeting, saving, debt reduction, income growth, and building financial stability and freedom.',
    prompts: ["I'm living paycheck to paycheck","How do I start saving?","I have too much debt","How do I increase my income?","Review my budget"]
  }
}

export default function PillarPage({ category }) {
  const { user, settings } = useAuth()
  const config = PILLAR_CONFIG[category]
  const [tasks, setTasks] = useState([])
  const [completedIds, setCompletedIds] = useState([])
  const [goals, setGoals] = useState([])
  const [msgs, setMsgs] = useState([])
  const [chatIn, setChatIn] = useState('')
  const [chatLoad, setChatLoad] = useState(false)
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTask, setNewTask] = useState('')
  const [newPriority, setNewPriority] = useState('medium')
  const [showAddGoal, setShowAddGoal] = useState(false)
  const [goalForm, setGoalForm] = useState({ title: '', description: '', target_date: '', target_metric: '' })
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const chatEndRef = useRef ? null : null
  const { useRef } = require ? {} : {}

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  useEffect(() => { if (user) loadData() }, [user, category])

  const loadData = async () => {
    const [tasksRes, compRes, goalsRes] = await Promise.all([
      supabase.from('user_tasks').select('*').eq('user_id', user.id).eq('category', category).eq('is_active', true).order('priority').order('sort_order'),
      supabase.from('daily_task_completions').select('task_id').eq('user_id', user.id).eq('completed_date', TODAY),
      supabase.from('user_goals').select('*').eq('user_id', user.id).eq('category', category).eq('status', 'active').order('priority')
    ])
    setTasks(tasksRes.data || [])
    setCompletedIds((compRes.data || []).map(c => c.task_id))
    setGoals(goalsRes.data || [])
    setLoading(false)

    // Opening coach message for this pillar
    const openingPrompt = `I'm checking in on my ${config.label.toLowerCase()} progress. My current goal: "${settings?.primary_goal || 'not set'}". I have ${tasksRes.data?.length || 0} ${category} tasks and ${(compRes.data||[]).length} completed today. Give me a brief, direct ${category} coaching message to start this session. 2-3 sentences max.`
    setMsgs([{ role: 'ai', content: '...' }])
    try {
      const r = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: `You are a ${config.coachPersonality} Keep responses to 3-4 sentences. Be direct and actionable.`,
          messages: [{ role: 'user', content: openingPrompt }]
        })
      })
      const d = await r.json()
      setMsgs([{ role: 'ai', content: d.reply || `Let's work on your ${category} goals today.` }])
    } catch {
      setMsgs([{ role: 'ai', content: `Let's focus on your ${category} goals. What do you need to tackle first?` }])
    }
  }

  const toggleTask = async (taskId) => {
    const isOn = completedIds.includes(taskId)
    const newIds = isOn ? completedIds.filter(id => id !== taskId) : [...completedIds, taskId]
    setCompletedIds(newIds)
    if (isOn) await supabase.from('daily_task_completions').delete().eq('user_id', user.id).eq('task_id', taskId).eq('completed_date', TODAY)
    else { await supabase.from('daily_task_completions').upsert({ user_id: user.id, task_id: taskId, completed_date: TODAY }); showToast('Done ✓ +' + (PRI_PTS[tasks.find(t=>t.id===taskId)?.priority]||5) + ' pts') }
  }

  const addTask = async () => {
    if (!newTask.trim()) return
    const { data } = await supabase.from('user_tasks').insert({
      user_id: user.id, category, text: newTask.trim(), priority: newPriority, is_active: true, sort_order: tasks.length
    }).select().single()
    if (data) { setTasks(p => [...p, data]); showToast('Task added ✓') }
    setNewTask(''); setShowAddTask(false)
  }

  const deleteTask = async (id) => {
    await supabase.from('user_tasks').update({ is_active: false }).eq('id', id).eq('user_id', user.id)
    setTasks(p => p.filter(t => t.id !== id))
  }

  const addGoal = async () => {
    if (!goalForm.title.trim()) return
    const { data } = await supabase.from('user_goals').insert({
      user_id: user.id, category, ...goalForm, status: 'active', priority: 'high'
    }).select().single()
    if (data) { setGoals(p => [...p, data]); showToast('Goal added ✓') }
    setGoalForm({ title: '', description: '', target_date: '', target_metric: '' })
    setShowAddGoal(false)
  }

  const completeGoal = async (id) => {
    await supabase.from('user_goals').update({ status: 'completed' }).eq('id', id)
    setGoals(p => p.filter(g => g.id !== id))
    showToast('Goal completed! 🎉')
  }

  const sendChat = async () => {
    if (!chatIn.trim() || chatLoad) return
    const userMsg = { role: 'user', content: chatIn.trim() }
    const newMsgs = [...msgs, userMsg]
    setMsgs(newMsgs); setChatIn(''); setChatLoad(true)
    try {
      const taskContext = `Current ${category} tasks: ${tasks.map(t=>`${t.text} (${completedIds.includes(t.id)?'done':'pending'}, ${t.priority})`).join('; ')}`
      const r = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: `You are a ${config.coachPersonality} Context: ${taskContext}. User goal: "${settings?.primary_goal||'not set'}". Direct, warm, 3-4 sentences, end with one specific next step.`,
          messages: newMsgs.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content }))
        })
      })
      const d = await r.json()
      setMsgs(p => [...p, { role: 'ai', content: d.reply || 'Keep going.' }])
    } catch { setMsgs(p => [...p, { role: 'ai', content: 'Trouble connecting.' }]) }
    setChatLoad(false)
  }

  const doneTasks = tasks.filter(t => completedIds.includes(t.id))
  const pendingTasks = tasks.filter(t => !completedIds.includes(t.id))
  const pct = tasks.length ? Math.round(doneTasks.length / tasks.length * 100) : 0

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}><div className="spinner spinner-dark"/></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: config.light, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, border: `1.5px solid ${config.border}` }}>{config.icon}</div>
            <div>
              <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 'clamp(22px,5vw,28px)', fontWeight: 900 }}>{config.label}</h1>
              <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{doneTasks.length}/{tasks.length} tasks · {goals.length} active goals</p>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 'clamp(22px,5vw,28px)', fontWeight: 900, color: config.color, fontFamily: "'Fraunces',serif" }}>{pct}%</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>today</div>
        </div>
      </div>

      {/* Progress */}
      <div className="progress-track">
        <div className="progress-fill" style={{ width: pct + '%', background: config.color }} />
      </div>

      {/* AI Coach Chat */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: config.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🧠</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{config.label} Coach</div>
        </div>
        <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
          {msgs.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'bubble-user' : 'bubble-ai'}>
              {m.content === '...' ? <div className="spinner spinner-dark" style={{ width: 14, height: 14 }} /> : m.content}
            </div>
          ))}
          {chatLoad && <div className="bubble-ai"><div className="spinner spinner-dark" style={{ width: 14, height: 14 }} /></div>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input-field" value={chatIn} onChange={e => setChatIn(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} placeholder={`Ask your ${config.label.toLowerCase()} coach...`} style={{ fontSize: 13 }} />
          <button className="btn btn-primary btn-sm" onClick={sendChat} disabled={chatLoad || !chatIn.trim()} style={{ opacity: chatLoad || !chatIn.trim() ? .5 : 1 }}>
            {chatLoad ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '→'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {config.prompts.map(p => (
            <button key={p} onClick={() => setChatIn(p)} style={{ background: config.light, border: `1px solid ${config.border}`, borderRadius: 20, padding: '5px 10px', fontSize: 11, fontWeight: 700, color: config.color, cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif" }}>{p}</button>
          ))}
        </div>
      </div>

      {/* Goals */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div className="eyebrow">🎯 {config.label} Goals</div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddGoal(p => !p)} style={{ background: config.color }}>{showAddGoal ? '✕' : '+ Goal'}</button>
        </div>

        {showAddGoal && (
          <div style={{ background: config.light, borderRadius: 12, padding: 16, marginBottom: 14, border: `1.5px solid ${config.border}` }}>
            <input className="input-field" value={goalForm.title} onChange={e => setGoalForm(p => ({ ...p, title: e.target.value }))} placeholder="What's the goal? Be specific." style={{ marginBottom: 8, fontSize: 13 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <input className="input-field" value={goalForm.target_metric} onChange={e => setGoalForm(p => ({ ...p, target_metric: e.target.value }))} placeholder="Target (e.g. Save $5000)" style={{ fontSize: 12 }} />
              <input type="date" className="input-field" value={goalForm.target_date} onChange={e => setGoalForm(p => ({ ...p, target_date: e.target.value }))} style={{ fontSize: 12 }} />
            </div>
            <textarea className="input-field" rows={2} value={goalForm.description} onChange={e => setGoalForm(p => ({ ...p, description: e.target.value }))} placeholder="Why does this matter? (optional)" style={{ resize: 'none', fontSize: 12, marginBottom: 8 }} />
            <button className="btn btn-primary btn-full" onClick={addGoal} style={{ background: config.color, fontSize: 13 }}>Add Goal</button>
          </div>
        )}

        {goals.map(goal => (
          <div key={goal.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: config.color, flexShrink: 0, marginTop: 6 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{goal.title}</p>
              {goal.target_metric && <p style={{ fontSize: 12, color: config.color, fontWeight: 600 }}>Target: {goal.target_metric}</p>}
              {goal.target_date && <p style={{ fontSize: 11, color: 'var(--text-3)' }}>By {new Date(goal.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>}
              {goal.description && <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, fontStyle: 'italic' }}>{goal.description}</p>}
            </div>
            <button onClick={() => completeGoal(goal.id)} style={{ padding: '4px 10px', borderRadius: 6, background: config.light, border: `1px solid ${config.border}`, color: config.color, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif", flexShrink: 0 }}>Done ✓</button>
          </div>
        ))}
        {goals.length === 0 && !showAddGoal && <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '8px 0' }}>No active goals — add one to give your coach context.</p>}
      </div>

      {/* Daily Tasks */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div className="eyebrow">📋 Daily Tasks</div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddTask(p => !p)} style={{ background: config.color }}>{showAddTask ? '✕' : '+ Task'}</button>
        </div>

        {showAddTask && (
          <div style={{ background: config.light, borderRadius: 10, padding: 14, marginBottom: 14, border: `1.5px solid ${config.border}` }}>
            <input className="input-field" value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} placeholder="What's the task?" style={{ marginBottom: 8, fontSize: 13 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              {['high', 'medium', 'low'].map(p => (
                <button key={p} onClick={() => setNewPriority(p)} style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: '1.5px solid', borderColor: newPriority === p ? config.color : 'var(--border)', background: newPriority === p ? config.light : 'var(--card)', color: newPriority === p ? config.color : 'var(--text-2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif" }}>
                  {p === 'high' ? '🔴' : p === 'medium' ? '🟡' : '🟢'} {p}
                </button>
              ))}
            </div>
            <button className="btn btn-primary btn-full" onClick={addTask} style={{ marginTop: 10, background: config.color, fontSize: 13 }}>Add Task</button>
          </div>
        )}

        {pendingTasks.length === 0 && doneTasks.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>No tasks yet. Add one above or ask your coach to suggest some.</p>
        )}

        {pendingTasks.map(task => (
          <div key={task.id} className="task-row" onClick={() => toggleTask(task.id)}>
            <div className="check-circle" />
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: task.priority === 'high' ? '#dc2626' : task.priority === 'medium' ? '#d97706' : '#16a34a', flexShrink: 0, marginTop: 7 }} />
            <span style={{ flex: 1, fontSize: 14, lineHeight: 1.5 }}>{task.text}</span>
            <span style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0 }}>+{PRI_PTS[task.priority]||5}pts</span>
            <button onClick={e => { e.stopPropagation(); deleteTask(task.id) }} style={{ background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', fontSize: 16, padding: '0 4px', flexShrink: 0 }}>×</button>
          </div>
        ))}

        {doneTasks.length > 0 && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div className="eyebrow" style={{ marginBottom: 8, fontSize: 9 }}>Completed today</div>
            {doneTasks.map(task => (
              <div key={task.id} className="task-row" onClick={() => toggleTask(task.id)} style={{ opacity: .6 }}>
                <div className="check-circle checked" />
                <span style={{ flex: 1, fontSize: 13, textDecoration: 'line-through', color: 'var(--text-3)' }}>{task.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
