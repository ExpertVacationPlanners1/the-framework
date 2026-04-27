import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const TODAY = new Date().toISOString().split('T')[0]
const NOW_HOUR = new Date().getHours()
const TOD = NOW_HOUR < 12 ? 'morning' : NOW_HOUR < 17 ? 'afternoon' : 'evening'

const STATUS_CONFIG = {
  todo:        { label: 'To Do',       color: '#6b7280', bg: '#f9fafb', icon: '○' },
  in_progress: { label: 'In Progress', color: '#2563eb', bg: '#eff6ff', icon: '◐' },
  blocked:     { label: 'Blocked',     color: '#dc2626', bg: '#fef2f2', icon: '✕' },
  review:      { label: 'Review',      color: '#d97706', bg: '#fffbeb', icon: '◎' },
  done:        { label: 'Done',        color: '#16a34a', bg: '#f0fdf4', icon: '✓' },
}

const PRIORITY_CONFIG = {
  critical: { label: 'Critical', color: '#dc2626', dot: '🔴' },
  high:     { label: 'High',     color: '#f97316', dot: '🟠' },
  medium:   { label: 'Medium',   color: '#f59e0b', dot: '🟡' },
  low:      { label: 'Low',      color: '#22c55e', dot: '🟢' },
}

const EA_PROMPTS = [
  { label: "Plan my day", prompt: "Based on my open tasks and priorities, help me plan the most productive day possible today." },
  { label: "Prioritize my tasks", prompt: "Look at all my open tasks and tell me exactly what order I should tackle them and why." },
  { label: "I'm overwhelmed", prompt: "I'm overwhelmed with my workload. Help me triage what's actually important versus what can wait." },
  { label: "Weekly plan", prompt: "Help me create a focused plan for the rest of this work week based on my tasks and priorities." },
  { label: "What am I avoiding?", prompt: "Looking at my task list, what important thing am I most likely avoiding and why?" },
  { label: "EOD summary", prompt: "Give me an end-of-day summary format to reflect on what I accomplished and what's next." },
]

export default function Work() {
  const { user, settings } = useAuth()

  const [activeTab, setActiveTab] = useState('board')
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [focusLog, setFocusLog] = useState(null)
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  // View modes
  const [viewMode, setViewMode] = useState('board') // board | list | priority
  const [selectedProject, setSelectedProject] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  // Forms
  const [showAddTask, setShowAddTask] = useState(false)
  const [showAddProject, setShowAddProject] = useState(false)
  const [showAddMeeting, setShowAddMeeting] = useState(false)
  const [editingTask, setEditingTask] = useState(null)

  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'medium', status: 'todo', due_date: '', is_urgent: false, is_important: true, estimated_minutes: '' })
  const [projectForm, setProjectForm] = useState({ name: '', description: '', color: '#1c3d2e', icon: '📁', priority: 'medium', due_date: '' })
  const [meetingForm, setMeetingForm] = useState({ title: '', meeting_date: TODAY, attendees: '', agenda: '', notes: '', action_items: '' })
  const [focusForm, setFocusForm] = useState({ current_focus: '', blockers: '', wins: '', energy_level: 7, stress_level: 5 })

  // EA Chat
  const [msgs, setMsgs] = useState([])
  const [chatIn, setChatIn] = useState('')
  const [chatLoad, setChatLoad] = useState(false)
  const chatEndRef = useRef(null)

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  useEffect(() => { if (user) load() }, [user])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  const load = async () => {
    setLoading(true)
    const [projR, tasksR, focusR, meetR] = await Promise.all([
      supabase.from('work_projects').select('*').eq('user_id', user.id).eq('status', 'active').order('sort_order'),
      supabase.from('work_tasks').select('*').eq('user_id', user.id).neq('status', 'done').order('priority').order('due_date'),
      supabase.from('work_focus_log').select('*').eq('user_id', user.id).eq('log_date', TODAY).single(),
      supabase.from('meeting_notes').select('*').eq('user_id', user.id).order('meeting_date', { ascending: false }).limit(5),
    ])
    setProjects(projR.data || [])
    setTasks(tasksR.data || [])
    setFocusLog(focusR.data || null)
    setMeetings(meetR.data || [])

    if (!focusR.data) {
      setFocusForm({ current_focus: '', blockers: '', wins: '', energy_level: 7, stress_level: 5 })
    } else {
      setFocusForm({ current_focus: focusR.data.current_focus || '', blockers: focusR.data.blockers || '', wins: focusR.data.wins || '', energy_level: focusR.data.energy_level || 7, stress_level: focusR.data.stress_level || 5 })
    }

    // Load EA greeting
    loadEAGreeting(projR.data || [], tasksR.data || [])
    setLoading(false)
  }

  const loadEAGreeting = async (projs, taskList) => {
    const urgent = taskList.filter(t => t.priority === 'critical' || t.is_urgent).length
    const overdue = taskList.filter(t => t.due_date && t.due_date < TODAY).length
    const openCount = taskList.length

    setMsgs([{ role: 'ai', content: `Good ${TOD}. You have ${openCount} open tasks${urgent > 0 ? `, ${urgent} urgent` : ''}${overdue > 0 ? `, and ${overdue} overdue` : ''}. ${urgent > 0 ? 'Let\'s tackle the urgent ones first.' : 'What\'s your focus today?'}` }])
  }

  const addTask = async () => {
    if (!taskForm.title) return
    const { data } = await supabase.from('work_tasks').insert({
      user_id: user.id, ...taskForm,
      estimated_minutes: +taskForm.estimated_minutes || null,
      project_id: selectedProject !== 'all' ? selectedProject : null
    }).select().single()
    if (data) { setTasks(p => [data, ...p]); showToast('Task added ✓') }
    setTaskForm({ title: '', description: '', priority: 'medium', status: 'todo', due_date: '', is_urgent: false, is_important: true, estimated_minutes: '' })
    setShowAddTask(false)
  }

  const updateTaskStatus = async (id, status) => {
    const completedAt = status === 'done' ? new Date().toISOString() : null
    await supabase.from('work_tasks').update({ status, completed_at: completedAt }).eq('id', id)
    if (status === 'done') {
      setTasks(p => p.filter(t => t.id !== id))
      showToast('Task done! 🎉')
    } else {
      setTasks(p => p.map(t => t.id === id ? { ...t, status } : t))
    }
  }

  const addProject = async () => {
    if (!projectForm.name) return
    const { data } = await supabase.from('work_projects').insert({ user_id: user.id, ...projectForm }).select().single()
    if (data) { setProjects(p => [...p, data]); showToast('Project created ✓') }
    setProjectForm({ name: '', description: '', color: '#1c3d2e', icon: '📁', priority: 'medium', due_date: '' })
    setShowAddProject(false)
  }

  const saveFocusLog = async () => {
    const data = { user_id: user.id, log_date: TODAY, ...focusForm }
    const { data: saved } = await supabase.from('work_focus_log').upsert(data).select().single()
    if (saved) { setFocusLog(saved); showToast('Focus log saved ✓') }
  }

  const addMeeting = async () => {
    if (!meetingForm.title) return
    const actionItems = meetingForm.action_items ? meetingForm.action_items.split('\n').filter(Boolean) : []
    const { data } = await supabase.from('meeting_notes').insert({ user_id: user.id, ...meetingForm, action_items: actionItems }).select().single()
    if (data) { setMeetings(p => [data, ...p]); showToast('Meeting notes saved ✓') }
    setMeetingForm({ title: '', meeting_date: TODAY, attendees: '', agenda: '', notes: '', action_items: '' })
    setShowAddMeeting(false)
  }

  const sendEA = async (text) => {
    const content = (text || chatIn).trim()
    if (!content || chatLoad) return
    const um = { role: 'user', content }
    const nm = [...msgs, um]
    setMsgs(nm); setChatIn(''); setChatLoad(true)

    // Build task context
    const taskCtx = tasks.slice(0, 8).map(t => `"${t.title}" (${t.priority} priority, ${t.status}${t.due_date ? ', due ' + t.due_date : ''})`).join('\n')
    const projCtx = projects.map(p => p.name).join(', ')
    const blocked = tasks.filter(t => t.status === 'blocked').map(t => t.title).join(', ')

    try {
      const r = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: `You are ${(settings?.primary_goal || 'their goals').split(' ')[0]}'s personal executive assistant — direct, strategic, no fluff.

Context:
- Open tasks:\n${taskCtx || 'none'}
- Projects: ${projCtx || 'none'}
- Blocked items: ${blocked || 'none'}
- Today's focus: ${focusLog?.current_focus || focusForm.current_focus || 'not set'}
- Blockers: ${focusLog?.blockers || focusForm.blockers || 'none'}
- Energy: ${focusLog?.energy_level || focusForm.energy_level}/10 | Stress: ${focusLog?.stress_level || focusForm.stress_level}/10
- Goal: "${settings?.primary_goal || 'not set'}"

As their EA: be decisive, prioritize ruthlessly, push back on distractions. 3-5 sentences max. End with one specific next action.`,
          messages: nm.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content }))
        })
      })
      const d = await r.json()
      setMsgs(p => [...p, { role: 'ai', content: d.reply || 'Focus on one thing.' }])
    } catch {
      setMsgs(p => [...p, { role: 'ai', content: 'Connection issue. Try again.' }])
    }
    setChatLoad(false)
  }

  // Computed
  const filteredTasks = tasks.filter(t => {
    if (selectedProject !== 'all' && t.project_id !== selectedProject) return false
    if (filterStatus !== 'all' && t.status !== filterStatus) return false
    return true
  })

  const tasksByStatus = {
    todo: filteredTasks.filter(t => t.status === 'todo'),
    in_progress: filteredTasks.filter(t => t.status === 'in_progress'),
    blocked: filteredTasks.filter(t => t.status === 'blocked'),
    review: filteredTasks.filter(t => t.status === 'review'),
  }

  const urgentTasks = tasks.filter(t => t.priority === 'critical' || t.is_urgent)
  const overdueTasks = tasks.filter(t => t.due_date && t.due_date < TODAY)
  const dueTodayTasks = tasks.filter(t => t.due_date === TODAY)

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}><div className="spinner spinner-dark" style={{ width: 28, height: 28 }} /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <div>
        <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 'clamp(22px,5vw,28px)', fontWeight: 900 }}>Work</h1>
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>Executive assistant · Projects · Tasks · Meetings</p>
      </div>

      {/* Status bar */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
        {[
          { label: `${tasks.length} Open`, color: '#6b7280', bg: '#f9fafb' },
          { label: `${urgentTasks.length} Urgent`, color: urgentTasks.length > 0 ? '#dc2626' : '#6b7280', bg: urgentTasks.length > 0 ? '#fef2f2' : '#f9fafb' },
          { label: `${overdueTasks.length} Overdue`, color: overdueTasks.length > 0 ? '#dc2626' : '#6b7280', bg: overdueTasks.length > 0 ? '#fef2f2' : '#f9fafb' },
          { label: `${dueTodayTasks.length} Due Today`, color: dueTodayTasks.length > 0 ? '#d97706' : '#6b7280', bg: dueTodayTasks.length > 0 ? '#fffbeb' : '#f9fafb' },
        ].map(s => (
          <div key={s.label} style={{ padding: '6px 12px', borderRadius: 20, background: s.bg, border: `1px solid ${s.color}30`, whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: s.color, fontFamily: "'Nunito Sans',sans-serif" }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
        {['board', 'assistant', 'focus', 'meetings'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '7px 14px', borderRadius: 20, border: '1.5px solid',
            borderColor: activeTab === tab ? '#1c3d2e' : 'var(--border)',
            background: activeTab === tab ? '#1c3d2e' : 'var(--card)',
            color: activeTab === tab ? '#fff' : 'var(--text-2)',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            fontFamily: "'Nunito Sans',sans-serif", whiteSpace: 'nowrap'
          }}>{tab === 'board' ? '📋 Board' : tab === 'assistant' ? '🤖 EA Chat' : tab === 'focus' ? '⚡ Focus Log' : '📝 Meetings'}</button>
        ))}
      </div>

      {/* BOARD TAB */}
      {activeTab === 'board' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, fontFamily: "'Nunito Sans',sans-serif", background: 'var(--card)', cursor: 'pointer' }}>
              <option value="all">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 4 }}>
              {['all', 'todo', 'in_progress', 'blocked', 'review'].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: '5px 10px', borderRadius: 20, border: '1px solid', borderColor: filterStatus === s ? '#1c3d2e' : 'var(--border)', background: filterStatus === s ? '#1c3d2e' : 'var(--card)', color: filterStatus === s ? '#fff' : 'var(--text-2)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif" }}>
                  {s === 'all' ? 'All' : STATUS_CONFIG[s]?.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setShowAddTask(p => !p)} className="btn btn-primary btn-sm" style={{ background: '#1c3d2e' }}>{showAddTask ? '✕ Cancel' : '+ Task'}</button>
              <button onClick={() => setShowAddProject(p => !p)} className="btn btn-sm" style={{ border: '1px solid #1c3d2e', color: '#1c3d2e', background: 'transparent' }}>{showAddProject ? '✕' : '+ Project'}</button>
            </div>
          </div>

          {/* Add task form */}
          {showAddTask && (
            <div className="card" style={{ padding: 16, border: '1.5px solid #1c3d2e' }}>
              <input className="input-field" placeholder="Task title" value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} style={{ marginBottom: 8, fontSize: 14, fontWeight: 600 }} autoFocus />
              <textarea className="input-field" placeholder="Description (optional)" value={taskForm.description} onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))} rows={2} style={{ resize: 'none', marginBottom: 8, fontSize: 13 }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 10 }}>
                <select className="input-field" value={taskForm.priority} onChange={e => setTaskForm(p => ({ ...p, priority: e.target.value }))} style={{ fontSize: 13 }}>
                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.dot} {v.label}</option>)}
                </select>
                <input type="date" className="input-field" value={taskForm.due_date} onChange={e => setTaskForm(p => ({ ...p, due_date: e.target.value }))} style={{ fontSize: 13 }} />
                <select className="input-field" value={selectedProject !== 'all' ? selectedProject : ''} onChange={e => setTaskForm(p => ({ ...p, project_id: e.target.value }))} style={{ fontSize: 13 }}>
                  <option value="">No project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
                </select>
                <input className="input-field" type="number" placeholder="Est. minutes" value={taskForm.estimated_minutes} onChange={e => setTaskForm(p => ({ ...p, estimated_minutes: e.target.value }))} style={{ fontSize: 13 }} />
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={taskForm.is_urgent} onChange={e => setTaskForm(p => ({ ...p, is_urgent: e.target.checked }))} /> 🔴 Urgent
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={taskForm.is_important} onChange={e => setTaskForm(p => ({ ...p, is_important: e.target.checked }))} /> ⭐ Important
                </label>
              </div>
              <button className="btn btn-primary btn-full" onClick={addTask} style={{ background: '#1c3d2e', fontSize: 13 }}>Add Task</button>
            </div>
          )}

          {/* Add project form */}
          {showAddProject && (
            <div className="card" style={{ padding: 16, border: '1.5px solid #1c3d2e' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <input className="input-field" placeholder="Project name" value={projectForm.name} onChange={e => setProjectForm(p => ({ ...p, name: e.target.value }))} style={{ fontSize: 13 }} />
                <input className="input-field" placeholder="Icon (emoji)" value={projectForm.icon} onChange={e => setProjectForm(p => ({ ...p, icon: e.target.value }))} style={{ fontSize: 20, textAlign: 'center' }} />
                <input type="date" className="input-field" value={projectForm.due_date} onChange={e => setProjectForm(p => ({ ...p, due_date: e.target.value }))} style={{ fontSize: 13 }} />
                <select className="input-field" value={projectForm.priority} onChange={e => setProjectForm(p => ({ ...p, priority: e.target.value }))} style={{ fontSize: 13 }}>
                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.dot} {v.label}</option>)}
                </select>
              </div>
              <textarea className="input-field" placeholder="Description (optional)" value={projectForm.description} onChange={e => setProjectForm(p => ({ ...p, description: e.target.value }))} rows={2} style={{ resize: 'none', marginBottom: 10, fontSize: 13 }} />
              <button className="btn btn-primary btn-full" onClick={addProject} style={{ background: '#1c3d2e', fontSize: 13 }}>Create Project</button>
            </div>
          )}

          {/* Board columns */}
          {['todo', 'in_progress', 'blocked', 'review'].map(status => {
            const cfg = STATUS_CONFIG[status]
            const colTasks = tasksByStatus[status]
            return (
              <div key={status}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, paddingBottom: 6, borderBottom: `2px solid ${cfg.color}` }}>
                  <span style={{ fontSize: 16 }}>{cfg.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: cfg.color, textTransform: 'uppercase', letterSpacing: 1, fontFamily: "'Nunito Sans',sans-serif" }}>{cfg.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', background: 'var(--surface)', borderRadius: 10, padding: '1px 6px' }}>{colTasks.length}</span>
                </div>
                {colTasks.map(task => {
                  const pc = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium
                  const proj = projects.find(p => p.id === task.project_id)
                  const isOverdue = task.due_date && task.due_date < TODAY
                  return (
                    <div key={task.id} style={{ padding: '12px 14px', background: 'var(--card)', borderRadius: 10, marginBottom: 8, border: `1px solid ${isOverdue ? '#fecaca' : 'var(--border)'}`, borderLeft: `4px solid ${pc.color}`, transition: 'all .15s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                            {task.is_urgent && <span style={{ fontSize: 10, fontWeight: 800, color: '#dc2626', background: '#fef2f2', padding: '1px 5px', borderRadius: 4 }}>URGENT</span>}
                            {proj && <span style={{ fontSize: 10, background: proj.color + '20', color: proj.color, padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>{proj.icon} {proj.name}</span>}
                          </div>
                          <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, lineHeight: 1.4 }}>{task.title}</p>
                          {task.description && <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.4, marginBottom: 4 }}>{task.description}</p>}
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: pc.color }}>{pc.dot} {pc.label}</span>
                            {task.due_date && <span style={{ fontSize: 10, color: isOverdue ? '#dc2626' : 'var(--text-3)', fontWeight: isOverdue ? 700 : 400 }}>
                              {isOverdue ? '⚠️ ' : '📅 '}Due {new Date(task.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>}
                            {task.estimated_minutes && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>⏱ {task.estimated_minutes}min</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                          <select value={task.status} onChange={e => updateTaskStatus(task.id, e.target.value)} style={{ padding: '4px 6px', borderRadius: 6, border: `1px solid ${cfg.color}40`, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif" }}>
                            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {colTasks.length === 0 && (
                  <div style={{ padding: '12px', background: 'var(--surface)', borderRadius: 8, textAlign: 'center', border: `1px dashed ${cfg.color}40` }}>
                    <p style={{ fontSize: 12, color: 'var(--text-3)' }}>No {cfg.label.toLowerCase()} tasks</p>
                  </div>
                )}
              </div>
            )
          })}

          {/* Projects */}
          {projects.length > 0 && (
            <div className="card" style={{ padding: 16 }}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>📁 Projects</div>
              {projects.map(proj => {
                const projTasks = tasks.filter(t => t.project_id === proj.id)
                const donePct = projTasks.length ? Math.round(projTasks.filter(t => t.status === 'done').length / projTasks.length * 100) : 0
                return (
                  <div key={proj.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 22 }}>{proj.icon}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 700 }}>{proj.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{projTasks.length} tasks{proj.due_date ? ` · Due ${new Date(proj.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</p>
                      <div className="progress-track" style={{ marginTop: 4 }}>
                        <div className="progress-fill" style={{ width: donePct + '%', background: proj.color || '#1c3d2e' }} />
                      </div>
                    </div>
                    <button onClick={() => setSelectedProject(proj.id === selectedProject ? 'all' : proj.id)} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif", color: 'var(--text-2)' }}>
                      {selectedProject === proj.id ? 'Show all' : 'Filter'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* EA CHAT TAB */}
      {activeTab === 'assistant' && (
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#1c3d2e,#065f46)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🤖</div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 800 }}>Your Executive Assistant</p>
              <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Knows your tasks, projects & blockers</p>
            </div>
          </div>

          <div style={{ height: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
            {msgs.map((m, i) => <div key={i} className={m.role === 'user' ? 'bubble-user' : 'bubble-ai'}>{m.content}</div>)}
            {chatLoad && <div className="bubble-ai"><div className="spinner spinner-dark" style={{ width: 14, height: 14 }} /></div>}
            <div ref={chatEndRef} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input className="input-field" value={chatIn} onChange={e => setChatIn(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendEA()} placeholder="Ask your EA..." />
            <button className="btn btn-primary" onClick={() => sendEA()} disabled={chatLoad || !chatIn.trim()} style={{ opacity: chatLoad || !chatIn.trim() ? .5 : 1, background: '#1c3d2e', minWidth: 64 }}>
              {chatLoad ? <span className="spinner" /> : 'Send'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {EA_PROMPTS.map(p => (
              <button key={p.label} onClick={() => sendEA(p.prompt)} style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 20, padding: '6px 12px', fontSize: 11, fontWeight: 700, color: '#1c3d2e', cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif" }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* FOCUS LOG TAB */}
      {activeTab === 'focus' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ padding: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>⚡ Today's Focus Log</div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>What am I working on right now?</label>
              <textarea className="input-field" rows={2} value={focusForm.current_focus} onChange={e => setFocusForm(p => ({ ...p, current_focus: e.target.value }))} placeholder="Be specific. What is your #1 task this moment?" style={{ resize: 'none', fontSize: 14 }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>What's blocking me?</label>
              <textarea className="input-field" rows={2} value={focusForm.blockers} onChange={e => setFocusForm(p => ({ ...p, blockers: e.target.value }))} placeholder="What's slowing you down or stopping progress?" style={{ resize: 'none', fontSize: 13 }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>Today's wins so far</label>
              <textarea className="input-field" rows={2} value={focusForm.wins} onChange={e => setFocusForm(p => ({ ...p, wins: e.target.value }))} placeholder="What have you already done right today?" style={{ resize: 'none', fontSize: 13 }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>Energy {focusForm.energy_level}/10</label>
                <input type="range" min={1} max={10} value={focusForm.energy_level} onChange={e => setFocusForm(p => ({ ...p, energy_level: +e.target.value }))} style={{ width: '100%', accentColor: '#1c3d2e' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>Stress {focusForm.stress_level}/10</label>
                <input type="range" min={1} max={10} value={focusForm.stress_level} onChange={e => setFocusForm(p => ({ ...p, stress_level: +e.target.value }))} style={{ width: '100%', accentColor: '#dc2626' }} />
              </div>
            </div>

            <button className="btn btn-primary btn-full" onClick={saveFocusLog} style={{ background: '#1c3d2e', fontSize: 13 }}>Save Focus Log</button>
          </div>

          {/* Priority Matrix */}
          <div className="card" style={{ padding: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>📊 Priority Matrix</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Urgent + Important', color: '#dc2626', bg: '#fef2f2', tasks: tasks.filter(t => t.is_urgent && t.is_important), desc: 'DO FIRST' },
                { label: 'Important, Not Urgent', color: '#2563eb', bg: '#eff6ff', tasks: tasks.filter(t => !t.is_urgent && t.is_important), desc: 'SCHEDULE' },
                { label: 'Urgent, Not Important', color: '#d97706', bg: '#fffbeb', tasks: tasks.filter(t => t.is_urgent && !t.is_important), desc: 'DELEGATE' },
                { label: 'Neither', color: '#6b7280', bg: '#f9fafb', tasks: tasks.filter(t => !t.is_urgent && !t.is_important), desc: 'ELIMINATE' },
              ].map(q => (
                <div key={q.label} style={{ padding: '10px', borderRadius: 10, background: q.bg, border: `1.5px solid ${q.color}30` }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: q.color, letterSpacing: 1.5, marginBottom: 4, fontFamily: "'Nunito Sans',sans-serif" }}>{q.desc}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: q.color, marginBottom: 8 }}>{q.label}</div>
                  {q.tasks.slice(0, 3).map(t => (
                    <div key={t.id} style={{ fontSize: 11, color: 'var(--text)', padding: '3px 0', borderBottom: '1px solid rgba(0,0,0,.06)', lineHeight: 1.4 }}>· {t.title}</div>
                  ))}
                  {q.tasks.length > 3 && <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>+{q.tasks.length - 3} more</div>}
                  {q.tasks.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>None</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MEETINGS TAB */}
      {activeTab === 'meetings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="eyebrow">📝 Meeting Notes</div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddMeeting(p => !p)} style={{ background: '#1c3d2e' }}>{showAddMeeting ? '✕' : '+ Add Meeting'}</button>
          </div>

          {showAddMeeting && (
            <div className="card" style={{ padding: 16, border: '1.5px solid #1c3d2e' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input className="input-field" placeholder="Meeting title" value={meetingForm.title} onChange={e => setMeetingForm(p => ({ ...p, title: e.target.value }))} style={{ fontSize: 13 }} />
                <input type="date" className="input-field" value={meetingForm.meeting_date} onChange={e => setMeetingForm(p => ({ ...p, meeting_date: e.target.value }))} style={{ fontSize: 13 }} />
              </div>
              <input className="input-field" placeholder="Attendees" value={meetingForm.attendees} onChange={e => setMeetingForm(p => ({ ...p, attendees: e.target.value }))} style={{ marginBottom: 8, fontSize: 13 }} />
              <textarea className="input-field" rows={2} placeholder="Agenda" value={meetingForm.agenda} onChange={e => setMeetingForm(p => ({ ...p, agenda: e.target.value }))} style={{ resize: 'none', marginBottom: 8, fontSize: 13 }} />
              <textarea className="input-field" rows={3} placeholder="Notes from the meeting" value={meetingForm.notes} onChange={e => setMeetingForm(p => ({ ...p, notes: e.target.value }))} style={{ resize: 'none', marginBottom: 8, fontSize: 13 }} />
              <textarea className="input-field" rows={2} placeholder="Action items (one per line)" value={meetingForm.action_items} onChange={e => setMeetingForm(p => ({ ...p, action_items: e.target.value }))} style={{ resize: 'none', marginBottom: 10, fontSize: 13 }} />
              <button className="btn btn-primary btn-full" onClick={addMeeting} style={{ background: '#1c3d2e', fontSize: 13 }}>Save Meeting Notes</button>
            </div>
          )}

          {meetings.map(m => (
            <div key={m.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 800 }}>{m.title}</p>
                  {m.attendees && <p style={{ fontSize: 12, color: 'var(--text-3)' }}>👥 {m.attendees}</p>}
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{new Date(m.meeting_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
              </div>
              {m.notes && <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65, marginBottom: m.action_items?.length ? 8 : 0 }}>{m.notes}</p>}
              {m.action_items?.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>ACTION ITEMS:</p>
                  {m.action_items.map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                      <span style={{ color: '#1c3d2e' }}>→</span>
                      <span style={{ fontSize: 13, color: 'var(--text)' }}>{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {meetings.length === 0 && !showAddMeeting && (
            <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>No meeting notes yet. Capture your key decisions and action items here.</p>
          )}
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
