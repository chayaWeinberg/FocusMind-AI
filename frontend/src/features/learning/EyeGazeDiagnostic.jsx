import { useEffect, useState } from 'react';

const REFRESH_INTERVAL_MS = 400;

const directionLabels = {
  left: 'שמאלה',
  right: 'ימינה',
  up: 'למעלה',
  down: 'למטה',
  center: 'מרכז',
  unknown: 'לא ידוע',
};

const eyeLookLabels = [
  ['eyeLookInLeft', 'מבט פנימה - עין שמאל'],
  ['eyeLookOutLeft', 'מבט החוצה - עין שמאל'],
  ['eyeLookInRight', 'מבט פנימה - עין ימין'],
  ['eyeLookOutRight', 'מבט החוצה - עין ימין'],
  ['eyeLookUpLeft', 'מבט למעלה - עין שמאל'],
  ['eyeLookUpRight', 'מבט למעלה - עין ימין'],
  ['eyeLookDownLeft', 'מבט למטה - עין שמאל'],
  ['eyeLookDownRight', 'מבט למטה - עין ימין'],
];

function formatEstimate(value) {
  return Number.isFinite(value) ? value.toFixed(3) : '—';
}

function blendshapesMatch(left, right) {
  if (!left || !right) return left === right;
  return eyeLookLabels.every(([name]) => left[name] === right[name]);
}

function hasBlendshapeScores(blendshapes) {
  return eyeLookLabels.some(([name]) => Number.isFinite(blendshapes?.[name]));
}

function estimatesMatch(left, right) {
  return left?.horizontal === right?.horizontal
    && left?.vertical === right?.vertical
    && left?.leftEye?.horizontal === right?.leftEye?.horizontal
    && left?.leftEye?.vertical === right?.leftEye?.vertical
    && left?.rightEye?.horizontal === right?.rightEye?.horizontal
    && left?.rightEye?.vertical === right?.rightEye?.vertical
    && left?.direction === right?.direction
    && left?.reliability === right?.reliability
    && left?.reason === right?.reason;
}

export default function EyeGazeDiagnostic({
  detectionStatus,
  gazeRef,
  blendshapesRef,
}) {
  const [gaze, setGaze] = useState(null);
  const [blendshapes, setBlendshapes] = useState(null);

  useEffect(() => {
    if (detectionStatus !== 'detected' || !gazeRef) {
      setGaze((currentGaze) => (currentGaze === null ? currentGaze : null));
      setBlendshapes((currentBlendshapes) => (
        currentBlendshapes === null ? currentBlendshapes : null
      ));
      return undefined;
    }

    function refreshGaze() {
      const latestGaze = gazeRef.current;
      setGaze((currentGaze) => (
        estimatesMatch(currentGaze, latestGaze) ? currentGaze : latestGaze
      ));
      const latestBlendshapes = blendshapesRef?.current ?? null;
      setBlendshapes((currentBlendshapes) => (
        blendshapesMatch(currentBlendshapes, latestBlendshapes)
          ? currentBlendshapes
          : latestBlendshapes
      ));
    }

    refreshGaze();
    const intervalId = window.setInterval(refreshGaze, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [detectionStatus, gazeRef, blendshapesRef]);

  const reliable = gaze?.reliability === 'reliable';
  const blendshapeScoresAvailable = hasBlendshapeScores(blendshapes);
  const direction = reliable
    ? directionLabels[gaze.direction] || directionLabels.unknown
    : directionLabels.unknown;
  return (
    <section className="eye-gaze-diagnostic" aria-label="אבחון כיוון מבט העיניים">
      <div className="eye-gaze-diagnostic-heading">
        <strong>כיוון מבט העיניים</strong>
        <span>ניסוי</span>
      </div>
      <p className="eye-gaze-diagnostic-direction">
        סיווג: <strong>{direction}</strong>
      </p>
      <dl className="eye-gaze-values">
        <div>
          <dt>אופקי - עין שמאל</dt>
          <dd>{formatEstimate(gaze?.leftEye?.horizontal)}</dd>
        </div>
        <div>
          <dt>אופקי - עין ימין</dt>
          <dd>{formatEstimate(gaze?.rightEye?.horizontal)}</dd>
        </div>
        <div>
          <dt>אנכי - עין שמאל</dt>
          <dd>{formatEstimate(gaze?.leftEye?.vertical)}</dd>
        </div>
        <div>
          <dt>אנכי - עין ימין</dt>
          <dd>{formatEstimate(gaze?.rightEye?.vertical)}</dd>
        </div>
        <div>
          <dt>אופקי משולב</dt>
          <dd>{formatEstimate(gaze?.horizontal)}</dd>
        </div>
        <div>
          <dt>אנכי משולב</dt>
          <dd>{formatEstimate(gaze?.vertical)}</dd>
        </div>
      </dl>
      <p className={`eye-gaze-reliability${reliable ? ' eye-gaze-reliability--reliable' : ''}`}>
        אמינות: {reliable ? 'מדידה זמינה' : 'לא אמינה / לא זמינה'}
      </p>
      <p className="eye-gaze-disclaimer">
        מדד עיניים ניסיוני בלבד. "מרכז" אינו מעיד שהמבט מופנה למסך.
      </p>
      <div className="eye-look-blendshape-diagnostic" aria-label="ציוני מבט עיניים של MediaPipe">
        <div className="eye-gaze-diagnostic-heading">
          <strong>ציוני Eye Look של MediaPipe</strong>
          <span>גולמיים / לא מכוילים</span>
        </div>
        <dl className="eye-gaze-values eye-look-blendshape-values">
          {eyeLookLabels.map(([name, label]) => (
            <div key={name}>
              <dt>{label}</dt>
              <dd>{formatEstimate(blendshapes?.[name])}</dd>
            </div>
          ))}
        </dl>
        <p className="eye-gaze-reliability">
          {blendshapeScoresAvailable
            ? 'ציוני Blendshape זמינים'
            : 'ציוני Blendshape אינם זמינים'}
        </p>
        <p className="eye-gaze-disclaimer">
          הציונים הם אומדני תנועת עיניים, לא מדידת מבט מסך מכוילת.
        </p>
      </div>
    </section>
  );
}
