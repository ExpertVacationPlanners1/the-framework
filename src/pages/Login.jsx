import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signIn } from '../lib/supabase'

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

    // Timeout safety — never spin forever
    const timer = setTimeout(() => {
      setLoading(false)
      setError('Login is taking too long. Please try again.')
    }, 10000)

    try {
      const { data, error } = await signIn(email, password)
      clearTimeout(timer)

      if (error) {
        const msg = error.message?.toLowerCase() || ''
        if (msg.includes('invalid')) setError('Incorrect email or password.')
        else if (msg.includes('confirmed')) setError('Please confirm your email first, then try again.')
        else setError(error.message)
        setLoading(false)
        return
      }

      if (data?.session) {
        navigate('/dashboard')
      } else {
        setError('Could not sign in. Please try again.')
        setLoading(false)
      }
    } catch (err) {
      clearTimeout(timer)
      setError('Something went wrong. Check your connection and try again.')
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
            <input type="email" className="input-field" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} required autoFocus/>
          </div>
          <div className="input-group">
            <label className="input-label">Password</label>
            <input type="password" className="input-field" placeholder="Your password"
              value={password} onChange={e => setPassword(e.target.value)} required/>
          </div>

          {error && (
            <div style={{ padding: '12px 14px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
              <p style={{ fontSize: 13, color: 'var(--red)', fontWeight: 600 }}>{error}</p>
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-full" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? <span className="spinner" /> : 'Sign In'}
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
