// api/briefing-user.js
// Uses anon key + user JWT - no service role key needed

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    return res.status(200).end()
  }
  if (req.method !== 'POST') return res.status(405).end()
  res.setHeader('Access-Control-Allow-Origin', '*')

  const { userId, force, userJwt, settings, firstName } = req.body
  const today = new Date().toISOString().split('T')[0]
  const dow = new Date().getDay()
  const isWeekend = dow === 0 || dow === 6
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/New_York' })

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

  // Use user's JWT if provided (respects RLS), otherwise fall back to anon key
  const authHeader = userJwt ? `Bearer ${userJwt}` : `Bearer ${SUPABASE_KEY}`

  async function dbGet(table, filters) {
    const params = Object.entries(filters).map(([k, v]) => `${k}=eq.${v}`).join('&')
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}&limit=1`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': authHeader }
    })
    const d = await r.json()
    return Array.isArray(d) ? d[0] : null
  }

  async function dbUpsert(table, data) {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY, 'Authorization': authHeader,
        'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(data)
    })
  }

  // Check for existing briefing today (unless force refresh)
  if (!force) {
    const existing = await dbGet('daily_briefings', { user_id: userId, briefing_date: today })
    if (existing) return res.status(200).json({ briefing: existing })
  }

  // Generate with AI
  const name = firstName || 'there'
  const goal = settings?.primary_goal || 'building a better life'
  const blockers = (settings?.main_blockers || []).join(', ') || 'not specified'
  const targetScore = isWeekend ? 65 : (settings?.weekday_target || 75)

  const prompt = `You are a personal life coach generating a daily briefing for ${name}.
Their main goal: "${goal}"
Main blockers: ${blockers}
Today is ${dayName}${isWeekend ? ' (weekend — no work goals today)' : ''}.
Target score: ${targetScore}/100

Return ONLY valid JSON, no markdown fences:
{
  "greeting": "punchy opening line under 10 words",
  "coachNote": "2-3 sentences. Reference ${dayName}. Frame today as a game to win. Speak directly to ${name}.",
  "challenges": [
    ${!isWeekend ? `{"category":"work","icon":"💼","label":"WORK","color":"#1c3d2e","bg":"#f0fdf4","points":20,"challenge":"one specific work action for today","why":"one sentence reason"},` : ''}
    {"category":"personal","icon":"🏠","label":"PERSONAL","color":"#7c3d00","bg":"#fff7ed","points":15,"challenge":"one specific personal action for today","why":"one sentence reason"},
    {"category":"financial","icon":"📈","label":"FINANCIAL","color":"#1e3a5f","bg":"#eff6ff","points":15,"challenge":"one specific financial action for today","why":"one sentence reason"}
  ]
}`

  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const aiData = await aiRes.json()
    const raw = aiData.content?.[0]?.text?.replace(/```json|```/g, '').trim() || '{}'
    const content = JSON.parse(raw)

    const briefingData = {
      user_id: userId,
      briefing_date: today,
      content,
      target_score: targetScore,
      challenges_completed: { work: false, personal: false, financial: false }
    }

    await dbUpsert('daily_briefings', briefingData)
    return res.status(200).json({ briefing: briefingData })

  } catch (e) {
    // Fallback briefing — never fails
    const fallback = {
      user_id: userId,
      briefing_date: today,
      content: {
        greeting: isWeekend ? 'Rest with intention today.' : `${dayName}. Let's go.`,
        coachNote: isWeekend
          ? `It's ${dayName} — your recovery day. Work goals don't count. Focus on personal growth, family, and one financial move. Target: 65.`
          : `It's ${dayName}, ${name}. Your target is ${targetScore}+. Every task moves the score. Treat today like a game you intend to win.`,
        challenges: [
          ...(!isWeekend ? [{ category: 'work', icon: '💼', label: 'WORK', color: '#1c3d2e', bg: '#f0fdf4', points: 20, challenge: 'Complete your single most important work task before noon.', why: 'One completed priority beats five half-started ones.' }] : []),
          { category: 'personal', icon: '🏠', label: 'PERSONAL', color: '#7c3d00', bg: '#fff7ed', points: 15, challenge: 'Protect your morning routine and be fully present.', why: 'Your morning sets the tone for everything.' },
          { category: 'financial', icon: '📈', label: 'FINANCIAL', color: '#1e3a5f', bg: '#eff6ff', points: 15, challenge: 'Review your bank balance — no avoiding it.', why: 'Facing your numbers removes the anxiety of avoiding them.' }
        ]
      },
      target_score: targetScore,
      challenges_completed: { work: false, personal: false, financial: false }
    }
    return res.status(200).json({ briefing: fallback })
  }
}
