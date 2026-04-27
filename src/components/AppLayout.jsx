import { Outlet } from 'react-router-dom'
import BottomNav from './nav/BottomNav'

export default function AppLayout() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      <BottomNav />
      <main className="app-main">
        <div className="app-content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
