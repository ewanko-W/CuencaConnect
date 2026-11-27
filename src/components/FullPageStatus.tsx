import type { ReactNode } from 'react'

export function FullPageStatus({ children }: { children: ReactNode }) {
  return (
    <main className="full-page-status" role="status" aria-live="polite">
      {children}
    </main>
  )
}
