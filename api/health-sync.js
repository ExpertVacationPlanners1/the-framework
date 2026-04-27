// api/health-sync.js — Apple Health sync receiver
const SUPABASE_URL = 'https://dayawnsrnasnzyslzrga.supabase.co'
const SVC_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRheWF3bnNybmFzbnp5c2x6cmdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyODQ2MTcsImV4cCI6MjA5MTg2MDYxN30.dTKFKeMDaVogvJuEoD2iMk3mdoL9WliYtjjIVP8YVyI'

const db = async (path, opts = {}) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { 'apikey': SVC_KEY, 'Authorization': `Bearer ${SVC_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=representation', ...opts.headers },
    ...opts
  })
  return r.ok ? r.json().catch(() => null) : null
}

const kgToLbs = v => v ? Math.round(v * 2.20462 * 10) / 10 : null
const mlToOz  = v => v ? Math.round(v / 29.5735) : null
const kmToMi  = v => v ? Math.round(v * 0.621371 * 100) / 100 : null

const WORKOUT_MAP = {
  Running:'run', Walking:'walk', Cycling:'cycling', Swimming:'swimming',
  HIIT:'hiit', Yoga:'yoga', FunctionalStrengthTraining:'strength',
  TraditionalStrengthTraining:'strength', CrossTraining:'hiit',
  MixedCardio:'cardio', Soccer:'sports', Basketball:'sports',
  Tennis:'sports', Golf:'sports', Hiking:'walk', Other:'other'
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Sync-Token')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const token = req.query?.token || req.body?.token || req.headers['x-sync-token']

  // GET — token validation ping from Shortcuts
  if (req.method === 'GET') {
    if (!token) return res.status(200).json({ ok: true, message: 'Health sync endpoint active' })
    const rows = await db(`health_sync_tokens?token=eq.${token}&select=user_id,sync_count`)
    if (!rows?.[0]) return res.status(401).json({ ok: false, error: 'Invalid token' })
    return res.status(200).json({ ok: true, message: 'Token valid', syncs: rows[0].sync_count })
  }

  if (req.method !== 'POST') return res.status(405).end()

  if (!token) return res.status(401).json({ error: 'Token required' })
  const rows = await db(`health_sync_tokens?token=eq.${token}&select=user_id,sync_count,id`)
  if (!rows?.[0]) return res.status(401).json({ error: 'Invalid token' })
  const { user_id, sync_count, id: tokenId } = rows[0]

  const b = req.body || {}
  const syncDate = b.date || new Date().toISOString().split('T')[0]

  const steps         = parseInt(b.steps) || null
  const calActive     = parseInt(b.active_calories || b.calories_active) || null
  const calResting    = parseInt(b.resting_calories || b.calories_resting) || null
  const calTotal      = parseInt(b.calories_total) || (calActive && calResting ? calActive + calResting : calActive || null)
  const distMi        = b.distance_miles ? +b.distance_miles : b.distance_km ? kmToMi(+b.distance_km) : null
  const exerciseMins  = parseInt(b.exercise_minutes || b.move_minutes) || null
  const standHrs      = parseInt(b.stand_hours) || null
  const sleepHrs      = b.sleep_hours ? +b.sleep_hours : b.sleep_minutes ? Math.round(+b.sleep_minutes / 60 * 10) / 10 : null
  const sleepDeep     = b.deep_sleep_hours ? +b.deep_sleep_hours : null
  const restingHR     = parseInt(b.resting_heart_rate || b.resting_hr) || null
  const hrAvg         = parseInt(b.heart_rate_avg || b.heart_rate) || null
  const waterMl       = parseInt(b.water_ml) || (b.water_oz ? Math.round(+b.water_oz * 29.5735) : null)
  const weightKg      = b.weight_kg ? +b.weight_kg : b.weight_lbs ? +(+b.weight_lbs / 2.20462).toFixed(2) : null
  const bodyFat       = b.body_fat_pct ? +b.body_fat_pct : null
  const workouts      = Array.isArray(b.workouts) ? b.workouts : []

  // 1. Save sync log
  await db('health_sync_log', {
    method: 'POST',
    body: JSON.stringify({
      user_id, sync_date: syncDate, source: b.source || 'apple_health',
      steps, calories_active: calActive, calories_resting: calResting, calories_total: calTotal,
      distance_miles: distMi, exercise_minutes: exerciseMins, stand_hours: standHrs,
      sleep_hours: sleepHrs, sleep_deep_hours: sleepDeep,
      resting_hr: restingHR, heart_rate_avg: hrAvg, water_ml: waterMl,
      weight_kg: weightKg, body_fat_pct: bodyFat, workouts,
      raw_payload: b
    })
  })

  // 2. Update body_metrics
  const metrics = {}
  if (steps)       metrics.steps = steps
  if (sleepHrs)    metrics.sleep_hours = sleepHrs
  if (restingHR)   metrics.resting_hr = restingHR
  if (waterMl)     metrics.water_oz = mlToOz(waterMl)
  if (weightKg)    metrics.weight_lbs = kgToLbs(weightKg)
  if (bodyFat)     metrics.body_fat_pct = bodyFat

  if (Object.keys(metrics).length > 0) {
    await db('body_metrics', {
      method: 'POST',
      body: JSON.stringify({ user_id, logged_date: syncDate, ...metrics })
    })
  }

  // 3. Create workout sessions
  let workoutsCreated = 0
  for (const w of workouts) {
    const wType = WORKOUT_MAP[w.type] || 'other'
    const mins = w.duration_minutes || (w.duration_seconds ? Math.round(+w.duration_seconds / 60) : null)
    const cal = parseInt(w.calories || w.active_calories) || null
    const wDate = w.date || syncDate
    const dist = w.distance_km ? kmToMi(+w.distance_km) : w.distance_miles ? +w.distance_miles : null

    const result = await fetch(`${SUPABASE_URL}/rest/v1/workout_sessions`, {
      method: 'POST',
      headers: { 'apikey': SVC_KEY, 'Authorization': `Bearer ${SVC_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify({
        user_id, session_date: wDate, workout_type: wType,
        name: w.name || w.type || 'Apple Health Workout',
        duration_minutes: mins, calories_burned: cal,
        notes: `Synced from Apple Health${dist ? ` · ${dist}mi` : ''}`
      })
    }).then(r => r.json()).catch(() => null)
    if (result?.id) workoutsCreated++
  }

  // 4. Update token
  await db(`health_sync_tokens?id=eq.${tokenId}`, {
    method: 'PATCH',
    body: JSON.stringify({ last_used_at: new Date().toISOString(), sync_count: sync_count + 1 })
  })

  return res.status(200).json({
    success: true,
    message: 'Synced to The Framework ✓',
    date: syncDate,
    synced: { steps, calories_active: calActive, sleep_hours: sleepHrs, workouts: workoutsCreated, weight_lbs: kgToLbs(weightKg) }
  })
}
