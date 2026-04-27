import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const TYPE_CONFIG = {
  challenge:        { icon: '⚡', color: '#1c3d2e', bg: '#f0fdf4', label: 'CHALLENGE' },
  goal_suggestion:  { icon: '🎯', color: '#7c3d00', bg: '#fff7ed', label: 'GOAL' },
  financial_tip:    { icon: '💰', color: '#1e3a5f', bg: '#eff6ff', label: 'FINANCIAL' },
  pattern:          { icon: '📊', color: '#6d28d9', bg: '#f5f3ff', label: 'PATTERN' },
  achievement:      { icon: '🏆', color: '#b45309', bg: '#fffbeb', label: 'WIN' },
  warning:          { icon: '⚠️', color: '#9f1239', bg: '#fff1f2', label: 'HEADS UP' },
  motivation:       { icon: '🔥', color: '#0369a1', bg: '#f0f9ff', label: 'COACH' },
}

const EDGE_URL = `https://dayawnsrnasnzyslzrga.supabase.co/functions/v1/coach-intelligence`

export default function ProactiveInsights({ compact = false }) {
  const { user } = useAuth()
  const [insights, setInsights] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { if (user) loadInsights() }, [user])

  const loadInsights = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('proactive_insights')
      .select('*')
      .eq('user_id', user.id)
      .eq('dismissed', false)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(compact ? 3 : 6)

    setInsights(data || [])
    setLoading(false)

    // Auto-generate if no insights today
    if (!data?.some(i => i.insight_date === today)) {
      generateInsights()
    }
  }

  const generateInsights = async () => {
    setGenerating(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setGenerating(false); return }

      const r = await fetch(EDGE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ action: 'generate_insights' })
      })

      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()

      if (d.insights?.length > 0) {
        // Reload from DB after generation
        await loadInsights()
      }
    } catch (e) {
      console.error('Generate insights error:', e)
      setError('Could not generate insights. Check your connection.')
    }
    setGenerating(false)
  }

  const dismissInsight = async (id) => {
    await supabase.from('proactive_insights').update({ dismissed: true }).eq('id', id)
    setInsights(p => p.filter(i => i.id !== id))
  }

  const actOnInsight = async (insight) => {
    await supabase.from('proactive_insights').update({ acted_on: true }).eq('id', insight.id)
    setInsights(p => p.map(i => i.id === insight.id ? { ...i, acted_on: true } : i))
  }

  if (loading) {
    return (
      <div style={{ padding: '16px 0', display: 'flex', gap: 10, alignItems: 'center' }}>
        <div className="spinner spinner-dark" style={{ width: 16, height: 16 }} />
        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Loading your insights...</span>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 3 }}>🧠 Your Coach Noticed</div>
          {insights.length > 0 && <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Based on your actual data today</p>}
        </div>
        <button
          onClick={generateInsights}
          disabled={generating}
          style={{ padding: '6px 12px', borderRadius: 8, background: 'var(--primary-light)', border: '1px solid var(--primary)', color: 'var(--primary)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif", opacity: generating ? .6 : 1 }}
        >
          {generating ? '...' : '↺ Refresh'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: 8, marginBottom: 12, fontSize: 13, color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {generating && insights.length === 0 && (
        <div style={{ padding: '20px', background: 'var(--surface)', borderRadius: 12, textAlign: 'center' }}>
          <div className="spinner spinner-dark" style={{ margin: '0 auto 10px', width: 22, height: 22 }} />
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Analyzing your data and generating personalized insights...</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {insights.map(insight => {
          const cfg = TYPE_CONFIG[insight.insight_type] || TYPE_CONFIG.motivation
          return (
            <div key={insight.id} style={{
              borderRadius: 12, border: `1.5px solid ${insight.acted_on ? '#d1fae5' : cfg.color + '30'}`,
              background: insight.acted_on ? '#f0fdf4' : cfg.bg,
              overflow: 'hidden', transition: 'all .2s',
              opacity: insight.acted_on ? .7 : 1
            }}>
              <div style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 16 }}>{cfg.icon}</span>
                      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: cfg.color, textTransform: 'uppercase', fontFamily: "'Nunito Sans',sans-serif" }}>{cfg.label}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-3)' }}>· Priority {insight.priority}/10</span>
                      {insight.acted_on && <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 700 }}>✓ Done</span>}
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{insight.title}</p>
                    <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65 }}>{insight.body}</p>
                  </div>
                  <button
                    onClick={() => dismissInsight(insight.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 18, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}
                  >×</button>
                </div>

                {insight.action_label && !insight.acted_on && (
                  <button
                    onClick={() => actOnInsight(insight)}
                    style={{ marginTop: 10, padding: '7px 14px', borderRadius: 8, background: cfg.color, color: '#fff', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif" }}
                  >
                    {insight.action_label} →
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {insights.length === 0 && !generating && !error && (
        <div style={{ padding: '20px', background: 'var(--surface)', borderRadius: 12, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 12 }}>No insights yet today.</p>
          <button className="btn btn-primary btn-sm" onClick={generateInsights}>Generate Insights</button>
        </div>
      )}
    </div>
  )
}
