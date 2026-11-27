import { useState, type FormEvent } from 'react'
import { broadcastAlert, fetchAllAlerts, setAlertActive } from '../../lib/admin/api'
import type { AlertInput } from '../../lib/admin/types'
import { validateAlert } from '../../lib/admin/validateAlert'
import { LEVEL_LABELS, type AlertLevel } from '../../lib/alerts/types'
import { fetchBarangays } from '../../lib/auth/api'
import type { Barangay } from '../../lib/auth/types'
import { formatDateTime } from '../../lib/format'
import { useAsyncData } from '../../lib/useAsyncData'

const EMPTY: AlertInput = {
  title: '',
  body: '',
  level: 'advisory',
  scope: 'municipality',
  targetBarangayIds: [],
  expiresInHours: 24,
}

export function AdminAlertsPage() {
  const alerts = useAsyncData(fetchAllAlerts, [])
  const barangays = useAsyncData(fetchBarangays, [])
  const names = new Map((barangays.data ?? []).map((b) => [b.id, b.name]))

  return (
    <section className="stack">
      <header className="page-header">
        <h1>Alerts</h1>
        <p className="muted">Broadcast advisories, warnings, and emergencies to residents. Delivered live to the app.</p>
      </header>
      <div className="two-column">
        <AlertComposer barangays={barangays.data ?? []} onSent={alerts.reload} />
        <section className="stack" aria-labelledby="sent-title">
          <h2 id="sent-title">Recent alerts</h2>
          {alerts.error && <p className="alert alert--error">{alerts.error}</p>}
          {(alerts.data ?? []).map((a) => {
            const expired = a.expires_at !== null && new Date(a.expires_at) < new Date()
            return (
              <article key={a.id} className={`card alert-card alert-card--${a.level}${a.is_active && !expired ? '' : ' is-muted'}`}>
                <div className="report-header">
                  <span className={`badge badge--${a.level}`}>{LEVEL_LABELS[a.level]}</span>
                  <span className="small muted">
                    {!a.is_active ? 'Deactivated' : expired ? 'Expired' : 'Active'}
                  </span>
                </div>
                <h3>{a.title}</h3>
                <p className="small">{a.body}</p>
                <p className="muted small">
                  {a.scope === 'municipality'
                    ? 'All of Cuenca'
                    : a.target_barangay_ids.map((id) => names.get(id) ?? `#${id}`).join(', ')}{' '}
                  · {formatDateTime(a.starts_at)}
                  {a.expires_at && ` → ${formatDateTime(a.expires_at)}`}
                </p>
                {a.is_active && !expired && (
                  <button
                    type="button"
                    className="button button--small"
                    onClick={() => {
                      if (window.confirm('Deactivate this alert? Residents will no longer see it.'))
                        void setAlertActive(a.id, false).then(alerts.reload)
                    }}
                  >
                    Deactivate
                  </button>
                )}
              </article>
            )
          })}
        </section>
      </div>
    </section>
  )
}

export function AlertComposer({ barangays, onSent }: { barangays: Barangay[]; onSent: () => void }) {
  const [input, setInput] = useState<AlertInput>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof AlertInput>(key: K, value: AlertInput[K]) => setInput((i) => ({ ...i, [key]: value }))

  function toggleBarangay(id: number) {
    set(
      'targetBarangayIds',
      input.targetBarangayIds.includes(id) ? input.targetBarangayIds.filter((b) => b !== id) : [...input.targetBarangayIds, id],
    )
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSent(false)
    const problem = validateAlert(input)
    setError(problem)
    if (problem) return
    const audience =
      input.scope === 'municipality' ? 'ALL residents of Cuenca' : `${input.targetBarangayIds.length} barangay(s)`
    if (!window.confirm(`Broadcast this ${LEVEL_LABELS[input.level].toLowerCase()} to ${audience}?`)) return
    setBusy(true)
    try {
      await broadcastAlert(input)
      setInput(EMPTY)
      setSent(true)
      onSent()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The alert was not sent.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card stack" onSubmit={submit} aria-labelledby="compose-title" noValidate>
      <h2 id="compose-title">New alert</h2>
      <fieldset className="segmented">
        <legend>Level</legend>
        {(['advisory', 'warning', 'emergency'] as AlertLevel[]).map((level) => (
          <label key={level} className={`segmented__option segmented__option--${level}`}>
            <input type="radio" name="level" checked={input.level === level} onChange={() => set('level', level)} />
            {LEVEL_LABELS[level]}
          </label>
        ))}
      </fieldset>
      <label className="field">
        <span>Title</span>
        <input value={input.title} maxLength={120} onChange={(e) => set('title', e.target.value)} />
      </label>
      <label className="field">
        <span>Message</span>
        <textarea rows={4} maxLength={2000} value={input.body} onChange={(e) => set('body', e.target.value)} />
      </label>
      <fieldset className="segmented">
        <legend>Send to</legend>
        <label className="segmented__option">
          <input type="radio" name="scope" checked={input.scope === 'municipality'} onChange={() => set('scope', 'municipality')} />
          All of Cuenca
        </label>
        <label className="segmented__option">
          <input type="radio" name="scope" checked={input.scope === 'barangay'} onChange={() => set('scope', 'barangay')} />
          Selected barangays
        </label>
      </fieldset>
      {input.scope === 'barangay' && (
        <fieldset className="checkbox-grid">
          <legend>Barangays</legend>
          {barangays.map((b) => (
            <label key={b.id} className="checkbox">
              <input type="checkbox" checked={input.targetBarangayIds.includes(b.id)} onChange={() => toggleBarangay(b.id)} />
              <span>{b.name}</span>
            </label>
          ))}
        </fieldset>
      )}
      <label className="field">
        <span>Expires after</span>
        <select
          value={input.expiresInHours ?? ''}
          onChange={(e) => set('expiresInHours', e.target.value ? Number(e.target.value) : null)}
        >
          <option value="6">6 hours</option>
          <option value="24">24 hours</option>
          <option value="72">3 days</option>
          <option value="168">7 days</option>
          <option value="">No expiry (deactivate manually)</option>
        </select>
      </label>
      {error && (
        <p className="alert alert--error small" role="alert">
          {error}
        </p>
      )}
      {sent && (
        <p className="alert alert--success small" role="status">
          Alert broadcast. Residents will see it immediately.
        </p>
      )}
      <button type="submit" className="button button--primary" disabled={busy}>
        {busy ? 'Sending…' : 'Broadcast alert'}
      </button>
    </form>
  )
}
