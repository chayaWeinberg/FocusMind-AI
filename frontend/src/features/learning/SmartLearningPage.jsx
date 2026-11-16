import { useCallback, useEffect, useRef, useState } from 'react';
import FocusIllustration from '../../components/FocusIllustration.jsx';
import SignatureBrand from '../../components/SignatureBrand.jsx';
import AttentionMonitor from './AttentionMonitor.jsx';
import AttentionSessionSummary, { AttentionTimeline } from './AttentionSessionSummary.jsx';
import { createAttentionSessionStats } from './attentionSessionStats.js';
import { resumePosition } from './lessonPlayback.js';
import useLessonPersistence from './useLessonPersistence.js';
import LessonHeader, { LessonStatusBar } from './LessonHeader.jsx';
import SmartTimerCard from './SmartTimerCard.jsx';
import { DEFAULT_PREFERENCES, createBreakClock, shouldRemindBreak, studyBlock } from './smartTimer.js';
import { getPreferences, savePreferences } from './learningApi.js';
import ReplayPanel from '../replay/ReplayPanel.jsx';
import useLessonReplay from '../replay/useLessonReplay.js';
import { itemRange, replayStart, replayStep } from '../replay/replayLogic.js';
import QuizPanel from '../quiz/QuizPanel.jsx';
import useLoader from '../courses/useLoader.js';
import { getLessonContext } from '../courses/coursesApi.js';
import { courseUrl } from '../courses/courseRoutes.js';
import './SmartLearningPage.css';
import './AttentionMonitor.css';
import './LessonPlayer.css';

const STATS_TICK_MS = 500;

function formatElapsed(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ].join(':');
}

function playableSourceOf(lessonVideo) {
  if (!lessonVideo) return null;
  if (lessonVideo.sourceType === 'upload') return lessonVideo.url;
  if (lessonVideo.sourceType === 'external' && lessonVideo.provider === 'direct') return lessonVideo.url;
  return null;
}

function videoErrorMessage(lessonVideo, error) {
  if (lessonVideo?.sourceType === 'external') {
    return 'לא ניתן לנגן את הסרטון מהקישור. ייתכן שסינון אינטרנט (למשל NetFree) חוסם קבצי וידאו מהאתר, שהאתר המארח חוסם ניגון מאתרים אחרים, שהקישור אינו זמין, או שהפורמט אינו נתמך בדפדפן.';
  }
  if (lessonVideo?.sourceType === 'upload') {
    return error?.code === 4
      ? 'הדפדפן אינו תומך בקידוד של הסרטון הזה. נסו להעלות קובץ MP4 (H.264) או WebM.'
      : 'לא הצלחנו לטעון את הסרטון. בדקו את החיבור ונסו לרענן את הדף.';
  }
  return 'הדפדפן אינו יכול לנגן את הקובץ הזה.';
}

/**
 * Smart Learning player. Without `lessonId` it plays a local file chosen by
 * the user (nothing is uploaded). With `lessonId` it is the lesson player of
 * the Courses system: it loads the lesson's video, restores the saved
 * position, saves progress and records attention segments.
 */
export default function SmartLearningPage({ lessonId = null, replayItemId = null }) {
  const [video, setVideo] = useState(null);
  const [, setVideoPlaybackState] = useState('paused');
  const [sessionState, setSessionState] = useState('ready');
  const [isCounting, setIsCounting] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const videoRef = useRef(null);
  const videoInputRef = useRef(null);
  const activeStartedAtRef = useRef(null);
  const elapsedMillisecondsRef = useRef(0);
  const manualEndRef = useRef(false);
  const mediaEndedRef = useRef(false);
  const seekingRef = useRef(false);
  // Attention statistics: the latest measured state (null = not measured) is
  // attributed to session time while the session timer runs.
  const statsRef = useRef(null);
  if (!statsRef.current) statsRef.current = createAttentionSessionStats();
  const attentionStateRef = useRef(null);
  const concentrationRef = useRef(null);
  const [attentionStats, setAttentionStats] = useState(() => statsRef.current.snapshot());

  const handleAttentionState = useCallback((state, concentration = null) => {
    attentionStateRef.current = state;
    concentrationRef.current = concentration;
  }, []);

  const statsGenerationRef = useRef(0);

  // --- course lesson mode ---------------------------------------------------
  const lessonMode = Boolean(lessonId);
  const lessonContext = useLoader(
    () => (lessonId ? getLessonContext(lessonId) : Promise.resolve(null)),
    [lessonId],
  );
  const context = lessonContext.data;
  const lesson = context?.lesson ?? null;
  const lessonVideo = lesson?.video ?? null;
  const canLearn = Boolean(context?.canLearn);
  const lessonSource = canLearn ? playableSourceOf(lessonVideo) : null;
  const embedSource = canLearn && lessonVideo?.provider === 'youtube' ? lessonVideo.embedUrl : null;
  // A web page that shows the video: opened on the external site, never played here.
  const externalPage = canLearn && lessonVideo?.provider === 'page' ? lessonVideo.url : null;
  const manualTimer = Boolean(embedSource || externalPage);
  const videoSource = lessonMode ? lessonSource : video?.url ?? null;
  const [videoError, setVideoError] = useState('');
  const [resumeNotice, setResumeNotice] = useState(null);
  const restoredRef = useRef(false);

  const currentActiveMs = useCallback(() => {
    const startedAt = activeStartedAtRef.current;
    return elapsedMillisecondsRef.current + (startedAt === null ? 0 : performance.now() - startedAt);
  }, []);

  // --- Smart Timer: breaks and study blocks ----------------------------------
  const breakClockRef = useRef(null);
  if (!breakClockRef.current) breakClockRef.current = createBreakClock();
  const [onBreak, setOnBreak] = useState(false);
  const [, setBreakTick] = useState(0);
  const [blockStartMs, setBlockStartMs] = useState(0);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [videoPosition, setVideoPosition] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getPreferences()
      .then((stored) => { if (!cancelled && stored) setPreferences({ ...DEFAULT_PREFERENCES, ...stored }); })
      .catch(() => {}); // defaults work without the server
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!onBreak) return undefined;
    const id = window.setInterval(() => setBreakTick((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [onBreak]);

  // --- ReplayAI -------------------------------------------------------------
  const trackableLesson = lessonMode && Boolean(lessonSource);
  const replay = useLessonReplay(lessonId, trackableLesson);
  const replayRef = useRef(null); // { item, phase: 'playing' | 'finished' }
  const [replayState, setReplayState] = useState(null);
  const [replayNotice, setReplayNotice] = useState('');
  const [metadataReady, setMetadataReady] = useState(false);
  const pendingReplayRef = useRef(replayItemId);
  const replayReloadRef = useRef(replay.reload);
  replayReloadRef.current = replay.reload;

  const persistence = useLessonPersistence({
    lessonId,
    enabled: trackableLesson,
    timed: lessonMode && manualTimer,
    initialProgress: lesson?.progress ?? null,
    getActiveMs: currentActiveMs,
    getBreakMs: () => breakClockRef.current.totalMs(),
    onSegmentsSaved: () => void replayReloadRef.current({ quiet: true }),
  });
  const persistenceRef = useRef(persistence);
  persistenceRef.current = persistence;

  function handleLoadedMetadata() {
    const element = videoRef.current;
    if (!lessonMode || !element || restoredRef.current) return;
    restoredRef.current = true;
    setMetadataReady(true);
    if (pendingReplayRef.current) return; // opened from ReplayAI: the replay sets the position
    const position = resumePosition(persistence.progress ?? lesson?.progress, element.duration);
    if (position > 0) {
      element.currentTime = position;
      setResumeNotice(position);
    }
  }

  function setReplay(next) {
    replayRef.current = next;
    setReplayState(next);
  }

  function startReplay(item) {
    const element = videoRef.current;
    if (!element) return;
    if (onBreak) endBreak();
    setResumeNotice(null);
    setReplayNotice('');
    setReplay(item.endSeconds == null ? null : { item, phase: 'playing' });
    if (item.endSeconds == null) setReplayNotice(`מנגנים מהסימנייה (${itemRange(item)}).`);
    element.currentTime = replayStart(item);
    const playing = element.play?.();
    if (playing && typeof playing.catch === 'function') {
      playing.catch(() => setReplayNotice('הנגן מוכן בתחילת הקטע. לחצו על ▶ בנגן כדי לנגן.'));
    }
  }

  function exitReplay() {
    setReplay(null);
    setReplayNotice('');
  }

  async function markReplayReviewed() {
    const current = replayRef.current;
    if (!current) return;
    const updated = await replay.setStatus(current.item, 'reviewed');
    if (updated) setReplay({ ...current, item: updated });
  }

  function handleTimeUpdate() {
    const element = videoRef.current;
    persistence.onTimeUpdate(element);
    if (!element) return;
    const second = Math.floor(element.currentTime || 0);
    setVideoPosition((previous) => (previous === second ? previous : second));
    const current = replayRef.current;
    if (current?.phase !== 'playing') return;
    const step = replayStep(current.item, element.currentTime);
    if (step === 'finish') {
      element.pause();
      setReplay({ ...current, phase: 'finished' });
    } else if (step === 'exit') {
      setReplay(null);
    }
  }

  // Opened from the review page: play the chosen interval once both the
  // suggestions and the video are ready.
  useEffect(() => {
    const pending = pendingReplayRef.current;
    if (!pending || !metadataReady || replay.status !== 'ready') return;
    pendingReplayRef.current = null;
    const item = replay.items.find((entry) => entry.id === pending);
    if (item) startReplay(item);
    else setReplayNotice('הקטע המבוקש כבר אינו קיים. אפשר לבחור קטע אחר מהרשימה.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metadataReady, replay.status, replay.items]);

  function startBreak() {
    const element = videoRef.current;
    if (element && !element.paused) element.pause();
    if (activeStartedAtRef.current !== null) stopPlayback('paused');
    breakClockRef.current.start();
    setOnBreak(true);
  }

  function endBreak() {
    breakClockRef.current.stop();
    setOnBreak(false);
    setBlockStartMs(currentActiveMs());
  }

  function resetSmartTimer() {
    breakClockRef.current.reset();
    setOnBreak(false);
    setBlockStartMs(0);
  }

  async function storePreferences(values) {
    const saved = await savePreferences(values);
    setPreferences({ ...DEFAULT_PREFERENCES, ...saved });
  }

  function restartFromBeginning() {
    const element = videoRef.current;
    if (element) element.currentTime = 0;
    setResumeNotice(null);
  }

  function handleVideoError() {
    setVideoError(videoErrorMessage(lessonMode ? lessonVideo : null, videoRef.current?.error));
    if (activeStartedAtRef.current !== null) stopPlayback('paused');
  }

  function resetAttentionStats() {
    statsGenerationRef.current += 1; // drops time still pending from the previous session
    statsRef.current.reset();
    setAttentionStats(statsRef.current.snapshot());
  }

  useEffect(() => {
    if (!video?.url) return undefined;
    return () => URL.revokeObjectURL(video.url);
  }, [video]);

  useEffect(() => {
    if (!isCounting) return undefined;
    const intervalId = window.setInterval(() => {
      const activeStartedAt = activeStartedAtRef.current;
      if (activeStartedAt === null) return;
      const seconds = Math.floor(
        (elapsedMillisecondsRef.current + performance.now() - activeStartedAt) / 1000,
      );
      setElapsedSeconds(seconds);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isCounting]);

  useEffect(() => {
    if (!isCounting) return undefined;
    const stats = statsRef.current;
    const generation = statsGenerationRef.current;
    let lastTick = performance.now();
    const flush = () => {
      if (statsGenerationRef.current !== generation) return;
      const now = performance.now();
      stats.add(attentionStateRef.current, now - lastTick, concentrationRef.current);
      persistenceRef.current.sample(videoRef.current, attentionStateRef.current, concentrationRef.current);
      lastTick = now;
      setAttentionStats(stats.snapshot());
    };
    const intervalId = window.setInterval(flush, STATS_TICK_MS);
    return () => {
      window.clearInterval(intervalId);
      flush();
    };
  }, [isCounting]);

  function updateSessionState(nextState) {
    setSessionState(nextState);
  }

  function stopPlayback(nextState) {
    const activeStartedAt = activeStartedAtRef.current;
    if (activeStartedAt !== null) {
      elapsedMillisecondsRef.current += Math.max(0, performance.now() - activeStartedAt);
      activeStartedAtRef.current = null;
    }

    setIsCounting(false);
    setElapsedSeconds(Math.floor(elapsedMillisecondsRef.current / 1000));
    if (nextState) updateSessionState(nextState);
  }

  function startPlayback() {
    if (manualEndRef.current || mediaEndedRef.current || seekingRef.current) return;
    if (activeStartedAtRef.current === null) {
      activeStartedAtRef.current = performance.now();
    }
    setIsCounting(true);
    updateSessionState('running');
  }

  function handleVideoPlaying() {
    setVideoPlaybackState('playing');
    setVideoError('');
    persistence.onPlaying(videoRef.current);
    startPlayback();
  }

  function handleVideoLoadStart() {
    setVideoPlaybackState('buffering');
  }

  function handleVideoPause() {
    setVideoPlaybackState(mediaEndedRef.current ? 'ended' : 'paused');
    if (!mediaEndedRef.current) persistence.onStop(videoRef.current);
    if (manualEndRef.current || mediaEndedRef.current) return;
    if (activeStartedAtRef.current !== null) stopPlayback('paused');
  }

  function handleVideoWaiting() {
    setVideoPlaybackState('buffering');
    persistence.onSeeking();
    if (!manualEndRef.current && !mediaEndedRef.current && activeStartedAtRef.current !== null) {
      stopPlayback('paused');
    }
  }

  function handleVideoSeeking() {
    seekingRef.current = true;
    persistence.onSeeking();
    setVideoPlaybackState('buffering');
    if (!manualEndRef.current && !mediaEndedRef.current && activeStartedAtRef.current !== null) {
      stopPlayback('paused');
    }
  }

  function handleVideoSeeked() {
    seekingRef.current = false;
    const currentVideo = videoRef.current;
    persistence.onSeeked(currentVideo);
    if (
      currentVideo
      && !currentVideo.paused
      && currentVideo.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA
    ) {
      startPlayback();
    } else {
      setVideoPlaybackState('paused');
    }
  }

  function handleVideoEnded() {
    persistence.onStop(videoRef.current, { ended: true });
    mediaEndedRef.current = true;
    setVideoPlaybackState('ended');
    stopPlayback('video-ended');
  }

  function chooseVideo(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    manualEndRef.current = true;
    stopPlayback();
    videoRef.current?.pause();
    const url = URL.createObjectURL(file);
    elapsedMillisecondsRef.current = 0;
    resetAttentionStats();
    resetSmartTimer();
    setElapsedSeconds(0);
    mediaEndedRef.current = false;
    seekingRef.current = false;
    setVideoPlaybackState('paused');
    manualEndRef.current = false;
    updateSessionState('ready');
    setVideo({ file, url });
  }

  function endSession() {
    manualEndRef.current = true;
    stopPlayback('ended');
    videoRef.current?.pause();
  }

  function startNewSession() {
    manualEndRef.current = false;
    mediaEndedRef.current = false;
    seekingRef.current = false;
    setVideoPlaybackState('paused');
    elapsedMillisecondsRef.current = 0;
    resetAttentionStats();
    resetSmartTimer();
    setElapsedSeconds(0);
    updateSessionState('ready');
    const currentVideo = videoRef.current;
    if (currentVideo && currentVideo.ended) {
      currentVideo.currentTime = 0;
    }
  }

  const sessionStatus = {
    ready: 'מוכנים להתחיל',
    running: 'הסשן פעיל',
    paused: 'הסשן מושהה',
    'video-ended': 'הסרטון הסתיים',
    ended: 'המפגש הסתיים',
  }[sessionState];

  const sessionHint = lessonMode && manualTimer
    ? (externalPage
      ? 'הסרטון נפתח באתר החיצוני. אפשר להפעיל את שעון המפגש ידנית בזמן הצפייה, ולסמן את השיעור כהושלם בסיום.'
      : 'בסרטון YouTube מפעילים את שעון המפגש ידנית. מיקום הצפייה אינו נשמר, ולכן מסמנים את השיעור כהושלם בסיום.')
    : {
      ready: (video || lessonSource) ? 'הפעילו את הסרטון כדי להתחיל את המפגש.' : (lessonMode ? '' : 'בחרו סרטון כדי להתחיל מפגש למידה.'),
      running: 'הזמן נספר בזמן שהסרטון מופעל.',
      paused: 'המפגש מושהה. אפשר להמשיך בניגון הסרטון.',
      ended: 'המפגש הסתיים והזמן הסופי נשמר בתצוגה.',
      'video-ended': 'הסרטון הסתיים והזמן נעצר.',
    }[sessionState];

  const videoElement = videoSource ? (
    <video
      ref={videoRef}
      key={videoSource}
      className="local-video-player signature-local-video"
      src={videoSource}
      controls
      playsInline
      preload="metadata"
      aria-label={`נגן וידאו: ${lessonMode ? lesson?.title : video?.file.name}`}
      onPlaying={handleVideoPlaying}
      onPause={handleVideoPause}
      onLoadStart={handleVideoLoadStart}
      onLoadedMetadata={handleLoadedMetadata}
      onTimeUpdate={handleTimeUpdate}
      onWaiting={handleVideoWaiting}
      onStalled={handleVideoWaiting}
      onSeeking={handleVideoSeeking}
      onSeeked={handleVideoSeeked}
      onEnded={handleVideoEnded}
      onError={handleVideoError}
    >
      הדפדפן שלך אינו תומך בניגון וידאו.
    </video>
  ) : null;

  function lessonScene() {
    if (lessonContext.status === 'loading') {
      return <div className="lesson-scene-message" role="status"><span className="route-loading-spinner" aria-hidden="true" /> טוענים את השיעור…</div>;
    }
    if (lessonContext.status === 'error') {
      return (
        <div className="lesson-scene-message" role="alert">
          <strong>{lessonContext.error}</strong>
          <a href="/courses">חזרה לקורסים שלי</a>
        </div>
      );
    }
    if (!canLearn) {
      return (
        <div className="lesson-scene-message">
          <strong>כדי ללמוד את השיעור צריך להירשם לקורס.</strong>
          <a href={courseUrl(context.course.id)}>לעמוד הקורס ולהרשמה</a>
        </div>
      );
    }
    if (videoElement) return videoElement;
    if (embedSource) {
      return (
        <iframe
          className="lesson-embed"
          src={embedSource}
          title={`סרטון YouTube: ${lesson.title}`}
          allow="encrypted-media; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          allowFullScreen
        />
      );
    }
    if (externalPage) {
      return (
        <div className="lesson-scene-message lesson-external-page">
          <strong>הסרטון של השיעור נמצא באתר חיצוני</strong>
          <span>{lessonVideo.sourceName || 'עמוד וידאו חיצוני'}</span>
          <a
            className="signature-primary-button"
            href={externalPage}
            target="_blank"
            rel="noopener noreferrer"
          >
            פתיחת הסרטון באתר החיצוני <span aria-hidden="true">↗</span>
          </a>
          <small>
            הסרטון אינו מתנגן בתוך FocusMind, ולכן מיקום הצפייה לא נשמר, ו-ReplayAI המסונכרן למעקב הקשב אינו זמין בשיעור הזה.
          </small>
        </div>
      );
    }
    return (
      <div className="lesson-scene-message">
        <strong>לשיעור הזה עדיין אין סרטון.</strong>
        {context.course.canEdit
          ? <a href={`/courses/${encodeURIComponent(context.course.id)}/edit`}>הוספת סרטון לשיעור</a>
          : <span>הסרטון יתווסף בהמשך.</span>}
      </div>
    );
  }

  return (
    <main className="signature-production smart-learning-page" dir="rtl" lang="he">
      <section className="signature-page signature-learning-page" aria-labelledby="learning-title">
        {lessonMode ? (
          <LessonHeader context={context} />
        ) : (
          <>
            <header className="signature-learning-header">
              <SignatureBrand />
              <nav aria-label="ניווט ראשי">
                <a href="/dashboard">לוח הבקרה</a>
                <a href="/courses">הקורסים שלי</a>
                <a href="/learning" className="is-active" aria-current="page">למידה חכמה</a>
                <a href="/review">חזרה חכמה</a>
                <a href="/insights">תובנות</a>
              </nav>
              <a className="signature-learning-back" href="/dashboard">חזרה ללוח הבקרה <span aria-hidden="true">←</span></a>
            </header>

            <div className="smart-learning-heading">
              <span>המרחב שלך ללמידה</span>
              <h1 id="learning-title">למידה חכמה</h1>
            </div>
          </>
        )}

        <div className="signature-learning-layout">
          <section className="signature-learning-main">
            <section className="signature-video-card" aria-labelledby="video-title">
              <h2 className="signature-learning-video-title" id="video-title">נגן וידאו</h2>
              <div className="signature-video-scene">
                {lessonMode ? lessonScene() : videoElement ?? (
                  <>
                    <FocusIllustration type="smart" />
                    <div className="signature-video-overlay">
                      <button type="button" onClick={() => videoInputRef.current?.click()} aria-label="פתיחת בחירת סרטון">
                        ▶
                      </button>
                      <strong>בחרו סרטון כדי להתחיל</strong>
                      <span className="signature-video-empty-copy">הסרטון נשאר במכשיר שלכם ואינו מועלה לשרת.</span>
                    </div>
                  </>
                )}
              </div>
              {lessonMode ? (
                <div className="signature-video-toolbar lesson-toolbar">
                  {resumeNotice !== null && (
                    <span role="status">
                      ממשיכים מהמקום שבו עצרתם ({formatElapsed(Math.floor(resumeNotice))}).
                      {' '}
                      <button type="button" className="lesson-inline-button" onClick={restartFromBeginning}>להתחיל מההתחלה</button>
                    </span>
                  )}
                  {videoError && (
                    <span className="lesson-video-error" role="alert">
                      {videoError}
                      {lessonVideo?.sourceUrl && (
                        <> <a href={lessonVideo.sourceUrl} target="_blank" rel="noopener noreferrer">פתיחת עמוד המקור של הסרטון ↗</a></>
                      )}
                    </span>
                  )}
                  {lessonVideo?.sourceName && (
                    <small className="lesson-attribution">
                      מקור: {lessonVideo.sourceName}
                      {lessonVideo.license && <> · רישיון {lessonVideo.license}</>}
                      {lessonVideo.sourceUrl && <> · <a href={lessonVideo.sourceUrl} target="_blank" rel="noopener noreferrer">עמוד המקור ↗</a></>}
                    </small>
                  )}
                  {replayState && (
                    <div className="replay-banner" role="status">
                      <span>
                        <b>מצב חזרה</b> · <span dir="ltr">{itemRange(replayState.item)}</span>
                        {' · '}{replayState.phase === 'finished' ? 'הקטע הסתיים.' : 'מנגנים את הקטע ועוצרים בסופו.'}
                      </span>
                      <span className="replay-banner-actions">
                        <button type="button" className="signature-secondary-button" onClick={() => startReplay(replayState.item)}>ניגון חוזר</button>
                        {replayState.item.status !== 'reviewed' && (
                          <button type="button" className="signature-secondary-button" onClick={markReplayReviewed}>סימון כנבדק</button>
                        )}
                        <button type="button" className="lesson-inline-button" onClick={exitReplay}>יציאה ממצב חזרה</button>
                      </span>
                    </div>
                  )}
                  {!replayState && replayNotice && <span role="status">{replayNotice}</span>}
                </div>
              ) : (
                <div className="signature-video-toolbar">
                  <span aria-live="polite">{video?.file.name || 'עדיין לא נבחר סרטון'}</span>
                  <label htmlFor="learning-video-input">
                    {video ? 'בחירת סרטון אחר' : 'בחירת סרטון'}
                  </label>
                  <input
                    ref={videoInputRef}
                    id="learning-video-input"
                    className="visually-hidden"
                    type="file"
                    accept="video/*,.mp4,.webm,.ogg,.mov,.m4v"
                    aria-label={video ? 'בחירת סרטון אחר מהמכשיר' : 'בחירת סרטון מהמכשיר'}
                    onChange={chooseVideo}
                  />
                </div>
              )}
            </section>

            {lessonMode && context && (
              <LessonStatusBar
                context={context}
                progress={persistence.progress}
                onProgress={persistence.setProgress}
                saveError={persistence.saveError}
              />
            )}

            <div className="signature-learning-actions">
              <span>{sessionHint}</span>
              {lessonMode && manualTimer && (sessionState === 'ready' || sessionState === 'paused') && (
                <button className="signature-primary-button" type="button" onClick={() => { persistence.startTimedSession(); startPlayback(); }} disabled={onBreak}>
                  הפעלת שעון המפגש
                </button>
              )}
              {lessonMode && manualTimer && sessionState === 'running' && (
                <button className="signature-secondary-button" type="button" onClick={() => stopPlayback('paused')}>
                  השהיית השעון
                </button>
              )}
              {(sessionState === 'running' || sessionState === 'paused') && (
                <button className="signature-primary-button" type="button" onClick={endSession}>
                  סיום מפגש
                </button>
              )}
              {(sessionState === 'ended' || sessionState === 'video-ended') && (
                <button className="signature-primary-button" type="button" onClick={startNewSession} disabled={!video && !lessonMode}>
                  התחלת מפגש חדש <span aria-hidden="true">←</span>
                </button>
              )}
            </div>
            <div className="signature-learning-secondary">
              <section aria-labelledby="timeline-title">
                <h2 id="timeline-title">ציר זמן של כיוון המבט</h2>
                <AttentionTimeline timeline={attentionStats.timeline} />
              </section>
              {!lessonMode && (
                <section aria-labelledby="replay-local-title">
                  <h2 id="replay-local-title">ReplayAI</h2>
                  <p>
                    בסרטון מקומי שום דבר לא נשמר בשרת, ולכן אין המלצות לחזרה.
                    כדי לקבל קטעים מומלצים לחזרה, למדו שיעור מתוך קורס.
                  </p>
                  <a className="course-link" href="/courses">לקורסים שלי <span aria-hidden="true">←</span></a>
                </section>
              )}
            </div>
            {lessonMode && context && canLearn && (
              <ReplayPanel
                replay={replay}
                trackable={Boolean(lessonSource)}
                hasVideo={Boolean(lessonSource || embedSource || externalPage)}
                provider={lessonVideo?.provider}
                getCurrentTime={() => videoRef.current?.currentTime ?? 0}
                getDuration={() => videoRef.current?.duration}
                onPlay={startReplay}
                activeItemId={replayState?.item.id}
              />
            )}
            {lessonMode && context && canLearn && lessonVideo?.sourceType !== 'none' && <QuizPanel lessonId={lessonId} />}
          </section>

          <aside className="signature-learning-side" aria-label="כלי למידה">
            <AttentionMonitor onStateChange={handleAttentionState} sessionRunning={sessionState === 'running'} />
            <SmartTimerCard
              elapsedSeconds={elapsedSeconds}
              statusText={sessionStatus}
              videoPosition={videoSource ? videoPosition : null}
              preferences={preferences}
              onSavePreferences={storePreferences}
              block={studyBlock(elapsedSeconds * 1000, blockStartMs, preferences.studyMinutes)}
              onBreak={onBreak}
              breakSeconds={Math.floor(breakClockRef.current.currentMs() / 1000)}
              breakTotalSeconds={Math.floor(breakClockRef.current.totalMs() / 1000)}
              onStartBreak={startBreak}
              onEndBreak={endBreak}
              remindBreak={shouldRemindBreak({ preferences, activeMs: elapsedSeconds * 1000, blockStartMs, onBreak })}
              onSnooze={() => setBlockStartMs(currentActiveMs())}
              canBreak={Boolean(videoSource || manualTimer)}
            />
            <AttentionSessionSummary stats={attentionStats} />
          </aside>
        </div>
      </section>
    </main>
  );
}
