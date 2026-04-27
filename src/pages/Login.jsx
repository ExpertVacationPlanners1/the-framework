import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Login doesn't need to navigate — useAuth onAuthStateChange handles it
// Once signed in, ProtectedRoute will automatically redirect to /dashboard
export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      const msg = error.message?.toLowerCase() || ''
      if (msg.includes('invalid')) setError('Incorrect email or password.')
      else if (msg.includes('confirm')) setError('Please check your email and confirm your account first.')
      else setError(error.message)
      setLoading(false)
      return
    }

    if (data?.session) {
      // Auth context will pick this up via onAuthStateChange
      // ProtectedRoute will redirect automatically — just show success
      setSuccess(true)
      // Don't call navigate() — let the auth state drive routing
    } else {
      setError('Sign in failed — please try again.')
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="auth-container">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
          <h2 className="font-serif" style={{ fontSize: 22, marginBottom: 8 }}>Signed in!</h2>
          <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 20 }}>Loading your dashboard...</p>
          <div className="spinner spinner-dark" style={{ margin: '0 auto', width: 28, height: 28 }} />
        </div>
      </div>
    )
  }

  return (
    <div className="auth-container">
      <div className="auth-card animate-fade-up">
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🎯</div>
          <h1 className="font-serif" style={{ fontSize: 26, marginBottom: 8 }}>Welcome back</h1>
          <p style={{ fontSize: 14, color: 'var(--text-3)' }}>Sign in to your coaching dashboard</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="input-group">
            <label className="input-label">Email</label>
            <input
              type="email" className="input-field"
              placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)}
              required autoFocus
            />
          </div>
          <div className="input-group">
            <label className="input-label">Password</label>
            <input
              type="password" className="input-field"
              placeholder="Your password"
              value={password} onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div style={{ padding: '12px 14px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
              <p style={{ fontSize: 13, color: 'var(--red)', fontWeight: 600 }}>{error}</p>
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-full"
            disabled={loading} style={{ marginTop: 4, fontSize: 15 }}>
            {loading
              ? <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <span className="spinner" /> Signing in...
                </span>
              : 'Sign In'
            }
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--text-3)' }}>
          Don't have an account?{' '}
          <Link to="/signup" style={{ color: 'var(--primary)', fontWeight: 700 }}>Sign up free</Link>
        </p>
      </div>
    </div>
  )
}
