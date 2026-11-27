import { useState, type FormEvent } from 'react'
import { SeverityBadge } from '../../components/admin/SeverityBadge'
import {
  addKeyword,
  deleteKeyword,
  fetchKeywords,
  fetchThresholds,
  previewTriage,
  updateKeyword,
  updateThresholds,
} from '../../lib/admin/api'
import {
  PRIORITY_LABELS,
  SEVERITIES,
  type CommunityThresholds,
  type Keyword,
  type KeywordLang,
  type Severity,
  type TriagePreview,
} from '../../lib/admin/types'
import { CATEGORY_INFO, REPORT_CATEGORIES, type ReportCategory } from '../../lib/reports/types'
import { useAsyncData } from '../../lib/useAsyncData'

const LANG_LABELS: Record<KeywordLang, string> = { en: 'English', fil: 'Filipino' }

export function KeywordsPage() {
  const keywords = useAsyncData(fetchKeywords, [])
  const [lang, setLang] = useState<KeywordLang>('fil')
  const [error, setError] = useState<string | null>(null)

  const list = (keywords.data ?? []).filter((k) => k.lang === lang)
  const counts = { en: 0, fil: 0 }
  for (const k of keywords.data ?? []) counts[k.lang] += 1

  async function run(action: () => Promise<void>) {
    setError(null)
    try {
      await action()
      keywords.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The change was not saved.')
    }
  }

  return (
    <section className="stack">
      <header className="page-header">
        <h1>Triage keywords</h1>
        <p className="muted">
          A report that contains a keyword (whole word or phrase) is raised to at least that priority. Critical keywords
          mark the report critical. Changes apply to new reports immediately.
        </p>
      </header>

      <div className="two-column two-column--wide-left">
        <section className="stack">
          <div className="tabs" role="tablist" aria-label="Keyword language">
            {(['fil', 'en'] as KeywordLang[]).map((l) => (
              <button
                key={l}
                type="button"
                role="tab"
                id={`tab-${l}`}
                aria-selected={lang === l}
                aria-controls="keyword-panel"
                className="tabs__tab"
                onClick={() => setLang(l)}
              >
                {LANG_LABELS[l]} ({counts[l]})
              </button>
            ))}
          </div>

          <div id="keyword-panel" role="tabpanel" aria-labelledby={`tab-${lang}`} className="stack">
            <AddKeywordForm lang={lang} onAdd={(input) => run(() => addKeyword(input))} />
            {error && (
              <p className="alert alert--error small" role="alert">
                {error}
              </p>
            )}
            <div className="table-wrap">
              <table className="data-table" aria-label={`${LANG_LABELS[lang]} keywords`}>
                <thead>
                  <tr>
                    <th scope="col">Term</th>
                    <th scope="col">Priority</th>
                    <th scope="col">Category hint</th>
                    <th scope="col">Active</th>
                    <th scope="col">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((k) => (
                    <KeywordRow key={k.id} keyword={k} onChange={run} />
                  ))}
                  {!keywords.loading && list.length === 0 && (
                    <tr>
                      <td colSpan={5} className="muted">
                        No {LANG_LABELS[lang]} keywords yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <div className="stack">
          <TriageTester />
          <ThresholdsCard />
        </div>
      </div>
    </section>
  )
}

function KeywordRow({ keyword: k, onChange }: { keyword: Keyword; onChange: (action: () => Promise<void>) => Promise<void> }) {
  return (
    <tr className={k.is_active ? undefined : 'is-muted'}>
      <th scope="row" className="term">
        {k.term}
      </th>
      <td>
        <select
          aria-label={`Priority for ${k.term}`}
          value={k.severity}
          onChange={(e) => void onChange(() => updateKeyword(k.id, { severity: e.target.value as Severity }))}
        >
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {PRIORITY_LABELS[s]}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select
          aria-label={`Category hint for ${k.term}`}
          value={k.category ?? ''}
          onChange={(e) =>
            void onChange(() => updateKeyword(k.id, { category: (e.target.value || null) as ReportCategory | null }))
          }
        >
          <option value="">None</option>
          {REPORT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_INFO[c].label}
            </option>
          ))}
        </select>
      </td>
      <td>
        <input
          type="checkbox"
          aria-label={`${k.term} is active`}
          checked={k.is_active}
          onChange={(e) => void onChange(() => updateKeyword(k.id, { is_active: e.target.checked }))}
        />
      </td>
      <td>
        <button
          type="button"
          className="button button--small button--danger"
          aria-label={`Delete ${k.term}`}
          onClick={() => {
            if (window.confirm(`Delete the keyword "${k.term}"?`)) void onChange(() => deleteKeyword(k.id))
          }}
        >
          Delete
        </button>
      </td>
    </tr>
  )
}

export function AddKeywordForm({
  lang,
  onAdd,
}: {
  lang: KeywordLang
  onAdd: (input: { term: string; lang: KeywordLang; category: ReportCategory | null; severity: Severity }) => Promise<void>
}) {
  const [term, setTerm] = useState('')
  const [severity, setSeverity] = useState<Severity>('high')
  const [category, setCategory] = useState<ReportCategory | ''>('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (term.trim().length < 2) return
    await onAdd({ term: term.trim().toLowerCase(), lang, category: category || null, severity })
    setTerm('')
  }

  return (
    <form className="card inline-form" onSubmit={submit} aria-label={`Add ${LANG_LABELS[lang]} keyword`}>
      <label className="field field--inline field--grow">
        <span>New {LANG_LABELS[lang]} keyword or phrase</span>
        <input value={term} maxLength={60} onChange={(e) => setTerm(e.target.value)} placeholder={lang === 'fil' ? 'hal. gumuho' : 'e.g. collapsed'} />
      </label>
      <label className="field field--inline">
        <span>Priority</span>
        <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {PRIORITY_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="field field--inline">
        <span>Category hint</span>
        <select value={category} onChange={(e) => setCategory(e.target.value as ReportCategory | '')}>
          <option value="">None</option>
          {REPORT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_INFO[c].label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="button button--primary" disabled={term.trim().length < 2}>
        Add
      </button>
    </form>
  )
}

function TriageTester() {
  const [text, setText] = useState('')
  const [category, setCategory] = useState<ReportCategory>('other')
  const [result, setResult] = useState<TriagePreview | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      setResult(await previewTriage(text, category))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed.')
    }
  }

  return (
    <form className="card stack" onSubmit={submit} aria-labelledby="tester-title">
      <h2 id="tester-title">Test the lists</h2>
      <label className="field">
        <span>Sample report text</span>
        <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="May sunog sa likod ng palengke…" />
      </label>
      <label className="field">
        <span>Category chosen by the resident</span>
        <select value={category} onChange={(e) => setCategory(e.target.value as ReportCategory)}>
          {REPORT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_INFO[c].label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="button" disabled={!text.trim()}>
        Preview triage
      </button>
      {error && <p className="alert alert--error small">{error}</p>}
      {result && (
        <dl className="details" aria-label="Triage result">
          <dt>Priority</dt>
          <dd>
            <SeverityBadge severity={result.severity} />
          </dd>
          <dt>Matched</dt>
          <dd>{result.matched_keywords.length ? result.matched_keywords.join(', ') : 'No keywords'}</dd>
          <dt>Suggested office</dt>
          <dd>{result.suggested_office_name ?? 'None'}</dd>
        </dl>
      )}
    </form>
  )
}

export function ThresholdsCard() {
  const current = useAsyncData(fetchThresholds, [])
  return current.data ? (
    <ThresholdsForm key={current.data.updated_at} initial={current.data} onSaved={current.reload} />
  ) : (
    <section className="card">
      <h2>Community verification</h2>
      <p className="muted small">{current.error ?? 'Loading…'}</p>
    </section>
  )
}

function ThresholdsForm({ initial, onSaved }: { initial: CommunityThresholds; onSaved: () => void }) {
  const [values, setValues] = useState({
    min_confirms: initial.min_confirms,
    min_disputes: initial.min_disputes,
    dominance_ratio: Number(initial.dominance_ratio),
  })
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      await updateThresholds(values)
      setMessage({ kind: 'success', text: 'Saved. All reports were re-evaluated with the new thresholds.' })
      onSaved()
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Not saved.' })
    } finally {
      setBusy(false)
    }
  }

  const number = (key: keyof typeof values, label: string, min: number, max: number, step = 1) => (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={values[key]}
        onChange={(e) => setValues((v) => ({ ...v, [key]: Number(e.target.value) }))}
        required
      />
    </label>
  )

  return (
    <form className="card stack" onSubmit={submit} aria-labelledby="thresholds-title">
      <h2 id="thresholds-title">Community verification</h2>
      <p className="muted small">
        A report is <strong>community-confirmed</strong> when it has at least {values.min_confirms} confirmations and{' '}
        {values.dominance_ratio}× as many confirmations as disputes. It is <strong>disputed</strong> when it has at
        least {values.min_disputes} disputes and {values.dominance_ratio}× as many disputes as confirmations. Disputed
        routine reports are hidden from the residents&apos; map; <strong>critical reports are never hidden</strong>.
      </p>
      <div className="inline-form">
        {number('min_confirms', 'Confirmations needed', 1, 100)}
        {number('min_disputes', 'Disputes needed', 1, 100)}
        {number('dominance_ratio', 'Ratio', 1, 10, 0.5)}
      </div>
      {message && (
        <p className={`alert alert--${message.kind} small`} role={message.kind === 'error' ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
      <button type="submit" className="button button--primary" disabled={busy}>
        {busy ? 'Saving…' : 'Save thresholds'}
      </button>
    </form>
  )
}
