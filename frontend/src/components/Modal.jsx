import { useEffect, useId, useRef } from 'react';
import './Modal.css';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog. It never closes by itself: the parent decides (for
 * example only after the server confirmed a save). While `busy`, Escape, the
 * backdrop and the close button are disabled so a request is not abandoned.
 * Focus moves into the dialog, stays there, and returns to the opener.
 */
export default function Modal({ title, description, onClose, busy = false, children }) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement;
    const dialog = dialogRef.current;
    const first = dialog?.querySelector('input, select, textarea') || dialog?.querySelector(FOCUSABLE);
    first?.focus();

    function handleKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!busyRef.current) closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const items = [...dialog.querySelectorAll(FOCUSABLE)];
      if (items.length === 0) return;
      const [head, tail] = [items[0], items[items.length - 1]];
      if (event.shiftKey && document.activeElement === head) {
        event.preventDefault();
        tail.focus();
      } else if (!event.shiftKey && document.activeElement === tail) {
        event.preventDefault();
        head.focus();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  return (
    <div
      className="fm-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busyRef.current) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="fm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        aria-busy={busy || undefined}
      >
        <header className="fm-modal-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="fm-modal-close" onClick={onClose} disabled={busy} aria-label="סגירת החלון">×</button>
        </header>
        {description && <p id={descriptionId} className="fm-modal-description">{description}</p>}
        {children}
      </div>
    </div>
  );
}
