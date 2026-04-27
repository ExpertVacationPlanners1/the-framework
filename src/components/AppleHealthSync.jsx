import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const APP_URL = 'https://the-framework-one.vercel.app'

export default function AppleHealthSync() {
  const { user } = useAuth()
  const [token, setToken] = useState(null)
  const [syncHistory, setSyncHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [testing, setTesting] = useState(false)
  const [copied, setCopied] = useState('')
  const [step, setStep] = useState(1)

  useEffect(() => { if (user) load() }, [user])

  const load = async () => {
    setLoading(true)
    const [tokenRes, historyRes] = await Promise.all([
      supabase.from('health_sync_tokens').select('*').eq('user_id', user.id).single(),
      supabase.from('health_sync_log').select('sync_date,steps,calories_active,sleep_hours,workouts,synced_at').eq('user_id', user.id).order('sync_date', { ascending: false }).limit(10)
    ])
    setToken(tokenRes.data || null)
    setSyncHistory(historyRes.data || [])
    setLoading(false)
  }

  const generateToken = async () => {
    setGenerating(true)
    const { data } = await supabase.from('health_sync_tokens').upsert({ user_id: user.id }).select().single()
    setToken(data)
    setGenerating(false)
  }

  const copy = (text, key) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  const testSync = async () => {
    if (!token) return
    setTesting(true)
    setTestResult(null)
    try {
      const r = await fetch(`${APP_URL}/api/health-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.token,
          date: new Date().toISOString().split('T')[0],
          steps: 8432,
          active_calories: 387,
          resting_calories: 1842,
          sleep_hours: 7.2,
          resting_heart_rate: 58,
          water_ml: 1800,
          source: 'test',
          workouts: []
        })
      })
      const d = await r.json()
      setTestResult(d)
      if (d.success) load()
    } catch (e) {
      setTestResult({ error: e.message })
    }
    setTesting(false)
  }

  const syncURL = token ? `${APP_URL}/api/health-sync` : ''
  const webhookToken = token?.token || ''

  // The shortcut JSON structure to show users
  const shortcutSteps = [
    {
      step: 1,
      title: 'Open Shortcuts on iPhone',
      desc: 'Open the Shortcuts app. Tap + to create a new shortcut.',
      icon: '📱'
    },
    {
      step: 2,
      title: 'Add "Get Health Sample" actions',
      desc: 'Search for "Health" actions. Add these one by one:\n• Get Health Sample → Steps\n• Get Health Sample → Active Energy Burned\n• Get Health Sample → Resting Energy Burned\n• Get Health Sample → Sleep Analysis\n• Get Health Sample → Resting Heart Rate\n• Get Health Sample → Body Mass (weight)',
      icon: '💪'
    },
    {
      step: 3,
      title: 'Set time range for each',
      desc: 'For each "Get Health Sample": set period to "Today" and aggregation to "Sum" (or "Latest" for heart rate and weight).',
      icon: '📅'
    },
    {
      step: 4,
      title: 'Add "Get Contents of URL" action',
      desc: 'Add a "Get Contents of URL" action. Set method to POST, URL to the sync URL below.',
      icon: '🌐'
    },
    {
      step: 5,
      title: 'Configure the request body',
      desc: 'In the URL action, set Request Body to JSON and add these key-value pairs using your saved Health samples as values.',
      icon: '⚙️'
    },
    {
      step: 6,
      title: 'Automate it',
      desc: 'Go to Automations tab → + → Time of Day → set to 9:00 PM daily → Run Immediately → select your shortcut.',
      icon: '🔄'
    }
  ]

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div className="spinner spinner-dark" style={{ width: 16, height: 16 }} /><span style={{ fontSize: 13, color: 'var(--text-3)' }}>Loading...</span></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg,#ff2d55,#ff9500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>🍎</div>
        <div>
          <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 22, fontWeight: 900, marginBottom: 3 }}>Apple Health Sync</h2>
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Auto-sync steps, calories, sleep, workouts & weight</p>
        </div>
      </div>

      {/* Last sync status */}
      {syncHistory.length > 0 && (
        <div style={{ padding: '12px 16px', background: '#f0fdf4', borderRadius: 12, border: '1px solid #86efac', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Last Sync</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{new Date(syncHistory[0].synced_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
          </div>
          {[
            { label: 'Steps', val: syncHistory[0].steps?.toLocaleString() || '—' },
            { label: 'Active Cal', val: syncHistory[0].calories_active ? `${syncHistory[0].calories_active} kcal` : '—' },
            { label: 'Sleep', val: syncHistory[0].sleep_hours ? `${syncHistory[0].sleep_hours}h` : '—' },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{s.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Token section */}
      <div className="card" style={{ padding: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>🔑 Your Sync Token</div>

        {!token ? (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14, lineHeight: 1.65 }}>
              Generate a secure token to link your iPhone with this app. Keep it private — it's your personal health data key.
            </p>
            <button className="btn btn-primary btn-full" onClick={generateToken} disabled={generating}>
              {generating ? <span className="spinner" /> : '🔑 Generate My Sync Token'}
            </button>
          </div>
        ) : (
          <div>
            {/* Sync URL */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>SYNC URL (paste into Shortcuts)</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ flex: 1, padding: '10px 12px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all', color: 'var(--text)' }}>
                  {syncURL}
                </div>
                <button onClick={() => copy(syncURL, 'url')} style={{ padding: '8px 12px', borderRadius: 8, background: copied === 'url' ? '#16a34a' : 'var(--primary)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif", flexShrink: 0 }}>
                  {copied === 'url' ? '✓' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Token */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>TOKEN (add as "token" field in request body)</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ flex: 1, padding: '10px 12px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all', color: 'var(--text)' }}>
                  {webhookToken}
                </div>
                <button onClick={() => copy(webhookToken, 'token')} style={{ padding: '8px 12px', borderRadius: 8, background: copied === 'token' ? '#16a34a' : 'var(--primary)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif", flexShrink: 0 }}>
                  {copied === 'token' ? '✓' : 'Copy'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={testSync} disabled={testing} style={{ flex: 1, padding: '10px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #86efac', color: '#16a34a', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif" }}>
                {testing ? '...' : '🧪 Test Sync'}
              </button>
              <button onClick={generateToken} disabled={generating} style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif" }}>
                ↺ New Token
              </button>
            </div>

            {testResult && (
              <div style={{ marginTop: 10, padding: '10px 14px', background: testResult.success ? '#f0fdf4' : '#fef2f2', borderRadius: 8, border: `1px solid ${testResult.success ? '#86efac' : '#fecaca'}` }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: testResult.success ? '#16a34a' : '#dc2626' }}>
                  {testResult.success ? `✓ ${testResult.message}` : `✕ ${testResult.error || 'Sync failed'}`}
                </p>
                {testResult.synced && (
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>
                    Steps: {testResult.synced.steps?.toLocaleString()} · Calories: {testResult.synced.calories_active} · Sleep: {testResult.synced.sleep_hours}h
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Setup guide */}
      {token && (
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>📋 iPhone Setup (5 minutes)</div>

          {/* Step selector */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
            {shortcutSteps.map(s => (
              <button key={s.step} onClick={() => setStep(s.step)} style={{
                width: 32, height: 32, borderRadius: '50%', border: '2px solid',
                borderColor: step === s.step ? 'var(--primary)' : 'var(--border)',
                background: step === s.step ? 'var(--primary)' : 'var(--card)',
                color: step === s.step ? '#fff' : 'var(--text-3)',
                fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif"
              }}>{s.step}</button>
            ))}
          </div>

          {shortcutSteps.filter(s => s.step === step).map(s => (
            <div key={s.step} style={{ padding: '14px 16px', background: 'var(--surface)', borderRadius: 12 }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 24 }}>{s.icon}</span>
                <p style={{ fontSize: 15, fontWeight: 800 }}>Step {s.step}: {s.title}</p>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.75, whiteSpace: 'pre-line' }}>{s.desc}</p>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            {step > 1 && <button onClick={() => setStep(p => p - 1)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text-2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif" }}>← Back</button>}
            {step < 6 && <button onClick={() => setStep(p => p + 1)} className="btn btn-primary" style={{ flex: 1, fontSize: 13 }}>Next →</button>}
            {step === 6 && <button onClick={testSync} className="btn btn-primary" style={{ flex: 1, fontSize: 13 }} disabled={testing}>{testing ? '...' : '🧪 Test It Now'}</button>}
          </div>
        </div>
      )}

      {/* JSON request body reference */}
      {token && (
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>⚙️ Shortcut Request Body</div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12, lineHeight: 1.6 }}>In the "Get Contents of URL" action, set Request Body to JSON and add these fields. Map each to the corresponding Health sample from the steps above.</p>
          <div style={{ background: '#0f1923', borderRadius: 10, padding: 14, fontFamily: 'monospace', fontSize: 11, color: '#e2e8f0', lineHeight: 1.8, overflowX: 'auto' }}>
            <span style={{ color: '#93c5fd' }}>{'{'}</span>{'\n'}
            {'  '}<span style={{ color: '#f9a8d4' }}>"token"</span><span style={{ color: '#fff' }}>: </span><span style={{ color: '#86efac' }}>"{webhookToken.slice(0,8)}..."</span>,{'\n'}
            {'  '}<span style={{ color: '#f9a8d4' }}>"steps"</span><span style={{ color: '#fff' }}>: </span><span style={{ color: '#fde68a' }}>Steps sample</span>,{'\n'}
            {'  '}<span style={{ color: '#f9a8d4' }}>"active_calories"</span><span style={{ color: '#fff' }}>: </span><span style={{ color: '#fde68a' }}>Active Energy sample</span>,{'\n'}
            {'  '}<span style={{ color: '#f9a8d4' }}>"resting_calories"</span><span style={{ color: '#fff' }}>: </span><span style={{ color: '#fde68a' }}>Resting Energy sample</span>,{'\n'}
            {'  '}<span style={{ color: '#f9a8d4' }}>"sleep_hours"</span><span style={{ color: '#fff' }}>: </span><span style={{ color: '#fde68a' }}>Sleep Analysis sample</span>,{'\n'}
            {'  '}<span style={{ color: '#f9a8d4' }}>"resting_heart_rate"</span><span style={{ color: '#fff' }}>: </span><span style={{ color: '#fde68a' }}>Resting Heart Rate sample</span>,{'\n'}
            {'  '}<span style={{ color: '#f9a8d4' }}>"weight_lbs"</span><span style={{ color: '#fff' }}>: </span><span style={{ color: '#fde68a' }}>Body Mass sample</span>,{'\n'}
            {'  '}<span style={{ color: '#f9a8d4' }}>"water_oz"</span><span style={{ color: '#fff' }}>: </span><span style={{ color: '#fde68a' }}>Dietary Water sample</span>{'\n'}
            <span style={{ color: '#93c5fd' }}>{'}'}</span>
          </div>
          <button onClick={() => copy(JSON.stringify({ token: webhookToken, steps: 'STEPS_SAMPLE', active_calories: 'ACTIVE_CAL_SAMPLE', resting_calories: 'RESTING_CAL_SAMPLE', sleep_hours: 'SLEEP_SAMPLE', resting_heart_rate: 'RHR_SAMPLE', weight_lbs: 'WEIGHT_SAMPLE', water_oz: 'WATER_SAMPLE' }, null, 2), 'json')} style={{ marginTop: 10, width: '100%', padding: '9px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif", color: 'var(--text-2)' }}>
            {copied === 'json' ? '✓ Copied!' : '📋 Copy JSON Template'}
          </button>
        </div>
      )}

      {/* Sync history */}
      {syncHistory.length > 0 && (
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>📊 Sync History</div>
          {syncHistory.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700 }}>{new Date(s.sync_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {s.steps ? `${s.steps.toLocaleString()} steps` : ''}
                  {s.calories_active ? ` · ${s.calories_active} cal` : ''}
                  {s.sleep_hours ? ` · ${s.sleep_hours}h sleep` : ''}
                  {Array.isArray(s.workouts) && s.workouts.length > 0 ? ` · ${s.workouts.length} workout${s.workouts.length > 1 ? 's' : ''}` : ''}
                </p>
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{new Date(s.synced_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
            </div>
          ))}
        </div>
      )}

      {/* What gets synced */}
      <div style={{ padding: '14px 16px', background: '#f0f9ff', borderRadius: 12, border: '1px solid #bae6fd' }}>
        <div className="eyebrow" style={{ color: '#0369a1', marginBottom: 10 }}>✓ What Gets Synced</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[
            ['👣 Steps', '→ Body Metrics'],
            ['🔥 Active Calories', '→ Today tab'],
            ['😴 Sleep hours', '→ Body Metrics'],
            ['💓 Resting HR', '→ Body Metrics'],
            ['💧 Water intake', '→ Body Metrics'],
            ['⚖️ Weight', '→ Body Metrics + Chart'],
            ['🏋️ Workouts', '→ Workout History'],
            ['🫀 Body fat %', '→ Body Metrics'],
          ].map(([from, to]) => (
            <div key={from} style={{ fontSize: 11, color: '#1e3a5f', display: 'flex', gap: 4 }}>
              <span>{from}</span><span style={{ color: '#0369a1' }}>{to}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
