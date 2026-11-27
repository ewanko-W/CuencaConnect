import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth/AuthContext'

export interface SidebarLink {
  to: string
  label: string
  end?: boolean
}

/** Desktop-first shell with a left sidebar, used by /admin and /office. */
export function SidebarLayout({ title, label, links }: { title: string; label: string; links: SidebarLink[] }) {
  const { profile, signOut } = useAuth()

  return (
    <div className="layout layout--sidebar">
      <aside className="sidebar">
        <span className="brand">{title}</span>
        <nav aria-label={label} className="sidebar-nav">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="muted">{profile?.display_name}</span>
          <button type="button" className="button button--small" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
