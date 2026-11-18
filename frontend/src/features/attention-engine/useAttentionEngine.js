// React binding for the attention engine: runs MediaPipe on the local video,
// feeds the engine and publishes a throttled view model for the UI.
// All processing stays in the browser.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createVideoFaceLandmarker } from '../vision/faceLandmarker.js';
import { createAttentionEngine } from './engine.js';
import { ATTENTION_REASONS } from './contracts.js';

export const DETECTION_INTERVAL_MS = 66; // ~15 analysed frames per second
const PUBLISH_INTERVAL_MS = 150;

/** What the engine measured in one frame, for the "measurement details" view. */
export function measurementDetails({ raw, signals }) {
  return {
    modelUsed: raw.modelUsed,
    offset: raw.offset,
    tolerance: raw.tolerance,
    eyeOpenness: signals.eyes.openness,
    eyeQuality: signals.quality.eyes,
  };
}

/**
 * @param {React.RefObject<HTMLVideoElement>} videoRef video element showing `stream`
 * @param {MediaStream|null} stream
 * @param {{ onFrame?: (frame: object) => void, onLandmarks?: (landmarks: object[]|null, at: number) => void }} [options]
 *   onFrame: called for every analysed frame. onLandmarks: the raw 478 landmarks
 *   of the first face (null without a face), for the course attention model.
 */
export default function useAttentionEngine(videoRef, stream, { onFrame, onLandmarks } = {}) {
  const engineRef = useRef(null);
  if (!engineRef.current) engineRef.current = createAttentionEngine();
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  const onLandmarksRef = useRef(onLandmarks);
  onLandmarksRef.current = onLandmarks;

  const [status, setStatus] = useState('off'); // off | loading | running | paused | error
  const [error, setError] = useState(null);
  const [frame, setFrame] = useState(() => (
    engineRef.current.unavailable(ATTENTION_REASONS.CAMERA_UNAVAILABLE, 0)
  ));
  const [fatigue, setFatigue] = useState(null);
  const [details, setDetails] = useState(null);

  const recenter = useCallback(() => {
    engineRef.current.recenter();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const engine = engineRef.current;
    if (!stream || !video) {
      setStatus('off');
      setError(null);
      const offFrame = engine.unavailable(ATTENTION_REASONS.CAMERA_UNAVAILABLE, performance.now());
      setFrame(offFrame);
      onFrameRef.current?.(offFrame);
      return undefined;
    }

    let cancelled = false;
    let running = false;
    let landmarker = null;
    let frameCallbackId = null;
    let timeoutId = null;
    let lastDetectionAt = Number.NEGATIVE_INFINITY;
    let lastTimestamp = Number.NEGATIVE_INFINITY;
    let lastMediaTime = -1;
    let lastPublishAt = Number.NEGATIVE_INFINITY;
    setStatus('loading');
    setError(null);
    engine.reset(ATTENTION_REASONS.ADAPTING);
    setFrame(engine.unavailable(ATTENTION_REASONS.ADAPTING, performance.now()));

    const canUseFrameCallbacks = typeof video.requestVideoFrameCallback === 'function'
      && typeof video.cancelVideoFrameCallback === 'function';

    function cancelScheduled() {
      if (frameCallbackId !== null) video.cancelVideoFrameCallback(frameCallbackId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      frameCallbackId = null;
      timeoutId = null;
    }

    function schedule() {
      if (cancelled || !running) return;
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

    function analyse(now) {
      if (cancelled || !running || !landmarker) return;
      const ready = video.readyState >= 2 && video.videoWidth > 0 && !video.paused;
      if (ready && video.currentTime !== lastMediaTime && now - lastDetectionAt >= DETECTION_INTERVAL_MS) {
        const timestamp = Math.max(now, lastTimestamp + 1);
        try {
          const result = landmarker.detectForVideo(video, timestamp);
          lastDetectionAt = now;
          lastTimestamp = timestamp;
          lastMediaTime = video.currentTime;
          const output = engine.process(result, timestamp, {
            frameWidth: video.videoWidth,
            frameHeight: video.videoHeight,
          });
          onFrameRef.current?.(output.frame);
          onLandmarksRef.current?.(result?.faceLandmarks?.[0] ?? null, timestamp);
          if (now - lastPublishAt >= PUBLISH_INTERVAL_MS) {
            lastPublishAt = now;
            setFrame(output.frame);
            setFatigue(output.fatigue);
            setDetails(measurementDetails(output));
          }
        } catch (detectionError) {
          console.error('Attention engine: face detection failed.', detectionError);
          setError('ניתוח המצלמה נעצר בגלל שגיאה. כבו והפעילו את המצלמה מחדש.');
          setStatus('error');
          running = false;
          return;
        }
      }
      schedule();
    }

    function startLoop() {
      if (cancelled || !landmarker || running || document.visibilityState === 'hidden') return;
      running = true;
      setStatus('running');
      schedule();
    }

    function pauseLoop() {
      running = false;
      cancelScheduled();
      const pausedFrame = engine.unavailable(ATTENTION_REASONS.PAUSED, performance.now());
      setFrame(pausedFrame);
      onFrameRef.current?.(pausedFrame);
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
        setError('טעינת מודל זיהוי הפנים נכשלה. רעננו את הדף ונסו שוב.');
        setStatus('error');
      });

    return () => {
      cancelled = true;
      running = false;
      cancelScheduled();
      document.removeEventListener('visibilitychange', handleVisibility);
      landmarker?.close();
      landmarker = null;
    };
  }, [stream, videoRef]);

  return { status, error, frame, fatigue, details, recenter };
}
