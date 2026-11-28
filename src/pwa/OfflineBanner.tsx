import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from './useOnlineStatus'

export type OfflineContext = 'resident' | 'staff' | 'auth'

const OFFLINE_MESSAGES: Record<OfflineContext, { title: string; body: string }> = {
  resident: {
    title: 'You are offline.',
    body: 'You can still write a report: it is saved on this phone and sent automatically when you reconnect. Alerts and the map may be out of date. In an emergency, call 911.',
  },
  staff: {
    title: 'You are offline.',
    body: 'Lists may be out of date and changes cannot be saved until the connection returns.',
  },
  auth: {
    title: 'You are offline.',
    body: 'Connect to the internet to sign in or create an account.',
  },
}

/** Clear, persistent notice shown while the device has no connection. */
export function OfflineBanner({ context }: { context: OfflineContext }) {
  const online = useOnlineStatus()
  if (online) return null
  const message = OFFLINE_MESSAGES[context]
  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <WifiOff size={20} aria-hidden="true" className="offline-banner__icon" />
      <p>
        <strong>{message.title}</strong> {message.body}
      </p>
    </div>
  )
}
