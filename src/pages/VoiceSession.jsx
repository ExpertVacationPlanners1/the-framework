import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const SESSION_TYPES = [
  { id: 'coaching', label: 'Coaching Session', icon: '🎯', desc: 'Performance review, goal setting, accountability', color: '#1c3d2e' },
  { id: 'therapy', label: 'Stress Check-In', icon: '🧘', desc: 'Talk through stress, anxiety, or overwhelm', color: '#4a1d96' },
  { id: 'checkin', label: 'Daily Check-In', icon: '⚡', desc: 'Quick 5-min pulse on how you\'re doing today', color: '#1e3a5f' },
]

const COACH_SYSTEMS = {
  coaching: `You are a personal life coach having a voice conversation. Be direct, warm, and athletic in your framing. The user is working on building a better life and needs accountability and real coaching. Ask powerful questions. Push them when they're making excuses. Celebrate genuine wins. Keep responses conversational and under 4 sentences. Always end with a question or a clear next action.`,
  therapy: `You are a supportive, grounded life coach conducting a stress check-in. Listen carefully. Reflect back what you hear. Help the person name what they're actually feeling and separate facts from anxiety spirals. Be calm, steady, and direct. No toxic positivity. Keep responses under 4 sentences and ask one focused question at a time.`,
  checkin: `You are a personal accountability coach doing a quick daily check-in. Be concise and direct. Ask about today's priority, what's gone well, and what's getting in the way. Help the person clarify their focus for the rest of the day. Keep every response under 3 sentences.`
}

const OPENING_MESSAGES = {
  coaching: "I'm ready to coach you. Let's start with this: what's the most important thing you're working on right now, and how honest are you being with yourself about your progress?",
  therapy: "I'm here. Take a breath. Tell me what's been sitting heaviest on you lately — work, family, money, or just a general sense of being overwhelmed. What's actually going on?",
  checkin: "Quick check-in. Three questions: What's your #1 priority for today? What's already gone well? And what's getting in your way right now?"
}

export default function VoiceSession() {
  const { user, profile, settings } = useAuth()
  const navigate = useNavigate()
  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  const [sessionType, setSessionType] = useState(null)
  const [phase, setPhase] = useState('select') // select | intro | session | summary
  const [messages, setMessages] = useState([])
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [sessionTime, setSessionTime] = useState(0)
  const [moodBefore, setMoodBefore] = useState(null)
  const [moodAfter, setMoodAfter] = useState(null)
  const [summary, setSummary] = useState(null)
  const [savingSession, setSavingSession] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [useTextMode, setUseTextMode] = useState(false)
  const [browserSupport, setBrowserSupport] = useState(true)

  const recognitionRef = useRef(null)
  const synthRef = useRef(window.speechSynthesis)
  const timerRef = useRef(null)
  const messagesEndRef = useRef(null)
  const sessionStartRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
      setBrowserSupport(false)
      setUseTextMode(true)
    }
    return () => {
      stopListening()
      if (synthRef.current) synthRef.current.cancel()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  useEffect(() => {
    if (phase === 'session') {
      sessionStartRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setSessionTime(Math.floor((Date.now() - sessionStartRef.current) / 1000))
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase])

  const speak = useCallback((text, onEnd) => {
    if (synthRef.current) {
      synthRef.current.cancel()
      const utt = new SpeechSynthesisUtterance(text)
      utt.rate = 0.92; utt.pitch = 1.0; utt.volume = 1
      const voices = synthRef.current.getVoices()
      const preferred = voices.find(v => v.name.includes('Samantha') || v.name.includes('Karen') || v.name.includes('Daniel'))
      if (preferred) utt.voice = preferred
      utt.onstart = () => setIsSpeaking(true)
      utt.onend = () => { setIsSpeaking(false); if (onEnd) onEnd() }
      utt.onerror = () => { setIsSpeaking(false); if (onEnd) onEnd() }
      setIsSpeaking(true)
      synthRef.current.speak(utt)
    }
  }, [])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
      recognitionRef.current = null
    }
    setIsListening(false)
    setInterimTranscript('')
  }, [])

  const startListening = useCallback(() => {
    if (useTextMode || isSpeaking || isProcessing) return
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) { setUseTextMode(true); return }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (e) => {
      let interim = '', final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' '
        else interim += e.results[i][0].transcript
      }
      setInterimTranscript(interim)
      if (final) {
        setTranscript(p => p + final)
        setInterimTranscript('')
      }
    }
    recognition.onerror = (e) => {
      if (e.error === 'not-allowed') { setBrowserSupport(false); setUseTextMode(true) }
      setIsListening(false)
    }
    recognition.onend = () => setIsListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [useTextMode, isSpeaking, isProcessing])

  const sendMessage = useCallback(async (content) => {
    if (!content.trim()) return
    stopListening()
    const userMsg = { role: 'user', content: content.trim() }
    const newMsgs = [...messages, userMsg]
    setMessages(newMsgs)
    setTranscript('')
    setIsProcessing(true)

    try {
      const r = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: COACH_SYSTEMS[sessionType] + ` The user's name is ${firstName}. Their main goal: "${settings?.primary_goal || 'building a better life'}".`,
          messages: newMsgs.map(m => ({ role: m.role, content: m.content }))
        })
      })
      const d = await r.json()
      const reply = d.reply || "Keep going. What else is on your mind?"
      const aiMsg = { role: 'assistant', content: reply }
      setMessages(p => [...p, aiMsg])
      if (!useTextMode) speak(reply)
    } catch {
      const fallback = "I'm here. Keep talking."
      setMessages(p => [...p, { role: 'assistant', content: fallback }])
      if (!useTextMode) speak(fallback)
    }
    setIsProcessing(false)
  }, [messages, sessionType, firstName, settings, speak, stopListening, useTextMode])

  const startSession = async (type) => {
    setSessionType(type)
    setPhase('intro')
    const opening = OPENING_MESSAGES[type]
    setMessages([{ role: 'assistant', content: opening }])
    setTimeout(() => {
      setPhase('session')
      if (!useTextMode) speak(opening)
    }, 200)
  }

  const handleMicClick = () => {
    if (isListening) {
      stopListening()
      if (transcript.trim()) sendMessage(transcript)
    } else {
      startListening()
    }
  }

  const handleTextSend = () => {
    if (textInput.trim()) { sendMessage(textInput); setTextInput('') }
  }

  const endSession = async () => {
    stopListening()
    synthRef.current?.cancel()
    if (timerRef.current) clearInterval(timerRef.current)
    setSavingSession(true)
    setPhase('summary')

    const fullTranscript = messages.map(m => `${m.role === 'user' ? firstName : 'Coach'}: ${m.content}`).join('\n\n')

    try {
      const r = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: 'Generate a brief session summary. Return JSON only, no markdown: {"summary":"2-3 sentence summary of what was discussed","insights":["key insight 1","key insight 2","key insight 3"],"nextAction":"one specific action to take"}',
          messages: [{ role: 'user', content: `Summarize this ${sessionType} session:\n\n${fullTranscript}` }]
        })
      })
      const d = await r.json()
      try {
        const parsed = JSON.parse(d.reply.replace(/```json|```/g, '').trim())
        setSummary(parsed)
      } catch {
        setSummary({ summary: 'Good session. Your coach heard you.', insights: ['You showed up — that matters.'], nextAction: 'Take the next step you identified today.' })
      }

      await supabase.from('voice_sessions').insert({
        user_id: user.id,
        session_type: sessionType,
        duration_seconds: sessionTime,
        transcript: fullTranscript,
        ai_summary: d.reply,
        mood_before: moodBefore,
        mood_after: moodAfter,
        session_date: new Date().toISOString().split('T')[0]
      })
    } catch {
      setSummary({ summary: 'Session complete.', insights: ['You showed up.'], nextAction: 'Take the next step.' })
    }
    setSavingSession(false)
  }

  const fmt = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <button onClick={() => { synthRef.current?.cancel(); navigate('/dashboard') }} style={{ color: 'rgba(255,255,255,.6)', fontSize: 14, fontWeight: 700, fontFamily: "'Nunito Sans',sans-serif", display: 'flex', alignItems: 'center', gap: 6 }}>
          ← Dashboard
        </button>
        <div style={{ fontFamily: "'Fraunces',serif", fontSize: 16, fontWeight: 900, color: '#fff' }}>🎙️ Voice Session</div>
        {phase === 'session' && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="font-mono" style={{ fontSize: 14, color: sessionTime >= 540 ? '#f59e0b' : 'rgba(255,255,255,.5)' }}>{fmt(sessionTime)}</span>
            <button onClick={endSession} style={{ padding: '6px 14px', borderRadius: 8, background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif" }}>End</button>
          </div>
        )}
        {phase !== 'session' && <div style={{ width: 80 }}/>}
      </div>

      {/* Select phase */}
      {phase === 'select' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
          <div style={{ marginBottom: 12, fontSize: 11, fontWeight: 800, letterSpacing: 1.8, color: '#c9a96e', textTransform: 'uppercase', fontFamily: "'Nunito Sans',sans-serif" }}>
            Choose Your Session
          </div>
          <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 'clamp(24px,5vw,36px)', fontWeight: 900, marginBottom: 8, textAlign: 'center' }}>
            What do you need right now?
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,.5)', marginBottom: 40, textAlign: 'center', fontFamily: "'Nunito Sans',sans-serif" }}>
            Your AI coach is ready. Talk freely — no judgment, just forward motion.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 420 }}>
            {SESSION_TYPES.map(t => (
              <button key={t.id} onClick={() => startSession(t.id)} style={{
                padding: '20px 24px', borderRadius: 16, border: `2px solid ${t.color}40`,
                background: `${t.color}15`, cursor: 'pointer', textAlign: 'left',
                transition: 'all .2s', fontFamily: "'Nunito Sans',sans-serif"
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = t.color; e.currentTarget.style.background = `${t.color}25` }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = `${t.color}40`; e.currentTarget.style.background = `${t.color}15` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 28 }}>{t.icon}</span>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{t.label}</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)' }}>{t.desc}</div>
                  </div>
                  <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,.3)', fontSize: 18 }}>→</span>
                </div>
              </button>
            ))}
          </div>

          {!browserSupport && (
            <div style={{ marginTop: 24, padding: '12px 16px', background: 'rgba(245,158,11,.1)', borderRadius: 10, border: '1px solid rgba(245,158,11,.3)', maxWidth: 420, width: '100%' }}>
              <p style={{ fontSize: 13, color: '#f59e0b', fontFamily: "'Nunito Sans',sans-serif" }}>
                🔒 Microphone not available. Text mode will be used automatically.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Session phase */}
      {(phase === 'session' || phase === 'intro') && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 640, margin: '0 auto', width: '100%', padding: '0 16px' }}>
          {/* Session type badge */}
          {sessionType && (
            <div style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>{SESSION_TYPES.find(t => t.id === sessionType)?.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.6)', fontFamily: "'Nunito Sans',sans-serif" }}>
                {SESSION_TYPES.find(t => t.id === sessionType)?.label}
              </span>
              {!useTextMode && (
                <button onClick={() => setUseTextMode(p => !p)} style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.4)', background: 'none', border: '1px solid rgba(255,255,255,.15)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif" }}>
                  {useTextMode ? '🎙️ Use voice' : '⌨️ Use text'}
                </button>
              )}
            </div>
          )}

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                maxWidth: '88%',
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                background: m.role === 'user' ? '#1c3d2e' : 'rgba(255,255,255,.08)',
                borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                padding: '12px 16px',
                border: m.role === 'assistant' ? '1px solid rgba(255,255,255,.1)' : 'none'
              }}>
                <p style={{ fontSize: 14, lineHeight: 1.65, color: '#fff', fontFamily: "'Nunito Sans',sans-serif" }}>{m.content}</p>
              </div>
            ))}
            {isProcessing && (
              <div style={{ alignSelf: 'flex-start', padding: '12px 16px', background: 'rgba(255,255,255,.06)', borderRadius: '18px 18px 18px 4px', display: 'flex', gap: 8, alignItems: 'center', border: '1px solid rgba(255,255,255,.08)' }}>
                <div className="spinner" style={{ borderTopColor: '#c9a96e', borderColor: 'rgba(255,255,255,.15)' }}/><span style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', fontFamily: "'Nunito Sans',sans-serif" }}>Coach is thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef}/>
          </div>

          {/* Input area */}
          <div style={{ padding: '16px 0 24px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
            {/* Transcript preview */}
            {(transcript || interimTranscript) && (
              <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(255,255,255,.06)', borderRadius: 10, border: '1px solid rgba(255,255,255,.1)' }}>
                <p style={{ fontSize: 14, color: '#fff', fontFamily: "'Nunito Sans',sans-serif", lineHeight: 1.5 }}>
                  {transcript}<span style={{ color: 'rgba(255,255,255,.4)' }}>{interimTranscript}</span>
                </p>
              </div>
            )}

            {useTextMode ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={textInput} onChange={e => setTextInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleTextSend()}
                  placeholder="Type your response..." disabled={isProcessing}
                  style={{ flex: 1, padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.08)', color: '#fff', fontSize: 14, outline: 'none', fontFamily: "'Nunito Sans',sans-serif" }}/>
                <button onClick={handleTextSend} disabled={!textInput.trim() || isProcessing} style={{ padding: '12px 20px', borderRadius: 12, background: '#1c3d2e', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif", opacity: !textInput.trim() || isProcessing ? .5 : 1 }}>Send</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <button
                  className={`voice-pulse${isListening ? ' active' : ''}`}
                  onClick={handleMicClick}
                  disabled={isSpeaking || isProcessing}
                  style={{ background: isListening ? '#dc2626' : isSpeaking ? '#7c3d00' : '#1c3d2e', opacity: (isSpeaking || isProcessing) && !isListening ? .5 : 1 }}
                >
                  {isListening ? '⏹' : isSpeaking ? '🔊' : '🎙️'}
                </button>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', textAlign: 'center', fontFamily: "'Nunito Sans',sans-serif" }}>
                  {isListening ? 'Listening... tap to send' : isSpeaking ? 'Coach is speaking...' : isProcessing ? 'Processing...' : 'Tap to speak'}
                </p>
                {transcript && !isListening && (
                  <button onClick={() => sendMessage(transcript)} style={{ padding: '8px 20px', borderRadius: 20, background: '#1c3d2e', color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif" }}>
                    Send →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary phase */}
      {phase === 'summary' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', maxWidth: 500, margin: '0 auto', width: '100%' }}>
          {savingSession ? (
            <div style={{ textAlign: 'center' }}>
              <div className="spinner" style={{ width: 32, height: 32, borderTopColor: '#c9a96e', borderColor: 'rgba(255,255,255,.15)', margin: '0 auto 16px' }}/>
              <p style={{ color: 'rgba(255,255,255,.6)', fontFamily: "'Nunito Sans',sans-serif" }}>Saving your session...</p>
            </div>
          ) : summary && (
            <div style={{ width: '100%' }} className="animate-fade-up">
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 26, fontWeight: 900 }}>Session Complete</h2>
                <p style={{ color: 'rgba(255,255,255,.5)', marginTop: 8, fontFamily: "'Nunito Sans',sans-serif" }}>{fmt(sessionTime)} · {SESSION_TYPES.find(t => t.id === sessionType)?.label}</p>
              </div>

              <div style={{ background: 'rgba(255,255,255,.06)', borderRadius: 16, padding: 20, marginBottom: 14, border: '1px solid rgba(255,255,255,.1)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: '#c9a96e', marginBottom: 10, fontFamily: "'Nunito Sans',sans-serif" }}>SESSION SUMMARY</div>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,.8)', fontFamily: "'Nunito Sans',sans-serif" }}>{summary.summary}</p>
              </div>

              <div style={{ background: 'rgba(255,255,255,.06)', borderRadius: 16, padding: 20, marginBottom: 14, border: '1px solid rgba(255,255,255,.1)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: '#93c5fd', marginBottom: 10, fontFamily: "'Nunito Sans',sans-serif" }}>KEY INSIGHTS</div>
                {(summary.insights || []).map((insight, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                    <span style={{ color: '#22c55e', flexShrink: 0 }}>→</span>
                    <span style={{ fontSize: 14, color: 'rgba(255,255,255,.8)', fontFamily: "'Nunito Sans',sans-serif", lineHeight: 1.5 }}>{insight}</span>
                  </div>
                ))}
              </div>

              {summary.nextAction && (
                <div style={{ background: '#1c3d2e', borderRadius: 16, padding: 20, marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: '#a8d4b0', marginBottom: 8, fontFamily: "'Nunito Sans',sans-serif" }}>YOUR NEXT ACTION</div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: "'Nunito Sans',sans-serif" }}>→ {summary.nextAction}</p>
                </div>
              )}

              <button onClick={() => navigate('/dashboard')} style={{ width: '100%', padding: '14px', borderRadius: 12, background: '#1c3d2e', color: '#fff', fontSize: 15, fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif" }}>
                Back to Dashboard →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
