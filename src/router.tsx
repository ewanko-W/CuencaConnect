import { Navigate, type RouteObject } from 'react-router-dom'
import { AdminHome } from './admin/AdminHome'
import { AdminLayout } from './admin/AdminLayout'
import { AppHome } from './app/AppHome'
import { AppLayout } from './app/AppLayout'
import { AppProfile } from './app/AppProfile'
import { RegisterPage } from './app/auth/RegisterPage'
import { LoginPage } from './components/auth/LoginPage'
import { NotFound } from './components/NotFound'
import { RedirectIfSignedIn } from './guards/RedirectIfSignedIn'
import { RequireRole } from './guards/RequireRole'
import { OfficeHome } from './office/OfficeHome'
import { OfficeLayout } from './office/OfficeLayout'

/**
 * Route map. Each area is wrapped in RequireRole; the guards are a UX
 * convenience, and Row Level Security enforces access in the database.
 */
export const routes: RouteObject[] = [
  { path: '/', element: <Navigate to="/app" replace /> },

  // Public auth pages
  { path: '/app/login', element: <RedirectIfSignedIn><LoginPage area="app" /></RedirectIfSignedIn> },
  { path: '/app/register', element: <RedirectIfSignedIn><RegisterPage /></RedirectIfSignedIn> },
  { path: '/admin/login', element: <RedirectIfSignedIn><LoginPage area="admin" /></RedirectIfSignedIn> },
  { path: '/office/login', element: <RedirectIfSignedIn><LoginPage area="office" /></RedirectIfSignedIn> },

  // Resident PWA
  {
    path: '/app',
    element: <RequireRole allow={['resident']} loginPath="/app/login" />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <AppHome /> },
          { path: 'profile', element: <AppProfile /> },
        ],
      },
    ],
  },

  // Admin command center
  {
    path: '/admin',
    element: <RequireRole allow={['admin']} loginPath="/admin/login" />,
    children: [{ element: <AdminLayout />, children: [{ index: true, element: <AdminHome /> }] }],
  },

  // Office inbox
  {
    path: '/office',
    element: <RequireRole allow={['office_staff']} loginPath="/office/login" />,
    children: [{ element: <OfficeLayout />, children: [{ index: true, element: <OfficeHome /> }] }],
  },

  { path: '*', element: <NotFound /> },
]
