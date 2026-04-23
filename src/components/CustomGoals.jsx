import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const CATEGORIES = [
  { id: 'work', label: 'Work', icon: '💼' },
  { id: 'personal', label: 'Personal', icon: '🏠' },
  { id: 'financial', label: 'Financial', icon: '📈' },
  { id: 'health', label: 'Health', icon: '💪' },
  { id: 'family', label: 'Family', icon: '👨‍👩‍👦' },
]

const PRIORITIES = [
  { id: 'high', label: 'High', color: '#dc2626', pts: '8 pts' },
  { id: 'medium', label: 'Medium', color: '#d97706', pts: '5 pts' },
  { id: 'low', label: 'Low', color: '#16a34a', pts: '3 pts' },
]

export default function CustomGoals({ tasks, onTasksChange }) {
  const { user } = useAuth()
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ text: '', category: 'work', priority: 'medium' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2000) }

  const save = async () => {
    if (!form.text.trim()) return
    setSaving(true)
    if (editId) {
      const { data } = await supabase.from('user_tasks').update({
        text: form.text.trim(), category: form.category, priority: form.priority
      }).eq('id', editId).eq('user_id', user.id).select().single()
      if (data) { onTasksChange(tasks.map(t => t.id === editId ? data : t)); showToast('Goal updated ✓') }
      setEditId(null)
    } else {
      const { data } = await supabase.from('user_tasks').insert({
        user_id: user.id, text: form.text.trim(), category: form.category, priority: form.priority,
        is_active: true, sort_order: tasks.length
      }).select().single()
      if (data) { onTasksChange([...tasks, data]); showToast('Goal added ✓') }
      setShowAdd(false)
    }
    setForm({ text: '', category: 'work', priority: 'medium' })
    setSaving(false)
  }

  const deleteTask = async (id) => {
    await supabase.from('user_tasks').update({ is_active: false }).eq('id', id).eq('user_id', user.id)
    onTasksChange(tasks.filter(t => t.id !== id))
    showToast('Goal removed')
  }

  const startEdit = (task) => {
    setForm({ text: task.text, category: task.category, priority: task.priority })
    setEditId(task.id)
    setShowAdd(false)
  }

  const groupedTasks = CATEGORIES.reduce((acc, c) => {
    acc[c.id] = tasks.filter(t => t.category === c.id)
    return acc
  }, {})

  return (
    <div>
      {/* Add button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>Custom Goals</div>
          <p style={{ fontSize: 13, color: 'var(--text-2)' }}>{tasks.length} goals across {CATEGORIES.filter(c => groupedTasks[c.id]?.length > 0).length} categories</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowAdd(p => !p); setEditId(null); setForm({ text: '', category: 'work', priority: 'medium' }) }}>
          {showAdd ? '✕ Cancel' : '+ Add Goal'}
        </button>
      </div>

      {/* Add/Edit form */}
      {(showAdd || editId) && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 16, marginBottom: 16, border: '1.5px solid var(--primary)' }}>
          <div style={{ fontFamily: "'Fraunces',serif", fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
            {editId ? 'Edit Goal' : 'New Goal'}
          </div>
          <textarea
            className="input-field"
            rows={2}
            placeholder="What's the goal? Be specific."
            value={form.text}
            onChange={e => setForm(p => ({ ...p, text: e.target.value }))}
            style={{ resize: 'none', marginBottom: 10, fontSize: 14 }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>Category</label>
              <select className="input-field" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={{ fontSize: 13 }}>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>Priority</label>
              <select className="input-field" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} style={{ fontSize: 13 }}>
                {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label} ({p.pts})</option>)}
              </select>
            </div>
          </div>
          <button className="btn btn-primary" onClick={save} disabled={!form.text.trim() || saving} style={{ width: '100%' }}>
            {saving ? <span className="spinner" /> : editId ? 'Save Changes' : 'Add Goal'}
          </button>
        </div>
      )}

      {/* Goals by category */}
      {CATEGORIES.filter(c => groupedTasks[c.id]?.length > 0).map(cat => (
        <div key={cat.id} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 14 }}>{cat.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: 'var(--text-3)', textTransform: 'uppercase' }}>{cat.label}</span>
            <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 4 }}>({groupedTasks[cat.id].length})</span>
          </div>
          {groupedTasks[cat.id].map(task => (
            <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid #fafaf9' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: PRIORITIES.find(p => p.id === task.priority)?.color || '#d97706', flexShrink: 0, marginTop: 6 }} />
              <span style={{ flex: 1, fontSize: 13, lineHeight: 1.5, color: 'var(--text)' }}>{task.text}</span>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button onClick={() => startEdit(task)} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 11, cursor: 'pointer', color: 'var(--text-2)', fontFamily: "'Nunito Sans',sans-serif" }}>Edit</button>
                <button onClick={() => deleteTask(task.id)} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', fontSize: 11, cursor: 'pointer', color: '#dc2626', fontFamily: "'Nunito Sans',sans-serif" }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {tasks.length === 0 && !showAdd && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 12 }}>No custom goals yet.</p>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>Add Your First Goal</button>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--primary)', color: '#fff', padding: '10px 20px', borderRadius: 24, fontSize: 13, fontWeight: 700, zIndex: 9999 }}>
          {toast}
        </div>
      )}
    </div>
  )
}
