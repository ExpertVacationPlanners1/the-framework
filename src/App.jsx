import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import VoiceSession from './pages/VoiceSession'

function ProtectedRoute({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" replace />
  if (user && profile && !profile.onboarded) return <Navigate to="/onboarding" replace />
  return children
}

function OnboardingRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (user && profile?.onboarded) return <Navigate to="/dashboard" replace />
  return children
}

function FullScreenLoader() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--surface)', flexDirection: 'column', gap: 16
    }}>
      <div style={{ fontSize: 32 }}>🎯</div>
      <div className="spinner spinner-dark" style={{ width: 24, height: 24 }} />
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
      <Route path="/onboarding" element={<OnboardingRoute><Onboarding /></OnboardingRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
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
