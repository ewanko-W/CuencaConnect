import { Languages, Map as MapIcon, Megaphone, ScrollText } from 'lucide-react'
import { SidebarLayout } from '../components/SidebarLayout'

export function AdminLayout() {
  return (
    <SidebarLayout
      title="CuencaConnect Admin"
      label="Admin navigation"
      links={[
        { to: '/admin/command', label: 'Command Center', icon: MapIcon },
        { to: '/admin/alerts', label: 'Alerts', icon: Megaphone },
        { to: '/admin/keywords', label: 'Keywords', icon: Languages },
        { to: '/admin/audit', label: 'Audit log', icon: ScrollText },
      ]}
    />
  )
}
