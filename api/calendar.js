// api/calendar.js
// Google Calendar integration via Anthropic MCP
// Uses the Google Calendar MCP connected to the user's Google account

const SUPABASE_URL = 'https://dayawnsrnasnzyslzrga.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRheWF3bnNybmFzbnp5c2x6cmdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyODQ2MTcsImV4cCI6MjA5MTg2MDYxN30.dTKFKeMDaVogvJuEoD2iMk3mdoL9WliYtjjIVP8YVyI'

const GOOGLE_CALENDAR_MCP = 'https://calendarmcp.googleapis.com/mcp/v1'

async function getUserId(jwt) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${jwt}` }
  })
  const d = await r.json()
  return d.id || null
}

async function callClaudeWithCalendar(prompt, system) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'mcp-client-2025-04-04'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: system || 'You are a calendar assistant. Complete the requested action and return a JSON response.',
      messages: [{ role: 'user', content: prompt }],
      mcp_servers: [{
        type: 'url',
        url: GOOGLE_CALENDAR_MCP,
        name: 'google-calendar'
      }]
    })
  })
  return r.json()
}

function extractText(data) {
  if (!data?.content) return ''
  return data.content.filter(b => b.type === 'text').map(b => b.text).join('\n')
}

function extractJSON(text) {
  try {
    const match = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/\{[\s\S]*\}/) || text.match(/\[[\s\S]*\]/)
    if (match) return JSON.parse(match[1] || match[0])
    return JSON.parse(text)
  } catch {
    return null
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

  const { action, task, date, taskIds } = req.body || {}

  try {
    // ── list_events ─────────────────────────────────────────
    if (action === 'list_events') {
      const targetDate = date || new Date().toISOString().split('T')[0]
      const data = await callClaudeWithCalendar(
        `List all Google Calendar events for ${targetDate}. 
         Return ONLY a JSON array like:
         [{"id":"...","title":"...","start":"...","end":"...","location":"...","description":"...","colorId":"..."}]
         If no events, return []. No explanation needed.`,
        'You are a calendar data retriever. Use the Google Calendar tool to list events and return structured JSON only.'
      )
      const text = extractText(data)
      const events = extractJSON(text) || []
      return res.status(200).json({ events: Array.isArray(events) ? events : [] })
    }

    // ── create_from_task ─────────────────────────────────────
    if (action === 'create_from_task') {
      if (!task) return res.status(400).json({ error: 'task required' })

      const eventDate = task.due_date || new Date().toISOString().split('T')[0]
      const duration = task.estimated_minutes || 30
      const priority = task.priority || 'medium'
      const priorityColor = { critical: '11', high: '6', medium: '5', low: '2' }[priority] || '5'

      const data = await callClaudeWithCalendar(
        `Create a Google Calendar event for this work task:
         Title: "${task.title}"
         ${task.description ? `Description: "${task.description}"` : ''}
         Date: ${eventDate}
         Duration: ${duration} minutes
         Priority: ${priority} (use colorId "${priorityColor}" — 11=tomato for critical, 6=tangerine for high, 5=banana for medium, 2=sage for low)
         
         Schedule it at a reasonable work hour (9am-5pm). 
         Add "[Framework]" prefix to the title so it's identifiable.
         
         After creating, return ONLY JSON:
         {"success": true, "event_id": "...", "event_link": "...", "start": "...", "end": "..."}`,
        'You are a calendar event creator. Create the event using Google Calendar tools and return structured JSON.'
      )

      const text = extractText(data)
      const result = extractJSON(text) || { success: false }

      // Save the calendar event ID back to the task
      if (result.success && result.event_id) {
        await fetch(`${SUPABASE_URL}/rest/v1/work_tasks?id=eq.${task.id}`, {
          method: 'PATCH',
          headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ calendar_event_id: result.event_id, calendar_synced: true })
        })
      }

      return res.status(200).json(result)
    }

    // ── sync_all_tasks ────────────────────────────────────────
    if (action === 'sync_all_tasks') {
      // Fetch tasks with due dates that haven't been synced
      const tasksRes = await fetch(`${SUPABASE_URL}/rest/v1/work_tasks?user_id=eq.${userId}&status=neq.done&calendar_synced=is.null&due_date=not.is.null&limit=10`, {
        headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${jwt}` }
      })
      const tasks = await tasksRes.json()
      if (!Array.isArray(tasks) || tasks.length === 0) {
        return res.status(200).json({ synced: 0, message: 'No tasks to sync' })
      }

      const taskList = tasks.map(t => `- "${t.title}" on ${t.due_date}, ${t.estimated_minutes || 30} min, ${t.priority} priority`).join('\n')

      const data = await callClaudeWithCalendar(
        `Create Google Calendar events for these work tasks. Add "[Framework]" prefix to each title.
         Use appropriate times during business hours (9am-6pm):
         ${taskList}
         
         Return ONLY JSON array:
         [{"task_title":"...", "success": true, "event_id":"...", "start":"..."}]`,
        'You are a batch calendar event creator. Create all events and return JSON array.'
      )

      const text = extractText(data)
      const results = extractJSON(text) || []
      const synced = Array.isArray(results) ? results.filter(r => r.success).length : 0

      return res.status(200).json({ synced, results })
    }

    // ── delete_event ──────────────────────────────────────────
    if (action === 'delete_event') {
      const { eventId } = req.body
      if (!eventId) return res.status(400).json({ error: 'eventId required' })

      await callClaudeWithCalendar(
        `Delete the Google Calendar event with ID: "${eventId}". Confirm deletion.`,
        'Delete the specified calendar event.'
      )
      return res.status(200).json({ success: true })
    }

    // ── get_week ──────────────────────────────────────────────
    if (action === 'get_week') {
      const startDate = date || new Date().toISOString().split('T')[0]
      const data = await callClaudeWithCalendar(
        `List all Google Calendar events for the week starting ${startDate} (next 7 days).
         Return ONLY a JSON array:
         [{"id":"...","title":"...","start":"...","end":"...","date":"YYYY-MM-DD","time":"HH:MM"}]
         Sort by start time. No explanation.`,
        'Return calendar events as JSON array only.'
      )
      const text = extractText(data)
      const events = extractJSON(text) || []
      return res.status(200).json({ events: Array.isArray(events) ? events : [] })
    }

    return res.status(400).json({ error: 'Unknown action' })
  } catch (e) {
    console.error('Calendar API error:', e)
    return res.status(500).json({ error: e.message })
  }
}
