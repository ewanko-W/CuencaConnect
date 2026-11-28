/** True when the browser reports no network connection. */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/** Errors worth retrying later (no connection), as opposed to rule violations. */
export function isRetryableError(error: unknown): boolean {
  if (isOffline()) return true
  const message = error instanceof Error ? error.message : String(error)
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|offline/i.test(message)
}

export const OFFLINE_LOAD_MESSAGE = 'You are offline. This page will load when your connection returns.'
