// Saves lesson progress, the Smart Timer and ReplayAI attention segments for a
// course lesson played on the Smart Learning page.
//
// - Progress (trackable videos only): throttled while playing (every 10 s at
//   most), and immediately on pause, seek end, end of video, hiding the tab
//   and leaving the page. Nothing is saved before the video actually plays.
// - A learning session is created on first playback (or, for YouTube, when
//   the learner starts the session timer). A heartbeat with the active and
//   break time is sent every 15 s, so an interrupted visit keeps its time.
// - Segments (trackable videos only) are sent every 15 s and when playback
//   stops; the session is ended when leaving the page.
// - Requests on page exit use `keepalive` so they survive navigation.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  endLearningSession,
  saveLessonProgress,
  sendSessionSegments,
  startLearningSession,
} from '../courses/coursesApi.js';
import { sendHeartbeat } from './learningApi.js';
import {
  SEGMENT_FLUSH_INTERVAL_MS,
  createSegmentRecorder,
  shouldSaveWhilePlaying,
} from './lessonPlayback.js';

const SEGMENT_BATCH = 200;
export const HEARTBEAT_INTERVAL_MS = 15_000;

export default function useLessonPersistence({
  lessonId,
  enabled,
  timed = false,
  initialProgress,
  getActiveMs,
  getBreakMs,
  onSegmentsSaved,
}) {
  const sessionEnabled = enabled || timed;
  const [progress, setProgress] = useState(initialProgress ?? null);
  const [saveError, setSaveError] = useState('');
  const mountedRef = useRef(true);
  const hasPlayedRef = useRef(false);
  const playingRef = useRef(false);
  const lastSaveRef = useRef({ at: Number.NEGATIVE_INFINITY, position: -1 });
  const positionRef = useRef({ time: 0, duration: null });
  const sessionRef = useRef(null); // Promise<string|null>
  const lastBeatRef = useRef({ active: -1, breaks: -1 });
  const recorderRef = useRef(null);
  if (!recorderRef.current) recorderRef.current = createSegmentRecorder({ sessionStartedAt: performance.now() });
  const clocksRef = useRef({ getActiveMs, getBreakMs, onSegmentsSaved });
  clocksRef.current = { getActiveMs, getBreakMs, onSegmentsSaved };

  useEffect(() => {
    setProgress(initialProgress ?? null);
  }, [initialProgress]);

  const clocks = () => ({
    activeMs: Math.max(0, Math.round(clocksRef.current.getActiveMs?.() || 0)),
    breakMs: Math.max(0, Math.round(clocksRef.current.getBreakMs?.() || 0)),
  });

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
    if (!sessionEnabled) return null;
    if (!sessionRef.current) {
      sessionRef.current = startLearningSession(lessonId).then((session) => session.id).catch(() => null);
    }
    return sessionRef.current;
  }, [sessionEnabled, lessonId]);

  const heartbeat = useCallback(async ({ keepalive = false } = {}) => {
    if (!sessionRef.current) return;
    const { activeMs, breakMs } = clocks();
    const last = lastBeatRef.current;
    if (activeMs === last.active && breakMs === last.breaks) return;
    const sessionId = await sessionRef.current;
    if (!sessionId) return;
    lastBeatRef.current = { active: activeMs, breaks: breakMs };
    try {
      await sendHeartbeat(sessionId, activeMs, breakMs, { keepalive });
    } catch {
      lastBeatRef.current = last; // retried with the next heartbeat
    }
  }, []);

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
    if (!keepalive && mountedRef.current) clocksRef.current.onSegmentsSaved?.();
  }, []);

  // Periodic segment upload and heartbeat.
  useEffect(() => {
    if (!sessionEnabled) return undefined;
    const id = window.setInterval(() => {
      if (enabled) void flushSegments();
      void heartbeat();
    }, Math.min(SEGMENT_FLUSH_INTERVAL_MS, HEARTBEAT_INTERVAL_MS));
    return () => window.clearInterval(id);
  }, [enabled, sessionEnabled, flushSegments, heartbeat]);

  // Leaving: hidden tab / page unload / unmount.
  useEffect(() => {
    if (!sessionEnabled) return undefined;
    mountedRef.current = true;
    function persistNow() {
      recorderRef.current.interrupt();
      void save({ keepalive: true });
      void flushSegments({ keepalive: true });
      void heartbeat({ keepalive: true });
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
      recorderRef.current.interrupt();
      void save({ keepalive: true });
      void flushSegments({ keepalive: true });
      const session = sessionRef.current;
      if (session) {
        const { activeMs, breakMs } = clocks();
        void session.then((sessionId) => (
          sessionId ? endLearningSession(sessionId, activeMs, { keepalive: true, breakMs }).catch(() => {}) : null
        ));
      }
    };
  }, [sessionEnabled, flushSegments, heartbeat, save]);

  /**
   * The learner ended the session ("סיום מפגש"): store the last progress and
   * segments, close the session on the server, and start the next playback
   * as a new session (new recorder, new session id).
   * @returns {Promise<object|null>} the ended session, or null when none was open
   */
  const finishSession = useCallback(async () => {
    recorderRef.current.interrupt();
    await save();
    await flushSegments();
    const { activeMs, breakMs } = clocks();
    const session = sessionRef.current;
    sessionRef.current = null;
    lastBeatRef.current = { active: -1, breaks: -1 };
    recorderRef.current = createSegmentRecorder({ sessionStartedAt: performance.now() });
    if (!session) return null;
    const sessionId = await session;
    if (!sessionId) return null;
    try {
      return await endLearningSession(sessionId, activeMs, { breakMs });
    } catch {
      return null;
    }
  }, [save, flushSegments]);

  return {
    progress,
    setProgress,
    saveError,
    finishSession,
    /** YouTube lessons: the learner started the session timer. */
    startTimedSession() {
      if (timed) ensureSession();
    },
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
      void heartbeat();
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
    sample(video, state, concentration, attentionScore = null) {
      if (!enabled || !video || !hasPlayedRef.current || video.paused) return;
      remember(video);
      recorderRef.current.sample({
        at: performance.now(),
        videoTime: video.currentTime,
        rate: video.playbackRate || 1,
        state,
        concentration,
        attentionScore,
      });
    },
  };
}
