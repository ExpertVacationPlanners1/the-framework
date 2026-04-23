import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const TIER_COLOR = {
  'GET MOVING': '#f43f5e',
  'WARMING UP': '#a78bfa',
  'BUILDING': '#f97316',
  'SOLID': '#3b82f6',
  'STRONG': '#22c55e',
  'ELITE': '#f59e0b'
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function getTier(score) {
  if (score >= 90) return 'ELITE'
  if (score >= 75) return 'STRONG'
  if (score >= 60) return 'SOLID'
  if (score >= 45) return 'BUILDING'
  if (score >= 25) return 'WARMING UP'
  return 'GET MOVING'
}

export default function ScoreHistory() {
  const { user } = useAuth()
  const [scores, setScores] = useState([])
  const [habitHistory, setHabitHistory] = useState({})
  const [habits, setHabits] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeHabit, setActiveHabit] = useState(null)

  useEffect(() => {
    if (user) loadHistory()
  }, [user])

  const loadHistory = async () => {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
    const startDate = thirtyDaysAgo.toISOString().split('T')[0]

    const [scoresRes, habitsRes, habitCompRes] = await Promise.all([
      supabase.from('daily_scores').select('*').eq('user_id', user.id).gte('score_date', startDate).order('score_date'),
      supabase.from('user_habits').select('*').eq('user_id', user.id).eq('is_active', true),
      supabase.from('habit_completions').select('habit_id, completed_date').eq('user_id', user.id).gte('completed_date', startDate)
    ])

    setScores(scoresRes.data || [])
    setHabits(habitsRes.data || [])

    // Build habit history map: habitId -> Set of completed dates
    const histMap = {}
    ;(habitsRes.data || []).forEach(h => { histMap[h.id] = new Set() })
    ;(habitCompRes.data || []).forEach(c => {
      if (histMap[c.habit_id]) histMap[c.habit_id].add(c.completed_date)
    })
    setHabitHistory(histMap)
    if (habitsRes.data?.length) setActiveHabit(habitsRes.data[0].id)
    setLoading(false)
  }

  // Build last 30 days array
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    return d.toISOString().split('T')[0]
  })

  const scoreMap = {}
  scores.forEach(s => { scoreMap[s.score_date] = s })

  const weekLabels = last30.filter((_, i) => i % 7 === 0)
  const maxScore = Math.max(...scores.map(s => s.score), 1)

  const avgScore = scores.length ? Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length) : 0
  const bestDay = scores.length ? scores.reduce((a, s) => s.score > a.score ? s : a, scores[0]) : null
  const streak7 = last30.slice(-7).filter(d => scoreMap[d]?.score >= 60).length

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div className="spinner spinner-dark" style={{ margin: '0 auto' }} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {[
          { label: '30-Day Avg', value: avgScore || '—', sub: 'daily score', color: TIER_COLOR[getTier(avgScore)] || '#a1a1aa' },
          { label: 'Best Day', value: bestDay ? bestDay.score : '—', sub: bestDay ? new Date(bestDay.score_date).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : 'no data', color: '#f59e0b' },
          { label: 'Days 60+', value: streak7 + '/7', sub: 'this week', color: '#22c55e' },
        ].map(s => (
          <div key={s.label} style={{ padding: '12px 10px', background: 'var(--surface)', borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color, fontFamily: "'Fraunces',serif" }}>{s.value}</div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: 'var(--text-3)', textTransform: 'uppercase', marginTop: 3 }}>{s.label}</div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Score bar chart - last 30 days */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 12 }}>
          📈 Last 30 Days
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
          {last30.map((date, i) => {
            const s = scoreMap[date]
            const h = s ? Math.max(4, Math.round((s.score / 100) * 76)) : 0
            const color = s ? (TIER_COLOR[s.tier] || '#1c3d2e') : '#f0ebe3'
            const isToday = date === new Date().toISOString().split('T')[0]
            return (
              <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, position: 'relative' }}>
                <div title={s ? `${date}: ${s.score}/100` : date} style={{
                  width: '100%', height: h, background: color, borderRadius: '3px 3px 0 0',
                  opacity: s ? 1 : 0.3, transition: 'height .3s',
                  outline: isToday ? `2px solid ${color}` : 'none',
                  outlineOffset: 1
                }} />
                {isToday && (
                  <div style={{ position: 'absolute', top: -16, fontSize: 8, fontWeight: 800, color, letterSpacing: .5 }}>TODAY</div>
                )}
              </div>
            )
          })}
        </div>
        {/* Date labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          {[last30[0], last30[7], last30[14], last30[21], last30[29]].map(d => (
            <span key={d} style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: "'JetBrains Mono',monospace" }}>
              {new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
            </span>
          ))}
        </div>
      </div>

      {/* Habit streak calendar */}
      {habits.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 10 }}>
            🔥 Habit Streaks — Last 30 Days
          </div>

          {/* Habit selector */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {habits.map(h => (
              <button key={h.id} onClick={() => setActiveHabit(h.id)} style={{
                padding: '5px 12px', borderRadius: 20, border: '1.5px solid',
                borderColor: activeHabit === h.id ? 'var(--primary)' : 'var(--border)',
                background: activeHabit === h.id ? 'var(--primary-light)' : 'var(--card)',
                color: activeHabit === h.id ? 'var(--primary)' : 'var(--text-2)',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif"
              }}>
                {h.icon} {h.name}
              </button>
            ))}
          </div>

          {/* Calendar grid */}
          {activeHabit && (
            <div>
              {/* Day labels */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 3 }}>
                {DAYS.map((d, i) => (
                  <div key={i} style={{ textAlign: 'center', fontSize: 9, fontWeight: 800, color: 'var(--text-3)', letterSpacing: .5 }}>{d}</div>
                ))}
              </div>
              {/* Calendar squares */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                {(() => {
                  // Pad to start on correct day of week
                  const firstDate = new Date(last30[0])
                  const startDow = firstDate.getDay()
                  const cells = []
                  for (let i = 0; i < startDow; i++) cells.push(null)
                  last30.forEach(d => cells.push(d))
                  return cells.map((date, i) => {
                    if (!date) return <div key={i} />
                    const done = habitHistory[activeHabit]?.has(date)
                    const isToday = date === new Date().toISOString().split('T')[0]
                    return (
                      <div key={date} title={date} style={{
                        aspectRatio: '1', borderRadius: 4,
                        background: done ? 'var(--primary)' : '#f0ebe3',
                        opacity: done ? 1 : 0.5,
                        border: isToday ? '2px solid var(--primary)' : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 8, color: done ? '#fff' : 'transparent',
                        fontWeight: 900, transition: 'background .2s'
                      }}>
                        {done ? '✓' : ''}
                      </div>
                    )
                  })
                })()}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 10, alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--primary)' }}/>
                  <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Done</span>
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: '#f0ebe3' }}/>
                  <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Missed</span>
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 'auto' }}>
                  {(() => {
                    const completed = last30.filter(d => habitHistory[activeHabit]?.has(d)).length
                    return `${completed}/30 days (${Math.round(completed/30*100)}%)`
                  })()}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
