import { useState } from 'react'
import { fetchAuditEntries } from '../../lib/admin/api'
import { summarize } from '../../lib/admin/auditSummary'
import { formatDateTime } from '../../lib/format'
import { useAsyncData } from '../../lib/useAsyncData'

const ACTION_FILTERS = [
  { value: '', label: 'All actions' },
  { value: 'report.', label: 'Report routing and status' },
  { value: 'alerts.', label: 'Alerts' },
  { value: 'keywords.', label: 'Keywords' },
  { value: 'offices.', label: 'Offices' },
]

export function AuditPage() {
  const [action, setAction] = useState('')
  const entries = useAsyncData(() => fetchAuditEntries(action), [action])

  return (
    <section className="stack">
      <header className="page-header">
        <h1>Audit log</h1>
        <p className="muted">Every admin action, newest first. Entries cannot be edited or deleted.</p>
      </header>
      <label className="field field--inline">
        <span>Show</span>
        <select value={action} onChange={(e) => setAction(e.target.value)}>
          {ACTION_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
      {entries.error && <p className="alert alert--error">{entries.error}</p>}
      <div className="table-wrap">
        <table className="data-table" aria-label="Audit entries">
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Who</th>
              <th scope="col">Action</th>
              <th scope="col">Details</th>
            </tr>
          </thead>
          <tbody>
            {(entries.data ?? []).map((e) => (
              <tr key={e.id}>
                <td className="small nowrap">{formatDateTime(e.created_at)}</td>
                <td>{e.actor_name ?? <span className="muted">System</span>}</td>
                <td>
                  <code>{e.action}</code>
                </td>
                <td className="small">{summarize(e)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
