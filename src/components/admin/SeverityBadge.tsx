import { PRIORITY_LABELS, type Severity } from '../../lib/admin/types'

export function SeverityBadge({ severity }: { severity: Severity | null }) {
  if (!severity) return <span className="badge">Not triaged</span>
  return <span className={`badge badge--sev-${severity}`}>{PRIORITY_LABELS[severity]}</span>
}
