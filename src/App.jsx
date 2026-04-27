import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import { AuthProvider, useAuth } from './hooks/useAuth'

// Pages
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import Work from './pages/Work'
import Personal from './pages/Personal'
import Financial from './pages/Financial'
import Coach from './pages/Coach'
import VoiceSession from './pages/VoiceSession'
import Upgrade from './pages/Upgrade'
import Debug from './pages/Debug'

// Layout
import AppLayout from './components/AppLayout'

function Loader() {
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--surface)', flexDirection:'column', gap:16 }}>
      <div style={{ fontSize:36 }}>🎯</div>
      <div className="spinner spinner-dark" style={{ width:24, height:24 }}/>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <Loader />
  if (!user) return <Navigate to="/login" replace />
  if (user && profile && !profile.onboarded) return <Navigate to="/onboarding" replace />
  return children
}

function OnboardingRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Loader />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <Loader />
  // If logged in and onboarded, go to dashboard
  if (user && profile && profile.onboarded) return <Navigate to="/dashboard" replace />
  // If logged in but not onboarded, go to onboarding
  if (user && profile && !profile.onboarded) return <Navigate to="/onboarding" replace />
  // If logged in but profile still loading, wait
  if (user && !profile && !loading) return <Loader />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
      <Route path="/onboarding" element={<OnboardingRoute><Onboarding /></OnboardingRoute>} />
      <Route path="/debug" element={<Debug />} />

      {/* Protected — wrapped in AppLayout with nav */}
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Home />} />
        <Route path="/work" element={<Work />} />
        <Route path="/personal" element={<Personal />} />
        <Route path="/financial" element={<Financial />} />
        <Route path="/coach" element={<Coach />} />
        <Route path="/upgrade" element={<Upgrade />} />
      </Route>

      {/* Voice — full screen, no nav */}
      <Route path="/voice" element={<ProtectedRoute><VoiceSession /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
