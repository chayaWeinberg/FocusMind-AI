import { useEffect, useState } from 'react';

const REFRESH_INTERVAL_MS = 400;

const stabilityLabels = {
  stable: 'יציב יחסית',
  'some-movement': 'נרשמה תנועה',
  variable: 'תנועה משתנה',
  'insufficient-data': 'נתונים לא מספיקים',
};

function summariesMatch(left, right) {
  return left?.validMeasurements === right?.validMeasurements
    && left?.totalMeasurements === right?.totalMeasurements
    && left?.reliablePercentage === right?.reliablePercentage
    && left?.averageMovementMagnitude === right?.averageMovementMagnitude
    && left?.averageMovementRate === right?.averageMovementRate
    && left?.significantMovementCount === right?.significantMovementCount
    && left?.gazeStability === right?.gazeStability
    && left?.insufficientData === right?.insufficientData;
}

function formatNumber(value) {
  return Number.isFinite(value) ? value.toFixed(3) : '—';
}

export default function EyeMovementDiagnostic({
  cameraAvailable,
  videoPlaybackState,
  summaryRef,
}) {
  const [summary, setSummary] = useState(null);
  const trackingActive = cameraAvailable && videoPlaybackState === 'playing';

  useEffect(() => {
    if (!trackingActive || !summaryRef) {
      setSummary((currentSummary) => (currentSummary === null ? currentSummary : null));
      return undefined;
    }

    function refreshSummary() {
      const latestSummary = summaryRef.current;
      setSummary((currentSummary) => (
        summariesMatch(currentSummary, latestSummary) ? currentSummary : latestSummary
      ));
    }

    refreshSummary();
    const intervalId = window.setInterval(refreshSummary, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [trackingActive, summaryRef]);

  const insufficientData = !summary || summary.insufficientData;
  const statusState = !cameraAvailable
    ? 'unavailable'
    : videoPlaybackState !== 'playing'
      ? 'paused'
      : insufficientData
        ? 'insufficient'
        : 'active';
  const statusText = {
    unavailable: 'המצלמה אינה זמינה',
    paused: 'המעקב מושהה',
    insufficient: 'נתונים לא מספיקים',
    active: 'המעקב פעיל · מדידה ניסיונית בלבד',
  }[statusState];
  return (
    <section className="eye-movement-diagnostic" aria-label="מעקב תנועות עיניים">
      <div className="eye-gaze-diagnostic-heading">
        <strong>מעקב תנועות עיניים</strong>
        <span>חלון של 10 שניות</span>
      </div>
      <p className={`eye-movement-status eye-movement-status--${statusState}`} role="status">
        {statusText}
      </p>
      <dl className="eye-gaze-values eye-movement-values">
        <div>
          <dt>מדידות אמינות</dt>
          <dd>
            {summary
              ? `${summary.reliablePercentage.toFixed(0)}% (${summary.validMeasurements}/${summary.totalMeasurements})`
              : '—'}
          </dd>
        </div>
        <div>
          <dt>ממוצע תנועה לנקודה</dt>
          <dd>{!insufficientData ? formatNumber(summary.averageMovementMagnitude) : '—'}</dd>
        </div>
        <div>
          <dt>קצב תנועה ממוצע לשנייה</dt>
          <dd>{!insufficientData ? formatNumber(summary.averageMovementRate) : '—'}</dd>
        </div>
        <div>
          <dt>שינויים משמעותיים</dt>
          <dd>{summary ? summary.significantMovementCount : '—'}</dd>
        </div>
        <div>
          <dt>יציבות מבט</dt>
          <dd>{stabilityLabels[summary?.gazeStability] || stabilityLabels['insufficient-data']}</dd>
        </div>
      </dl>
      <p className="eye-movement-disclaimer">
        מבוסס על דגימה של כ-5 פעמים בשנייה; אינו מודד קשב ואינו מיועד לזיהוי תנועות עיניים מהירות.
      </p>
    </section>
  );
}
