import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const QUICK_PROMPTS = [
  { label: "How am I doing?", prompt: "Give me an honest assessment of how I'm doing this week based on my progress." },
  { label: "I'm overwhelmed", prompt: "I'm feeling overwhelmed right now. Help me slow down and figure out what to actually focus on." },
  { label: "Set me a challenge", prompt: "Based on what you know about me, give me one specific challenge to push myself this week." },
  { label: "Work stress", prompt: "I'm dealing with a lot of work stress. Help me think through it and figure out my next move." },
  { label: "Financial pressure", prompt: "Financial pressure is weighing on me. Help me think clearly about it." },
  { label: "I'm avoiding something", prompt: "I know I'm avoiding something important. Help me figure out what and why." },
  { label: "Review my week", prompt: "Review my progress this week and tell me honestly: what's working and what isn't?" },
  { label: "Motivate me", prompt: "I need real motivation right now, not fluff. Speak to me directly." },
]

const SYSTEM = (firstName, goal, blockers, memory) => `You are ${firstName}'s personal AI life coach. You know them well.

About them:
- Main goal: "${goal || 'not set'}"
- Known blockers: ${blockers || 'not specified'}
- Coaching history: ${memory ? `avg score ${memory.avg_weekly_score||'unknown'}, strongest: ${memory.strongest_category||'unknown'}, weakest: ${memory.weakest_category||'unknown'}, ${memory.total_days_logged||0} days logged, recurring blockers: ${(memory.recurring_blockers||[]).join(', ')||'none noted'}` : 'new user'}

Rules:
- Never be generic. Always speak to this specific person.
- 3-5 sentences max per response.
- End every message with either a direct challenge or a sharp question.
- When they're spiraling: slow them down, separate facts from fear.
- When they're avoiding: call it out directly.
- When they succeed: recognize it specifically, then push higher.
- Stress pattern to watch for: stress → overanalysis → hesitation → guilt → lower confidence → more stress. Interrupt this.`

export default function Coach() {
  const { user, profile, settings } = useAuth()
  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const [msgs, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [memory, setMemory] = useState(null)
  const [scores, setScores] = useState([])
  const chatEndRef = useRef(null)

  useEffect(() => {
    if (user) loadContext()
  }, [user])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  const loadContext = async () => {
    const [memRes, scoresRes] = await Promise.all([
      supabase.from('coach_memory').select('*').eq('user_id', user.id).single(),
      supabase.from('daily_scores').select('score,tier,score_date').eq('user_id', user.id).order('score_date', { ascending: false }).limit(7)
    ])
    setMemory(memRes.data || null)
    setScores(scoresRes.data || [])

    // Generate opening message based on their actual data
    const recent = scoresRes.data || []
    const avgRecent = recent.length ? Math.round(recent.reduce((a,s)=>a+s.score,0)/recent.length) : null
    const trend = recent.length >= 2 ? (recent[0].score > recent[recent.length-1].score ? 'improving' : recent[0].score < recent[recent.length-1].score ? 'declining' : 'flat') : 'unknown'

    const openingContext = avgRecent ? `Recent performance: ${avgRecent} avg over ${recent.length} days, trend is ${trend}. Latest score: ${recent[0]?.score}/100 (${recent[0]?.tier}).` : 'First session — welcome them and ask what they want to work on.'

    setLoading(true)
    try {
      const r = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: SYSTEM(firstName, settings?.primary_goal, (settings?.main_blockers||[]).join(', '), memRes.data),
          messages: [{ role: 'user', content: `Start our coaching session. ${openingContext} Open with a brief, direct message that references my actual situation. Don't be generic.` }]
        })
      })
      const d = await r.json()
      setMsgs([{ role: 'ai', content: d.reply || `Hey ${firstName}. What do you need from me today?` }])
    } catch {
      setMsgs([{ role: 'ai', content: `Hey ${firstName}. What's on your mind?` }])
    }
    setLoading(false)
  }

  const send = useCallback(async (text) => {
    const content = (text || input).trim()
    if (!content || loading) return
    const userMsg = { role: 'user', content }
    const newMsgs = [...msgs, userMsg]
    setMsgs(newMsgs); setInput(''); setLoading(true)

    try {
      const r = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: SYSTEM(firstName, settings?.primary_goal, (settings?.main_blockers||[]).join(', '), memory),
          messages: newMsgs.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content }))
        })
      })
      const d = await r.json()
      setMsgs(p => [...p, { role: 'ai', content: d.reply || 'Keep going.' }])

      // Update coach memory after each exchange
      updateMemory()
    } catch {
      setMsgs(p => [...p, { role: 'ai', content: 'Connection issue. Try again.' }])
    }
    setLoading(false)
  }, [input, msgs, loading, firstName, settings, memory])

  const updateMemory = async () => {
    // Background: update total sessions count
    try {
      await supabase.from('coach_memory').upsert({
        user_id: user.id,
        total_days_logged: (memory?.total_days_logged || 0) + 0, // will be updated by weekly analysis
        last_checkin_note: new Date().toISOString()
      })
    } catch {}
  }

  const avgScore = scores.length ? Math.round(scores.reduce((a,s)=>a+s.score,0)/scores.length) : null
  const trend = scores.length >= 2 ? (scores[0].score > scores[scores.length-1].score ? '📈' : scores[0].score < scores[scores.length-1].score ? '📉' : '➡️') : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 'clamp(22px,5vw,28px)', fontWeight: 900 }}>Your Coach</h1>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>Knows your patterns. Remembers your progress.</p>
        </div>
        <Link to="/voice" style={{ padding: '9px 16px', borderRadius: 10, background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Nunito Sans',sans-serif" }}>
          🎙️ Voice
        </Link>
      </div>

      {/* What coach knows */}
      <div className="card" style={{ padding: 16, background: 'linear-gradient(135deg,var(--primary),#163325)' }}>
        <div className="eyebrow" style={{ color: '#a8d4b0', marginBottom: 10 }}>🧠 What Your Coach Knows About You</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
          {[
            { label: 'Main Goal', val: settings?.primary_goal ? settings.primary_goal.slice(0,40)+'...' : 'Not set', action: null },
            { label: '7-Day Avg', val: avgScore ? `${avgScore}/100 ${trend}` : 'No data yet', action: null },
            { label: 'Strongest Area', val: memory?.strongest_category ? memory.strongest_category.charAt(0).toUpperCase()+memory.strongest_category.slice(1) : 'Learning...', action: null },
            { label: 'Days Logged', val: memory?.total_days_logged || scores.length || 0, action: null },
          ].map(item => (
            <div key={item.label} style={{ padding: '10px 12px', background: 'rgba(255,255,255,.1)', borderRadius: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#a8d4b0', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4, fontFamily: "'Nunito Sans',sans-serif" }}>{item.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: "'Nunito Sans',sans-serif", lineHeight: 1.3 }}>{item.val}</div>
            </div>
          ))}
        </div>
        {settings?.main_blockers?.length > 0 && (
          <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(255,255,255,.08)', borderRadius: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#a8d4b0', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4, fontFamily: "'Nunito Sans',sans-serif" }}>Known Blockers</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {settings.main_blockers.slice(0,3).map(b => (
                <span key={b} style={{ padding: '3px 8px', borderRadius: 20, background: 'rgba(255,255,255,.1)', color: '#fff', fontSize: 11, fontFamily: "'Nunito Sans',sans-serif" }}>{b}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent scores */}
      {scores.length > 0 && (
        <div className="card" style={{ padding: '14px 18px' }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>📊 Last 7 Days</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 48 }}>
            {scores.slice().reverse().map((s, i) => {
              const colors = { 'GET MOVING': '#f43f5e', 'WARMING UP': '#a78bfa', 'BUILDING': '#f97316', 'SOLID': '#3b82f6', 'STRONG': '#22c55e', 'ELITE': '#f59e0b' }
              const h = Math.max(4, Math.round(s.score/100*44))
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <div style={{ width: '100%', height: h, background: colors[s.tier]||'#1c3d2e', borderRadius: '3px 3px 0 0' }} title={`${s.score_date}: ${s.score}/100`} />
                  <span style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'monospace' }}>{new Date(s.score_date).toLocaleDateString('en-US',{weekday:'narrow'})}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Chat */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ height: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
          {msgs.length === 0 && loading && (
            <div className="bubble-ai" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div className="spinner spinner-dark" style={{ width: 14, height: 14 }} />
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Your coach is reading your data...</span>
            </div>
          )}
          {msgs.map((m, i) => <div key={i} className={m.role === 'user' ? 'bubble-user' : 'bubble-ai'}>{m.content}</div>)}
          {loading && msgs.length > 0 && <div className="bubble-ai"><div className="spinner spinner-dark" style={{ width: 14, height: 14 }} /></div>}
          <div ref={chatEndRef} />
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input className="input-field" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()} placeholder="Talk to your coach..." />
          <button className="btn btn-primary" onClick={() => send()} disabled={loading || !input.trim()} style={{ opacity: loading || !input.trim() ? .5 : 1, minWidth: 64 }}>
            {loading ? <span className="spinner" /> : 'Send'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {QUICK_PROMPTS.map(p => (
            <button key={p.label} onClick={() => send(p.prompt)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '6px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-2)', cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif" }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
