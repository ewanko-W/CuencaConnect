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

/** Bilingual labels (English / Filipino). Icons: src/components/icons/categoryIcons.ts. */
export const CATEGORY_INFO: Record<ReportCategory, { label: string; filipino: string }> = {
  fire: { label: 'Fire', filipino: 'Sunog' },
  flood: { label: 'Flood', filipino: 'Baha' },
  medical: { label: 'Medical', filipino: 'Medikal' },
  crime: { label: 'Crime', filipino: 'Krimen' },
  road: { label: 'Road', filipino: 'Daan' },
  utilities: { label: 'Utilities', filipino: 'Kuryente/Tubig' },
  waste: { label: 'Waste', filipino: 'Basura' },
  other: { label: 'Other', filipino: 'Iba pa' },
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

/** Outcome of Confirm/Dispute votes against the thresholds in the database. */
export type CommunityStatus = 'pending' | 'confirmed' | 'disputed'
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
  is_critical: boolean
  community_status: CommunityStatus
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
