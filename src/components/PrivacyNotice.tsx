import { CONSENT_VERSION } from '../lib/auth/api'

/**
 * Privacy notice shown at registration (Data Privacy Act of 2012, RA 10173).
 * Changing this text requires a new consent version in both the database
 * (public.current_consent_version) and CONSENT_VERSION.
 */
export function PrivacyNotice() {
  return (
    <section className="privacy-notice" aria-labelledby="privacy-notice-title">
      <h2 id="privacy-notice-title">Privacy notice (version {CONSENT_VERSION})</h2>
      <p>
        CuencaConnect is a capstone prototype for the Municipality of Cuenca, Batangas. In line with the
        Data Privacy Act of 2012 (Republic Act No. 10173), we collect only what is needed:
      </p>
      <ul>
        <li>
          <strong>Account data:</strong> email address, display name, and barangay, used to sign you in and
          send alerts for your area.
        </li>
        <li>
          <strong>Report data:</strong> the description, photos, and location of incidents you report, shared
          only with municipal administrators and the office handling the report.
        </li>
        <li>
          <strong>ID verification:</strong> a photo of a government ID, used only to verify you. We record the
          ID type and result, never the ID number, and delete the image 7 days after review.
        </li>
      </ul>
      <p>
        You may request access to, correction of, or deletion of your data through the municipal
        administrator. This prototype uses simulated data only.
      </p>
    </section>
  )
}
