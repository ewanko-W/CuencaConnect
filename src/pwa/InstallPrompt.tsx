import { useInstallPrompt } from './useInstallPrompt'

export function InstallPrompt() {
  const { canPrompt, showIosHint, promptInstall } = useInstallPrompt()

  if (canPrompt) {
    return (
      <div className="card install-card">
        <p>Install CuencaConnect on your phone for quick access to reports and alerts.</p>
        <button type="button" className="button button--primary" onClick={() => void promptInstall()}>
          Install app
        </button>
      </div>
    )
  }

  if (showIosHint) {
    return (
      <div className="card install-card">
        <p>
          To install on iPhone or iPad, tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
        </p>
      </div>
    )
  }

  return null
}
