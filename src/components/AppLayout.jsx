import { Outlet } from 'react-router-dom'
import BottomNav from './nav/BottomNav'

export default function AppLayout() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      <BottomNav />
      <main style={{ marginLeft: 220, paddingBottom: 40 }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 24px' }}>
          <Outlet />
        </div>
      </main>
      {/* Mobile: sidebar collapses, bottom nav takes over */}
      <style>{`
        @media (max-width: 768px) {
          main { margin-left: 0 !important; padding-bottom: 90px !important; }
        }
      `}</style>
    </div>
  )
}
