import type { SupabaseClient } from '@supabase/supabase-js'
import { isRetryableError } from '../network'
import { supabase } from '../supabaseClient'
import type {
  MyReport,
  NearbyReport,
  ReportDetail,
  ReportDraft,
  StatusEvent,
  VoteResult,
  VoteType,
} from './types'

export { isRetryableError }

export const MEDIA_BUCKET = 'report-media'
const SIGNED_URL_SECONDS = 300

function client(): SupabaseClient {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

function fail(message: string): never {
  throw new Error(message)
}

/**
 * Sends a draft: creates the report (idempotent by clientUuid), uploads each
 * photo to "<userId>/<clientUuid>/<n>.jpg", and records it in report_media.
 * Safe to call again after a partial failure.
 */
export async function sendReport(draft: ReportDraft): Promise<string> {
  const sb = client()
  const { data: reportId, error } = await sb.rpc('submit_report', {
    p_client_uuid: draft.clientUuid,
    p_category: draft.category,
    p_description: draft.description,
    p_lat: draft.lat,
    p_lng: draft.lng,
    p_accuracy_m: draft.accuracy,
    p_location_source: draft.locationSource,
    p_barangay_id: draft.barangayId ?? null,
  })
  if (error) fail(error.message)

  // On a retry, skip photos that an earlier attempt already uploaded.
  const folder = `${draft.userId}/${draft.clientUuid}`
  const existing = draft.photos.length
    ? new Set(((await sb.storage.from(MEDIA_BUCKET).list(folder)).data ?? []).map((f) => f.name))
    : new Set<string>()

  for (const [index, photo] of draft.photos.entries()) {
    const fileName = `${index + 1}.jpg`
    const path = `${folder}/${fileName}`
    const upload = existing.has(fileName)
      ? { error: null }
      : await sb.storage
      .from(MEDIA_BUCKET)
      .upload(path, photo, { contentType: photo.type || 'image/jpeg', upsert: false })
    // A retry may find the file already uploaded; that is fine.
    if (upload.error && !/already exists|duplicate/i.test(upload.error.message)) fail(upload.error.message)

    const media = await sb.from('report_media').upsert(
      {
        report_id: reportId as string,
        storage_path: path,
        mime_type: photo.type || 'image/jpeg',
        size_bytes: photo.size,
      },
      { onConflict: 'storage_path', ignoreDuplicates: true },
    )
    if (media.error) fail(media.error.message)
  }
  return reportId as string
}

const LIST_COLUMNS = 'id, category, description, status, created_at, updated_at, confirm_count, dispute_count'

export async function fetchMyReports(userId: string): Promise<MyReport[]> {
  const { data, error } = await client()
    .from('reports')
    .select(LIST_COLUMNS)
    .eq('reporter_id', userId)
    .order('created_at', { ascending: false })
  if (error) fail(error.message)
  return data as MyReport[]
}

export async function fetchReportDetail(id: string): Promise<ReportDetail> {
  const sb = client()
  const { data, error } = await sb
    .from('reports')
    .select(
      `${LIST_COLUMNS}, lat, lng, location_source,
       report_status_history (status, note, created_at),
       report_media (storage_path)`,
    )
    .eq('id', id)
    .single()
  if (error) fail(error.message)

  const row = data as unknown as MyReport &
    Pick<ReportDetail, 'lat' | 'lng' | 'location_source'> & {
      report_status_history: StatusEvent[]
      report_media: { storage_path: string }[]
    }

  let photoUrls: string[] = []
  if (row.report_media.length > 0) {
    const signed = await sb.storage
      .from(MEDIA_BUCKET)
      .createSignedUrls(row.report_media.map((m) => m.storage_path), SIGNED_URL_SECONDS)
    photoUrls = (signed.data ?? []).flatMap((s) => (s.signedUrl ? [s.signedUrl] : []))
  }

  const { report_status_history, report_media: _media, ...report } = row
  return {
    ...report,
    events: [...report_status_history].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    photoUrls,
  }
}

export async function fetchNearbyReports(lat: number, lng: number, radiusM = 3000): Promise<NearbyReport[]> {
  const { data, error } = await client().rpc('nearby_reports', { p_lat: lat, p_lng: lng, p_radius_m: radiusM })
  if (error) fail(error.message)
  return data as NearbyReport[]
}

export async function castVote(reportId: string, vote: VoteType): Promise<VoteResult> {
  const { data, error } = await client().rpc('cast_vote', { p_report_id: reportId, p_vote: vote })
  if (error) fail(error.message)
  return (data as VoteResult[])[0]
}

export async function withdrawVote(reportId: string): Promise<VoteResult> {
  const { data, error } = await client().rpc('withdraw_vote', { p_report_id: reportId })
  if (error) fail(error.message)
  return (data as VoteResult[])[0]
}
