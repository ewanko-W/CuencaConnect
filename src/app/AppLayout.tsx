import { NavLink, Outlet } from 'react-router-dom'

/** Mobile-first resident shell with a bottom navigation bar. */
export function AppLayout() {
  return (
    <div className="layout layout--app">
      <header className="topbar">
        <span className="brand">CuencaConnect</span>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <nav className="bottom-nav" aria-label="Resident navigation">
        <NavLink to="/app" end>
          Home
        </NavLink>
      </nav>
    </div>
  )
}
