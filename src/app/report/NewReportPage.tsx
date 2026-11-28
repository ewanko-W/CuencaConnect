import { CategoryIcon } from '../../components/icons/CategoryLabel'
import { Camera, LocateFixed, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LocationPicker } from '../../components/map/LocationPicker'
import { VerificationGate } from '../../components/VerificationGate'
import { fetchBarangays } from '../../lib/auth/api'
import { useAuth } from '../../lib/auth/AuthContext'
import { CUENCA_CENTER, isWithinCuenca, type LatLng } from '../../lib/geo/cuenca'
import { describeAccuracy, isUsableFix, useGeolocation } from '../../lib/geo/useGeolocation'
import { prepareImage } from '../../lib/reports/image'
import { validatePhoto } from '../../lib/reports/photoValidation'
import { useOutbox } from '../../lib/reports/OutboxContext'
import { submitOrSave } from '../../lib/reports/submitOrSave'
import { useAsyncData } from '../../lib/useAsyncData'
import {
  CATEGORY_INFO,
  REPORT_CATEGORIES,
  type LocationSource,
  type ReportCategory,
  type ReportDraft,
} from '../../lib/reports/types'
import {
  DESCRIPTION_MAX,
  MAX_PHOTOS,
  validateReportForm,
  type ReportFormErrors,
} from '../../lib/reports/validation'

interface Photo {
  blob: Blob
  url: string
}

export function NewReportPage() {
  return (
    <section className="stack">
      <h1>Report an incident</h1>
      <VerificationGate feature="Reporting">
        <ReportForm />
      </VerificationGate>
    </section>
  )
}

function ReportForm() {
  const { session, profile } = useAuth()
  const barangays = useAsyncData(fetchBarangays, [])
  const [barangayId, setBarangayId] = useState<number | null>(profile?.barangay_id ?? null)
  const outbox = useOutbox()
  const navigate = useNavigate()
  const { state: geo, locate, fix: rawFix } = useGeolocation({ auto: true })
  // An approximate (network-based) fix is shown as a hint, never used as the pin.
  const gpsFix = isUsableFix(rawFix) ? rawFix : null
  const approximateFix = rawFix && !gpsFix ? rawFix : null

  // The pin follows the GPS fix until the user drags it or taps the map.
  const [manualLocation, setManualLocation] = useState<LatLng | null>(null)
  const location: LatLng | null = manualLocation ?? (gpsFix ? { lat: gpsFix.lat, lng: gpsFix.lng } : null)
  const locationSource: LocationSource = manualLocation ? (gpsFix ? 'adjusted' : 'manual') : 'gps'
  const [category, setCategory] = useState<ReportCategory | null>(null)
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [errors, setErrors] = useState<ReportFormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const locateMe = useCallback(() => {
    setManualLocation(null) // follow the new GPS fix
    void locate()
  }, [locate])

  // Free object URLs for photo previews when leaving the page.
  const photosRef = useRef(photos)
  useEffect(() => {
    photosRef.current = photos
  }, [photos])
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), [])

  const moveLocation = useCallback((p: LatLng) => setManualLocation(p), [])

  async function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, MAX_PHOTOS - photos.length)
    event.target.value = '' // allow taking the same photo again
    const prepared = await Promise.all(files.map((f) => prepareImage(f)))
    const problems = prepared.map(validatePhoto).filter((p): p is string => p !== null)
    setPhotoError(problems[0] ?? null)
    const accepted = prepared.filter((blob) => validatePhoto(blob) === null)
    setPhotos((current) => [...current, ...accepted.map((blob) => ({ blob, url: URL.createObjectURL(blob) }))])
  }

  function removePhoto(index: number) {
    setPhotos((current) => {
      URL.revokeObjectURL(current[index].url)
      return current.filter((_, i) => i !== index)
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitError(null)
    const found = validateReportForm({ category, description, location, photoCount: photos.length })
    setErrors(found)
    if (Object.keys(found).length > 0 || !location || !category || !session) return

    const draft: ReportDraft = {
      clientUuid: crypto.randomUUID(),
      userId: session.user.id,
      category,
      description: description.trim(),
      lat: location.lat,
      lng: location.lng,
      accuracy: locationSource === 'gps' && gpsFix ? gpsFix.accuracy : null,
      locationSource,
      barangayId,
      photos: photos.map((p) => p.blob),
      createdAt: new Date().toISOString(),
      attempts: 0,
      lastError: null,
    }

    setSubmitting(true)
    try {
      const outcome = await submitOrSave(draft)
      if (outcome.kind === 'sent') {
        navigate(`/app/reports/${outcome.reportId}`, { state: { justSubmitted: true } })
      } else {
        await outbox.refresh()
        setSavedMessage(outcome.message)
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'The report could not be sent.')
    } finally {
      setSubmitting(false)
    }
  }

  if (savedMessage) {
    return (
      <div className="card stack" role="status">
        <h2>Saved on this device</h2>
        <p>{savedMessage} It will be sent automatically when you are back online, or you can retry from My reports.</p>
        <Link className="button button--primary" to="/app/reports">
          Go to My reports
        </Link>
      </div>
    )
  }

  const outsideCuenca = location !== null && !isWithinCuenca(location)

  return (
    <form className="stack report-form" onSubmit={handleSubmit} noValidate>
      {/* 1. Location */}
      <fieldset className="card">
        <legend>Where is it?</legend>
        <LocationPicker
          value={location}
          accuracy={locationSource === 'gps' && gpsFix ? gpsFix.accuracy : null}
          recenterOn={gpsFix}
          fallbackCenter={CUENCA_CENTER}
          onChange={moveLocation}
        />
        <div className="location-status" aria-live="polite">
          {geo.status === 'locating' && <p className="muted small">Finding your location…</p>}
          {geo.status === 'error' && <p className="alert alert--warning small">{geo.message}</p>}
          {approximateFix && !manualLocation && (
            <p className="alert alert--warning small">
              Your device gave only an approximate location ({describeAccuracy(approximateFix.accuracy)}). Tap the map
              or drag the pin to where the incident is.
            </p>
          )}
          {location && (
            <p className="muted small">
              {locationSource === 'gps' && gpsFix
                ? `GPS location (accuracy about ${Math.round(gpsFix.accuracy)} m). Drag the pin if it is off.`
                : 'Pin placed manually.'}
            </p>
          )}
          {!location && geo.status !== 'locating' && (
            <p className="muted small">Tap the map to place the pin.</p>
          )}
          {outsideCuenca && <p className="field-error small">This spot is outside Cuenca.</p>}
          {errors.location && <p className="field-error small">{errors.location}</p>}
        </div>
        <button type="button" className="button button--small" onClick={locateMe}>
          <LocateFixed size={18} aria-hidden="true" />
          Use my current location
        </button>
        <label className="field">
          <span>Barangay where it happened</span>
          <select
            value={barangayId ?? ''}
            onChange={(e) => setBarangayId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Not sure (use my barangay)</option>
            {(barangays.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      {/* 2. Photo */}
      <fieldset className="card">
        <legend>Photo (optional, up to {MAX_PHOTOS})</legend>
        <input
          ref={fileInput}
          className="visually-hidden"
          type="file"
          accept="image/*"
          capture="environment"
          aria-label="Take a photo"
          onChange={(e) => void addPhotos(e)}
        />
        <div className="photo-grid">
          {photos.map((photo, i) => (
            <figure key={photo.url} className="photo-thumb">
              <img src={photo.url} alt={`Photo ${i + 1}`} />
              <button type="button" className="photo-thumb__remove" onClick={() => removePhoto(i)} aria-label={`Remove photo ${i + 1}`}>
                <X size={18} aria-hidden="true" />
              </button>
            </figure>
          ))}
        </div>
        {photoError && (
          <p className="field-error small" role="alert">
            {photoError}
          </p>
        )}
        {photos.length < MAX_PHOTOS && (
          <button type="button" className="button" onClick={() => fileInput.current?.click()}>
            <Camera size={18} aria-hidden="true" />
            Take photo
          </button>
        )}
      </fieldset>

      {/* 3. Category */}
      <fieldset className="card">
        <legend>What happened?</legend>
        <div className="category-grid" role="radiogroup" aria-label="Category">
          {REPORT_CATEGORIES.map((c) => (
            <label key={c} className={`category-option${category === c ? ' category-option--selected' : ''}`}>
              <input
                type="radio"
                name="category"
                value={c}
                checked={category === c}
                onChange={() => setCategory(c)}
                className="visually-hidden"
              />
              <span className="category-option__icon">
                <CategoryIcon category={c} size={22} />
              </span>
              <span className="category-option__text">
                {CATEGORY_INFO[c].label}
                <small className="muted"> / {CATEGORY_INFO[c].filipino}</small>
              </span>
            </label>
          ))}
        </div>
        {errors.category && <p className="field-error small">{errors.category}</p>}
      </fieldset>

      {/* 4. Description */}
      <fieldset className="card">
        <legend>Describe it</legend>
        <label className="field">
          <span className="visually-hidden">Description</span>
          <textarea
            rows={4}
            maxLength={DESCRIPTION_MAX}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is happening? Is anyone hurt? Any landmarks?"
            aria-invalid={Boolean(errors.description)}
          />
        </label>
        <p className="muted small">
          {description.trim().length}/{DESCRIPTION_MAX}. Do not include other people's names or personal details.
        </p>
        {errors.description && <p className="field-error small">{errors.description}</p>}
      </fieldset>

      {submitError && (
        <p className="alert alert--error" role="alert">
          {submitError}
        </p>
      )}

      <button type="submit" className="button button--primary button--block" disabled={submitting}>
        {submitting ? 'Sending…' : 'Send report'}
      </button>
    </form>
  )
}
