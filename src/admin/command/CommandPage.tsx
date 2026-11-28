import { TriangleAlert } from 'lucide-react'
import { CategoryLabel } from '../../components/icons/CategoryLabel'
import { useEffect, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FilterBar } from '../../components/admin/FilterBar'
import { ReportsMap } from '../../components/admin/ReportsMap'
import { SeverityBadge } from '../../components/admin/SeverityBadge'
import { CommunityBadge } from '../../components/reports/CommunityBadge'
import { StatusBadge } from '../../components/reports/StatusBadge'
import { fetchAdminReports, fetchOpenCriticalReports, subscribeToReports } from '../../lib/admin/api'
import { filtersFromSearch, filtersToSearch } from '../../lib/admin/filters'
import type { AdminReport, ReportFilters } from '../../lib/admin/types'
import { fetchBarangays } from '../../lib/auth/api'
import { formatRelative } from '../../lib/format'
import { useAsyncData } from '../../lib/useAsyncData'

function officeLabel(r: AdminReport): string {
  if (r.assigned_office) return r.assigned_office.code
  if (r.suggested_office) return `Suggested: ${r.suggested_office.code}`
  return '—'
}

/** Critical reports that are still open, regardless of the filters. */
export function CriticalPanel({ reports }: { reports: AdminReport[] }) {
  if (reports.length === 0) return null
  return (
    <section className="critical-panel" aria-labelledby="critical-title">
      <h2 id="critical-title" className="with-icon">
        <TriangleAlert size={20} aria-hidden="true" />
        <span>Critical, open ({reports.length})</span>
      </h2>
      <p className="small">Always shown, whatever the filters.</p>
      <ul className="critical-panel__list">
        {reports.map((r) => (
          <li key={r.id}>
            <Link to={`/admin/command/${r.id}`} className="critical-panel__item">
              <strong>
                <CategoryLabel category={r.category} />
              </strong>
              <span>{r.barangay?.name ?? 'Barangay not set'}</span>
              <span>{r.assigned_office ? `Routed to ${r.assigned_office.code}` : 'NOT ROUTED'}</span>
              <CommunityBadge status={r.community_status} />
              <span>{formatRelative(r.created_at)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function CommandPage() {
  const [search, setSearch] = useSearchParams()
  const navigate = useNavigate()
  const filters = useMemo(() => filtersFromSearch(search), [search])
  const filterKey = search.toString()

  const reports = useAsyncData(() => fetchAdminReports(filters), [filterKey])
  const critical = useAsyncData(fetchOpenCriticalReports, [])
  const barangays = useAsyncData(fetchBarangays, [])

  const { reload: reloadReports } = reports
  const { reload: reloadCritical } = critical
  useEffect(
    () =>
      subscribeToReports(() => {
        reloadReports()
        reloadCritical()
      }),
    [reloadReports, reloadCritical],
  )

  function changeFilters(next: ReportFilters) {
    setSearch(filtersToSearch(next), { replace: true })
  }

  const list = reports.data ?? []
  const open = (id: string) => navigate(`/admin/command/${id}`)

  return (
    <section className="stack">
      <header className="page-header">
        <h1>Command Center</h1>
        <p className="muted">Triage incoming reports and route them to the responding office.</p>
      </header>

      <CriticalPanel reports={critical.data ?? []} />

      <FilterBar filters={filters} barangays={barangays.data ?? []} onChange={changeFilters} />

      {reports.error && (
        <div className="alert alert--error" role="alert">
          {reports.error}{' '}
          <button type="button" className="button button--small" onClick={reports.reload}>
            Try again
          </button>
        </div>
      )}

      <div className="command-grid">
        <ReportsMap reports={list} onSelect={open} />

        <div className="table-wrap">
          <table className="data-table" aria-label="Reports by priority">
            <caption className="muted small">
              {reports.loading && !reports.data ? 'Loading…' : `${list.length} report(s), highest priority first`}
            </caption>
            <thead>
              <tr>
                <th scope="col">Priority</th>
                <th scope="col">Report</th>
                <th scope="col">Status</th>
                <th scope="col">Office</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className={r.is_critical ? 'row--critical' : undefined}>
                  <td>
                    <SeverityBadge severity={r.severity} />
                  </td>
                  <td>
                    <Link to={`/admin/command/${r.id}`} className="table-link">
                      <CategoryLabel category={r.category} />
                    </Link>
                    <div className="small clamp-2">{r.description}</div>
                    <div className="muted small">
                      {r.barangay?.name ?? 'Barangay not set'} · {formatRelative(r.created_at)}
                    </div>
                  </td>
                  <td>
                    <div className="badge-stack">
                      <StatusBadge status={r.status} />
                      <CommunityBadge status={r.community_status} />
                    </div>
                  </td>
                  <td className="small">{officeLabel(r)}</td>
                </tr>
              ))}
              {!reports.loading && list.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    No reports match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
