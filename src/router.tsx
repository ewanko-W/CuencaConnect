import { Navigate, type RouteObject } from 'react-router-dom'
import { AppLayout } from './app/AppLayout'
import { AppHome } from './app/AppHome'
import { AdminLayout } from './admin/AdminLayout'
import { AdminHome } from './admin/AdminHome'
import { OfficeLayout } from './office/OfficeLayout'
import { OfficeHome } from './office/OfficeHome'
import { NotFound } from './components/NotFound'

/**
 * Route table for the three areas. Guards are added in Phase 1; they are a
 * UX convenience only, because Row Level Security enforces access.
 */
export const routes: RouteObject[] = [
  { path: '/', element: <Navigate to="/app" replace /> },
  {
    path: '/app',
    element: <AppLayout />,
    children: [{ index: true, element: <AppHome /> }],
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [{ index: true, element: <AdminHome /> }],
  },
  {
    path: '/office',
    element: <OfficeLayout />,
    children: [{ index: true, element: <OfficeHome /> }],
  },
  { path: '*', element: <NotFound /> },
]
