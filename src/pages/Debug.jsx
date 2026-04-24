// Debug page - shows env vars and tests Supabase connection
// Visit /debug to diagnose login issues
import { useState, useEffect } from 'react'

export default function Debug() {
  const [result, setResult] = useState('Testing...')
  const [envInfo, setEnvInfo] = useState({})

  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY

    setEnvInfo({
      VITE_SUPABASE_URL: url || '❌ MISSING',
      VITE_SUPABASE_ANON_KEY: key ? `✅ Set (${key.slice(0,20)}...)` : '❌ MISSING',
      NODE_ENV: import.meta.env.MODE,
    })

    if (!url || !key) {
      setResult('❌ Environment variables missing — see below')
      return
    }

    // Test Supabase connection
    fetch(`${url}/rest/v1/`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    })
    .then(r => setResult(`✅ Supabase reachable — HTTP ${r.status}`))
    .catch(e => setResult(`❌ Supabase unreachable: ${e.message}`))
  }, [])

  return (
    <div style={{ padding: 40, fontFamily: 'monospace', background: '#0a0a0a', minHeight: '100vh', color: '#fff' }}>
      <h1 style={{ marginBottom: 24, fontSize: 20 }}>🔧 Debug — Environment Check</h1>

      <div style={{ marginBottom: 24, padding: 16, background: '#111', borderRadius: 8 }}>
        <h2 style={{ fontSize: 14, marginBottom: 12, color: '#c9a96e' }}>Supabase Connection Test</h2>
        <p style={{ fontSize: 14 }}>{result}</p>
      </div>

      <div style={{ padding: 16, background: '#111', borderRadius: 8, marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, marginBottom: 12, color: '#c9a96e' }}>Environment Variables</h2>
        {Object.entries(envInfo).map(([k, v]) => (
          <div key={k} style={{ marginBottom: 8, fontSize: 13 }}>
            <span style={{ color: '#93c5fd' }}>{k}:</span>{' '}
            <span style={{ color: v.startsWith('❌') ? '#f43f5e' : '#22c55e' }}>{v}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: 16, background: '#111', borderRadius: 8 }}>
        <h2 style={{ fontSize: 14, marginBottom: 12, color: '#c9a96e' }}>Fix Instructions</h2>
        <p style={{ fontSize: 13, lineHeight: 1.8, color: '#a1a1aa' }}>
          If env vars are MISSING:<br/>
          1. Go to vercel.com → your project → Settings → Environment Variables<br/>
          2. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY<br/>
          3. <strong style={{color:'#fff'}}>Trigger a new deployment</strong> (Settings → Deployments → Redeploy)<br/>
          4. VITE_ vars must be present at BUILD time, not just runtime
        </p>
      </div>

      <div style={{ marginTop: 24 }}>
        <a href="/login" style={{ color: '#c9a96e', fontSize: 14 }}>← Back to Login</a>
      </div>
    </div>
  )
}
