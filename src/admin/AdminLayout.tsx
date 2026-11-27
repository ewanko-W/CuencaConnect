import { SidebarLayout } from '../components/SidebarLayout'

export function AdminLayout() {
  return (
    <SidebarLayout
      title="CuencaConnect Admin"
      label="Admin navigation"
      links={[{ to: '/admin', label: 'Overview', end: true }]}
    />
  )
}
