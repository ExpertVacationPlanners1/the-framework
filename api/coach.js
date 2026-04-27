// api/coach.js — stateless chat fallback (edge function handles persistent memory)
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(200).end()
  }
  if (req.method !== 'POST') return res.status(405).end()
  res.setHeader('Access-Control-Allow-Origin', '*')

  const { messages, system } = req.body
  if (!messages?.length) return res.status(400).json({ error: 'messages required' })

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: system || 'You are a direct, warm personal life coach. 3-4 sentences. End with one specific action.',
        messages: messages.slice(-12)
      })
    })
    const d = await r.json()
    return res.status(200).json({ reply: d.content?.[0]?.text || 'Keep going.' })
  } catch (e) {
    return res.status(500).json({ error: e.message, reply: 'Connection issue. Try again.' })
  }
}
