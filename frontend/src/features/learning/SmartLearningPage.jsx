import { useCallback, useEffect, useRef, useState } from 'react';
import FocusIllustration from '../../components/FocusIllustration.jsx';
import SignatureBrand from '../../components/SignatureBrand.jsx';
import AttentionMonitor from './AttentionMonitor.jsx';
import AttentionSessionSummary, { AttentionTimeline } from './AttentionSessionSummary.jsx';
import { createAttentionSessionStats } from './attentionSessionStats.js';
import { resumePosition } from './lessonPlayback.js';
import useLessonPersistence from './useLessonPersistence.js';
import LessonHeader, { LessonStatusBar } from './LessonHeader.jsx';
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
    return 'לא ניתן לנגן את הסרטון מהקישור. ייתכן שהאתר המארח חוסם ניגון מאתרים אחרים, שהקישור אינו זמין, או שהפורמט אינו נתמך בדפדפן.';
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
export default function SmartLearningPage({ lessonId = null }) {
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
  const videoSource = lessonMode ? lessonSource : video?.url ?? null;
  const [videoError, setVideoError] = useState('');
  const [resumeNotice, setResumeNotice] = useState(null);
  const restoredRef = useRef(false);

  const currentActiveMs = useCallback(() => {
    const startedAt = activeStartedAtRef.current;
    return elapsedMillisecondsRef.current + (startedAt === null ? 0 : performance.now() - startedAt);
  }, []);
  const persistence = useLessonPersistence({
    lessonId,
    enabled: lessonMode && Boolean(lessonSource),
    initialProgress: lesson?.progress ?? null,
    getActiveMs: currentActiveMs,
  });
  const persistenceRef = useRef(persistence);
  persistenceRef.current = persistence;

  function handleLoadedMetadata() {
    const element = videoRef.current;
    if (!lessonMode || !element || restoredRef.current) return;
    restoredRef.current = true;
    const position = resumePosition(persistence.progress ?? lesson?.progress, element.duration);
    if (position > 0) {
      element.currentTime = position;
      setResumeNotice(position);
    }
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

  const sessionHint = lessonMode && embedSource
    ? 'בסרטון YouTube מפעילים את שעון המפגש ידנית. מיקום הצפייה אינו נשמר, ולכן מסמנים את השיעור כהושלם בסיום.'
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
      onTimeUpdate={() => persistence.onTimeUpdate(videoRef.current)}
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
                  {videoError && <span className="lesson-video-error" role="alert">{videoError}</span>}
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
              {lessonMode && embedSource && (sessionState === 'ready' || sessionState === 'paused') && (
                <button className="signature-primary-button" type="button" onClick={startPlayback}>
                  הפעלת שעון המפגש
                </button>
              )}
              {lessonMode && embedSource && sessionState === 'running' && (
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
            <section className="signature-learning-progress" aria-label="זמן הלמידה במפגש">
              <div><small>מטרת המפגש</small><strong>לא הוגדרה עדיין</strong></div>
              <div className="signature-progress-empty" aria-label="לא הוגדרה עדיין מטרת זמן" />
              <b>{sessionState === 'running' ? 'פעיל' : sessionState === 'paused' ? 'מושהה' : '—'}</b>
            </section>
            <div className="signature-learning-secondary">
              <section aria-labelledby="timeline-title">
                <h2 id="timeline-title">ציר זמן של כיוון המבט</h2>
                <AttentionTimeline timeline={attentionStats.timeline} />
              </section>
              <section aria-labelledby="replay-title">
                <h2 id="replay-title">ReplayAI</h2>
                <p>בעתיד יוצגו כאן קטעי וידאו מומלצים לחזרה, לפי הרגעים שכדאי להתעמק בהם.</p>
                {lessonMode && lessonSource && (
                  <p>בשיעור הזה נשמרים מצבי הקשב לפי זמן בסרטון (בלי תמונות מהמצלמה), כהכנה להמלצות.</p>
                )}
                <span>המלצות יופיעו כאן בעתיד</span>
              </section>
            </div>
          </section>

          <aside className="signature-learning-side" aria-label="כלי למידה">
            <AttentionMonitor onStateChange={handleAttentionState} sessionRunning={sessionState === 'running'} />
            <section className="signature-timer-card" aria-labelledby="session-title">
              <small id="session-title">שעון מפגש</small>
              <strong aria-label={`זמן למידה פעיל ${formatElapsed(elapsedSeconds)}`}>
                <span>{formatElapsed(elapsedSeconds)}</span>
              </strong>
              <span>שעות : דקות : שניות</span>
              <span role="status">{sessionStatus}</span>
            </section>
            <AttentionSessionSummary stats={attentionStats} />
          </aside>
        </div>
      </section>
    </main>
  );
}
