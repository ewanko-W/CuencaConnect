import type { AlertLevel } from '../alerts/types'
import type { CommunityStatus, ReportCategory, ReportStatus, StatusEvent } from '../reports/types'

export type Severity = 'low' | 'medium' | 'high' | 'critical'
export const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low']

/** "Priority" in the dashboard is the triage severity (critical → low). */
export const PRIORITY_LABELS: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export interface OfficeRef {
  id: number
  name: string
  code: string
}

export interface AdminReport {
  id: string
  category: ReportCategory
  description: string
  status: ReportStatus
  severity: Severity | null
  is_critical: boolean
  priority_score: number
  created_at: string
  lat: number
  lng: number
  confirm_count: number
  dispute_count: number
  community_status: CommunityStatus
  matched_keywords: string[]
  barangay: { id: number; name: string } | null
  suggested_office: OfficeRef | null
  assigned_office: OfficeRef | null
}

export interface RoutingEntry {
  id: number
  note: string | null
  created_at: string
  from_office: { name: string } | null
  to_office: { name: string } | null
}

export interface AdminReportDetail extends AdminReport {
  location_source: string
  gps_accuracy_m: number | null
  resolved_at: string | null
  reporter: { display_name: string } | null
  events: StatusEvent[]
  routing: RoutingEntry[]
  photoUrls: string[]
}

export interface AdminOffice extends OfficeRef {
  handles_categories: ReportCategory[]
}

export type StatusFilter = 'active' | 'all' | ReportStatus

export interface ReportFilters {
  category: ReportCategory | ''
  status: StatusFilter
  severity: Severity | ''
  barangayId: number | ''
}

export const DEFAULT_FILTERS: ReportFilters = { category: '', status: 'active', severity: '', barangayId: '' }

export interface AdminAlert {
  id: string
  title: string
  body: string
  level: AlertLevel
  scope: 'municipality' | 'barangay'
  target_barangay_ids: number[]
  starts_at: string
  expires_at: string | null
  is_active: boolean
  created_at: string
}

export interface AlertInput {
  title: string
  body: string
  level: AlertLevel
  scope: 'municipality' | 'barangay'
  targetBarangayIds: number[]
  expiresInHours: number | null
}

export type KeywordLang = 'en' | 'fil'

export interface Keyword {
  id: number
  term: string
  lang: KeywordLang
  category: ReportCategory | null
  severity: Severity
  is_active: boolean
  updated_at: string
}

export interface TriagePreview {
  severity: Severity
  is_critical: boolean
  matched_keywords: string[]
  suggested_office_name: string | null
}

export interface AuditEntry {
  id: number
  created_at: string
  action: string
  table_name: string | null
  record_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  actor_name: string | null
  actor_role: string | null
}

export interface CommunityThresholds {
  min_confirms: number
  min_disputes: number
  dominance_ratio: number
  updated_at: string
}
