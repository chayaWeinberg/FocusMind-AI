import { useEffect, useRef, useState } from 'react';
import useFaceLandmarker from './useFaceLandmarker.js';
import HeadPoseDiagnostic from './HeadPoseDiagnostic.jsx';
import EyeGazeDiagnostic from './EyeGazeDiagnostic.jsx';
import EyeMovementDiagnostic from './EyeMovementDiagnostic.jsx';
import ScreenAttentionDiagnostic from './ScreenAttentionDiagnostic.jsx';
import ScreenCalibration from './ScreenCalibration.jsx';

function stopStream(stream) {
  stream.getTracks().forEach((track) => track.stop());
}

function getCameraErrorMessage(error) {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'הגישה למצלמה נדחתה. אפשר לאשר גישה למצלמה בהגדרות הדפדפן ולנסות שוב.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'לא נמצאה מצלמה זמינה במכשיר.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'לא ניתן להפעיל את המצלמה. ייתכן שהיא נמצאת בשימוש באפליקציה אחרת.';
    case 'OverconstrainedError':
      return 'המצלמה הזמינה אינה תומכת בהגדרות הנדרשות.';
    default:
      return 'אירעה שגיאה בעת הפעלת המצלמה. אפשר לנסות שוב.';
  }
}

export default function CameraPreview({
  videoPlaybackState = 'paused',
  className = '',
  onPersonalizedAttention,
  experimentMode = false,
  modelReady = false,
}) {
  const [stream, setStream] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const requestInProgressRef = useRef(false);
  const mountedRef = useRef(false);
  const cameraAvailable = Boolean(
    stream?.getVideoTracks?.().some((track) => track.readyState !== 'ended'),
  );
  const trackingEnabled = cameraAvailable
    && (experimentMode || videoPlaybackState === 'playing');

  const {
    status: detectionStatus,
    latestPoseRef,
    latestEyeGazeRef,
    latestEyeLookBlendshapesRef,
    latestEyeMovementSummaryRef,
    latestScreenAttentionSummaryRef,
    screenAttentionRecorderRef,
    screenCalibrationSessionRef,
    startDiagnosticRecording,
    stopDiagnosticRecording,
    resetDiagnosticRecording,
    startCalibration,
    startGuidedCalibration,
    liveGazeDiagnosticRecorderRef,
    startLiveGazeDiagnosticRecording,
    setLiveGazeDiagnosticStage,
    endLiveGazeDiagnosticStage,
    stopLiveGazeDiagnosticRecording,
    cancelCalibration,
    restartCalibration,
    repeatCalibrationTarget,
    startKeyboardEvaluation,
    startOffscreenCalibration,
    completeCalibration,
    latestDetectionSampleRef,
  } = useFaceLandmarker(
    videoRef,
    stream,
    undefined,
    trackingEnabled,
    onPersonalizedAttention,
  );
  const detectionStatusText = {
    off: 'המצלמה כבויה',
    loading: 'טוען מודל לזיהוי פנים…',
    ready: 'זיהוי פנים מוכן',
    detected: 'זוהו פנים',
    'no-face': 'לא זוהו פנים',
    error: 'שגיאה בזיהוי פנים',
  }[detectionStatus];

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (streamRef.current) {
        stopStream(streamRef.current);
        streamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!stream || !videoRef.current) return undefined;
    videoRef.current.srcObject = stream;
    return () => {
      if (videoRef.current?.srcObject === stream) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream]);

  async function startCamera() {
    if (requestInProgressRef.current || streamRef.current) return;

    const getUserMedia = navigator.mediaDevices?.getUserMedia;
    if (typeof getUserMedia !== 'function') {
      setErrorMessage('הדפדפן או המכשיר אינם תומכים בגישה למצלמה.');
      return;
    }

    requestInProgressRef.current = true;
    setIsLoading(true);
    setErrorMessage('');

    try {
      const cameraStream = await getUserMedia.call(navigator.mediaDevices, {
        video: true,
        audio: false,
      });

      if (!mountedRef.current) {
        stopStream(cameraStream);
        return;
      }

      streamRef.current = cameraStream;
      setStream(cameraStream);
    } catch (error) {
      if (mountedRef.current) {
        setErrorMessage(getCameraErrorMessage(error));
      }
    } finally {
      requestInProgressRef.current = false;
      if (mountedRef.current) setIsLoading(false);
    }
  }

  function stopCamera() {
    const activeStream = streamRef.current;
    streamRef.current = null;
    if (activeStream) stopStream(activeStream);
    setStream(null);
    setErrorMessage('');
  }

  return (
    <section
      className={`learning-card camera-card${experimentMode ? ' camera-card--experiment' : ''} ${className}`.trim()}
      aria-labelledby="camera-title"
    >
      <div className="learning-card-heading">
        <div>
          <span className="learning-card-kicker">הפעלה לפי בחירתכם</span>
          <h2 id="camera-title">תצוגת מצלמה</h2>
        </div>
        <span className="learning-card-icon learning-card-icon--blue" aria-hidden="true">◉</span>
      </div>

      <div className={`camera-preview${stream ? ' camera-preview--active' : ''}`}>
        {stream ? (
          <video
            ref={videoRef}
            className="camera-preview-video"
            playsInline
            autoPlay
            muted
            aria-label="תצוגה חיה מהמצלמה"
          />
        ) : (
          <div className="camera-off-state">
            <span className="camera-off-icon" aria-hidden="true">◉</span>
            <strong>המצלמה כבויה</strong>
            <p>המצלמה תופעל רק לאחר לחיצה על הכפתור.</p>
          </div>
        )}
      </div>

      <div className={`camera-diagnostic camera-diagnostic--${detectionStatus}`} role="status" aria-label="סטטוס זיהוי פנים">
        <span className="camera-diagnostic-indicator" aria-hidden="true" />
        <span>{detectionStatusText}</span>
      </div>

      <HeadPoseDiagnostic
        cameraActive={Boolean(stream)}
        detectionStatus={detectionStatus}
        poseRef={latestPoseRef}
        detectionSampleRef={latestDetectionSampleRef}
      />
      <EyeGazeDiagnostic
        detectionStatus={detectionStatus}
        gazeRef={latestEyeGazeRef}
        blendshapesRef={latestEyeLookBlendshapesRef}
      />
      <EyeMovementDiagnostic
        cameraAvailable={cameraAvailable}
        videoPlaybackState={videoPlaybackState}
        summaryRef={latestEyeMovementSummaryRef}
      />
      <ScreenAttentionDiagnostic
        cameraAvailable={cameraAvailable}
        videoPlaybackState={videoPlaybackState}
        summaryRef={latestScreenAttentionSummaryRef}
        recorderRef={screenAttentionRecorderRef}
        startRecording={startDiagnosticRecording}
        stopRecording={stopDiagnosticRecording}
        resetRecording={resetDiagnosticRecording}
      />
      <ScreenCalibration
        experimentMode={experimentMode}
        modelReady={modelReady}
        cameraAvailable={cameraAvailable}
        videoPlaybackState={videoPlaybackState}
        sessionRef={screenCalibrationSessionRef}
        liveDiagnosticRecorderRef={liveGazeDiagnosticRecorderRef}
        startCalibration={startCalibration}
        startGuidedCalibration={startGuidedCalibration}
        startLiveGazeDiagnosticRecording={startLiveGazeDiagnosticRecording}
        setLiveGazeDiagnosticStage={setLiveGazeDiagnosticStage}
        endLiveGazeDiagnosticStage={endLiveGazeDiagnosticStage}
        stopLiveGazeDiagnosticRecording={stopLiveGazeDiagnosticRecording}
        cancelCalibration={cancelCalibration}
        restartCalibration={restartCalibration}
        repeatCalibrationTarget={repeatCalibrationTarget}
        startKeyboardEvaluation={startKeyboardEvaluation}
        startOffscreenCalibration={startOffscreenCalibration}
        completeCalibration={completeCalibration}
      />

      {errorMessage && <p className="camera-error" role="alert">{errorMessage}</p>}

      <button
        className={`camera-toggle-button${stream ? ' camera-toggle-button--stop' : ''}`}
        type="button"
        onClick={stream ? stopCamera : startCamera}
        disabled={isLoading}
      >
        {stream ? 'כיבוי מצלמה' : isLoading ? 'מתחברים למצלמה…' : 'הפעלת מצלמה'}
      </button>
      <p className="camera-privacy-note">התצוגה נשארת במכשיר ואינה מוקלטת או מועברת.</p>
    </section>
  );
}
