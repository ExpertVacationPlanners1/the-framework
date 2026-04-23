import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const TIER_BG = {
  'GET MOVING': '#1c000a',
  'WARMING UP': '#1e0050',
  'BUILDING': '#1c0a00',
  'SOLID': '#0f1e35',
  'STRONG': '#052e16',
  'ELITE': '#1c1200'
}

export default function ShareCard({ score, tier, tierColor, firstName, focus }) {
  const { user } = useAuth()
  const cardRef = useRef(null)
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const copyShareText = async () => {
    const text = `🎯 Daily Score: ${score}/100 — ${tier}\n\n"${focus || 'Building a better life, one day at a time.'}"\n\nTracking my progress with The Framework 📊\ntheframework.app`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      // Log the share
      await supabase.from('score_shares').insert({
        user_id: user.id, score, tier: tier, share_date: new Date().toISOString().split('T')[0], platform: 'clipboard'
      })
    } catch {}
  }

  const shareNative = async () => {
    const text = `🎯 Daily Score: ${score}/100 — ${tier}\n\n"${focus || 'Building a better life, one day at a time.'}"\n\nTracking my progress with The Framework 📊`
    if (navigator.share) {
      setSharing(true)
      try {
        await navigator.share({ title: 'My Daily Score', text, url: 'https://the-framework-one.vercel.app' })
        await supabase.from('score_shares').insert({
          user_id: user.id, score, tier, share_date: new Date().toISOString().split('T')[0], platform: 'native_share'
        })
      } catch {}
      setSharing(false)
    } else {
      copyShareText()
    }
  }

  return (
    <div>
      {/* Visual card preview */}
      <div ref={cardRef} style={{
        background: `linear-gradient(135deg, ${TIER_BG[tier] || '#052e16'}, #0a0a0a)`,
        borderRadius: 16, padding: 24, border: `2px solid ${tierColor}30`,
        marginBottom: 16, position: 'relative', overflow: 'hidden'
      }}>
        {/* Background decoration */}
        <div style={{
          position: 'absolute', top: -40, right: -40,
          width: 160, height: 160, borderRadius: '50%',
          background: `${tierColor}08`
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: tierColor, textTransform: 'uppercase', marginBottom: 6, fontFamily: "'Nunito Sans',sans-serif" }}>
              🎯 Daily Score
            </div>
            <div style={{ fontFamily: "'Fraunces',serif", fontSize: 64, fontWeight: 900, color: tierColor, lineHeight: 1 }}>{score}</div>
            <div style={{ fontFamily: "'Nunito Sans',sans-serif", fontSize: 12, fontWeight: 800, letterSpacing: 2, color: tierColor, marginTop: 4 }}>{tier}</div>
          </div>
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="4"/>
            <circle cx="32" cy="32" r="26" fill="none" stroke={tierColor} strokeWidth="4"
              strokeDasharray={2*Math.PI*26} strokeDashoffset={2*Math.PI*26*(1-score/100)}
              strokeLinecap="round" transform="rotate(-90 32 32)"/>
            <text x="32" y="36" textAnchor="middle" fill={tierColor} fontSize="13" fontWeight="900" fontFamily="sans-serif">{score}%</text>
          </svg>
        </div>

        {focus && (
          <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,.06)', borderRadius: 8, marginBottom: 12 }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', fontStyle: 'italic', lineHeight: 1.5, fontFamily: "'Nunito Sans',sans-serif" }}>
              "{focus}"
            </p>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: "'Nunito Sans',sans-serif", fontSize: 11, color: 'rgba(255,255,255,.4)' }}>
            {firstName} · {today}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>🎯</span>
            <span style={{ fontFamily: "'Fraunces',serif", fontSize: 13, fontWeight: 900, color: 'rgba(255,255,255,.5)' }}>The Framework</span>
          </div>
        </div>
      </div>

      {/* Share buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button className="btn btn-primary" onClick={shareNative} disabled={sharing} style={{ fontSize: 13 }}>
          {sharing ? <span className="spinner" /> : '📤 Share Score'}
        </button>
        <button className="btn btn-secondary" onClick={copyShareText} style={{ fontSize: 13 }}>
          {copied ? '✓ Copied!' : '📋 Copy Text'}
        </button>
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
        Share to Instagram Stories, TikTok, or anywhere. Let people know you're building.
      </p>
    </div>
  )
}
