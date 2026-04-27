import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        const msg = error.message?.toLowerCase() || ''
        if (msg.includes('invalid')) setError('Incorrect email or password. Please try again.')
        else if (msg.includes('email not confirmed')) setError('Please confirm your email first.')
        else setError(error.message)
        setLoading(false)
        return
      }

      if (data?.session) {
        // Success — navigate to dashboard
        navigate('/dashboard', { replace: true })
      } else {
        // Session missing — try refreshing
        const { data: refreshed } = await supabase.auth.getSession()
        if (refreshed?.session) {
          navigate('/dashboard', { replace: true })
        } else {
          setError('Sign in failed. Please try again.')
          setLoading(false)
        }
      }
    } catch (err) {
      setError(`Error: ${err.message}. Check your internet connection.`)
      setLoading(false)
    }
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

          <button type="submit" className="btn btn-primary btn-full" disabled={loading} style={{ marginTop: 4, fontSize: 15 }}>
            {loading
              ? <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <span className="spinner" />
                  Signing in...
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
