import { useEffect, useState } from 'react';
import { RECORDING_DURATION_MS } from './screenAttentionDiagnosticRecorder.js';

const REFRESH_INTERVAL_MS = 400;

const stateLabels = {
  LIKELY_ON_SCREEN: 'כנראה מול המסך',
  LIKELY_OFF_SCREEN: 'כנראה לא מול המסך',
  UNKNOWN: 'לא ידוע',
};

const qualityLabels = {
  reliable: 'טובה',
  degraded: 'מוגבלת',
  unreliable: 'לא זמינה',
};

function summariesMatch(left, right) {
  return left?.currentState === right?.currentState
    && left?.onScreenMs === right?.onScreenMs
    && left?.offScreenMs === right?.offScreenMs
    && left?.unknownMs === right?.unknownMs
    && left?.measurementQuality === right?.measurementQuality
    && left?.qualityScore === right?.qualityScore;
}

function formatDuration(milliseconds = 0) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

function formatRelativeTimestamp(milliseconds) {
  return Number.isFinite(milliseconds) ? `${(milliseconds / 1000).toFixed(2)}s` : '—';
}

function formatValue(value) {
  return Number.isFinite(value) ? value.toFixed(3) : '—';
}

export default function ScreenAttentionDiagnostic({
  cameraAvailable,
  videoPlaybackState,
  summaryRef,
  recorderRef,
  startRecording,
  stopRecording,
  resetRecording,
}) {
  const [summary, setSummary] = useState(null);
  const [recordingSnapshot, setRecordingSnapshot] = useState(null);
  const [exportError, setExportError] = useState('');
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

  useEffect(() => {
    if (!recorderRef) return undefined;
    function refreshRecording() {
      const nextSnapshot = recorderRef.current?.getSnapshot() ?? null;
      setRecordingSnapshot((currentSnapshot) => (
        JSON.stringify(currentSnapshot) === JSON.stringify(nextSnapshot)
          ? currentSnapshot
          : nextSnapshot
      ));
    }

    refreshRecording();
    const intervalId = window.setInterval(refreshRecording, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [recorderRef]);

  function handleStartRecording() {
    if (startRecording?.()) {
      setExportError('');
      setRecordingSnapshot(recorderRef.current.getSnapshot());
    }
  }

  function handleStopRecording() {
    stopRecording?.();
    setRecordingSnapshot(recorderRef?.current?.getSnapshot() ?? null);
  }

  function handleResetRecording() {
    resetRecording?.();
    setExportError('');
    setRecordingSnapshot(recorderRef?.current?.getSnapshot() ?? null);
  }

  function handleDownload() {
    const recorder = recorderRef?.current;
    if (!recorder || !recordingSnapshot?.totalSamples) return;
    if (typeof URL.createObjectURL !== 'function') {
      setExportError('הדפדפן אינו תומך בהורדת קובץ JSON.');
      return;
    }
    const file = new Blob([recorder.serialize()], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'screen-attention-diagnostic.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setExportError('');
  }

  const currentState = summary?.currentState ?? 'UNKNOWN';
  const statusText = !cameraAvailable
    ? 'המצלמה אינה זמינה'
    : videoPlaybackState !== 'playing'
      ? 'המעקב מושהה'
      : 'הערכה ניסיונית בלבד';

  return (
    <section className="screen-attention-diagnostic" aria-label="אבחון כיוון למסך">
      <div className="eye-gaze-diagnostic-heading">
        <strong>כיוון משוער למסך</strong>
        <span>חלון של 10 שניות</span>
      </div>
      <p className="screen-attention-status" role="status">{statusText}</p>
      <p className="screen-attention-current" aria-live="polite">
        מצב נוכחי: <strong>{stateLabels[currentState] || stateLabels.UNKNOWN}</strong>
      </p>
      <dl className="eye-gaze-values screen-attention-values">
        <div>
          <dt>זמן משוער מול המסך</dt>
          <dd>{formatDuration(summary?.onScreenMs)}</dd>
        </div>
        <div>
          <dt>זמן משוער מחוץ למסך</dt>
          <dd>{formatDuration(summary?.offScreenMs)}</dd>
        </div>
        <div>
          <dt>זמן לא ידוע</dt>
          <dd>{formatDuration(summary?.unknownMs)}</dd>
        </div>
        <div>
          <dt>איכות מדידה</dt>
          <dd>{qualityLabels[summary?.measurementQuality] || qualityLabels.unreliable}</dd>
        </div>
      </dl>
      <p className="screen-attention-disclaimer">
        הערכה ניסיונית של כיוון חזותי בלבד; מבט למסך אינו מעיד על ריכוז ואינו מדידת מבט מכוילת.
      </p>
      <div className="screen-attention-recording">
        <strong>הקלטת אבחון מסונכרנת (עד 10 שניות)</strong>
        <div className="screen-attention-recording-buttons">
          <button
            type="button"
            onClick={handleStartRecording}
            disabled={!trackingActive || recordingSnapshot?.recording}
          >
            התחלת בדיקה
          </button>
          <button
            type="button"
            onClick={handleStopRecording}
            disabled={!recordingSnapshot?.recording}
          >
            עצירת בדיקה
          </button>
          <button
            type="button"
            onClick={handleResetRecording}
            disabled={!recordingSnapshot?.totalSamples && !recordingSnapshot?.recording}
          >
            איפוס בדיקה
          </button>
        </div>
        <p className="screen-attention-recording-status" role="status">
          {recordingSnapshot?.recording
            ? `הבדיקה פעילה · ${formatRelativeTimestamp(Math.min(
              RECORDING_DURATION_MS,
              performance.now() - recordingSnapshot.startedAt,
            ))} / 10.00s`
            : recordingSnapshot?.totalSamples
              ? 'הבדיקה הסתיימה'
              : trackingActive
                ? 'מוכן לבדיקה'
                : 'ניתן להתחיל רק כשהמצלמה פעילה והסרטון מתנגן'}
        </p>
        <dl className="eye-gaze-values screen-attention-recording-counts">
          <div><dt>דגימות</dt><dd>{recordingSnapshot?.totalSamples ?? 0}</dd></div>
          <div><dt>אמינות עיניים</dt><dd>{recordingSnapshot?.reliableSamples ?? 0}</dd></div>
          <div><dt>ON_SCREEN</dt><dd>{recordingSnapshot?.onScreenSamples ?? 0}</dd></div>
          <div><dt>OFF_SCREEN</dt><dd>{recordingSnapshot?.offScreenSamples ?? 0}</dd></div>
          <div><dt>UNKNOWN</dt><dd>{recordingSnapshot?.unknownSamples ?? 0}</dd></div>
        </dl>
        {recordingSnapshot?.samples.length > 0 && (
          <details className="screen-attention-recording-details">
            <summary>פרטי דגימות הבדיקה</summary>
            <ol>
              {recordingSnapshot.samples.map((sample, index) => (
                <li key={`${sample.timestampMs}-${index}`}>
                  <strong>{formatRelativeTimestamp(sample.timestampMs)}</strong>
                  <span>ראש: yaw {formatValue(sample.headYaw)}°, pitch {formatValue(sample.headPitch)}°</span>
                  <span>
                    עיניים: שמאל ({formatValue(sample.leftEyeHorizontal)}, {formatValue(sample.leftEyeVertical)})
                    {' · '}
                    ימין ({formatValue(sample.rightEyeHorizontal)}, {formatValue(sample.rightEyeVertical)})
                  </span>
                  <span>
                    אמינות: {sample.eyeMeasurementReliability}
                    {' · '}
                    סיבת אמינות: {sample.eyeReliabilityReason || 'Reason unavailable'}
                  </span>
                  <span>
                    זווית משולבת: ({formatValue(sample.combinedYaw)}°, {formatValue(sample.combinedPitch)}°)
                    {' · '}
                    סיווג: {sample.screenAttentionState}
                    {' · '}
                    סיבת סיווג: {sample.screenAttentionReason || 'Reason unavailable'}
                  </span>
                  <span>
                    מצב מוחלק: {sample.smoothedScreenAttentionState}
                    {' · '}
                    eyeLookDown: {formatValue(sample.eyeLookDownLeft)} / {formatValue(sample.eyeLookDownRight)}
                  </span>
                </li>
              ))}
            </ol>
          </details>
        )}
        <button
          className="screen-attention-download"
          type="button"
          onClick={handleDownload}
          disabled={!recordingSnapshot?.totalSamples}
        >
          הורדת JSON
        </button>
        {exportError && <p className="screen-attention-export-error" role="alert">{exportError}</p>}
        <p className="screen-attention-disclaimer">
          הנתונים נשמרים זמנית בזיכרון הדפדפן וכוללים מדדים בלבד, ללא תמונות או פריימים.
        </p>
      </div>
    </section>
  );
}
