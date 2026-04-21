import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff' }}>

      {/* Nav */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '16px 24px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', background: 'rgba(10,10,10,.9)',
        backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🎯</span>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: '#fff' }}>
            The Framework
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link to="/login" style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.7)', fontFamily: "'Nunito Sans', sans-serif" }}>
            Sign In
          </Link>
          <Link to="/signup" style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#1c3d2e', color: '#fff', fontFamily: "'Nunito Sans', sans-serif" }}>
            Get Started Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        padding: '120px 20px 80px',
        background: 'linear-gradient(135deg, #0a0a0a 0%, #0f2d1e 50%, #0a0a0a 100%)',
        position: 'relative', overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 50% 40%, rgba(201,169,110,.06) 0%, transparent 65%)'
        }} />

        <div style={{ position: 'relative', maxWidth: 680, margin: '0 auto' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 16px', borderRadius: 20,
            border: '1px solid rgba(201,169,110,.3)',
            background: 'rgba(201,169,110,.08)',
            marginBottom: 24
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#c9a96e', letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'Nunito Sans', sans-serif" }}>
              Your Personal Life Coach · 24/7
            </span>
          </div>

          <h1 style={{
            fontFamily: "'Fraunces', serif", fontWeight: 900,
            fontSize: 'clamp(36px, 8vw, 64px)', lineHeight: 1.05,
            color: '#fff', marginBottom: 24
          }}>
            Stop feeling stuck.<br />
            <span style={{ color: '#c9a96e' }}>Start building the life</span><br />
            you actually want.
          </h1>

          <p style={{
            fontSize: 'clamp(15px, 2.5vw, 18px)', color: 'rgba(255,255,255,.65)',
            lineHeight: 1.7, marginBottom: 40, maxWidth: 520, margin: '0 auto 40px',
            fontFamily: "'Nunito Sans', sans-serif"
          }}>
            The Framework is the personal life coach for people who know they want more —
            but don't have $500/month or a support system cheering them on.
            Daily score. Real coaching. No fluff.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
            <Link to="/signup" style={{
              padding: '14px 32px', borderRadius: 12, fontSize: 16, fontWeight: 800,
              background: '#1c3d2e', color: '#fff', fontFamily: "'Nunito Sans', sans-serif",
              boxShadow: '0 0 30px rgba(28,61,46,.4)'
            }}>
              Start Free — No Credit Card
            </Link>
            <a href="#how-it-works" style={{
              padding: '14px 32px', borderRadius: 12, fontSize: 16, fontWeight: 700,
              background: 'rgba(255,255,255,.08)', color: '#fff',
              border: '1px solid rgba(255,255,255,.15)',
              fontFamily: "'Nunito Sans', sans-serif"
            }}>
              See How It Works
            </a>
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', fontFamily: "'Nunito Sans', sans-serif" }}>
            Free forever · No credit card · Takes 5 minutes to set up
          </p>
        </div>

        {/* Score preview */}
        <div style={{
          marginTop: 80, maxWidth: 360,
          background: '#111', borderRadius: 20,
          border: '1px solid rgba(255,255,255,.1)',
          padding: 24, textAlign: 'left',
          boxShadow: '0 25px 50px rgba(0,0,0,.5)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: '#22c55e', textTransform: 'uppercase', fontFamily: "'Nunito Sans', sans-serif" }}>🏆 Today's Score</div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 48, fontWeight: 900, color: '#22c55e', lineHeight: 1 }}>78</div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: '#22c55e', fontFamily: "'Nunito Sans', sans-serif" }}>STRONG</div>
            </div>
            <svg width="68" height="68" viewBox="0 0 68 68">
              <circle cx="34" cy="34" r="28" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="5"/>
              <circle cx="34" cy="34" r="28" fill="none" stroke="#22c55e" strokeWidth="5"
                strokeDasharray={175.9} strokeDashoffset={175.9 * 0.22}
                strokeLinecap="round" transform="rotate(-90 34 34)"/>
              <text x="34" y="38" textAnchor="middle" fill="#22c55e" fontSize="14" fontWeight="900" fontFamily="sans-serif">78%</text>
            </svg>
          </div>
          <div style={{ background: '#1a1a1a', borderRadius: 10, padding: '12px 14px', borderLeft: '3px solid #22c55e' }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.8)', lineHeight: 1.65, fontFamily: "'Nunito Sans', sans-serif" }}>
              Strong performance today. You've hit 5 of 7 work tasks and all 4 habits. Two more tasks and you hit ELITE. What's stopping you?
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" style={{ padding: '100px 20px', background: '#0d0d0d' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.8, color: '#c9a96e', textTransform: 'uppercase', marginBottom: 16, fontFamily: "'Nunito Sans', sans-serif" }}>
            How It Works
          </div>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 900, color: '#fff', marginBottom: 60 }}>
            Your coach. Your scoreboard. Every day.
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
            {[
              { icon: '🎯', title: 'Set your profile', desc: 'Tell us where you\'re stuck — work, finances, confidence, relationships. Your goals and schedule are set once. Everything adjusts to you.' },
              { icon: '📋', title: 'Daily briefing', desc: 'Every morning you get 3 specific challenges and a target score. Not generic advice — your actual priorities for that day.' },
              { icon: '🏆', title: 'Live score', desc: 'Your 0-100 score updates in real time as you complete tasks, hit habits, and log wins. Watch yourself improve every single day.' },
              { icon: '🧠', title: 'AI coach responds', desc: 'Your coach reads your actual progress and speaks to it directly. Bad day? It calls you out. Good day? It pushes you higher.' },
              { icon: '🎙️', title: 'Voice check-ins', desc: '10-minute voice sessions with your coach. Talk through stress, get real advice, build mental toughness. No judgment, just forward motion.' },
              { icon: '📈', title: 'Weekly report', desc: 'Every Sunday — your average score, best and worst day, habit consistency, and your priorities for next week.' },
            ].map(item => (
              <div key={item.title} style={{
                background: '#141414', borderRadius: 16, padding: 28,
                border: '1px solid rgba(255,255,255,.07)', textAlign: 'left'
              }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{item.icon}</div>
                <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{item.title}</h3>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,.5)', lineHeight: 1.65, fontFamily: "'Nunito Sans', sans-serif" }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section style={{ padding: '100px 20px', background: '#0a0a0a' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.8, color: '#c9a96e', textTransform: 'uppercase', marginBottom: 16, fontFamily: "'Nunito Sans', sans-serif" }}>Pricing</div>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 900, color: '#fff', marginBottom: 16 }}>
            Less than a gym membership.
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,.5)', marginBottom: 60, fontFamily: "'Nunito Sans', sans-serif" }}>
            Life coaching costs $200-500/month with a human. We're $9.99.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            {[
              {
                name: 'Free', price: '$0', period: 'forever',
                features: ['Daily score', '3 preset tasks per category', 'Basic habit tracking', 'Check-in log'],
                cta: 'Start Free', link: '/signup', featured: false
              },
              {
                name: 'Core', price: '$9.99', period: '/month',
                features: ['Everything in Free', 'AI daily briefing', 'AI coach chat', 'Voice check-ins (3/week)', 'Telegram bot', 'Weekly reports', 'Custom goals'],
                cta: 'Start Core', link: '/signup', featured: true
              },
              {
                name: 'Pro', price: '$19.99', period: '/month',
                features: ['Everything in Core', 'Unlimited voice sessions', 'Score history + charts', 'Advanced analytics', 'Priority AI responses', 'Accountability partner matching'],
                cta: 'Start Pro', link: '/signup', featured: false
              }
            ].map(tier => (
              <div key={tier.name} style={{
                padding: 28, borderRadius: 20,
                border: `2px solid ${tier.featured ? '#1c3d2e' : 'rgba(255,255,255,.1)'}`,
                background: tier.featured ? 'linear-gradient(135deg, #0f2d1e, #0a1a10)' : '#111',
                textAlign: 'left'
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: tier.featured ? '#22c55e' : 'rgba(255,255,255,.4)', marginBottom: 8, fontFamily: "'Nunito Sans', sans-serif" }}>{tier.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                  <span style={{ fontFamily: "'Fraunces', serif", fontSize: 36, fontWeight: 900, color: '#fff' }}>{tier.price}</span>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', fontFamily: "'Nunito Sans', sans-serif" }}>{tier.period}</span>
                </div>
                <div style={{ marginBottom: 24 }}>
                  {tier.features.map(f => (
                    <div key={f} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '5px 0', fontSize: 13, color: 'rgba(255,255,255,.65)', fontFamily: "'Nunito Sans', sans-serif" }}>
                      <span style={{ color: '#22c55e', flexShrink: 0, marginTop: 1 }}>✓</span> {f}
                    </div>
                  ))}
                </div>
                <Link to={tier.link} style={{
                  display: 'block', padding: '11px 0', borderRadius: 10,
                  textAlign: 'center', fontSize: 13, fontWeight: 800,
                  background: tier.featured ? '#1c3d2e' : 'rgba(255,255,255,.08)',
                  color: '#fff', fontFamily: "'Nunito Sans', sans-serif",
                  border: tier.featured ? 'none' : '1px solid rgba(255,255,255,.15)'
                }}>
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{
        padding: '100px 20px', textAlign: 'center',
        background: 'linear-gradient(135deg, #1c3d2e 0%, #0f2d1e 100%)'
      }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 900, color: '#fff', marginBottom: 20 }}>
          You already know<br />you want more.
        </h2>
        <p style={{ fontSize: 18, color: 'rgba(255,255,255,.65)', marginBottom: 36, fontFamily: "'Nunito Sans', sans-serif" }}>
          The only thing missing is the framework to build it.
        </p>
        <Link to="/signup" style={{
          padding: '16px 40px', borderRadius: 12, fontSize: 16, fontWeight: 800,
          background: '#fff', color: '#1c3d2e', fontFamily: "'Nunito Sans', sans-serif",
          boxShadow: '0 10px 30px rgba(0,0,0,.3)'
        }}>
          Start Building Today — It's Free
        </Link>
      </section>

      {/* Footer */}
      <footer style={{ background: '#080808', padding: '40px 20px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 18 }}>🎯</span>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 900, color: '#fff' }}>The Framework</span>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', fontFamily: "'Nunito Sans', sans-serif" }}>
          © 2026 The Framework. Built for people who are done feeling stuck.
        </p>
      </footer>
    </div>
  )
}
