// api/intelligence.js
// Full intelligence engine on Vercel - uses ANTHROPIC_API_KEY already set here
// Calls Supabase as the user via their JWT - no service role key needed

const SUPABASE_URL = 'https://dayawnsrnasnzyslzrga.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRheWF3bnNybmFzbnp5c2x6cmdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyODQ2MTcsImV4cCI6MjA5MTg2MDYxN30.dTKFKeMDaVogvJuEoD2iMk3mdoL9WliYtjjIVP8YVyI'

async function sbFetch(path, jwt) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${jwt}` }
  })
  return r.ok ? r.json() : []
}

async function sbPost(path, body, jwt) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify(body)
  })
  return r.ok ? r.json().catch(() => ({})) : {}
}

async function callClaude(system, messages, maxTokens = 800) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: maxTokens, system, messages })
  })
  const d = await r.json()
  return d.content?.[0]?.text || ''
}

async function getUserId(jwt) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${jwt}` }
  })
  const d = await r.json()
  return d.id || null
}

async function buildContext(userId, jwt) {
  const thirty = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  const today = new Date().toISOString().split('T')[0]

  const [profile, settings, memory, scores, habits, habitComps, tasks, taskComps, wins, budget, savingsGoals, goals, threads] = await Promise.all([
    sbFetch(`profiles?id=eq.${userId}&select=full_name,subscription_tier,created_at`, jwt),
    sbFetch(`user_settings?user_id=eq.${userId}`, jwt),
    sbFetch(`coach_memory?user_id=eq.${userId}`, jwt),
    sbFetch(`daily_scores?user_id=eq.${userId}&score_date=gte.${thirty}&order=score_date`, jwt),
    sbFetch(`user_habits?user_id=eq.${userId}&is_active=eq.true`, jwt),
    sbFetch(`habit_completions?user_id=eq.${userId}&completed_date=gte.${thirty}`, jwt),
    sbFetch(`user_tasks?user_id=eq.${userId}&is_active=eq.true`, jwt),
    sbFetch(`daily_task_completions?user_id=eq.${userId}&completed_date=gte.${thirty}`, jwt),
    sbFetch(`user_logs?user_id=eq.${userId}&log_type=eq.win&order=logged_at.desc&limit=8`, jwt),
    sbFetch(`user_budget?user_id=eq.${userId}`, jwt),
    sbFetch(`savings_goals?user_id=eq.${userId}`, jwt),
    sbFetch(`user_goals?user_id=eq.${userId}&status=eq.active`, jwt),
    sbFetch(`conversation_threads?user_id=eq.${userId}&select=thread_type,messages,message_count`, jwt),
  ])

  const scoreArr = Array.isArray(scores) ? scores.map(s => s.score) : []
  const avg30 = scoreArr.length ? Math.round(scoreArr.reduce((a, b) => a + b, 0) / scoreArr.length) : 0
  const recent7 = scoreArr.slice(-7)
  const avg7 = recent7.length ? Math.round(recent7.reduce((a, b) => a + b, 0) / recent7.length) : 0
  const trend = recent7.length >= 3 ? (recent7[recent7.length - 1] > recent7[0] ? 'improving' : recent7[recent7.length - 1] < recent7[0] ? 'declining' : 'stable') : 'unknown'

  const habitArr = Array.isArray(habits) ? habits : []
  const habitCompArr = Array.isArray(habitComps) ? habitComps : []
  const habitRates = {}
  habitArr.forEach(h => {
    const done = habitCompArr.filter(c => c.habit_id === h.id).length
    habitRates[h.name] = Math.round(done / 30 * 100)
  })

  const taskArr = Array.isArray(tasks) ? tasks : []
  const compArr = Array.isArray(taskComps) ? taskComps : []
  const catPerf = {}
  for (const cat of ['work', 'personal', 'financial', 'health', 'family']) {
    const ct = taskArr.filter(t => t.category === cat)
    if (!ct.length) continue
    const done = compArr.filter(c => ct.some(t => t.id === c.task_id)).length
    catPerf[cat] = { done, total: ct.length, rate: Math.round(done / Math.max(ct.length * 30, 1) * 100) }
  }

  const bud = Array.isArray(budget) ? budget[0] : null
  const income = +(bud?.income || 0)
  const fixed = +(bud?.fixed_costs || 0)
  const variable = +(bud?.variable_costs || 0)
  const target = +(bud?.stability_target || 0)
  const netMonthly = income - fixed - variable
  const savingsTotal = Array.isArray(savingsGoals) ? savingsGoals.reduce((a, s) => a + +(s.current_amount || 0), 0) : 0

  const p = Array.isArray(profile) ? profile[0] : null
  const s = Array.isArray(settings) ? settings[0] : null
  const m = Array.isArray(memory) ? memory[0] : null
  const joined = p?.created_at ? new Date(p.created_at) : new Date()
  const daysSince = Math.floor((Date.now() - joined.getTime()) / 86400000)

  // Thread history
  const threadMap = {}
  if (Array.isArray(threads)) {
    threads.forEach(t => { threadMap[t.thread_type] = t.messages || [] })
  }

  return {
    userId, jwt, today,
    firstName: p?.full_name?.split(' ')[0] || 'there',
    settings: s,
    memory: m,
    daysSince,
    scores: { avg30, avg7, trend, daysLogged: scoreArr.length, recent: recent7 },
    habitRates,
    catPerf,
    financial: { income, fixed, variable, target, netMonthly, savingsTotal },
    savingsGoals: Array.isArray(savingsGoals) ? savingsGoals : [],
    goals: Array.isArray(goals) ? goals : [],
    wins: Array.isArray(wins) ? wins.map(w => w.content) : [],
    threads: threadMap
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    return res.status(200).end()
  }
  if (req.method !== 'POST') return res.status(405).end()
  res.setHeader('Access-Control-Allow-Origin', '*')

  const jwt = req.headers.authorization?.replace('Bearer ', '')
  if (!jwt) return res.status(401).json({ error: 'No token' })

  const userId = await getUserId(jwt)
  if (!userId) return res.status(401).json({ error: 'Invalid token' })

  const { action, message, threadType, force } = req.body || {}

  try {
    // ── generate_insights ──────────────────────────────────────
    if (action === 'generate_insights') {
      const today = new Date().toISOString().split('T')[0]

      // Check if already generated today
      if (!force) {
        const existing = await sbFetch(`proactive_insights?user_id=eq.${userId}&insight_date=eq.${today}&dismissed=eq.false&limit=1`, jwt)
        if (Array.isArray(existing) && existing.length > 0) {
          const all = await sbFetch(`proactive_insights?user_id=eq.${userId}&insight_date=eq.${today}&dismissed=eq.false&order=priority.desc&limit=6`, jwt)
          return res.status(200).json({ insights: all, cached: true })
        }
      }

      const ctx = await buildContext(userId, jwt)

      const systemPrompt = `You are the AI intelligence engine for The Framework life coaching app.
Analyze user data and generate highly personalized, specific insights.

User: ${ctx.firstName} | ${ctx.daysSince} days using app
Goal: "${ctx.settings?.primary_goal || 'not set'}"
Blockers: ${(ctx.settings?.main_blockers || []).join(', ') || 'none'}
30-day avg score: ${ctx.scores.avg30}/100 | 7-day avg: ${ctx.scores.avg7}/100 | Trend: ${ctx.scores.trend}
Days logged: ${ctx.scores.daysLogged}
Habit rates: ${JSON.stringify(ctx.habitRates)}
Category performance: ${JSON.stringify(ctx.catPerf)}
Monthly income: $${ctx.financial.income} | Expenses: $${ctx.financial.fixed + ctx.financial.variable} | Net: $${ctx.financial.netMonthly}
Savings: $${ctx.financial.savingsTotal} | Stability target: $${ctx.financial.target}
Active goals: ${ctx.goals.map(g => g.title).join(', ') || 'none'}
Recent wins: ${ctx.wins.slice(0, 3).join(' | ') || 'none'}

Generate 4-6 personalized insights as a JSON array. Each object:
{
  "type": "challenge|goal_suggestion|financial_tip|pattern|achievement|warning|motivation",
  "title": "punchy title under 8 words",
  "body": "2-3 sentences referencing their SPECIFIC numbers and situation",
  "action_label": "CTA button text or null",
  "priority": 1-10
}

Rules: Reference actual numbers. Challenges must be doable today/this week. Financial tips must include dollar amounts. Never be generic. Return ONLY the JSON array.`

      const raw = await callClaude(systemPrompt, [{ role: 'user', content: `Generate insights for ${ctx.firstName} today (${today}). Score trend: ${ctx.scores.recent.join(',')}. Recent wins: ${ctx.wins[0] || 'none yet'}.` }], 1200)

      let insights = []
      try { insights = JSON.parse(raw.replace(/```json|```/g, '').trim()) } catch {}

      if (insights.length > 0) {
        await sbPost(`proactive_insights`, insights.map(i => ({
          user_id: userId, insight_date: today,
          insight_type: i.type, title: i.title, body: i.body,
          action_label: i.action_label || null, priority: i.priority || 5
        })), jwt)

        // Update coach memory
        const cats = Object.keys(ctx.catPerf)
        const strongest = cats.sort((a, b) => (ctx.catPerf[b]?.rate || 0) - (ctx.catPerf[a]?.rate || 0))[0]
        const weakest = cats.sort((a, b) => (ctx.catPerf[a]?.rate || 0) - (ctx.catPerf[b]?.rate || 0))[0]
        await sbPost(`coach_memory`, {
          user_id: userId, avg_weekly_score: ctx.scores.avg7,
          total_days_logged: ctx.scores.daysLogged,
          strongest_category: strongest, weakest_category: weakest,
          recurring_blockers: ctx.settings?.main_blockers || [],
          last_analyzed_at: new Date().toISOString(),
          last_insight_date: today
        }, jwt)
      }

      const saved = await sbFetch(`proactive_insights?user_id=eq.${userId}&insight_date=eq.${today}&dismissed=eq.false&order=priority.desc&limit=6`, jwt)
      return res.status(200).json({ insights: Array.isArray(saved) ? saved : insights })
    }

    // ── coach_chat ─────────────────────────────────────────────
    if (action === 'coach_chat') {
      const type = threadType || 'general'
      const ctx = await buildContext(userId, jwt)
      const history = ctx.threads[type] || []
      const last20 = history.slice(-20)

      const systemPrompt = `You are ${ctx.firstName}'s personal AI life coach. You remember everything.

What you know:
- Main goal: "${ctx.settings?.primary_goal || 'not set'}"
- Blockers: ${(ctx.settings?.main_blockers || []).join(', ') || 'not specified'}
- 30-day avg: ${ctx.scores.avg30}/100 | Recent 7-day: ${ctx.scores.avg7}/100 | Trend: ${ctx.scores.trend}
- Strongest: ${ctx.memory?.strongest_category || 'analyzing'} | Weakest: ${ctx.memory?.weakest_category || 'analyzing'}
- Financial health: net $${ctx.financial.netMonthly}/month | savings: $${ctx.financial.savingsTotal}
- Active goals: ${ctx.goals.map(g => g.title).join(', ') || 'none set'}
- Recent wins: ${ctx.wins.slice(0, 2).join(' | ') || 'none logged yet'}
- Days using app: ${ctx.daysSince}

Rules:
- NEVER be generic. Always speak to this person's specific data.
- 3-5 sentences max per response.
- End with a challenge, question, or specific next action.
- Stress pattern to interrupt: stress → overanalysis → hesitation → guilt → confidence drop → more stress.
- When they spiral: slow it down, separate facts from fear.
- When they avoid: name it directly.
- When they win: celebrate specifically, then push higher.`

      const messages = [
        ...last20.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content })),
        { role: 'user', content: message }
      ]

      const reply = await callClaude(systemPrompt, messages, 500)

      // Save to thread history
      const updated = [...history, { role: 'user', content: message, ts: new Date().toISOString() }, { role: 'ai', content: reply, ts: new Date().toISOString() }].slice(-50)
      await sbPost(`conversation_threads`, { user_id: userId, thread_type: type, messages: updated, message_count: updated.length, last_message_at: new Date().toISOString() }, jwt)

      return res.status(200).json({ reply })
    }

    // ── get_thread ─────────────────────────────────────────────
    if (action === 'get_thread') {
      const type = threadType || 'general'
      const data = await sbFetch(`conversation_threads?user_id=eq.${userId}&thread_type=eq.${type}&limit=1`, jwt)
      const thread = Array.isArray(data) ? data[0] : null
      return res.status(200).json({ thread })
    }

    // ── financial_plan ─────────────────────────────────────────
    if (action === 'financial_plan') {
      const ctx = await buildContext(userId, jwt)
      const { income, fixed, variable, target, netMonthly, savingsTotal } = ctx.financial

      const plan = await callClaude(
        `You are a direct, no-nonsense financial coach. Use the user's actual numbers. Be specific. No generic advice.`,
        [{ role: 'user', content: `Build a 90-day financial plan for ${ctx.firstName}.

Their numbers:
- Monthly income: $${income}
- Fixed costs: $${fixed} | Variable costs: $${variable}
- Total expenses: $${fixed + variable}
- Net monthly: $${netMonthly}
- Current savings: $${savingsTotal}
- Stability target: $${target}
- Savings goals: ${ctx.savingsGoals.map(g => `${g.name}: $${g.current_amount}/$${g.target_amount}`).join(', ') || 'none set'}
- Main goal: "${ctx.settings?.primary_goal || 'financial stability'}"

Write a specific 90-day plan with:
1. Honest 2-sentence assessment using their actual numbers
2. Month 1: 3 specific actions with dollar amounts
3. Month 2: focus area and target
4. Month 3: milestone to hit
5. The one number to track daily

Be direct and use their actual numbers throughout.` }],
        1000
      )

      await sbPost(`proactive_insights`, {
        user_id: userId, insight_type: 'financial_tip',
        title: '90-Day Financial Plan',
        body: plan, priority: 8
      }, jwt)

      return res.status(200).json({ plan })
    }

    return res.status(400).json({ error: 'Unknown action' })

  } catch (e) {
    console.error('Intelligence error:', e)
    return res.status(500).json({ error: e.message })
  }
}
