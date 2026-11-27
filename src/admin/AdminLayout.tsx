import { SidebarLayout } from '../components/SidebarLayout'

export function AdminLayout() {
  return (
    <SidebarLayout
      title="CuencaConnect Admin"
      label="Admin navigation"
      links={[
        { to: '/admin/command', label: '🗺️ Command Center' },
        { to: '/admin/alerts', label: '📢 Alerts' },
        { to: '/admin/keywords', label: '🔤 Keywords' },
        { to: '/admin/audit', label: '📜 Audit log' },
      ]}
    />
  )
}
