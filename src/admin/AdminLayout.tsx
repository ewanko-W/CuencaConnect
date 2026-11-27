import { NavLink, Outlet } from 'react-router-dom'

/** Desktop-first admin shell with a side navigation. */
export function AdminLayout() {
  return (
    <div className="layout layout--admin">
      <nav className="side-nav" aria-label="Admin navigation">
        <span className="brand">CuencaConnect Admin</span>
        <NavLink to="/admin" end>
          Overview
        </NavLink>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
