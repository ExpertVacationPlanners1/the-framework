import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { signOut } from '../../lib/supabase'

const TABS = [
  { path: '/dashboard', icon: '🏠', label: 'Home' },
  { path: '/work',      icon: '💼', label: 'Work' },
  { path: '/personal',  icon: '🏃', label: 'Personal' },
  { path: '/financial', icon: '💰', label: 'Financial' },
  { path: '/coach',     icon: '🧠', label: 'Coach' },
]

export default function BottomNav() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const firstName = profile?.full_name?.split(' ')[0] || ''

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <nav className="sidebar-nav">
        <div className="sidebar-logo">
          <span style={{ fontSize: 22 }}>🎯</span>
          <span className="sidebar-logo-text">Framework</span>
        </div>

        <div className="sidebar-links">
          {TABS.map(t => (
            <NavLink key={t.path} to={t.path} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <span className="sidebar-icon">{t.icon}</span>
              <span>{t.label}</span>
            </NavLink>
          ))}
        </div>

        <div className="sidebar-footer">
          <NavLink to="/voice" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <span className="sidebar-icon">🎙️</span>
            <span>Voice</span>
          </NavLink>
          <NavLink to="/upgrade" className="sidebar-link sidebar-upgrade">
            <span className="sidebar-icon">✦</span>
            <span>Upgrade</span>
          </NavLink>
          <button
            className="sidebar-link sidebar-signout"
            onClick={async () => { await signOut(); navigate('/') }}
          >
            <div className="sidebar-avatar">{firstName.charAt(0).toUpperCase() || '?'}</div>
            <span>Sign out</span>
          </button>
        </div>
      </nav>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="bottom-nav">
        {TABS.map(t => (
          <NavLink key={t.path} to={t.path} className={({ isActive }) => `bottom-tab${isActive ? ' active' : ''}`}>
            <span className="bottom-tab-icon">{t.icon}</span>
            <span className="bottom-tab-label">{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  )
}
