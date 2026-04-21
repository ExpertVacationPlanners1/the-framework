import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signUp } from '../lib/supabase'

export default function Signup() {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const navigate = useNavigate()

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true)
    const { data, error } = await signUp(form.email, form.password, form.name)
    if (error) {
      setError(error.message)
      setLoading(false)
    } else if (data?.user?.identities?.length === 0) {
      setError('An account with this email already exists. Please sign in.')
      setLoading(false)
    } else if (data?.session) {
      // Email confirmation disabled - go straight to onboarding
      navigate('/onboarding')
    } else {
      // Email confirmation required - show check email screen
      setShowConfirm(true)
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card animate-fade-up">

        {showConfirm ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
            <h2 className="font-serif" style={{ fontSize: 24, marginBottom: 12 }}>Check your email</h2>
            <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 24 }}>
              We sent a confirmation link to <strong>{form.email}</strong>.<br/>
              Click it to activate your account and start building.
            </p>
            <div style={{ padding: '14px', background: 'var(--primary-light)', borderRadius: 10, border: '1px solid rgba(28,61,46,.15)', marginBottom: 20 }}>
              <p style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>
                ✓ After confirming, you'll be taken straight to your personalized onboarding.
              </p>
            </div>
            <button className="btn btn-ghost btn-full" onClick={() => setShowConfirm(false)}>
              ← Use a different email
            </button>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🎯</div>
              <h1 className="font-serif" style={{ fontSize: 26, marginBottom: 8 }}>Start building your life</h1>
              <p style={{ fontSize: 14, color: 'var(--text-3)' }}>Free forever. No credit card needed.</p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="input-group">
                <label className="input-label">Your first name</label>
                <input className="input-field" placeholder="Alex"
                  value={form.name} onChange={e => set('name', e.target.value)} required autoFocus/>
              </div>
              <div className="input-group">
                <label className="input-label">Email</label>
                <input type="email" className="input-field" placeholder="you@example.com"
                  value={form.email} onChange={e => set('email', e.target.value)} required/>
              </div>
              <div className="input-group">
                <label className="input-label">Password</label>
                <input type="password" className="input-field" placeholder="At least 6 characters"
                  value={form.password} onChange={e => set('password', e.target.value)} required/>
              </div>

              {error && (
                <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
                  <p style={{ fontSize: 13, color: 'var(--red)', fontWeight: 600 }}>{error}</p>
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-full" disabled={loading} style={{ marginTop: 4 }}>
                {loading ? <span className="spinner" /> : 'Create My Account'}
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6 }}>
              By signing up you agree to our Terms of Service.
            </p>
            <p style={{ textAlign: 'center', marginTop: 12, fontSize: 14, color: 'var(--text-3)' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 700 }}>Sign in</Link>
            </p>
          </>
        )}

      </div>
    </div>
  )
}
