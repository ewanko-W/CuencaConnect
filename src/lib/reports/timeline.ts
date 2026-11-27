import { STATUS_FLOW, type ReportStatus, type StatusEvent } from './types'

export interface TimelineStep {
  status: ReportStatus
  state: 'done' | 'current' | 'upcoming'
  event: StatusEvent | null
}

/**
 * Builds the timeline: the normal path (submitted → … → resolved) with the
 * time each step happened, or, for closed-without-resolution reports
 * (rejected/duplicate), the events exactly as they happened.
 */
export function buildTimeline(status: ReportStatus, events: StatusEvent[]): TimelineStep[] {
  const latestByStatus = new Map<ReportStatus, StatusEvent>()
  for (const event of events) latestByStatus.set(event.status, event)

  if (!STATUS_FLOW.includes(status)) {
    return events.map((event, i) => ({
      status: event.status,
      state: i === events.length - 1 ? 'current' : 'done',
      event,
    }))
  }

  const currentIndex = STATUS_FLOW.indexOf(status)
  return STATUS_FLOW.map((step, i) => ({
    status: step,
    state: i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming',
    event: i <= currentIndex ? (latestByStatus.get(step) ?? null) : null,
  }))
}
