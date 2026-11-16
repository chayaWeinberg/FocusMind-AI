import { useState } from 'react';

/**
 * Two-step button for destructive actions: the first click asks for
 * confirmation in place (no browser dialog), the second performs it.
 */
export default function ConfirmButton({
  label,
  confirmLabel,
  question,
  onConfirm,
  busy = false,
  className = 'signature-secondary-button course-danger-outline',
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" className={className} onClick={() => setAsking(true)} disabled={busy}>
        {label}
      </button>
    );
  }
  return (
    <span className="course-confirm" role="group" aria-label={question}>
      <span>{question}</span>
      <button
        type="button"
        className="signature-primary-button course-danger-button"
        disabled={busy}
        onClick={async () => {
          await onConfirm();
          setAsking(false);
        }}
      >
        {busy ? 'רגע…' : confirmLabel}
      </button>
      <button type="button" className="signature-secondary-button" onClick={() => setAsking(false)} disabled={busy}>ביטול</button>
    </span>
  );
}
