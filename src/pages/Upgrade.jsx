import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const FEATURES = {
  free: [
    '3 preset goals per category',
    'Daily habit tracking',
    'Basic daily score',
    'Check-in log',
    'Win logging',
  ],
  core: [
    'Everything in Free',
    '✦ AI daily briefing with 3 challenges',
    '✦ AI coach chat (unlimited)',
    '✦ Custom goal creation',
    '✦ Voice coaching sessions (3/week)',
    '✦ 30-day score history',
    '✦ Habit streak calendar',
    '✦ Journal with daily prompts',
    '✦ Shareable score card',
    '✦ Weekly performance report',
    '✦ Financial tracker & savings goals',
    '✦ 7-day free trial',
  ],
  pro: [
    'Everything in Core',
    '✦ Unlimited voice sessions',
    '✦ Advanced analytics & trends',
    '✦ Accountability partner matching',
    '✦ Priority AI responses',
    '✦ Community leaderboard access',
    '✦ Early access to new features',
    '✦ 7-day free trial',
  ]
}

export default function Upgrade() {
  const { user, profile } = useNavigate ? useAuth() : { user: null, profile: null }
  const navigate = useNavigate()
  const [loading, setLoading] = useState(null)
  const [annual, setAnnual] = useState(false)
  const currentTier = profile?.subscription_tier || 'free'

  const checkout = async (tier) => {
    if (!user) { navigate('/signup'); return }
    setLoading(tier)
    try {
      const r = await fetch('/api/stripe-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: user.email, tier, annual })
      })
      const d = await r.json()
      if (d.url) window.location.href = d.url
      else throw new Error(d.error || 'Checkout failed')
    } catch (e) {
      alert('Could not start checkout. Please try again.')
    }
    setLoading(null)
  }

  const TIERS = [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      period: 'forever',
      desc: 'Get started. See what the system can do.',
      color: 'var(--text-3)',
      cta: currentTier === 'free' ? 'Current Plan' : 'Downgrade',
      featured: false,
    },
    {
      id: 'core',
      name: 'Core',
      price: annual ? '$83' : '$9.99',
      period: annual ? '/month, billed annually' : '/month',
      annualNote: annual ? 'Save $36/year' : null,
      desc: 'The full coaching system. Everything you need to build real momentum.',
      color: 'var(--primary)',
      cta: currentTier === 'core' ? 'Current Plan' : currentTier === 'pro' ? 'Downgrade' : 'Start 7-Day Free Trial',
      featured: true,
    },
    {
      id: 'pro',
      name: 'Pro',
      price: annual ? '$167' : '$19.99',
      period: annual ? '/month, billed annually' : '/month',
      annualNote: annual ? 'Save $60/year' : null,
      desc: 'Unlimited sessions, community, and advanced analytics.',
      color: '#f59e0b',
      cta: currentTier === 'pro' ? 'Current Plan' : 'Start 7-Day Free Trial',
      featured: false,
    }
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', padding: '40px 20px' }}>
      {/* Back */}
      <button onClick={() => navigate('/dashboard')} style={{ color: 'rgba(255,255,255,.5)', fontSize: 14, fontWeight: 700, marginBottom: 32, fontFamily: "'Nunito Sans',sans-serif", display: 'block' }}>
        ← Back to Dashboard
      </button>

      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase', marginBottom: 12, fontFamily: "'Nunito Sans',sans-serif" }}>Upgrade Your Framework</div>
          <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 'clamp(28px,5vw,44px)', fontWeight: 900, marginBottom: 16 }}>
            Invest in the person<br/>you're becoming.
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,.5)', fontFamily: "'Nunito Sans',sans-serif" }}>
            Life coaching costs $200-500/month with a human. We're $9.99.
          </p>

          {/* Annual toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 24 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: !annual ? '#fff' : 'rgba(255,255,255,.4)', fontFamily: "'Nunito Sans',sans-serif" }}>Monthly</span>
            <div onClick={() => setAnnual(p => !p)} style={{
              width: 48, height: 26, borderRadius: 13, background: annual ? 'var(--primary)' : 'rgba(255,255,255,.2)',
              cursor: 'pointer', position: 'relative', transition: 'background .2s'
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 3, left: annual ? 25 : 3, transition: 'left .2s'
              }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: annual ? '#c9a96e' : 'rgba(255,255,255,.4)', fontFamily: "'Nunito Sans',sans-serif" }}>Annual <span style={{ color: '#c9a96e' }}>Save 30%</span></span>
          </div>
        </div>

        {/* Tier cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 48 }}>
          {TIERS.map(tier => (
            <div key={tier.id} style={{
              padding: 28, borderRadius: 20,
              border: `2px solid ${tier.featured ? tier.color : 'rgba(255,255,255,.1)'}`,
              background: tier.featured ? 'linear-gradient(135deg, rgba(28,61,46,.3), rgba(28,61,46,.1))' : '#111',
              position: 'relative'
            }}>
              {tier.featured && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'var(--primary)', color: '#fff', padding: '4px 14px', borderRadius: 20, fontSize: 11, fontWeight: 800, fontFamily: "'Nunito Sans',sans-serif", whiteSpace: 'nowrap' }}>
                  MOST POPULAR
                </div>
              )}
              <div style={{ fontSize: 14, fontWeight: 700, color: tier.color, marginBottom: 8, fontFamily: "'Nunito Sans',sans-serif" }}>{tier.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                <span style={{ fontFamily: "'Fraunces',serif", fontSize: 36, fontWeight: 900, color: '#fff' }}>{tier.price}</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', fontFamily: "'Nunito Sans',sans-serif" }}>{tier.period}</span>
              </div>
              {tier.annualNote && <div style={{ fontSize: 11, color: '#c9a96e', fontWeight: 700, marginBottom: 8, fontFamily: "'Nunito Sans',sans-serif" }}>{tier.annualNote}</div>}
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginBottom: 20, lineHeight: 1.6, fontFamily: "'Nunito Sans',sans-serif" }}>{tier.desc}</p>

              <div style={{ marginBottom: 24 }}>
                {FEATURES[tier.id].map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: 12, color: f.startsWith('✦') ? '#fff' : 'rgba(255,255,255,.5)', fontFamily: "'Nunito Sans',sans-serif" }}>
                    <span style={{ color: f.startsWith('✦') ? tier.color : 'rgba(255,255,255,.3)', flexShrink: 0 }}>{f.startsWith('✦') ? '✦' : '✓'}</span>
                    {f.replace('✦ ', '')}
                  </div>
                ))}
              </div>

              <button
                onClick={() => tier.id !== 'free' && currentTier !== tier.id && checkout(tier.id)}
                disabled={currentTier === tier.id || tier.id === 'free' || loading === tier.id}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
                  background: tier.featured ? 'var(--primary)' : currentTier === tier.id ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.08)',
                  color: '#fff', fontSize: 13, fontWeight: 800, cursor: currentTier === tier.id ? 'default' : 'pointer',
                  fontFamily: "'Nunito Sans',sans-serif",
                  opacity: currentTier === tier.id ? .6 : 1
                }}
              >
                {loading === tier.id ? <span style={{ display:'inline-block', width:16, height:16, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .6s linear infinite' }} /> : tier.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Guarantee */}
        <div style={{ textAlign: 'center', padding: '24px', background: 'rgba(255,255,255,.04)', borderRadius: 16, border: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🛡️</div>
          <h3 style={{ fontFamily: "'Fraunces',serif", fontSize: 18, fontWeight: 900, marginBottom: 8 }}>7-Day Free Trial. Cancel Anytime.</h3>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', lineHeight: 1.7, fontFamily: "'Nunito Sans',sans-serif" }}>
            Try Core or Pro free for 7 days. No charge until the trial ends. Cancel any time before then — no questions asked.
          </p>
        </div>
      </div>
    </div>
  )
}
