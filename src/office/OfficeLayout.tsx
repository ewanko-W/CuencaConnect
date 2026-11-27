import { NavLink, Outlet } from 'react-router-dom'

/** Shell for responding-office staff (MDRRMO, BFP, PNP, MHO, etc.). */
export function OfficeLayout() {
  return (
    <div className="layout layout--office">
      <nav className="side-nav" aria-label="Office navigation">
        <span className="brand">CuencaConnect Office</span>
        <NavLink to="/office" end>
          Inbox
        </NavLink>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
