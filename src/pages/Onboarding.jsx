import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, DEFAULT_TASKS, DEFAULT_HABITS } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const STEPS = [
  { id: 1, title: "What's pulling you down?", sub: "Choose every area where you feel stuck right now." },
  { id: 2, title: "What's your daily setup?", sub: "This helps us build a schedule that works for your real life." },
  { id: 3, title: "What's your #1 goal?", sub: "Be honest. What would make the next 90 days genuinely count?" },
  { id: 4, title: "What keeps getting in your way?", sub: "Name the real blockers. Not excuses — real ones." },
  { id: 5, title: "You're almost in.", sub: "Here's what your system is built around." },
]

const STRUGGLE_AREAS = [
  { id: 'work', label: 'Work & Career', icon: '💼', desc: 'Stress, stuck in place, no growth path' },
  { id: 'financial', label: 'Money & Finances', icon: '💰', desc: 'Not enough, no plan, constant pressure' },
  { id: 'confidence', label: 'Confidence & Mindset', icon: '🧠', desc: 'Self-doubt, anxiety, overthinking everything' },
  { id: 'health', label: 'Health & Energy', icon: '💪', desc: 'Inconsistent habits, low energy, no routine' },
  { id: 'family', label: 'Family & Relationships', icon: '👨‍👩‍👦', desc: 'Stress at home, not present, disconnected' },
  { id: 'purpose', label: 'Purpose & Direction', icon: '🎯', desc: 'No clear path, drifting, not living intentionally' },
]

const SCHEDULES = [
  { id: 'office', label: 'Office / Corporate', icon: '🏢', desc: 'Mon–Fri, standard hours' },
  { id: 'shift', label: 'Shift Worker', icon: '🔄', desc: 'Rotating or irregular hours' },
  { id: 'freelance', label: 'Freelance / Self-Employed', icon: '💻', desc: 'I set my own hours' },
  { id: 'student', label: 'Student', icon: '📚', desc: 'In school, part-time work' },
  { id: 'homemaker', label: 'Stay at Home', icon: '🏠', desc: 'Running the household' },
]

const BLOCKERS = [
  'I overthink and don\'t take action',
  'I start strong but don\'t follow through',
  'Financial stress distracts me from everything',
  'I don\'t have support from people around me',
  'I\'m too busy and overwhelmed',
  'I don\'t know where to start',
  'Fear of failure holds me back',
  'I lose motivation after a few days',
]

const WAKE_TIMES = ['4:00am', '4:30am', '5:00am', '5:30am', '6:00am', '6:30am', '7:00am', '7:30am', '8:00am', '8:30am', '9:00am', 'Later']

export default function Onboarding() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    struggles: [],
    schedule: '',
    wakeTime: '6:00am',
    goal: '',
    blockers: [],
  })
  const [saving, setSaving] = useState(false)
  const { user, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const toggle = (field, val) => {
    setForm(p => ({
      ...p,
      [field]: p[field].includes(val) ? p[field].filter(v => v !== val) : [...p[field], val]
    }))
  }

  const canNext = () => {
    if (step === 1) return form.struggles.length > 0
    if (step === 2) return form.schedule !== ''
    if (step === 3) return form.goal.trim().length > 5
    if (step === 4) return form.blockers.length > 0
    return true
  }

  const handleFinish = async () => {
    setSaving(true)
    try {
      // Determine pillars from struggle areas
      const pillars = []
      if (form.struggles.includes('work')) pillars.push('discipline')
      if (form.struggles.includes('financial')) pillars.push('financial')
      if (form.struggles.includes('confidence') || form.struggles.includes('purpose')) pillars.push('confidence')
      if (form.struggles.includes('health')) pillars.push('discipline')
      if (!pillars.length) pillars.push('discipline')
      const uniquePillars = [...new Set(pillars)]

      // Save settings
      await supabase.from('user_settings').upsert({
        user_id: user.id,
        wake_time: form.wakeTime,
        work_schedule: form.schedule,
        pillars: uniquePillars,
        primary_goal: form.goal,
        main_blockers: form.blockers,
      })

      // Seed default tasks based on struggle areas
      const taskCategories = form.struggles.filter(s =>
        ['work', 'personal', 'financial', 'health', 'family'].includes(s)
      )
      if (!taskCategories.includes('personal')) taskCategories.push('personal')

      const taskInserts = []
      for (const cat of taskCategories) {
        const tasks = DEFAULT_TASKS[cat] || []
        tasks.forEach((t, i) => {
          taskInserts.push({
            user_id: user.id,
            category: cat,
            text: t.text,
            priority: t.priority,
            is_default: true,
            sort_order: i,
          })
        })
      }
      if (taskInserts.length) await supabase.from('user_tasks').insert(taskInserts)

      // Seed default habits
      const habitInserts = DEFAULT_HABITS.map((h, i) => ({
        user_id: user.id, name: h.name, icon: h.icon, sort_order: i
      }))
      await supabase.from('user_habits').insert(habitInserts)

      // Seed default savings goals
      await supabase.from('savings_goals').insert([
        { user_id: user.id, name: 'Emergency Fund (3 months)', target_amount: 5000, current_amount: 0 },
        { user_id: user.id, name: 'Financial Stability Buffer', target_amount: 2000, current_amount: 0 },
      ])

      // Mark as onboarded
      await supabase.from('profiles').update({ onboarded: true }).eq('id', user.id)

      await refreshProfile()
      navigate('/dashboard')
    } catch (err) {
      console.error('Onboarding save error:', err)
      setSaving(false)
    }
  }

  const progress = (step / STEPS.length) * 100

  return (
    <div className="onboarding-container">
      <div className="onboarding-card animate-fade-up">
        {/* Progress */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>🎯</span>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 900, color: 'var(--primary)' }}>The Framework</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>{step} of {STEPS.length}</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: progress + '%', background: 'var(--primary)' }} />
          </div>
        </div>

        {/* Step header */}
        <div style={{ marginBottom: 28 }}>
          <h2 className="font-serif" style={{ fontSize: 'clamp(20px, 5vw, 26px)', marginBottom: 8 }}>
            {STEPS[step - 1].title}
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.6 }}>{STEPS[step - 1].sub}</p>
        </div>

        {/* Step content */}
        {step === 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {STRUGGLE_AREAS.map(area => (
              <div
                key={area.id}
                className={`option-card${form.struggles.includes(area.id) ? ' selected' : ''}`}
                onClick={() => toggle('struggles', area.id)}
              >
                <div style={{ fontSize: 22, marginBottom: 6 }}>{area.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{area.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4 }}>{area.desc}</div>
              </div>
            ))}
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
              {SCHEDULES.map(s => (
                <div
                  key={s.id}
                  className={`option-card${form.schedule === s.id ? ' selected' : ''}`}
                  onClick={() => setForm(p => ({ ...p, schedule: s.id }))}
                >
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.desc}</div>
                </div>
              ))}
            </div>
            <div>
              <label className="input-label">What time do you wake up?</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {WAKE_TIMES.map(t => (
                  <button key={t} onClick={() => setForm(p => ({ ...p, wakeTime: t }))}
                    style={{
                      padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                      border: '1.5px solid', cursor: 'pointer',
                      borderColor: form.wakeTime === t ? 'var(--primary)' : 'var(--border)',
                      background: form.wakeTime === t ? 'var(--primary-light)' : 'var(--card)',
                      color: form.wakeTime === t ? 'var(--primary)' : 'var(--text-2)',
                      fontFamily: "'Nunito Sans', sans-serif"
                    }}>{t}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <label className="input-label">My #1 goal for the next 90 days is...</label>
            <textarea
              className="input-field"
              rows={4}
              placeholder="e.g. Get promoted and increase my income by $20k. Build a 6-month emergency fund. Stop letting stress run my life."
              value={form.goal}
              onChange={e => setForm(p => ({ ...p, goal: e.target.value }))}
              style={{ resize: 'none' }}
            />
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10, lineHeight: 1.6 }}>
              Be specific. Vague goals produce vague results. Your coach will reference this every single day.
            </p>
          </div>
        )}

        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {BLOCKERS.map(b => (
              <div
                key={b}
                className={`option-card${form.blockers.includes(b) ? ' selected' : ''}`}
                onClick={() => toggle('blockers', b)}
                style={{ padding: '12px 16px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 4, border: '2px solid',
                    borderColor: form.blockers.includes(b) ? 'var(--primary)' : 'var(--border)',
                    background: form.blockers.includes(b) ? 'var(--primary)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    {form.blockers.includes(b) && <span style={{ color: '#fff', fontSize: 12 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{b}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 5 && (
          <div>
            <div style={{ background: 'var(--primary-light)', borderRadius: 14, padding: 20, marginBottom: 16, border: '1px solid rgba(28,61,46,.15)' }}>
              <div className="eyebrow" style={{ color: 'var(--primary)', marginBottom: 10 }}>Your System Is Built Around</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {form.struggles.map(s => {
                  const area = STRUGGLE_AREAS.find(a => a.id === s)
                  return area ? (
                    <div key={s} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, fontWeight: 600 }}>
                      <span>{area.icon}</span> {area.label}
                    </div>
                  ) : null
                })}
              </div>
            </div>

            <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Your #1 Goal</div>
              <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.6, color: 'var(--text)' }}>"{form.goal}"</p>
            </div>

            <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 12, border: '1px solid rgba(28,61,46,.15)' }}>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--primary)', fontWeight: 600 }}>
                ✓ Your goals, habits, and daily briefings are personalized to this profile.<br/>
                ✓ Your daily score tracks against your specific pillars.<br/>
                ✓ Your AI coach knows your situation and speaks to it directly.
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32, gap: 12 }}>
          {step > 1 ? (
            <button className="btn btn-ghost" onClick={() => setStep(s => s - 1)}>← Back</button>
          ) : <div />}

          {step < STEPS.length ? (
            <button
              className="btn btn-primary"
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}
              style={{ opacity: canNext() ? 1 : .4 }}
            >
              Continue →
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleFinish} disabled={saving}>
              {saving ? <span className="spinner" /> : 'Build My Framework →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
