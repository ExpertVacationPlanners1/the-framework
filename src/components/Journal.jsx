import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const DAILY_PROMPTS = [
  "What's one thing you're proud of today, no matter how small?",
  "What's the one thing you're avoiding right now? Why?",
  "What would tomorrow look like if you gave it everything you had?",
  "Where are you making excuses instead of making progress?",
  "What's one win from today that proves you're capable?",
  "If your best self reviewed today, what would they say?",
  "What's the biggest thing standing between you and where you want to be?",
  "What would you do today if you weren't afraid?",
]

export default function Journal() {
  const { user } = useAuth()
  const [todayEntry, setTodayEntry] = useState(null)
  const [content, setContent] = useState('')
  const [mood, setMood] = useState(5)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const todayDow = new Date().getDay()
  const prompt = DAILY_PROMPTS[todayDow % DAILY_PROMPTS.length]

  useEffect(() => { if (user) loadJournal() }, [user])

  const loadJournal = async () => {
    const [todayRes, histRes] = await Promise.all([
      supabase.from('journal_entries').select('*').eq('user_id', user.id).eq('entry_date', today).single(),
      supabase.from('journal_entries').select('id, entry_date, content, mood, prompt').eq('user_id', user.id).order('entry_date', { ascending: false }).limit(7)
    ])
    if (todayRes.data) { setTodayEntry(todayRes.data); setContent(todayRes.data.content); setMood(todayRes.data.mood || 5) }
    setHistory(histRes.data?.filter(e => e.entry_date !== today) || [])
  }

  const saveEntry = async () => {
    if (!content.trim()) return
    setSaving(true)
    const entry = { user_id: user.id, entry_date: today, prompt, content: content.trim(), mood }
    if (todayEntry) {
      await supabase.from('journal_entries').update({ content: content.trim(), mood }).eq('id', todayEntry.id)
    } else {
      const { data } = await supabase.from('journal_entries').insert(entry).select().single()
      setTodayEntry(data)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
    loadJournal()
  }

  return (
    <div>
      {/* Today's prompt */}
      <div style={{ background: 'var(--primary-light)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, borderLeft: '4px solid var(--primary)' }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: 6 }}>Today's Prompt</div>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary)', lineHeight: 1.6 }}>"{prompt}"</p>
      </div>

      {/* Mood */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>How are you feeling? ({mood}/10)</div>
        <input type="range" min={1} max={10} value={mood} onChange={e => setMood(+e.target.value)}
          style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}/>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>
          <span>Struggling</span><span>Thriving</span>
        </div>
      </div>

      {/* Text area */}
      <textarea
        className="input-field"
        rows={5}
        placeholder="Write freely. This is just for you."
        value={content}
        onChange={e => setContent(e.target.value)}
        style={{ resize: 'none', marginBottom: 10, fontSize: 14, lineHeight: 1.6 }}
      />

      <button className="btn btn-primary btn-full" onClick={saveEntry} disabled={!content.trim() || saving}>
        {saving ? <span className="spinner" /> : saved ? '✓ Saved' : todayEntry ? 'Update Entry' : 'Save Entry'}
      </button>

      {/* History */}
      {history.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button onClick={() => setShowHistory(p => !p)} style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 700, color: 'var(--text-3)', cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif", letterSpacing: .5 }}>
            {showHistory ? '▲ Hide' : '▼ Show'} past entries ({history.length})
          </button>
          {showHistory && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {history.map(e => (
                <div key={e.id} style={{ padding: '12px 14px', background: 'var(--surface)', borderRadius: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>
                      {new Date(e.entry_date).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}
                    </span>
                    {e.mood && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Mood: {e.mood}/10</span>}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{e.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
