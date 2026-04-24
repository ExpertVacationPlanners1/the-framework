import { Outlet } from 'react-router-dom'
import BottomNav from './nav/BottomNav'

export default function AppLayout() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      <BottomNav />
      {/* Desktop: offset for sidebar. Mobile: offset for bottom nav */}
      <main style={{ paddingLeft: 'var(--nav-width, 220px)', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
