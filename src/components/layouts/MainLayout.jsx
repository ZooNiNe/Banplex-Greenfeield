import { Outlet } from 'react-router-dom'
import BottomNav from '../ui/BottomNav'

function MainLayout() {
  return (
    <div className="app-shell mx-auto flex h-screen max-w-md flex-col overflow-hidden">
      <main className="flex-1 overflow-y-auto pb-20 px-2 pt-2">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}

export default MainLayout
