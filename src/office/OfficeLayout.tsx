import { Inbox } from 'lucide-react'
import { SidebarLayout } from '../components/SidebarLayout'

export function OfficeLayout() {
  return (
    <SidebarLayout
      title="CuencaConnect Office"
      label="Office navigation"
      links={[{ to: '/office', label: 'Inbox', icon: Inbox, end: true }]}
    />
  )
}
