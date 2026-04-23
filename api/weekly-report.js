// api/weekly-report.js
// Generates weekly performance report for a user
// Called by cron on Sunday evenings OR manually

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

async function db(path, options = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', ...options.headers },
    ...options
  })
  return r.ok ? r.json() : []
}

async function generateReport(userId, weekStart, weekEnd) {
  // Get scores for the week
  const scores = await db(`daily_scores?user_id=eq.${userId}&score_date=gte.${weekStart}&score_date=lte.${weekEnd}&order=score_date`)

  if (!Array.isArray(scores) || !scores.length) return null

  const avgScore = Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length)
  const bestEntry = scores.reduce((a, s) => s.score > a.score ? s : a, scores[0])
  const worstEntry = scores.reduce((a, s) => s.score < a.score ? s : a, scores[0])
  const bestDay = new Date(bestEntry.score_date).toLocaleDateString('en-US', { weekday: 'long' })

  // Get habits
  const habitComps = await db(`habit_completions?user_id=eq.${userId}&completed_date=gte.${weekStart}&completed_date=lte.${weekEnd}`)
  const habits = await db(`user_habits?user_id=eq.${userId}&is_active=eq.true`)
  const habitRate = habits.length > 0 ? Math.round((Array.isArray(habitComps) ? habitComps.length : 0) / (habits.length * 7) * 100) : 0

  // Get wins
  const wins = await db(`user_logs?user_id=eq.${userId}&log_type=eq.win&logged_at=gte.${weekStart}T00:00:00&logged_at=lte.${weekEnd}T23:59:59`)

  // Get user profile
  const profileRes = await db(`profiles?id=eq.${userId}&select=full_name`)
  const firstName = profileRes[0]?.full_name?.split(' ')[0] || 'there'

  // Get settings
  const settingsRes = await db(`user_settings?user_id=eq.${userId}&select=primary_goal,weekday_target`)
  const goal = settingsRes[0]?.primary_goal || 'building a better life'
  const target = settingsRes[0]?.weekday_target || 75

  // Generate AI coach summary
  const prompt = `Weekly performance report for ${firstName}.
Week: ${weekStart} to ${weekEnd}
Days logged: ${scores.length}/7
Average score: ${avgScore}/100 (target: ${target}+)
Best day: ${bestDay} with ${bestEntry.score}/100
Worst day: ${worstEntry.score}/100
Habit completion rate: ${habitRate}%
Wins logged: ${Array.isArray(wins) ? wins.length : 0}
Their main goal: "${goal}"

Write a 3-4 sentence weekly coaching summary. Reference the actual numbers. Be direct and honest — celebrate genuine progress, call out gaps without shaming. End with their #1 priority for next week.`

  let coachSummary = ''
  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 300, messages: [{ role: 'user', content: prompt }] })
    })
    const aiData = await aiRes.json()
    coachSummary = aiData.content?.[0]?.text || ''
  } catch {}

  // Determine next week priorities
  const nextPriorities = []
  if (avgScore < target) nextPriorities.push(`Push daily score above ${target} — you averaged ${avgScore} this week`)
  if (habitRate < 70) nextPriorities.push(`Improve habit consistency — you hit ${habitRate}% this week, target is 80%+`)
  if (Array.isArray(wins) && wins.length < 3) nextPriorities.push('Log at least 1 win per day — recognition builds confidence')
  if (!nextPriorities.length) nextPriorities.push(`Maintain your ${avgScore} average and push toward ${Math.min(100, avgScore + 10)} this week`)

  return {
    user_id: userId,
    week_start: weekStart,
    week_end: weekEnd,
    avg_score: avgScore,
    best_score: bestEntry.score,
    worst_score: worstEntry.score,
    best_day: bestDay,
    total_tasks_completed: scores.reduce((a, s) => a + (s.breakdown ? Object.values(s.breakdown).reduce((x, v) => x + (v.done || 0), 0) : 0), 0),
    habit_completion_rate: habitRate,
    wins_logged: Array.isArray(wins) ? wins.length : 0,
    coach_summary: coachSummary,
    next_week_priorities: nextPriorities
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  res.setHeader('Access-Control-Allow-Origin', '*')

  const { userId, userJwt } = req.body

  // Get week boundaries (Mon-Sun)
  const today = new Date()
  const day = today.getDay()
  const diffToMonday = day === 0 ? 6 : day - 1
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - diffToMonday)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)

  const weekStartStr = weekStart.toISOString().split('T')[0]
  const weekEndStr = weekEnd.toISOString().split('T')[0]

  // Check if report exists
  const existing = await db(`weekly_reports?user_id=eq.${userId}&week_start=eq.${weekStartStr}`)
  if (Array.isArray(existing) && existing.length > 0) {
    return res.status(200).json({ report: existing[0], cached: true })
  }

  const report = await generateReport(userId, weekStartStr, weekEndStr)
  if (!report) return res.status(200).json({ report: null, message: 'Not enough data yet' })

  // Save report
  await fetch(`${SUPABASE_URL}/rest/v1/weekly_reports`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify(report)
  })

  return res.status(200).json({ report })
}
