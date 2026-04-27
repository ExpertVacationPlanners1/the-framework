import { useState, useEffect } from 'react'
import AppleHealthSync from '../components/AppleHealthSync'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const TODAY = new Date().toISOString().split('T')[0]
const DOW = new Date().getDay()
const IS_WEEKEND = DOW === 0 || DOW === 6

const WORKOUT_TYPES = [
  { id: 'strength', label: 'Strength', icon: '🏋️', color: '#1c3d2e' },
  { id: 'cardio',   label: 'Cardio',   icon: '🏃', color: '#1e3a5f' },
  { id: 'hiit',     label: 'HIIT',     icon: '⚡', color: '#7c3d00' },
  { id: 'yoga',     label: 'Yoga',     icon: '🧘', color: '#4a1d96' },
  { id: 'walk',     label: 'Walk',     icon: '🚶', color: '#065f46' },
  { id: 'run',      label: 'Run',      icon: '🏃‍♂️', color: '#1e3a5f' },
  { id: 'cycling',  label: 'Cycling',  icon: '🚴', color: '#7c3d00' },
  { id: 'swimming', label: 'Swim',     icon: '🏊', color: '#0369a1' },
  { id: 'sports',   label: 'Sports',   icon: '⚽', color: '#065f46' },
  { id: 'other',    label: 'Other',    icon: '💪', color: '#6b7280' },
]

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack']
const MEAL_ICONS = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' }

// Common foods with nutrition data
const QUICK_FOODS = [
  { name: 'Chicken Breast (4oz)', calories: 185, protein_g: 35, carbs_g: 0, fat_g: 4 },
  { name: 'Brown Rice (1 cup)', calories: 216, protein_g: 5, carbs_g: 45, fat_g: 2 },
  { name: 'Eggs (2 large)', calories: 148, protein_g: 13, carbs_g: 1, fat_g: 10 },
  { name: 'Oatmeal (1 cup)', calories: 154, protein_g: 5, carbs_g: 27, fat_g: 3 },
  { name: 'Greek Yogurt (6oz)', calories: 100, protein_g: 17, carbs_g: 6, fat_g: 0 },
  { name: 'Banana', calories: 89, protein_g: 1, carbs_g: 23, fat_g: 0 },
  { name: 'Avocado (half)', calories: 120, protein_g: 2, carbs_g: 6, fat_g: 11 },
  { name: 'Salmon (4oz)', calories: 233, protein_g: 25, carbs_g: 0, fat_g: 14 },
]

export default function Personal() {
  const { user, settings } = useAuth()

  const [activeTab, setActiveTab] = useState('today')
  const [workouts, setWorkouts] = useState([])
  const [todayWorkout, setTodayWorkout] = useState(null)
  const [exercises, setExercises] = useState([])
  const [nutrition, setNutrition] = useState([])
  const [bodyMetrics, setBodyMetrics] = useState(null)
  const [recentMetrics, setRecentMetrics] = useState([])
  const [fitnessGoals, setFitnessGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  // Forms
  const [showLogWorkout, setShowLogWorkout] = useState(false)
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [showAddFood, setShowAddFood] = useState(false)
  const [showUpdateMetrics, setShowUpdateMetrics] = useState(false)
  const [showAddGoal, setShowAddGoal] = useState(false)

  const [workoutForm, setWorkoutForm] = useState({ workout_type: 'strength', name: '', duration_minutes: '', calories_burned: '', notes: '' })
  const [exerciseForm, setExerciseForm] = useState({ name: '', sets: '', reps: '', weight_lbs: '', duration_seconds: '', distance_miles: '' })
  const [foodForm, setFoodForm] = useState({ meal_type: 'breakfast', food_name: '', serving_size: '', calories: '', protein_g: '', carbs_g: '', fat_g: '' })
  const [metricsForm, setMetricsForm] = useState({ weight_lbs: '', body_fat_pct: '', waist_inches: '', steps: '', water_oz: '', sleep_hours: '' })
  const [goalForm, setGoalForm] = useState({ goal_type: 'weight', title: '', target_value: '', current_value: '', unit: '', target_date: '' })
  const [selectedMeal, setSelectedMeal] = useState('breakfast')

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  useEffect(() => { if (user) load() }, [user])

  const load = async () => {
    setLoading(true)
    const [workoutsR, todayWorkoutR, nutritionR, metricsR, recentMetR, goalsR] = await Promise.all([
      supabase.from('workout_sessions').select('*').eq('user_id', user.id).order('session_date', { ascending: false }).limit(20),
      supabase.from('workout_sessions').select('*').eq('user_id', user.id).eq('session_date', TODAY).single(),
      supabase.from('nutrition_logs').select('*').eq('user_id', user.id).eq('log_date', TODAY).order('created_at'),
      supabase.from('body_metrics').select('*').eq('user_id', user.id).eq('logged_date', TODAY).single(),
      supabase.from('body_metrics').select('*').eq('user_id', user.id).order('logged_date', { ascending: false }).limit(30),
      supabase.from('fitness_goals').select('*').eq('user_id', user.id).eq('status', 'active'),
    ])
    setWorkouts(workoutsR.data || [])
    setTodayWorkout(todayWorkoutR.data || null)
    setNutrition(nutritionR.data || [])
    setBodyMetrics(metricsR.data || null)
    setRecentMetrics(recentMetR.data || [])
    setFitnessGoals(goalsR.data || [])

    if (todayWorkoutR.data) {
      const { data: exs } = await supabase.from('workout_exercises').select('*').eq('session_id', todayWorkoutR.data.id)
      setExercises(exs || [])
    }
    setLoading(false)
  }

  const logWorkout = async () => {
    const { data } = await supabase.from('workout_sessions').insert({
      user_id: user.id, session_date: TODAY, ...workoutForm,
      duration_minutes: +workoutForm.duration_minutes || null,
      calories_burned: +workoutForm.calories_burned || null
    }).select().single()
    if (data) { setTodayWorkout(data); setWorkouts(p => [data, ...p]); showToast('Workout logged ✓') }
    setShowLogWorkout(false)
  }

  const addExercise = async () => {
    if (!todayWorkout || !exerciseForm.name) return
    const { data } = await supabase.from('workout_exercises').insert({
      session_id: todayWorkout.id, user_id: user.id, ...exerciseForm,
      sets: +exerciseForm.sets || null, reps: +exerciseForm.reps || null,
      weight_lbs: +exerciseForm.weight_lbs || null, duration_seconds: +exerciseForm.duration_seconds || null,
      distance_miles: +exerciseForm.distance_miles || null
    }).select().single()
    if (data) { setExercises(p => [...p, data]); showToast('Exercise added ✓') }
    setExerciseForm({ name: '', sets: '', reps: '', weight_lbs: '', duration_seconds: '', distance_miles: '' })
    setShowAddExercise(false)
  }

  const logFood = async (foodData = null) => {
    const fd = foodData || { ...foodForm, calories: +foodForm.calories || 0, protein_g: +foodForm.protein_g || 0, carbs_g: +foodForm.carbs_g || 0, fat_g: +foodForm.fat_g || 0 }
    const { data } = await supabase.from('nutrition_logs').insert({
      user_id: user.id, log_date: TODAY, meal_type: selectedMeal, ...fd
    }).select().single()
    if (data) { setNutrition(p => [...p, data]); showToast('Food logged ✓') }
    setFoodForm({ meal_type: 'breakfast', food_name: '', serving_size: '', calories: '', protein_g: '', carbs_g: '', fat_g: '' })
    setShowAddFood(false)
  }

  const saveMetrics = async () => {
    const data = {
      user_id: user.id, logged_date: TODAY,
      weight_lbs: +metricsForm.weight_lbs || null,
      body_fat_pct: +metricsForm.body_fat_pct || null,
      waist_inches: +metricsForm.waist_inches || null,
      steps: +metricsForm.steps || null,
      water_oz: +metricsForm.water_oz || null,
      sleep_hours: +metricsForm.sleep_hours || null,
    }
    const { data: saved } = await supabase.from('body_metrics').upsert(data).select().single()
    if (saved) { setBodyMetrics(saved); showToast('Metrics saved ✓') }
    setShowUpdateMetrics(false)
  }

  const addGoal = async () => {
    if (!goalForm.title) return
    const { data } = await supabase.from('fitness_goals').insert({ user_id: user.id, ...goalForm, target_value: +goalForm.target_value || null, current_value: +goalForm.current_value || null }).select().single()
    if (data) { setFitnessGoals(p => [...p, data]); showToast('Goal added ✓') }
    setGoalForm({ goal_type: 'weight', title: '', target_value: '', current_value: '', unit: '', target_date: '' })
    setShowAddGoal(false)
  }

  // Nutrition totals
  const totals = nutrition.reduce((acc, n) => ({
    calories: acc.calories + (+n.calories || 0),
    protein: acc.protein + (+n.protein_g || 0),
    carbs: acc.carbs + (+n.carbs_g || 0),
    fat: acc.fat + (+n.fat_g || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

  const calorieGoal = 2000 // TODO: make this configurable
  const calPct = Math.min(100, Math.round(totals.calories / calorieGoal * 100))

  // Weight trend
  const weightHistory = recentMetrics.filter(m => m.weight_lbs).slice(0, 7).reverse()
  const latestWeight = recentMetrics.find(m => m.weight_lbs)?.weight_lbs

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}><div className="spinner spinner-dark" style={{ width: 28, height: 28 }} /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <div>
        <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 'clamp(22px,5vw,28px)', fontWeight: 900 }}>Personal</h1>
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>Fitness · Nutrition · Body metrics · Goals</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
        {['today', 'workout', 'nutrition', 'metrics', 'goals', 'sync'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '7px 14px', borderRadius: 20, border: '1.5px solid',
            borderColor: activeTab === tab ? '#7c3d00' : 'var(--border)',
            background: activeTab === tab ? '#7c3d00' : 'var(--card)',
            color: activeTab === tab ? '#fff' : 'var(--text-2)',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            fontFamily: "'Nunito Sans',sans-serif", whiteSpace: 'nowrap'
          }}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
        ))}
      </div>

      {/* TODAY TAB */}
      {activeTab === 'today' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Daily snapshot */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
            {[
              { icon: '🔥', label: 'Calories', val: totals.calories ? `${totals.calories}/${calorieGoal}` : 'Not logged', color: '#dc2626', sub: `${calPct}% of goal` },
              { icon: '🏋️', label: 'Workout', val: todayWorkout ? todayWorkout.workout_type : 'Not done', color: '#1c3d2e', sub: todayWorkout ? `${todayWorkout.duration_minutes || '?'} min` : 'Log a workout' },
              { icon: '💧', label: 'Water', val: bodyMetrics?.water_oz ? `${bodyMetrics.water_oz} oz` : '—', color: '#0369a1', sub: '64 oz goal' },
              { icon: '😴', label: 'Sleep', val: bodyMetrics?.sleep_hours ? `${bodyMetrics.sleep_hours}h` : '—', color: '#4a1d96', sub: '8h goal' },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: 14 }}>
                <div style={{ fontSize: 20, marginBottom: 5 }}>{s.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: s.color, fontFamily: "'Fraunces',serif" }}>{s.val}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 3 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Calorie progress */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Calories Today</span>
              <span style={{ fontSize: 13, fontWeight: 900, color: calPct > 100 ? '#dc2626' : '#1c3d2e', fontFamily: "'Fraunces',serif" }}>{totals.calories} / {calorieGoal}</span>
            </div>
            <div className="progress-track" style={{ marginBottom: 12, height: 10 }}>
              <div className="progress-fill" style={{ width: calPct + '%', background: calPct > 100 ? '#dc2626' : '#1c3d2e', height: '100%' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {[
                { label: 'Protein', val: Math.round(totals.protein), unit: 'g', color: '#1c3d2e', goal: 150 },
                { label: 'Carbs', val: Math.round(totals.carbs), unit: 'g', color: '#f97316', goal: 250 },
                { label: 'Fat', val: Math.round(totals.fat), unit: 'g', color: '#f59e0b', goal: 65 },
              ].map(m => (
                <div key={m.label} style={{ textAlign: 'center', padding: '8px', background: 'var(--surface)', borderRadius: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: m.color }}>{m.val}<span style={{ fontSize: 10 }}>{m.unit}</span></div>
                  <div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1 }}>{m.label}</div>
                  <div className="progress-track" style={{ marginTop: 4, height: 3 }}>
                    <div style={{ height: '100%', width: Math.min(100, Math.round(m.val / m.goal * 100)) + '%', background: m.color, borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Body metrics quick update */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="eyebrow">📏 Today's Metrics</div>
              <button className="btn btn-sm" onClick={() => setShowUpdateMetrics(p => !p)} style={{ background: '#7c3d00', color: '#fff', border: 'none' }}>
                {showUpdateMetrics ? '✕' : 'Update'}
              </button>
            </div>
            {showUpdateMetrics ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  {[
                    { k: 'weight_lbs', label: 'Weight (lbs)', ph: '170' },
                    { k: 'body_fat_pct', label: 'Body Fat %', ph: '18' },
                    { k: 'waist_inches', label: 'Waist (in)', ph: '32' },
                    { k: 'steps', label: 'Steps', ph: '8000' },
                    { k: 'water_oz', label: 'Water (oz)', ph: '64' },
                    { k: 'sleep_hours', label: 'Sleep (hrs)', ph: '7.5' },
                  ].map(f => (
                    <div key={f.k}>
                      <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 3 }}>{f.label}</label>
                      <input className="input-field" type="number" placeholder={f.ph} value={metricsForm[f.k]} onChange={e => setMetricsForm(p => ({ ...p, [f.k]: e.target.value }))} style={{ fontSize: 13, padding: '7px 10px' }} />
                    </div>
                  ))}
                </div>
                <button className="btn btn-primary btn-full" onClick={saveMetrics} style={{ fontSize: 13, background: '#7c3d00' }}>Save Metrics</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {[
                  { icon: '⚖️', label: 'Weight', val: bodyMetrics?.weight_lbs ? `${bodyMetrics.weight_lbs} lbs` : '—' },
                  { icon: '📏', label: 'Waist', val: bodyMetrics?.waist_inches ? `${bodyMetrics.waist_inches}"` : '—' },
                  { icon: '👣', label: 'Steps', val: bodyMetrics?.steps ? bodyMetrics.steps.toLocaleString() : '—' },
                  { icon: '💧', label: 'Water', val: bodyMetrics?.water_oz ? `${bodyMetrics.water_oz} oz` : '—' },
                  { icon: '😴', label: 'Sleep', val: bodyMetrics?.sleep_hours ? `${bodyMetrics.sleep_hours}h` : '—' },
                  { icon: '🫀', label: 'Body Fat', val: bodyMetrics?.body_fat_pct ? `${bodyMetrics.body_fat_pct}%` : '—' },
                ].map(m => (
                  <div key={m.label} style={{ textAlign: 'center', padding: '8px', background: 'var(--surface)', borderRadius: 8 }}>
                    <div style={{ fontSize: 16 }}>{m.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{m.val}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase' }}>{m.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* WORKOUT TAB */}
      {activeTab === 'workout' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Today's workout */}
          <div className="card" style={{ padding: 16, border: `2px solid ${todayWorkout ? '#1c3d2e' : 'var(--border)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div className="eyebrow" style={{ marginBottom: 4 }}>🏋️ Today's Workout</div>
                {todayWorkout ? (
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 800 }}>{WORKOUT_TYPES.find(t => t.id === todayWorkout.workout_type)?.icon} {todayWorkout.name || todayWorkout.workout_type}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{todayWorkout.duration_minutes ? `${todayWorkout.duration_minutes} min` : ''}{todayWorkout.calories_burned ? ` · ${todayWorkout.calories_burned} cal` : ''}</p>
                  </div>
                ) : (
                  <p style={{ fontSize: 14, color: 'var(--text-3)' }}>No workout logged today</p>
                )}
              </div>
              {!todayWorkout && <button className="btn btn-primary btn-sm" onClick={() => setShowLogWorkout(p => !p)} style={{ background: '#1c3d2e' }}>{showLogWorkout ? '✕' : '+ Log Workout'}</button>}
            </div>

            {showLogWorkout && !todayWorkout && (
              <div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  {WORKOUT_TYPES.map(t => (
                    <button key={t.id} onClick={() => setWorkoutForm(p => ({ ...p, workout_type: t.id }))} style={{
                      padding: '6px 12px', borderRadius: 20, border: '1.5px solid',
                      borderColor: workoutForm.workout_type === t.id ? t.color : 'var(--border)',
                      background: workoutForm.workout_type === t.id ? t.color + '18' : 'var(--card)',
                      color: workoutForm.workout_type === t.id ? t.color : 'var(--text-2)',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif"
                    }}>{t.icon} {t.label}</button>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <input className="input-field" placeholder="Workout name (optional)" value={workoutForm.name} onChange={e => setWorkoutForm(p => ({ ...p, name: e.target.value }))} style={{ fontSize: 13 }} />
                  <input className="input-field" type="number" placeholder="Duration (min)" value={workoutForm.duration_minutes} onChange={e => setWorkoutForm(p => ({ ...p, duration_minutes: e.target.value }))} style={{ fontSize: 13 }} />
                  <input className="input-field" type="number" placeholder="Calories burned" value={workoutForm.calories_burned} onChange={e => setWorkoutForm(p => ({ ...p, calories_burned: e.target.value }))} style={{ fontSize: 13 }} />
                  <input className="input-field" placeholder="Notes" value={workoutForm.notes} onChange={e => setWorkoutForm(p => ({ ...p, notes: e.target.value }))} style={{ fontSize: 13 }} />
                </div>
                <button className="btn btn-primary btn-full" onClick={logWorkout} style={{ background: '#1c3d2e', fontSize: 13 }}>Log Workout</button>
              </div>
            )}

            {/* Exercises for today's workout */}
            {todayWorkout && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>Exercises ({exercises.length})</span>
                  <button className="btn btn-sm" onClick={() => setShowAddExercise(p => !p)} style={{ background: '#1c3d2e', color: '#fff', border: 'none', fontSize: 11 }}>+ Add Exercise</button>
                </div>

                {showAddExercise && (
                  <div style={{ background: '#f0fdf4', borderRadius: 10, padding: 12, marginBottom: 12, border: '1.5px solid #86efac' }}>
                    <input className="input-field" placeholder="Exercise name (e.g. Bench Press)" value={exerciseForm.name} onChange={e => setExerciseForm(p => ({ ...p, name: e.target.value }))} style={{ marginBottom: 8, fontSize: 13 }} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 8 }}>
                      <input className="input-field" type="number" placeholder="Sets" value={exerciseForm.sets} onChange={e => setExerciseForm(p => ({ ...p, sets: e.target.value }))} style={{ fontSize: 12 }} />
                      <input className="input-field" type="number" placeholder="Reps" value={exerciseForm.reps} onChange={e => setExerciseForm(p => ({ ...p, reps: e.target.value }))} style={{ fontSize: 12 }} />
                      <input className="input-field" type="number" placeholder="Weight (lbs)" value={exerciseForm.weight_lbs} onChange={e => setExerciseForm(p => ({ ...p, weight_lbs: e.target.value }))} style={{ fontSize: 12 }} />
                    </div>
                    <button className="btn btn-primary btn-full" onClick={addExercise} style={{ background: '#1c3d2e', fontSize: 12 }}>Add</button>
                  </div>
                )}

                {exercises.map((ex, i) => (
                  <div key={ex.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#1c3d2e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 700 }}>{ex.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        {ex.sets ? `${ex.sets} sets` : ''}
                        {ex.reps ? ` × ${ex.reps} reps` : ''}
                        {ex.weight_lbs ? ` @ ${ex.weight_lbs} lbs` : ''}
                        {ex.duration_seconds ? ` ${Math.round(ex.duration_seconds / 60)} min` : ''}
                        {ex.distance_miles ? ` ${ex.distance_miles} mi` : ''}
                      </p>
                    </div>
                  </div>
                ))}
                {exercises.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-3)', paddingTop: 4 }}>No exercises yet. Add your sets above.</p>}
              </div>
            )}
          </div>

          {/* Workout history */}
          <div className="card" style={{ padding: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>📅 Recent Workouts</div>
            {workouts.filter(w => w.session_date !== TODAY).slice(0, 7).map(w => {
              const type = WORKOUT_TYPES.find(t => t.id === w.workout_type) || WORKOUT_TYPES[9]
              return (
                <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{type.icon}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 600 }}>{w.name || type.label}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {new Date(w.session_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {w.duration_minutes ? ` · ${w.duration_minutes} min` : ''}
                    </p>
                  </div>
                  {w.calories_burned && <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>🔥 {w.calories_burned}</span>}
                </div>
              )
            })}
            {workouts.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-3)' }}>No workouts yet.</p>}
          </div>
        </div>
      )}

      {/* NUTRITION TAB */}
      {activeTab === 'nutrition' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Calorie ring + macros */}
          <div className="card" style={{ padding: 16, background: 'linear-gradient(135deg,#0f1e35,#1e3a5f)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div className="eyebrow" style={{ color: '#93c5fd', marginBottom: 6 }}>🔥 Today's Nutrition</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontFamily: "'Fraunces',serif", fontSize: 40, fontWeight: 900, color: calPct > 100 ? '#f43f5e' : '#22c55e', lineHeight: 1 }}>{totals.calories}</span>
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,.4)' }}>/ {calorieGoal} cal</span>
                </div>
              </div>
              <svg width="64" height="64" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="5"/>
                <circle cx="32" cy="32" r="26" fill="none" stroke={calPct > 100 ? '#f43f5e' : '#22c55e'} strokeWidth="5"
                  strokeDasharray={2*Math.PI*26} strokeDashoffset={2*Math.PI*26*(1-Math.min(1,calPct/100))}
                  strokeLinecap="round" transform="rotate(-90 32 32)"/>
                <text x="32" y="36" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="900" fontFamily="sans-serif">{calPct}%</text>
              </svg>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {[{ label: 'Protein', val: Math.round(totals.protein) + 'g', goal: '150g', color: '#22c55e' }, { label: 'Carbs', val: Math.round(totals.carbs) + 'g', goal: '250g', color: '#f59e0b' }, { label: 'Fat', val: Math.round(totals.fat) + 'g', goal: '65g', color: '#f97316' }].map(m => (
                <div key={m.label} style={{ textAlign: 'center', padding: '8px', background: 'rgba(255,255,255,.08)', borderRadius: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: m.color }}>{m.val}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: 1 }}>{m.label}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,.3)' }}>Goal: {m.goal}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Meal type selector + add food */}
          <div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {MEAL_TYPES.map(m => (
                <button key={m} onClick={() => setSelectedMeal(m)} style={{
                  flex: 1, padding: '8px 4px', borderRadius: 10, border: '1.5px solid',
                  borderColor: selectedMeal === m ? '#7c3d00' : 'var(--border)',
                  background: selectedMeal === m ? '#fff7ed' : 'var(--card)',
                  color: selectedMeal === m ? '#7c3d00' : 'var(--text-2)',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer', textAlign: 'center',
                  fontFamily: "'Nunito Sans',sans-serif"
                }}>
                  <div style={{ fontSize: 16 }}>{MEAL_ICONS[m]}</div>
                  <div>{m}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-3)' }}>{nutrition.filter(n => n.meal_type === m).reduce((s, n) => s + (+n.calories || 0), 0)} cal</div>
                </button>
              ))}
            </div>

            <button className="btn btn-primary btn-full" onClick={() => setShowAddFood(p => !p)} style={{ background: '#7c3d00', marginBottom: 10, fontSize: 13 }}>
              {showAddFood ? '✕ Cancel' : `+ Add Food to ${selectedMeal}`}
            </button>

            {showAddFood && (
              <div>
                {/* Quick foods */}
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8 }}>Quick Add:</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {QUICK_FOODS.map(f => (
                      <button key={f.name} onClick={() => logFood({ food_name: f.name, calories: f.calories, protein_g: f.protein_g, carbs_g: f.carbs_g, fat_g: f.fat_g, serving_size: '1 serving' })}
                        style={{ padding: '5px 10px', borderRadius: 20, background: '#fff7ed', border: '1px solid #fdba74', color: '#7c3d00', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Nunito Sans',sans-serif" }}>
                        {f.name.split(' ')[0]} <span style={{ opacity: .6 }}>{f.calories}cal</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Manual entry */}
                <div className="card" style={{ padding: 14, border: '1.5px solid #fdba74' }}>
                  <input className="input-field" placeholder="Food name" value={foodForm.food_name} onChange={e => setFoodForm(p => ({ ...p, food_name: e.target.value }))} style={{ marginBottom: 8, fontSize: 13 }} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 8 }}>
                    <input className="input-field" type="number" placeholder="Calories" value={foodForm.calories} onChange={e => setFoodForm(p => ({ ...p, calories: e.target.value }))} style={{ fontSize: 13 }} />
                    <input className="input-field" placeholder="Serving size" value={foodForm.serving_size} onChange={e => setFoodForm(p => ({ ...p, serving_size: e.target.value }))} style={{ fontSize: 13 }} />
                    <input className="input-field" type="number" placeholder="Protein (g)" value={foodForm.protein_g} onChange={e => setFoodForm(p => ({ ...p, protein_g: e.target.value }))} style={{ fontSize: 13 }} />
                    <input className="input-field" type="number" placeholder="Carbs (g)" value={foodForm.carbs_g} onChange={e => setFoodForm(p => ({ ...p, carbs_g: e.target.value }))} style={{ fontSize: 13 }} />
                    <input className="input-field" type="number" placeholder="Fat (g)" value={foodForm.fat_g} onChange={e => setFoodForm(p => ({ ...p, fat_g: e.target.value }))} style={{ fontSize: 13 }} />
                  </div>
                  <button className="btn btn-primary btn-full" onClick={() => logFood()} style={{ background: '#7c3d00', fontSize: 13 }}>Log Food</button>
                </div>
              </div>
            )}
          </div>

          {/* Meals logged today */}
          {MEAL_TYPES.filter(m => nutrition.some(n => n.meal_type === m)).map(meal => {
            const mealFoods = nutrition.filter(n => n.meal_type === meal)
            const mealCals = mealFoods.reduce((s, n) => s + (+n.calories || 0), 0)
            return (
              <div key={meal} className="card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{MEAL_ICONS[meal]} {meal.charAt(0).toUpperCase() + meal.slice(1)}</span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: '#dc2626' }}>{mealCals} cal</span>
                </div>
                {mealFoods.map(f => (
                  <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <span>{f.food_name}{f.serving_size ? <span style={{ color: 'var(--text-3)', fontSize: 11 }}> · {f.serving_size}</span> : ''}</span>
                    <span style={{ fontWeight: 700, color: '#dc2626' }}>{f.calories} cal</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* METRICS TAB */}
      {activeTab === 'metrics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Weight chart */}
          {weightHistory.length > 1 && (
            <div className="card" style={{ padding: 16 }}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>⚖️ Weight Trend</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60 }}>
                {weightHistory.map((m, i) => {
                  const min = Math.min(...weightHistory.map(w => +w.weight_lbs))
                  const max = Math.max(...weightHistory.map(w => +w.weight_lbs))
                  const range = max - min || 1
                  const h = Math.max(8, Math.round(((+m.weight_lbs - min) / range) * 50) + 8)
                  return (
                    <div key={m.logged_date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'monospace' }}>{m.weight_lbs}</span>
                      <div style={{ width: '100%', height: h, background: '#7c3d00', borderRadius: '3px 3px 0 0' }} />
                      <span style={{ fontSize: 8, color: 'var(--text-3)' }}>{new Date(m.logged_date + 'T12:00').toLocaleDateString('en-US', { weekday: 'narrow' })}</span>
                    </div>
                  )
                })}
              </div>
              {latestWeight && (
                <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Current: {latestWeight} lbs</span>
                  {weightHistory.length > 1 && <span style={{ fontSize: 13, color: +weightHistory[weightHistory.length-1].weight_lbs < +weightHistory[0].weight_lbs ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                    {(+weightHistory[weightHistory.length-1].weight_lbs - +weightHistory[0].weight_lbs).toFixed(1)} lbs from start
                  </span>}
                </div>
              )}
            </div>
          )}

          {/* Log today's metrics */}
          <div className="card" style={{ padding: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>📏 Log Today's Metrics</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              {[
                { k: 'weight_lbs', label: 'Weight (lbs)', ph: bodyMetrics?.weight_lbs || '170' },
                { k: 'body_fat_pct', label: 'Body Fat %', ph: bodyMetrics?.body_fat_pct || '18' },
                { k: 'waist_inches', label: 'Waist (in)', ph: bodyMetrics?.waist_inches || '32' },
                { k: 'steps', label: 'Steps', ph: bodyMetrics?.steps || '8000' },
                { k: 'water_oz', label: 'Water (oz)', ph: bodyMetrics?.water_oz || '64' },
                { k: 'sleep_hours', label: 'Sleep (hrs)', ph: bodyMetrics?.sleep_hours || '7.5' },
              ].map(f => (
                <div key={f.k}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 3 }}>{f.label}</label>
                  <input className="input-field" type="number" placeholder={String(f.ph)} value={metricsForm[f.k]} onChange={e => setMetricsForm(p => ({ ...p, [f.k]: e.target.value }))} style={{ fontSize: 13, padding: '7px 10px' }} />
                </div>
              ))}
            </div>
            <button className="btn btn-primary btn-full" onClick={saveMetrics} style={{ background: '#7c3d00', fontSize: 13 }}>Save Today's Metrics</button>
          </div>
        </div>
      )}

      {/* GOALS TAB */}
      {activeTab === 'goals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="eyebrow">🎯 Fitness Goals</div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddGoal(p => !p)} style={{ background: '#7c3d00', border: 'none' }}>{showAddGoal ? '✕' : '+ Add Goal'}</button>
          </div>

          {showAddGoal && (
            <div className="card" style={{ padding: 16, border: '1.5px solid #fdba74' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <select className="input-field" value={goalForm.goal_type} onChange={e => setGoalForm(p => ({ ...p, goal_type: e.target.value }))} style={{ fontSize: 13 }}>
                  {['weight','strength','cardio','body_comp','habit','custom'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
                <input className="input-field" placeholder="Goal title" value={goalForm.title} onChange={e => setGoalForm(p => ({ ...p, title: e.target.value }))} style={{ fontSize: 13 }} />
                <input className="input-field" type="number" placeholder="Target (e.g. 170)" value={goalForm.target_value} onChange={e => setGoalForm(p => ({ ...p, target_value: e.target.value }))} style={{ fontSize: 13 }} />
                <input className="input-field" placeholder="Unit (lbs, reps...)" value={goalForm.unit} onChange={e => setGoalForm(p => ({ ...p, unit: e.target.value }))} style={{ fontSize: 13 }} />
                <input className="input-field" type="number" placeholder="Current value" value={goalForm.current_value} onChange={e => setGoalForm(p => ({ ...p, current_value: e.target.value }))} style={{ fontSize: 13 }} />
                <input type="date" className="input-field" value={goalForm.target_date} onChange={e => setGoalForm(p => ({ ...p, target_date: e.target.value }))} style={{ fontSize: 13 }} />
              </div>
              <button className="btn btn-primary btn-full" onClick={addGoal} style={{ background: '#7c3d00', fontSize: 13 }}>Add Goal</button>
            </div>
          )}

          {fitnessGoals.map(goal => {
            const pct = goal.target_value && goal.current_value ? Math.min(100, Math.round(+goal.current_value / +goal.target_value * 100)) : 0
            const goalTypeIcons = { weight: '⚖️', strength: '💪', cardio: '🏃', body_comp: '📏', habit: '🔥', custom: '🎯' }
            return (
              <div key={goal.id} className="card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 16 }}>{goalTypeIcons[goal.goal_type] || '🎯'}</span>
                      <span style={{ fontSize: 14, fontWeight: 800 }}>{goal.title}</span>
                    </div>
                    {goal.target_date && <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Target: {new Date(goal.target_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 14, fontWeight: 900, color: '#7c3d00', fontFamily: "'Fraunces',serif" }}>{pct}%</p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{goal.current_value || 0} / {goal.target_value} {goal.unit}</p>
                  </div>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: pct + '%', background: pct >= 100 ? '#16a34a' : '#7c3d00' }} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input type="number" placeholder="Update progress" style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, fontFamily: "'Nunito Sans',sans-serif" }}
                    onBlur={async e => {
                      const v = parseFloat(e.target.value)
                      if (!isNaN(v)) {
                        await supabase.from('fitness_goals').update({ current_value: v }).eq('id', goal.id)
                        setFitnessGoals(p => p.map(g => g.id === goal.id ? { ...g, current_value: v } : g))
                        e.target.value = ''
                        showToast('Progress updated ✓')
                      }
                    }} />
                </div>
              </div>
            )
          })}

          {fitnessGoals.length === 0 && !showAddGoal && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 12 }}>No fitness goals yet.</p>
              <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Add weight goals, strength targets, cardio milestones, or any custom goal you're working toward.</p>
            </div>
          )}
        </div>
      )}

      {/* SYNC TAB */}
      {activeTab === 'sync' && (
        <AppleHealthSync />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
