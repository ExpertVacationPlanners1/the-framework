import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signUp } from '../lib/supabase'

export default function Signup() {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true)
    const { error } = await signUp(form.email, form.password, form.name)
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      navigate('/onboarding')
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card animate-fade-up">
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🎯</div>
          <h1 className="font-serif" style={{ fontSize: 26, marginBottom: 8 }}>Start building your life</h1>
          <p style={{ fontSize: 14, color: 'var(--text-3)' }}>Free forever. No credit card needed.</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="input-group">
            <label className="input-label">Your first name</label>
            <input
              className="input-field" placeholder="Alex"
              value={form.name} onChange={e => set('name', e.target.value)} required autoFocus
            />
          </div>
          <div className="input-group">
            <label className="input-label">Email</label>
            <input
              type="email" className="input-field" placeholder="you@example.com"
              value={form.email} onChange={e => set('email', e.target.value)} required
            />
          </div>
          <div className="input-group">
            <label className="input-label">Password</label>
            <input
              type="password" className="input-field" placeholder="At least 6 characters"
              value={form.password} onChange={e => set('password', e.target.value)} required
            />
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
      </div>
    </div>
  )
}
