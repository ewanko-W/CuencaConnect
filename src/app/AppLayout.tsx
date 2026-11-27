import { NavLink, Outlet } from 'react-router-dom'

/** Mobile-first resident shell: top bar plus bottom navigation. */
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
          <span aria-hidden="true">🏠</span>
          Home
        </NavLink>
        <NavLink to="/app/profile">
          <span aria-hidden="true">👤</span>
          Profile
        </NavLink>
      </nav>
    </div>
  )
}
