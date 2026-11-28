import { Phone } from 'lucide-react'
import { fetchOffices, telHref } from '../../lib/directory/api'
import { useAsyncData } from '../../lib/useAsyncData'

export function DirectoryPage() {
  const { data, error, loading, reload } = useAsyncData(fetchOffices, [])

  return (
    <section className="stack">
      <h1>Hotlines and offices</h1>

      <a className="card hotline hotline--emergency" href="tel:911">
        <span>
          <strong>National Emergency Hotline</strong>
          <span className="muted small"> · police, fire, medical</span>
        </span>
        <span className="hotline__number with-icon">
          <Phone size={22} aria-hidden="true" />
          911
        </span>
      </a>

      {loading && !data && <p role="status">Loading offices…</p>}
      {error && (
        <div className="alert alert--error" role="alert">
          <p>{error}</p>
          <button type="button" className="button button--small" onClick={reload}>
            Try again
          </button>
        </div>
      )}

      {data && (
        <ul className="list" aria-label="Municipal offices">
          {data.map((office) => (
            <li key={office.id} className="card office">
              <div>
                <strong>{office.name}</strong>
                <span className="muted small"> ({office.code})</span>
                {office.contact_info && <p className="muted small">{office.contact_info}</p>}
              </div>
              {office.hotline ? (
                <a className="button button--primary" href={telHref(office.hotline)} aria-label={`Call ${office.name}`}>
                  <Phone size={18} aria-hidden="true" />
                  {office.hotline}
                </a>
              ) : (
                <span className="muted small">No hotline listed</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">Prototype: the office numbers are sample data, not real hotlines.</p>
    </section>
  )
}
