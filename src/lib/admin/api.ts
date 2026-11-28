import type { SupabaseClient } from '@supabase/supabase-js'
import { MEDIA_BUCKET } from '../reports/api'
import type { ReportCategory, ReportStatus, StatusEvent } from '../reports/types'
import { supabase } from '../supabaseClient'
import { ACTIVE_STATUSES, filterConditions } from './filters'
import type {
  AdminAlert,
  AdminOffice,
  AdminReport,
  AdminReportDetail,
  AlertInput,
  AuditEntry,
  CommunityThresholds,
  Keyword,
  KeywordLang,
  ReportFilters,
  RoutingEntry,
  Severity,
  TriagePreview,
} from './types'

function client(): SupabaseClient {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

function check<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message)
  return result.data as T
}

const REPORT_COLUMNS = `id, category, description, status, severity, is_critical, priority_score, created_at,
  lat, lng, confirm_count, dispute_count, community_status, matched_keywords,
  barangay:barangays (id, name),
  suggested_office:offices!reports_suggested_office_id_fkey (id, name, code),
  assigned_office:offices!reports_assigned_office_id_fkey (id, name, code)`

// ---------- Reports ----------

export async function fetchAdminReports(filters: ReportFilters): Promise<AdminReport[]> {
  let query = client().from('reports').select(REPORT_COLUMNS)
  for (const condition of filterConditions(filters)) {
    query = condition.op === 'in' ? query.in(condition.column, condition.value) : query.eq(condition.column, condition.value)
  }
  return check(
    await query.order('priority_score', { ascending: false }).order('created_at', { ascending: false }).limit(500),
  ) as unknown as AdminReport[]
}

/** Open critical reports, ignoring every filter (CLAUDE.md: always visible to admins). */
export async function fetchOpenCriticalReports(): Promise<AdminReport[]> {
  return check(
    await client()
      .from('reports')
      .select(REPORT_COLUMNS)
      .eq('is_critical', true)
      .in('status', ACTIVE_STATUSES)
      .order('created_at', { ascending: true }),
  ) as unknown as AdminReport[]
}

export async function fetchAdminReport(id: string): Promise<AdminReportDetail> {
  const sb = client()
  const row = check(
    await sb
      .from('reports')
      .select(
        `${REPORT_COLUMNS}, location_source, gps_accuracy_m, resolved_at,
         reporter:profiles!reports_reporter_id_fkey (display_name),
         report_status_history (status, note, created_at),
         report_media (storage_path),
         routing_history (id, note, created_at,
           from_office:offices!routing_history_from_office_id_fkey (name),
           to_office:offices!routing_history_to_office_id_fkey (name))`,
      )
      .eq('id', id)
      .single(),
  ) as unknown as AdminReport &
    Pick<AdminReportDetail, 'location_source' | 'gps_accuracy_m' | 'resolved_at' | 'reporter'> & {
      report_status_history: StatusEvent[]
      report_media: { storage_path: string }[]
      routing_history: RoutingEntry[]
    }

  let photoUrls: string[] = []
  if (row.report_media.length > 0) {
    const signed = await sb.storage.from(MEDIA_BUCKET).createSignedUrls(
      row.report_media.map((m) => m.storage_path),
      300,
    )
    photoUrls = (signed.data ?? []).flatMap((s) => (s.signedUrl ? [s.signedUrl] : []))
  }

  const { report_status_history, report_media: _media, routing_history, ...report } = row
  return {
    ...report,
    events: [...report_status_history].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    routing: [...routing_history].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    photoUrls,
  }
}

export async function routeReport(reportId: string, officeId: number, note: string): Promise<void> {
  check(await client().rpc('route_report', { p_report_id: reportId, p_office_id: officeId, p_note: note || null }))
}

export async function setReportStatus(reportId: string, status: ReportStatus, note: string): Promise<void> {
  check(await client().rpc('set_report_status', { p_report_id: reportId, p_status: status, p_note: note || null }))
}

export async function fetchActiveOffices(): Promise<AdminOffice[]> {
  return check(
    await client().from('offices').select('id, name, code, handles_categories').eq('is_active', true).order('name'),
  ) as AdminOffice[]
}

/** Calls onChange whenever any visible report changes (Realtime + RLS). */
export function subscribeToReports(onChange: () => void): () => void {
  if (!supabase) return () => {}
  const sb = supabase
  const channel = sb
    .channel('admin-reports')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, onChange)
    .subscribe()
  return () => {
    void sb.removeChannel(channel)
  }
}

// ---------- Alerts ----------

export async function fetchAllAlerts(): Promise<AdminAlert[]> {
  return check(
    await client()
      .from('alerts')
      .select('id, title, body, level, scope, target_barangay_ids, starts_at, expires_at, is_active, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
  ) as AdminAlert[]
}

export function alertRow(input: AlertInput, now: Date = new Date()) {
  return {
    title: input.title.trim(),
    body: input.body.trim(),
    level: input.level,
    scope: input.scope,
    target_barangay_ids: input.scope === 'barangay' ? input.targetBarangayIds : [],
    starts_at: now.toISOString(),
    expires_at: input.expiresInHours ? new Date(now.getTime() + input.expiresInHours * 3600_000).toISOString() : null,
  }
}

export async function broadcastAlert(input: AlertInput): Promise<void> {
  // created_by defaults to auth.uid(); the insert is audited by a trigger.
  check(await client().from('alerts').insert(alertRow(input)))
}

export async function setAlertActive(id: string, isActive: boolean): Promise<void> {
  check(await client().from('alerts').update({ is_active: isActive }).eq('id', id))
}

// ---------- Keywords ----------

export async function fetchKeywords(): Promise<Keyword[]> {
  return check(
    await client()
      .from('keywords')
      .select('id, term, lang, category, severity, is_active, updated_at')
      .order('lang')
      .order('term'),
  ) as Keyword[]
}

export async function addKeyword(input: {
  term: string
  lang: KeywordLang
  category: ReportCategory | null
  severity: Severity
}): Promise<void> {
  check(await client().from('keywords').insert(input))
}

export async function updateKeyword(
  id: number,
  patch: Partial<Pick<Keyword, 'category' | 'severity' | 'is_active'>>,
): Promise<void> {
  check(await client().from('keywords').update(patch).eq('id', id))
}

export async function deleteKeyword(id: number): Promise<void> {
  check(await client().from('keywords').delete().eq('id', id))
}

export async function previewTriage(text: string, category: ReportCategory): Promise<TriagePreview> {
  const rows = check(await client().rpc('preview_triage', { p_text: text, p_category: category })) as TriagePreview[]
  return rows[0]
}

// ---------- Community verification thresholds ----------

export async function fetchThresholds(): Promise<CommunityThresholds> {
  return check(
    await client()
      .from('community_thresholds')
      .select('min_confirms, min_disputes, dominance_ratio, updated_at')
      .single(),
  ) as CommunityThresholds
}

/** Statuses of all reports are recomputed by the database; the change is audited. */
export async function updateThresholds(
  values: Pick<CommunityThresholds, 'min_confirms' | 'min_disputes' | 'dominance_ratio'>,
): Promise<void> {
  check(await client().from('community_thresholds').update(values).eq('id', true))
}

// ---------- Audit ----------

export async function fetchAuditEntries(action: string): Promise<AuditEntry[]> {
  let query = client()
    .from('audit_log_entries')
    .select('id, created_at, action, table_name, record_id, old_data, new_data, actor_name, actor_role')
  if (action) query = query.like('action', `${action}%`)
  return check(await query.order('created_at', { ascending: false }).limit(200)) as AuditEntry[]
}
