import { useCallback, useEffect, useRef, useState } from 'react';
import './Modal.css';

export const NOTICE_MS = 7000;

/** A short-lived success notice: `[notice, show, clear]`. */
export function useNotice() {
  const [notice, setNotice] = useState(null);
  const timer = useRef(null);
  const clear = useCallback(() => {
    window.clearTimeout(timer.current);
    setNotice(null);
  }, []);
  const show = useCallback((message, link = null) => {
    window.clearTimeout(timer.current);
    setNotice({ message, link, id: Date.now() });
    timer.current = window.setTimeout(() => setNotice(null), NOTICE_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return [notice, show, clear];
}

export default function Notice({ notice, onClose }) {
  if (!notice) return null;
  return (
    <div className="fm-notice" role="status">
      <span>
        <span aria-hidden="true">✓ </span>
        {notice.message}
        {notice.link && <> <a href={notice.link.href}>{notice.link.label}</a></>}
      </span>
      <button type="button" onClick={onClose} aria-label="סגירת ההודעה">×</button>
    </div>
  );
}
