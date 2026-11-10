// React binding for the attention engine: runs MediaPipe on the local video,
// feeds the engine and the calibration session, and publishes a throttled
// view model for the UI. All processing stays in the browser.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createVideoFaceLandmarker } from '../vision/faceLandmarker.js';
import { createAttentionEngine } from './engine.js';
import { createCalibrationSession } from './calibration.js';
import { ATTENTION_REASONS } from './contracts.js';

export const DETECTION_INTERVAL_MS = 66; // ~15 analysed frames per second
const PUBLISH_INTERVAL_MS = 100;
const TIMELINE_STEP_MS = 500;
const TIMELINE_LENGTH = 120; // 60 seconds

function summarizeModel(model) {
  if (!model) return null;
  return {
    quality: model.quality,
    error: model.error,
    usesEyes: Boolean(model.full),
    fullError: model.full?.error ?? null,
    headOnlyError: model.headOnly?.error ?? null,
    samples: (model.full || model.headOnly).samplesUsed,
    createdAt: model.createdAt,
  };
}

/**
 * @param {React.RefObject<HTMLVideoElement>} videoRef video element showing `stream`
 * @param {MediaStream|null} stream
 * @param {{ onFrame?: (frame: object) => void }} [options]
 */
export default function useAttentionEngine(videoRef, stream, { onFrame } = {}) {
  const engineRef = useRef(null);
  const calibrationRef = useRef(null);
  if (!engineRef.current) engineRef.current = createAttentionEngine();
  if (!calibrationRef.current) calibrationRef.current = createCalibrationSession();
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  const [status, setStatus] = useState('off'); // off | loading | running | paused | error
  const [error, setError] = useState(null);
  const [view, setView] = useState(() => ({
    frame: engineRef.current.unavailable(ATTENTION_REASONS.CAMERA_UNAVAILABLE, 0),
    raw: null,
    fatigue: null,
    fps: 0,
  }));
  const [calibration, setCalibration] = useState(() => calibrationRef.current.getSnapshot());
  const [model, setModel] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const runningRef = useRef(false);

  const publishCalibration = useCallback(() => {
    setCalibration(calibrationRef.current.getSnapshot());
  }, []);

  const handleCalibrationProgress = useCallback(() => {
    const session = calibrationRef.current;
    const snapshot = session.getSnapshot();
    if (snapshot.status === 'done') {
      const fitted = session.getModel();
      engineRef.current.setCalibrating(false);
      engineRef.current.setCalibration(fitted);
      setModel(summarizeModel(fitted));
      session.reset();
      setCalibration({ ...session.getSnapshot(), lastResult: 'done' });
      return true;
    }
    if (snapshot.status === 'failed') {
      engineRef.current.setCalibrating(false);
      engineRef.current.setCalibration(engineRef.current.getCalibration());
      const failure = snapshot.failure;
      session.reset();
      setCalibration({ ...session.getSnapshot(), lastResult: 'failed', failure });
      return true;
    }
    return false;
  }, []);

  const startCalibration = useCallback(() => {
    if (!runningRef.current) return false;
    calibrationRef.current.start(performance.now());
    engineRef.current.setCalibrating(true);
    publishCalibration();
    return true;
  }, [publishCalibration]);

  const cancelCalibration = useCallback(() => {
    calibrationRef.current.cancel();
    handleCalibrationProgress();
  }, [handleCalibrationProgress]);

  const clearCalibration = useCallback(() => {
    calibrationRef.current.reset();
    engineRef.current.setCalibration(null);
    setModel(null);
    publishCalibration();
  }, [publishCalibration]);

  useEffect(() => {
    const video = videoRef.current;
    const engine = engineRef.current;
    if (!stream || !video) {
      runningRef.current = false;
      if (calibrationRef.current.getSnapshot().status === 'running') {
        calibrationRef.current.cancel();
        handleCalibrationProgress();
      }
      setStatus('off');
      setError(null);
      setView((current) => ({
        ...current,
        frame: engine.unavailable(ATTENTION_REASONS.CAMERA_UNAVAILABLE, performance.now()),
        raw: null,
        fps: 0,
      }));
      return undefined;
    }

    let cancelled = false;
    let landmarker = null;
    let frameCallbackId = null;
    let timeoutId = null;
    let lastDetectionAt = Number.NEGATIVE_INFINITY;
    let lastTimestamp = Number.NEGATIVE_INFINITY;
    let lastMediaTime = -1;
    let lastPublishAt = Number.NEGATIVE_INFINITY;
    let lastTimelineAt = Number.NEGATIVE_INFINITY;
    let detections = [];
    setStatus('loading');
    setError(null);

    const canUseFrameCallbacks = typeof video.requestVideoFrameCallback === 'function'
      && typeof video.cancelVideoFrameCallback === 'function';

    function cancelScheduled() {
      if (frameCallbackId !== null) video.cancelVideoFrameCallback(frameCallbackId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      frameCallbackId = null;
      timeoutId = null;
    }

    function schedule() {
      if (cancelled || !runningRef.current) return;
      if (canUseFrameCallbacks) {
        frameCallbackId = video.requestVideoFrameCallback((now) => {
          frameCallbackId = null;
          analyse(now);
        });
      } else {
        timeoutId = window.setTimeout(() => {
          timeoutId = null;
          analyse(performance.now());
        }, DETECTION_INTERVAL_MS);
      }
    }

    function publish(output, now) {
      detections = detections.filter((time) => now - time <= 1000);
      if (now - lastPublishAt < PUBLISH_INTERVAL_MS) return;
      lastPublishAt = now;
      setView({ frame: output.frame, raw: output.raw, fatigue: output.fatigue, fps: detections.length });
      if (calibrationRef.current.getSnapshot().status === 'running') publishCalibration();
      if (now - lastTimelineAt >= TIMELINE_STEP_MS) {
        lastTimelineAt = now;
        setTimeline((current) => [...current, { t: now, state: output.frame.state }].slice(-TIMELINE_LENGTH));
      }
    }

    function analyse(now) {
      if (cancelled || !runningRef.current || !landmarker) return;
      const ready = video.readyState >= 2 && video.videoWidth > 0 && !video.paused;
      if (ready && video.currentTime !== lastMediaTime && now - lastDetectionAt >= DETECTION_INTERVAL_MS) {
        const timestamp = Math.max(now, lastTimestamp + 1);
        try {
          const result = landmarker.detectForVideo(video, timestamp);
          lastDetectionAt = now;
          lastTimestamp = timestamp;
          lastMediaTime = video.currentTime;
          detections.push(now);
          const output = engine.process(result, timestamp, {
            frameWidth: video.videoWidth,
            frameHeight: video.videoHeight,
          });
          const session = calibrationRef.current;
          if (session.getSnapshot().status === 'running') {
            session.addSample(output.signals, timestamp);
            handleCalibrationProgress();
          }
          onFrameRef.current?.(output.frame);
          publish(output, now);
        } catch (detectionError) {
          console.error('Attention engine: face detection failed.', detectionError);
          setError('ניתוח הווידאו נכשל. נסו לכבות ולהפעיל את המצלמה מחדש.');
          setStatus('error');
          runningRef.current = false;
          return;
        }
      }
      schedule();
    }

    function startLoop() {
      if (cancelled || !landmarker || runningRef.current || document.visibilityState === 'hidden') return;
      runningRef.current = true;
      setStatus('running');
      schedule();
    }

    function pauseLoop() {
      runningRef.current = false;
      cancelScheduled();
      if (calibrationRef.current.getSnapshot().status === 'running') {
        calibrationRef.current.cancel();
        handleCalibrationProgress();
      }
      const frame = engine.unavailable(ATTENTION_REASONS.PAUSED, performance.now());
      setView((current) => ({ ...current, frame, raw: null, fps: 0 }));
      onFrameRef.current?.(frame);
      setStatus('paused');
    }

    function handleVisibility() {
      if (document.visibilityState === 'hidden') pauseLoop();
      else startLoop();
    }

    document.addEventListener('visibilitychange', handleVisibility);
    createVideoFaceLandmarker({ isCancelled: () => cancelled })
      .then((created) => {
        if (!created) return;
        landmarker = created;
        startLoop();
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error('Attention engine: Face Landmarker failed to load.', loadError);
        setError('טעינת מודל זיהוי הפנים נכשלה. בדקו את החיבור ורעננו את הדף.');
        setStatus('error');
      });

    return () => {
      cancelled = true;
      runningRef.current = false;
      cancelScheduled();
      document.removeEventListener('visibilitychange', handleVisibility);
      landmarker?.close();
      landmarker = null;
      engine.reset(ATTENTION_REASONS.CAMERA_UNAVAILABLE);
    };
  }, [stream, videoRef, handleCalibrationProgress, publishCalibration]);

  return {
    status,
    error,
    frame: view.frame,
    raw: view.raw,
    fatigue: view.fatigue,
    fps: view.fps,
    calibration,
    model,
    timeline,
    startCalibration,
    cancelCalibration,
    clearCalibration,
  };
}
