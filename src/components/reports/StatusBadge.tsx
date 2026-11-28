import { STATUS_LABELS, type ReportStatus } from '../../lib/reports/types'

export function StatusBadge({ status }: { status: ReportStatus }) {
  return <span className={`badge badge--${status}`}>{STATUS_LABELS[status]}</span>
}
