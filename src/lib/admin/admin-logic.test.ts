import { describe, expect, it } from 'vitest'
import migrationSql from '../../../supabase/migrations/20261127000500_admin_command.sql?raw'
import type { ReportStatus } from '../reports/types'
import { alertRow } from './api'
import { summarize } from './auditSummary'
import { ACTIVE_STATUSES, filterConditions, filtersFromSearch, filtersToSearch } from './filters'
import { canRoute, statusActions } from './statusActions'
import { DEFAULT_FILTERS, type AlertInput, type AuditEntry } from './types'
import { validateAlert } from './validateAlert'

describe('report filters', () => {
  it('defaults to open reports only', () => {
    expect(filterConditions(DEFAULT_FILTERS)).toEqual([{ op: 'in', column: 'status', value: ACTIVE_STATUSES }])
  })

  it('maps category, status, priority, and barangay to columns', () => {
    expect(
      filterConditions({ category: 'fire', status: 'resolved', severity: 'critical', barangayId: 6 }),
    ).toEqual([
      { op: 'eq', column: 'category', value: 'fire' },
      { op: 'eq', column: 'status', value: 'resolved' },
      { op: 'eq', column: 'severity', value: 'critical' },
      { op: 'eq', column: 'barangay_id', value: 6 },
    ])
  })

  it('applies no status condition for "all"', () => {
    expect(filterConditions({ ...DEFAULT_FILTERS, status: 'all' })).toEqual([])
  })

  it('round-trips through the URL so filtered views can be bookmarked', () => {
    const filters = { category: 'flood', status: 'all', severity: 'high', barangayId: 14 } as const
    expect(filtersFromSearch(filtersToSearch(filters))).toEqual(filters)
    expect(filtersToSearch(DEFAULT_FILTERS).toString()).toBe('')
    expect(filtersFromSearch(new URLSearchParams('barangay=abc')).barangayId).toBe('')
  })
})

describe('status actions mirror the database', () => {
  it('offers only reject/duplicate before a report is routed', () => {
    expect(statusActions('submitted', false).map((a) => a.label)).toEqual(['Reject', 'Duplicate'])
  })

  it('offers Received, In progress, and Resolved once routed', () => {
    expect(statusActions('routed', true).map((a) => a.label)).toEqual([
      'Received',
      'In progress',
      'Resolved',
      'Reject',
      'Duplicate',
    ])
  })

  it('requires a note to reject, mark duplicate, or reopen', () => {
    const routed = statusActions('routed', true)
    expect(routed.find((a) => a.to === 'acknowledged')?.needsNote).toBe(false)
    expect(routed.find((a) => a.to === 'rejected')?.needsNote).toBe(true)
    expect(statusActions('resolved', true)).toEqual([
      { to: 'in_progress', label: 'Reopen', needsNote: true, tone: 'default' },
    ])
  })

  it('does not allow routing closed reports', () => {
    expect(canRoute('in_progress')).toBe(true)
    expect(canRoute('resolved')).toBe(false)
  })

  it('matches is_allowed_status_transition() in the migration exactly', () => {
    const body = migrationSql.slice(migrationSql.indexOf('create function public.is_allowed_status_transition'))
    const block = body.slice(body.indexOf('array['), body.indexOf('])'))
    const fromDb = [...block.matchAll(/'(\w+)>(\w+)'/g)].map((m) => `${m[1]}>${m[2]}`).sort()

    const statuses: ReportStatus[] = ['submitted', 'routed', 'acknowledged', 'in_progress', 'resolved', 'rejected', 'duplicate']
    const fromUi = statuses.flatMap((s) => statusActions(s, true).map((a) => `${s}>${a.to}`)).sort()
    expect(fromUi).toEqual(fromDb)
  })
})

describe('alerts', () => {
  const input: AlertInput = {
    title: ' Flood warning ',
    body: ' Move to higher ground. ',
    level: 'warning',
    scope: 'barangay',
    targetBarangayIds: [6, 9],
    expiresInHours: 24,
  }

  it('builds the row to insert, trimming text and computing expiry', () => {
    const now = new Date('2026-11-27T00:00:00Z')
    expect(alertRow(input, now)).toEqual({
      title: 'Flood warning',
      body: 'Move to higher ground.',
      level: 'warning',
      scope: 'barangay',
      target_barangay_ids: [6, 9],
      starts_at: '2026-11-27T00:00:00.000Z',
      expires_at: '2026-11-28T00:00:00.000Z',
    })
  })

  it('sends no barangay targets for municipality-wide alerts', () => {
    expect(alertRow({ ...input, scope: 'municipality', expiresInHours: null }).target_barangay_ids).toEqual([])
  })

  it('validates title, message, and barangay selection', () => {
    expect(validateAlert(input)).toBeNull()
    expect(validateAlert({ ...input, title: 'x' })).toMatch(/title/)
    expect(validateAlert({ ...input, targetBarangayIds: [] })).toMatch(/barangay/)
  })
})

describe('audit summaries', () => {
  const base: AuditEntry = {
    id: 1,
    created_at: '2026-11-27T00:00:00Z',
    action: '',
    table_name: null,
    record_id: null,
    old_data: null,
    new_data: null,
    actor_name: 'Demo Admin',
    actor_role: 'admin',
  }

  it('describes routing and status changes', () => {
    expect(summarize({ ...base, action: 'report.routed', new_data: { assigned_office_id: 2, note: 'Nearest' } })).toBe(
      'Routed to office #2 (Nearest)',
    )
    expect(
      summarize({ ...base, action: 'report.status_changed', old_data: { status: 'routed' }, new_data: { status: 'resolved' } }),
    ).toBe('routed to resolved')
  })

  it('lists changed fields for generic updates', () => {
    expect(
      summarize({
        ...base,
        action: 'keywords.update',
        old_data: { severity: 'high', is_active: true, updated_at: 'a' },
        new_data: { severity: 'critical', is_active: true, updated_at: 'b' },
      }),
    ).toBe('Changed severity')
  })
})
