import { Outlet } from 'react-router-dom'
import Sidebar from '../components/sidebar/Sidebar'

export default function AppLayout() {
  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <Sidebar />
      <main style={{ flex:1, display:'flex', flexDirection:'column', overflowY:'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}
