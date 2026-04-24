import { NavLink } from 'react-router-dom'

const TABS = [
  { path: '/dashboard', icon: '🏠', label: 'Home' },
  { path: '/work', icon: '💼', label: 'Work' },
  { path: '/personal', icon: '🏃', label: 'Personal' },
  { path: '/financial', icon: '💰', label: 'Financial' },
  { path: '/coach', icon: '🧠', label: 'Coach' },
]

export default function BottomNav() {
  return (
    <>
      {/* Desktop sidebar */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 220,
        background: '#fff', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', padding: '20px 0',
        zIndex: 100, boxShadow: '2px 0 8px rgba(0,0,0,.04)'
      }} className="desktop-nav">
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>🎯</span>
            <span style={{ fontFamily: "'Fraunces',serif", fontSize: 18, fontWeight: 900, color: 'var(--primary)' }}>Framework</span>
          </div>
        </div>
        {TABS.map(t => (
          <NavLink key={t.path} to={t.path} style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '11px 20px', margin: '2px 10px', borderRadius: 10,
            textDecoration: 'none', fontSize: 14, fontWeight: 700,
            fontFamily: "'Nunito Sans',sans-serif",
            background: isActive ? 'var(--primary-light)' : 'transparent',
            color: isActive ? 'var(--primary)' : 'var(--text-2)',
            transition: 'all .15s'
          })}>
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
        <div style={{ marginTop: 'auto', padding: '0 10px' }}>
          <NavLink to="/voice" style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '11px 20px', borderRadius: 10, textDecoration: 'none',
            fontSize: 14, fontWeight: 700, fontFamily: "'Nunito Sans',sans-serif",
            background: isActive ? 'var(--primary-light)' : 'transparent',
            color: isActive ? 'var(--primary)' : 'var(--text-2)'
          })}>
            <span style={{ fontSize: 18 }}>🎙️</span> Voice Session
          </NavLink>
          <NavLink to="/upgrade" style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '11px 20px', borderRadius: 10, textDecoration: 'none',
            fontSize: 14, fontWeight: 700, fontFamily: "'Nunito Sans',sans-serif",
            background: 'linear-gradient(135deg,var(--primary),#2d5a3d)',
            color: '#fff', marginTop: 4
          })}>
            <span style={{ fontSize: 18 }}>✦</span> Upgrade
          </NavLink>
        </div>
      </nav>

      {/* Mobile bottom tab bar */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        padding: '6px 0 calc(6px + env(safe-area-inset-bottom))',
        zIndex: 100, boxShadow: '0 -2px 12px rgba(0,0,0,.06)'
      }} className="mobile-nav">
        {TABS.map(t => (
          <NavLink key={t.path} to={t.path} style={({ isActive }) => ({
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 3, textDecoration: 'none', padding: '4px 12px',
            borderRadius: 10, minWidth: 56,
            color: isActive ? 'var(--primary)' : 'var(--text-3)',
            transition: 'color .15s'
          })}>
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 800, fontFamily: "'Nunito Sans',sans-serif", letterSpacing: .3 }}>
              {t.label}
            </span>
          </NavLink>
        ))}
      </nav>
    </>
  )
}
