import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import ProactiveInsights from '../components/ProactiveInsights'

const EDGE_URL = `https://dayawnsrnasnzyslzrga.supabase.co/functions/v1/coach-intelligence`

const QUICK_PROMPTS = [
  { label: "How am I really doing?", prompt: "Give me an honest, direct assessment of how I'm doing based on everything you know about me." },
  { label: "I'm overwhelmed", prompt: "I'm overwhelmed right now. Help me slow down and figure out what to actually focus on first." },
  { label: "Challenge me", prompt: "Based on my patterns and data, give me one specific challenge that will push me this week." },
  { label: "Work stress", prompt: "Work stress is building up. Help me think through it clearly and decide on my next move." },
  { label: "Financial pressure", prompt: "Financial pressure is weighing on me. Help me look at it clearly." },
  { label: "I'm avoiding something", prompt: "I know I'm avoiding something important. Help me name it and figure out why." },
  { label: "Build a 90-day plan", prompt: "Help me build a specific 90-day plan based on my goals and where I'm at right now." },
  { label: "Motivate me", prompt: "I need real motivation right now, not generic inspiration. Speak directly to my situation." },
]

export default function Coach() {
  const { user, profile, settings } = useAuth()
  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  const [msgs, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [memory, setMemory] = useState(null)
  const [scores, setScores] = useState([])
  const [activeTab, setActiveTab] = useState('chat') // chat | insights | financial
  const [financialPlan, setFinancialPlan] = useState(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [session, setSession] = useState(null)
  const chatEndRef = useRef(null)
  const initialized = useRef(false)

  useEffect(() => { if (user) loadContext() }, [user])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  const loadContext = async () => {
    const [memRes, scoresRes, sessionRes] = await Promise.all([
      supabase.from('coach_memory').select('*').eq('user_id', user.id).single(),
      supabase.from('daily_scores').select('score,tier,score_date').eq('user_id', user.id).order('score_date', { ascending: false }).limit(7),
      supabase.auth.getSession()
    ])
    setMemory(memRes.data || null)
    setScores(scoresRes.data || [])
    setSession(sessionRes.data?.session || null)

    if (!initialized.current) {
      initialized.current = true
      loadThreadHistory(sessionRes.data?.session)
    }
  }

  const loadThreadHistory = async (sess) => {
    if (!sess) {
      setMsgs([{ role: 'ai', content: `Hey ${firstName}. What do you need from me today?` }])
      return
    }
    setLoading(true)
    try {
      const r = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sess.access_token}` },
        body: JSON.stringify({ action: 'get_thread', threadType: 'general' })
      })
      const d = await r.json()
      const thread = d.thread?.messages || []

      if (thread.length > 0) {
        // Load last 10 messages from history
        const recent = thread.slice(-10).map(m => ({ role: m.role, content: m.content }))
        setMsgs(recent)
      } else {
        // First session — generate opening based on data
        generateOpening(sess)
      }
    } catch {
      setMsgs([{ role: 'ai', content: `Hey ${firstName}. What do you need from me today?` }])
    }
    setLoading(false)
  }

  const generateOpening = async (sess) => {
    setLoading(true)
    try {
      const r = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sess.access_token}` },
        body: JSON.stringify({
          action: 'coach_chat',
          threadType: 'general',
          message: `Start our first coaching session. Give me a brief, direct welcome that references what you know about my situation. End with one question.`
        })
      })
      const d = await r.json()
      setMsgs([{ role: 'ai', content: d.reply || `Hey ${firstName}. What's on your mind?` }])
    } catch {
      setMsgs([{ role: 'ai', content: `Hey ${firstName}. What's on your mind?` }])
    }
    setLoading(false)
  }

  const send = useCallback(async (text) => {
    const content = (text || input).trim()
    if (!content || loading) return

    const { data: { session: sess } } = await supabase.auth.getSession()
    if (!sess) return

    const userMsg = { role: 'user', content }
    setMsgs(p => [...p, userMsg])
    setInput('')
    setLoading(true)

    try {
      const r = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sess.access_token}` },
        body: JSON.stringify({ action: 'coach_chat', threadType: 'general', message: content })
      })
      const d = await r.json()
      setMsgs(p => [...p, { role: 'ai', content: d.reply || 'Keep going.' }])
    } catch {
      setMsgs(p => [...p, { role: 'ai', content: 'Connection issue. Try again.' }])
    }
    setLoading(false)
  }, [input, loading])

  const generateFinancialPlan = async () => {
    if (!session) return
    setPlanLoading(true)
    try {
      const r = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'financial_plan' })
      })
      const d = await r.json()
      setFinancialPlan(d.plan || 'Could not generate plan. Please check your financial data first.')
    } catch {
      setFinancialPlan('Could not generate plan. Please check your connection.')
    }
    setPlanLoading(false)
  }

  const avgScore = scores.length ? Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length) : null
  const TIER_COLORS = { 'GET MOVING': '#f43f5e', 'WARMING UP': '#a78bfa', 'BUILDING': '#f97316', 'SOLID': '#3b82f6', 'STRONG': '#22c55e', 'ELITE': '#f59e0b' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 'clamp(22px,5vw,28px)', fontWeight: 900 }}>Your Coach</h1>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>Remembers everything. Knows your patterns.</p>
        </div>
        <Link to="/voice" style={{ padding: '9px 16px', borderRadius: 10, background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Nunito Sans',sans-serif" }}>
          🎙️ Voice
        </Link>
      </div>

      {/* What coach knows */}
      <div className="card" style={{ padding: 16, background: 'linear-gradient(135deg, #1a2f1a, #0d1f0d)' }}>
        <div className="eyebrow" style={{ color: '#a8d4b0', marginBottom: 12 }}>🧠 What Your Coach Knows</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
          {[
            { label: 'Main Goal', val: settings?.primary_goal ? settings.primary_goal.slice(0, 38) + (settings.primary_goal.length > 38 ? '...' : '') : 'Not set yet' },
            { label: '7-Day Avg', val: avgScore ? `${avgScore}/100` : 'Building...' },
            { label: 'Strongest', val: memory?.strongest_category ? memory.strongest_category.charAt(0).toUpperCase() + memory.strongest_category.slice(1) : 'Analyzing...' },
            { label: 'Days Logged', val: memory?.total_days_logged || scores.length || 0 },
          ].map(item => (
            <div key={item.label} style={{ padding: '10px 12px', background: 'rgba(255,255,255,.08)', borderRadius: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#a8d4b0', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4, fontFamily: "'Nunito Sans',sans-serif" }}>{item.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{item.val}</div>
            </div>
          ))}
        </div>
        {settings?.main_blockers?.length > 0 && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(255,255,255,.06)', borderRadius: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#a8d4b0', letterSpacing: 1, textTransform: 'uppercase', fontFamily: "'Nunito Sans',sans-serif" }}>Known blockers: </span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,.6)' }}>{settings.main_blockers.slice(0, 3).join(', ')}</span>
          </div>
        )}
      </div>

      {/* 7-day score chart */}
      {scores.length > 0 && (
        <div className="card" style={{ padding: '14px 18px' }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>📊 Last 7 Days</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 52 }}>
            {scores.slice().reverse().map((s, i) => {
              const h = Math.max(4, Math.round(s.score / 100 * 48))
              const color = TIER_COLORS[s.tier] || '#1c3d2e'
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: '100%', height: h, background: color, borderRadius: '3px 3px 0 0', transition: 'height .3s' }} title={`${s.score_date}: ${s.score}/100`} />
                  <span style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'monospace' }}>
                    {new Date(s.score_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'narrow' })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: 10, padding: 3, gap: 3 }}>
        {[
          { id: 'chat', label: '💬 Coach Chat' },
          { id: 'insights', label: '⚡ Insights' },
          { id: 'financial', label: '💰 90-Day Plan' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none',
            background: activeTab === tab.id ? '#fff' : 'transparent',
            color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-3)',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            fontFamily: "'Nunito Sans',sans-serif",
            boxShadow: activeTab === tab.id ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
            transition: 'all .15s'
          }}>{tab.label}</button>
        ))}
      </div>

      {/* Chat tab */}
      {activeTab === 'chat' && (
        <div className="card" style={{ padding: 18 }}>
          <div style={{ height: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
            {msgs.length === 0 && loading && (
              <div className="bubble-ai" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div className="spinner spinner-dark" style={{ width: 14, height: 14 }} />
                <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Reading your history...</span>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'bubble-user' : 'bubble-ai'}>{m.content}</div>
            ))}
            {loading && msgs.length > 0 && (
              <div className="bubble-ai">
                <div className="spinner spinner-dark" style={{ width: 14, height: 14 }} />
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input className="input-field" value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Talk to your coach..." />
            <button className="btn btn-primary" onClick={() => send()} disabled={loading || !input.trim()}
              style={{ opacity: loading || !input.trim() ? .5 : 1, minWidth: 64 }}>
              {loading ? <span className="spinner" /> : 'Send'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {QUICK_PROMPTS.map(p => (
              <button key={p.label} onClick={() => send(p.prompt)} style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20,
                padding: '6px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-2)',
                cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif"
              }}>{p.label}</button>
            ))}
          </div>

          <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--surface)', borderRadius: 8 }}>
            <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
              🧠 Your coach remembers past conversations. The longer you use it, the more personalized and accurate it gets.
            </p>
          </div>
        </div>
      )}

      {/* Insights tab */}
      {activeTab === 'insights' && (
        <div className="card" style={{ padding: 18 }}>
          <ProactiveInsights />
        </div>
      )}

      {/* Financial plan tab */}
      {activeTab === 'financial' && (
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>💰 AI Financial Plan</div>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.65 }}>
            Your coach analyzes your actual income, expenses, savings goals, and current financial position, then builds a specific 90-day plan with real numbers.
          </p>

          {!financialPlan && !planLoading && (
            <button className="btn btn-primary" onClick={generateFinancialPlan} style={{ width: '100%', fontSize: 14 }}>
              Generate My 90-Day Financial Plan
            </button>
          )}

          {planLoading && (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <div className="spinner spinner-dark" style={{ margin: '0 auto 12px', width: 24, height: 24 }} />
              <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Analyzing your financial data...</p>
            </div>
          )}

          {financialPlan && !planLoading && (
            <>
              <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
                <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text)', whiteSpace: 'pre-wrap', fontFamily: "'Nunito Sans',sans-serif" }}>
                  {financialPlan}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={generateFinancialPlan} style={{ flex: 1, fontSize: 13 }}>
                  ↺ Regenerate
                </button>
                <Link to="/financial" style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)', fontSize: 13, fontWeight: 700, textDecoration: 'none', textAlign: 'center', fontFamily: "'Nunito Sans',sans-serif" }}>
                  Update Numbers →
                </Link>
              </div>
            </>
          )}

          <div style={{ marginTop: 16, padding: '12px 14px', background: '#eff6ff', borderRadius: 10, border: '1px solid #93c5fd' }}>
            <p style={{ fontSize: 12, color: '#1e3a5f', lineHeight: 1.6, fontFamily: "'Nunito Sans',sans-serif" }}>
              💡 <strong>Tip:</strong> Keep your income, costs, and savings goals updated in the Financial tab. The more accurate your data, the more specific and useful this plan becomes.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
