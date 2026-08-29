/**
 * The manual escape hatch for useAppUpdate: shown when a new build is out but
 * the window has stayed in the foreground, so an auto-reload would risk eating
 * something half-written. Tapping it reloads.
 */
export default function UpdateBanner({ show }) {
  if (!show) return null;
  return (
    <button
      type="button"
      className="app-update-banner"
      onClick={() => window.location.reload()}
    >
      A new version is ready — tap to refresh
    </button>
  );
}
