import type { ReportFilters, StatusFilter } from '../../lib/admin/types'
import { PRIORITY_LABELS, SEVERITIES } from '../../lib/admin/types'
import type { Barangay } from '../../lib/auth/types'
import { CATEGORY_INFO, REPORT_CATEGORIES, STATUS_LABELS, type ReportStatus } from '../../lib/reports/types'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'active', label: 'Open (not closed)' },
  { value: 'all', label: 'All statuses' },
  ...(Object.keys(STATUS_LABELS) as ReportStatus[]).map((s) => ({ value: s, label: STATUS_LABELS[s] })),
]

export function FilterBar({
  filters,
  barangays,
  onChange,
}: {
  filters: ReportFilters
  barangays: Barangay[]
  onChange: (next: ReportFilters) => void
}) {
  const set = <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => onChange({ ...filters, [key]: value })

  return (
    <form className="filter-bar" aria-label="Report filters" onSubmit={(e) => e.preventDefault()}>
      <label className="field field--inline">
        <span>Category</span>
        <select value={filters.category} onChange={(e) => set('category', e.target.value as ReportFilters['category'])}>
          <option value="">All categories</option>
          {REPORT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_INFO[c].label}
            </option>
          ))}
        </select>
      </label>
      <label className="field field--inline">
        <span>Status</span>
        <select value={filters.status} onChange={(e) => set('status', e.target.value as StatusFilter)}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field field--inline">
        <span>Priority</span>
        <select value={filters.severity} onChange={(e) => set('severity', e.target.value as ReportFilters['severity'])}>
          <option value="">All priorities</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {PRIORITY_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="field field--inline">
        <span>Barangay</span>
        <select
          value={filters.barangayId === '' ? '' : String(filters.barangayId)}
          onChange={(e) => set('barangayId', e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">All barangays</option>
          {barangays.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="button button--small"
        onClick={() => onChange({ category: '', status: 'active', severity: '', barangayId: '' })}
      >
        Reset
      </button>
    </form>
  )
}
