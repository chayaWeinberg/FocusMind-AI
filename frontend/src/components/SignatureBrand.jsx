export default function SignatureBrand({ href = '/dashboard' }) {
  return (
    <a className="signature-brand" href={href} aria-label="FocusMind AI">
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M24 37c-10-2-15-9-13-19 9 1 14 6 14 14 2-12 9-18 20-18-1 14-8 22-21 23Z" />
        <path d="M12 39h25M19 11a11 11 0 0 1 11 0" />
        <circle cx="24" cy="22" r="2.5" />
      </svg>
      <span>
        <strong>FocusMind AI</strong>
        <small>מרחב ללמוד, לצמוח, להצליח</small>
      </span>
    </a>
  );
}
