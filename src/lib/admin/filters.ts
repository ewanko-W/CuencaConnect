import type { ReportStatus } from '../reports/types'
import type { ReportFilters } from './types'

export const ACTIVE_STATUSES: ReportStatus[] = ['submitted', 'routed', 'acknowledged', 'in_progress']

export type FilterOp =
  | { op: 'eq'; column: string; value: string | number }
  | { op: 'in'; column: string; value: string[] }

/** Translates dashboard filters into PostgREST conditions (tested separately). */
export function filterConditions(filters: ReportFilters): FilterOp[] {
  const ops: FilterOp[] = []
  if (filters.category) ops.push({ op: 'eq', column: 'category', value: filters.category })
  if (filters.status === 'active') ops.push({ op: 'in', column: 'status', value: ACTIVE_STATUSES })
  else if (filters.status !== 'all') ops.push({ op: 'eq', column: 'status', value: filters.status })
  if (filters.severity) ops.push({ op: 'eq', column: 'severity', value: filters.severity })
  if (filters.barangayId !== '') ops.push({ op: 'eq', column: 'barangay_id', value: filters.barangayId })
  return ops
}

/** Serializes filters into URL search params so views can be bookmarked and shared. */
export function filtersToSearch(filters: ReportFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.category) params.set('category', filters.category)
  if (filters.status !== 'active') params.set('status', filters.status)
  if (filters.severity) params.set('priority', filters.severity)
  if (filters.barangayId !== '') params.set('barangay', String(filters.barangayId))
  return params
}

export function filtersFromSearch(params: URLSearchParams): ReportFilters {
  const barangay = params.get('barangay')
  return {
    category: (params.get('category') ?? '') as ReportFilters['category'],
    status: (params.get('status') ?? 'active') as ReportFilters['status'],
    severity: (params.get('priority') ?? '') as ReportFilters['severity'],
    barangayId: barangay && /^\d+$/.test(barangay) ? Number(barangay) : '',
  }
}
