import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { userId, force } = req.body
  const today = new Date().toISOString().split('T')[0]
  const dow = new Date().getDay()
  const isWeekend = dow === 0 || dow === 6
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/New_York' })

  if (!force) {
    const { data } = await supabase.from('daily_briefings').select('*').eq('user_id', userId).eq('briefing_date', today).single()
    if (data) return res.status(200).json({ briefing: data })
  }

  const { data: settings } = await supabase.from('user_settings').select('*').eq('user_id', userId).single()
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userId).single()
  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const goal = settings?.primary_goal || 'building a better life'
  const blockers = (settings?.main_blockers || []).join(', ') || 'unknown'
  const targetScore = isWeekend ? 65 : (settings?.weekday_target || 75)

  const prompt = `You are a personal life coach generating a daily briefing for ${firstName}.
Their main goal: "${goal}"
Main blockers: ${blockers}
Today is ${dayName}${isWeekend ? ' (weekend — no work goals)' : ''}.

Return ONLY valid JSON, no markdown:
{
  "greeting": "one punchy opening line (max 10 words)",
  "coachNote": "2-3 sentences setting the tone for today. Reference it's ${dayName}. Frame today like a game to win.",
  "challenges": [
    ${!isWeekend ? `{"category":"work","icon":"💼","label":"WORK","color":"#1c3d2e","bg":"#f0fdf4","points":20,"challenge":"one specific work task for today","why":"one sentence reason"},` : ''}
    {"category":"personal","icon":"🏠","label":"PERSONAL","color":"#7c3d00","bg":"#fff7ed","points":15,"challenge":"one specific personal action for today","why":"one sentence reason"},
    {"category":"financial","icon":"📈","label":"FINANCIAL","color":"#1e3a5f","bg":"#eff6ff","points":15,"challenge":"one specific financial action for today","why":"one sentence reason"}
  ]
}`

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 600, messages: [{ role: 'user', content: prompt }] })
    })
    const d = await r.json()
    const content = JSON.parse(d.content?.[0]?.text?.replace(/```json|```/g, '').trim() || '{}')
    const briefingData = {
      user_id: userId, briefing_date: today,
      content: { ...content }, target_score: targetScore,
      challenges_completed: { work: false, personal: false, financial: false }
    }
    await supabase.from('daily_briefings').upsert(briefingData)
    return res.status(200).json({ briefing: briefingData })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
