// Saves lesson progress and ReplayAI-ready attention segments for a course
// lesson played on the Smart Learning page.
//
// - Progress: throttled while playing (every 10 s at most), and immediately on
//   pause, seek end, end of video, hiding the tab and leaving the page.
//   Nothing is saved before the video actually plays.
// - A learning session is created on first playback; segments are sent every
//   15 s and when playback stops; the session is ended when leaving the page.
// - Requests on page exit use `keepalive` so they survive navigation.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  endLearningSession,
  saveLessonProgress,
  sendSessionSegments,
  startLearningSession,
} from '../courses/coursesApi.js';
import {
  SEGMENT_FLUSH_INTERVAL_MS,
  createSegmentRecorder,
  shouldSaveWhilePlaying,
} from './lessonPlayback.js';

const SEGMENT_BATCH = 200;

export default function useLessonPersistence({ lessonId, enabled, initialProgress, getActiveMs }) {
  const [progress, setProgress] = useState(initialProgress ?? null);
  const [saveError, setSaveError] = useState('');
  const mountedRef = useRef(true);
  const hasPlayedRef = useRef(false);
  const playingRef = useRef(false);
  const lastSaveRef = useRef({ at: Number.NEGATIVE_INFINITY, position: -1 });
  const positionRef = useRef({ time: 0, duration: null });
  const sessionRef = useRef(null); // Promise<string|null>
  const recorderRef = useRef(null);
  if (!recorderRef.current) recorderRef.current = createSegmentRecorder({ sessionStartedAt: performance.now() });
  const getActiveMsRef = useRef(getActiveMs);
  getActiveMsRef.current = getActiveMs;

  useEffect(() => {
    setProgress(initialProgress ?? null);
  }, [initialProgress]);

  const remember = useCallback((video) => {
    if (!video) return;
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;
    positionRef.current = { time: video.currentTime || 0, duration };
  }, []);

  const save = useCallback(async ({ ended = false, keepalive = false } = {}) => {
    if (!enabled || !hasPlayedRef.current) return;
    const { time, duration } = positionRef.current;
    lastSaveRef.current = { at: performance.now(), position: time };
    try {
      const saved = await saveLessonProgress(
        lessonId,
        {
          positionSeconds: Math.max(0, Math.round(time * 100) / 100),
          ...(duration ? { durationSeconds: Math.round(duration * 100) / 100 } : {}),
          ended,
        },
        { keepalive },
      );
      if (mountedRef.current) {
        setProgress(saved);
        setSaveError('');
      }
    } catch {
      if (mountedRef.current) setSaveError('לא הצלחנו לשמור את ההתקדמות. ננסה שוב בהמשך הצפייה.');
    }
  }, [enabled, lessonId]);

  const ensureSession = useCallback(() => {
    if (!enabled) return null;
    if (!sessionRef.current) {
      sessionRef.current = startLearningSession(lessonId).then((session) => session.id).catch(() => null);
    }
    return sessionRef.current;
  }, [enabled, lessonId]);

  const flushSegments = useCallback(async ({ keepalive = false } = {}) => {
    const recorder = recorderRef.current;
    const segments = recorder.drain();
    if (segments.length === 0 || !sessionRef.current) {
      if (segments.length) recorder.restore(segments);
      return;
    }
    const sessionId = await sessionRef.current;
    if (!sessionId) return; // session could not be created: segments are dropped, never faked
    for (let index = 0; index < segments.length; index += SEGMENT_BATCH) {
      const batch = segments.slice(index, index + SEGMENT_BATCH);
      try {
        await sendSessionSegments(sessionId, batch, { keepalive });
      } catch {
        recorder.restore(segments.slice(index));
        return;
      }
    }
  }, []);

  // Periodic segment upload.
  useEffect(() => {
    if (!enabled) return undefined;
    const id = window.setInterval(() => void flushSegments(), SEGMENT_FLUSH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [enabled, flushSegments]);

  // Leaving: hidden tab / page unload / unmount.
  useEffect(() => {
    if (!enabled) return undefined;
    mountedRef.current = true;
    function persistNow() {
      recorderRef.current.interrupt();
      void save({ keepalive: true });
      void flushSegments({ keepalive: true });
    }
    function handleVisibility() {
      if (document.visibilityState === 'hidden') persistNow();
    }
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', persistNow);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', persistNow);
      mountedRef.current = false;
      persistNow();
      const session = sessionRef.current;
      if (session) {
        const activeMs = Math.max(0, Math.round(getActiveMsRef.current?.() || 0));
        void session.then((sessionId) => (
          sessionId ? endLearningSession(sessionId, activeMs, { keepalive: true }).catch(() => {}) : null
        ));
      }
    };
  }, [enabled, flushSegments, save]);

  return {
    progress,
    setProgress,
    saveError,
    onPlaying(video) {
      if (!enabled) return;
      hasPlayedRef.current = true;
      playingRef.current = true;
      remember(video);
      ensureSession();
      recorderRef.current.interrupt();
    },
    onTimeUpdate(video) {
      if (!enabled || !video) return;
      remember(video);
      if (playingRef.current && shouldSaveWhilePlaying({
        now: performance.now(),
        lastSavedAt: lastSaveRef.current.at,
        position: video.currentTime,
        lastSavedPosition: lastSaveRef.current.position,
      })) {
        void save();
      }
    },
    onStop(video, { ended = false } = {}) {
      if (!enabled) return;
      playingRef.current = false;
      remember(video);
      recorderRef.current.interrupt();
      void save({ ended });
      void flushSegments();
    },
    onSeeking() {
      if (!enabled) return;
      recorderRef.current.interrupt();
    },
    onSeeked(video) {
      if (!enabled) return;
      remember(video);
      void save();
    },
    /** One stats tick while the session timer runs (video playing). */
    sample(video, state, concentration) {
      if (!enabled || !video || !hasPlayedRef.current || video.paused) return;
      remember(video);
      recorderRef.current.sample({
        at: performance.now(),
        videoTime: video.currentTime,
        rate: video.playbackRate || 1,
        state,
        concentration,
      });
    },
  };
}
