export const REPORT_CATEGORIES = [
  'fire',
  'flood',
  'medical',
  'crime',
  'road',
  'utilities',
  'waste',
  'other',
] as const
export type ReportCategory = (typeof REPORT_CATEGORIES)[number]

/** Bilingual labels (English / Filipino) and an icon for each category. */
export const CATEGORY_INFO: Record<ReportCategory, { label: string; filipino: string; icon: string }> = {
  fire: { label: 'Fire', filipino: 'Sunog', icon: '🔥' },
  flood: { label: 'Flood', filipino: 'Baha', icon: '🌊' },
  medical: { label: 'Medical', filipino: 'Medikal', icon: '🚑' },
  crime: { label: 'Crime', filipino: 'Krimen', icon: '🚨' },
  road: { label: 'Road', filipino: 'Daan', icon: '🚧' },
  utilities: { label: 'Utilities', filipino: 'Kuryente/Tubig', icon: '💡' },
  waste: { label: 'Waste', filipino: 'Basura', icon: '🗑️' },
  other: { label: 'Other', filipino: 'Iba pa', icon: '📍' },
}

export type ReportStatus =
  | 'submitted'
  | 'routed'
  | 'acknowledged'
  | 'in_progress'
  | 'resolved'
  | 'rejected'
  | 'duplicate'

export const STATUS_LABELS: Record<ReportStatus, string> = {
  submitted: 'Submitted',
  routed: 'Sent to office',
  acknowledged: 'Received',
  in_progress: 'In progress',
  resolved: 'Resolved',
  rejected: 'Not accepted',
  duplicate: 'Duplicate',
}

/** The normal path of a report, in order. */
export const STATUS_FLOW: ReportStatus[] = ['submitted', 'routed', 'acknowledged', 'in_progress', 'resolved']

export type VoteType = 'confirm' | 'dispute'
export type LocationSource = 'gps' | 'adjusted' | 'manual'

export interface StatusEvent {
  status: ReportStatus
  note: string | null
  created_at: string
}

export interface MyReport {
  id: string
  category: ReportCategory
  description: string
  status: ReportStatus
  created_at: string
  updated_at: string
  confirm_count: number
  dispute_count: number
}

export interface ReportDetail extends MyReport {
  lat: number
  lng: number
  location_source: LocationSource
  events: StatusEvent[]
  photoUrls: string[]
}

export interface NearbyReport {
  id: string
  category: ReportCategory
  status: ReportStatus
  approx_lat: number
  approx_lng: number
  distance_m: number
  created_at: string
  confirm_count: number
  dispute_count: number
  my_vote: VoteType | null
  is_mine: boolean
}

export interface VoteResult {
  confirm_count: number
  dispute_count: number
  my_vote: VoteType | null
}

/** A report kept on the device until it is sent (offline outbox). */
export interface ReportDraft {
  clientUuid: string
  userId: string
  category: ReportCategory
  description: string
  lat: number
  lng: number
  accuracy: number | null
  locationSource: LocationSource
  /** Barangay where the incident happened (older drafts may lack it). */
  barangayId?: number | null
  photos: Blob[]
  createdAt: string
  attempts: number
  lastError: string | null
}
