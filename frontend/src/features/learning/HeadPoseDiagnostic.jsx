import { useEffect, useState } from 'react';

const REFRESH_INTERVAL_MS = 400;

const directionLabels = {
  forward: 'קדימה',
  left: 'שמאלה',
  right: 'ימינה',
  up: 'למעלה',
  down: 'למטה',
  unknown: 'לא ידוע',
};

const CAPTURE_POSES = [
  { key: 'neutral', label: 'Neutral', description: 'ראש מול המצלמה', button: 'לכידת מצב ניטרלי' },
  { key: 'up', label: 'Up', description: 'הטיית ראש כלפי מעלה', button: 'לכידת הטיה למעלה' },
  { key: 'right', label: 'Right', description: 'סיבוב הראש ימינה פיזית', button: 'לכידת סיבוב ימינה' },
];

function formatAngle(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)}°` : '—';
}

function getValidSample(sample, cameraActive, detectionStatus) {
  const { matrix, pose } = sample || {};
  if (
    !cameraActive
    || detectionStatus !== 'detected'
    || matrix?.rows !== 4
    || matrix?.columns !== 4
    || !Array.isArray(matrix.data)
    || matrix.data.length !== 16
    || matrix.data.some((value) => !Number.isFinite(value))
    || ![pose?.yaw, pose?.pitch, pose?.roll].every(Number.isFinite)
  ) {
    return null;
  }
  return { matrix, pose };
}

function posesMatch(left, right) {
  return left?.yaw === right?.yaw
    && left?.pitch === right?.pitch
    && left?.roll === right?.roll
    && left?.direction === right?.direction;
}

export default function HeadPoseDiagnostic({
  cameraActive = false,
  detectionStatus,
  poseRef,
  detectionSampleRef,
}) {
  const [pose, setPose] = useState(null);
  const [capturedSamples, setCapturedSamples] = useState({});
  const [copyMessage, setCopyMessage] = useState('');

  useEffect(() => {
    if (detectionStatus !== 'detected' || !poseRef) {
      setPose((currentPose) => (currentPose === null ? currentPose : null));
      return undefined;
    }

    function refreshPose() {
      const latestPose = poseRef.current;
      setPose((currentPose) => (
        posesMatch(currentPose, latestPose) ? currentPose : latestPose
      ));
    }

    refreshPose();
    const intervalId = window.setInterval(refreshPose, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [detectionStatus, poseRef]);

  const hasAngles = pose
    && Number.isFinite(pose.yaw)
    && Number.isFinite(pose.pitch)
    && Number.isFinite(pose.roll);
  const direction = hasAngles
    ? directionLabels[pose.direction] || directionLabels.unknown
    : directionLabels.unknown;
  const canCapture = Boolean(
    getValidSample(detectionSampleRef?.current, cameraActive, detectionStatus),
  );
  const allSamplesCaptured = CAPTURE_POSES.every(({ key }) => capturedSamples[key]);

  function capturePose(capture) {
    const sample = getValidSample(
      detectionSampleRef?.current,
      cameraActive,
      detectionStatus,
    );
    if (!sample) return;

    setCapturedSamples((currentSamples) => ({
      ...currentSamples,
      [capture.key]: {
        label: capture.key,
        labelText: `${capture.label} - ${capture.description}`,
        matrix: {
          rows: sample.matrix.rows,
          columns: sample.matrix.columns,
          data: [...sample.matrix.data],
        },
        pose: {
          yaw: sample.pose.yaw,
          pitch: sample.pose.pitch,
          roll: sample.pose.roll,
        },
      },
    }));
    setCopyMessage('');
  }

  async function copyCapturedSamples() {
    const samples = CAPTURE_POSES.map(({ key }) => capturedSamples[key]);
    try {
      await navigator.clipboard.writeText(JSON.stringify({ samples }, null, 2));
      setCopyMessage('הדגימות הועתקו ללוח.');
    } catch (error) {
      console.error('Could not copy head-pose diagnostic samples:', error);
      setCopyMessage('לא ניתן להעתיק ללוח בדפדפן זה.');
    }
  }

  return (
    <section className="head-pose-diagnostic" aria-label="אבחון תנוחת ראש">
      <div className="head-pose-diagnostic-heading">
        <strong>אבחון תנוחת ראש</strong>
        <span>כיוונים זמניים</span>
      </div>
      <dl className="head-pose-values">
        <div>
          <dt>Yaw</dt>
          <dd>{hasAngles ? formatAngle(pose.yaw) : '—'}</dd>
        </div>
        <div>
          <dt>Pitch</dt>
          <dd>{hasAngles ? formatAngle(pose.pitch) : '—'}</dd>
        </div>
        <div>
          <dt>Roll</dt>
          <dd>{hasAngles ? formatAngle(pose.roll) : '—'}</dd>
        </div>
      </dl>
      <p className="head-pose-direction">
        כיוון: <strong>{direction}</strong>
        <span> (מיפוי זמני)</span>
      </p>
      <div className="head-pose-capture" aria-label="לכידת מטריצות אבחון">
        <p>לכידת מטריצות לתנוחות בדיקה</p>
        <div className="head-pose-capture-buttons">
          {CAPTURE_POSES.map((capture) => (
            <button
              key={capture.key}
              type="button"
              onClick={() => capturePose(capture)}
              disabled={!canCapture}
              aria-label={capture.button}
            >
              {capture.label}
              {capturedSamples[capture.key] ? ' ✓' : ''}
            </button>
          ))}
        </div>
        <button
          className="head-pose-copy-button"
          type="button"
          onClick={copyCapturedSamples}
          disabled={!allSamplesCaptured}
        >
          העתקת JSON
        </button>
        <span className="head-pose-copy-message" role="status" aria-live="polite">
          {copyMessage}
        </span>
      </div>
    </section>
  );
}
