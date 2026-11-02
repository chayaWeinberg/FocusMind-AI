import { useEffect, useRef, useState } from 'react';
import CameraPreview from './CameraPreview.jsx';
import './SmartLearningPage.css';

function FocusLogo() {
  return (
    <svg className="learning-brand-mark" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M13 13 21 21M35 13 27 21M13 35l8-8m14 8-8-8" />
      <circle cx="24" cy="24" r="4.25" />
    </svg>
  );
}

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

export default function SmartLearningPage() {
  const [video, setVideo] = useState(null);
  const [videoPlaybackState, setVideoPlaybackState] = useState('paused');
  const [sessionState, setSessionState] = useState('ready');
  const [isCounting, setIsCounting] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const videoRef = useRef(null);
  const activeStartedAtRef = useRef(null);
  const elapsedMillisecondsRef = useRef(0);
  const manualEndRef = useRef(false);
  const mediaEndedRef = useRef(false);
  const seekingRef = useRef(false);

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
    startPlayback();
  }

  function handleVideoLoadStart() {
    setVideoPlaybackState('buffering');
  }

  function handleVideoPause() {
    setVideoPlaybackState(mediaEndedRef.current ? 'ended' : 'paused');
    if (manualEndRef.current || mediaEndedRef.current) return;
    if (activeStartedAtRef.current !== null) stopPlayback('paused');
  }

  function handleVideoWaiting() {
    setVideoPlaybackState('buffering');
    if (!manualEndRef.current && !mediaEndedRef.current && activeStartedAtRef.current !== null) {
      stopPlayback('paused');
    }
  }

  function handleVideoSeeking() {
    seekingRef.current = true;
    setVideoPlaybackState('buffering');
    if (!manualEndRef.current && !mediaEndedRef.current && activeStartedAtRef.current !== null) {
      stopPlayback('paused');
    }
  }

  function handleVideoSeeked() {
    seekingRef.current = false;
    const currentVideo = videoRef.current;
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

  return (
    <main className="smart-learning-page" dir="rtl" lang="he">
      <header className="learning-topbar">
        <a className="learning-brand" href="/dashboard" aria-label="FocusMind AI - לוח הבקרה">
          <FocusLogo />
          <span>FocusMind<span> AI</span></span>
        </a>
        <a className="learning-back-link" href="/dashboard">חזרה ללוח הבקרה</a>
      </header>

      <section className="learning-intro" aria-labelledby="learning-title">
        <span className="learning-eyebrow">מרחב למידה אישי</span>
        <h1 id="learning-title">למידה חכמה</h1>
        <p>צפו בתוכן בקצב שלכם ושמרו על זמן למידה ממוקד.</p>
      </section>

      <div className="learning-grid">
        <div className="video-stack">
          <section className="learning-card video-card" aria-labelledby="video-title">
            <div className="learning-card-heading">
              <div>
                <span className="learning-card-kicker">המרחב שלך לצפייה</span>
                <h2 id="video-title">נגן וידאו</h2>
              </div>
              <span className="learning-card-icon" aria-hidden="true">▶</span>
            </div>

            <div className={`video-stage${video ? ' video-stage--selected' : ''}`}>
              {video ? (
                <video
                  ref={videoRef}
                  key={video.url}
                  className="local-video-player"
                  src={video.url}
                  controls
                  playsInline
                  aria-label={`נגן וידאו: ${video.file.name}`}
                  onPlaying={handleVideoPlaying}
                  onPause={handleVideoPause}
                  onLoadStart={handleVideoLoadStart}
                  onWaiting={handleVideoWaiting}
                  onStalled={handleVideoWaiting}
                  onSeeking={handleVideoSeeking}
                  onSeeked={handleVideoSeeked}
                  onEnded={handleVideoEnded}
                >
                  הדפדפן שלך אינו תומך בניגון וידאו.
                </video>
              ) : (
                <div className="video-empty-state">
                  <span className="video-empty-icon" aria-hidden="true">▶</span>
                  <strong>בחרו סרטון כדי להתחיל</strong>
                  <p>הסרטון נשאר במכשיר שלכם ואינו מועלה לשרת.</p>
                </div>
              )}
            </div>

            <div className="video-toolbar">
              <div className="video-file-info" aria-live="polite">
                <span className="video-file-label">הסרטון שנבחר</span>
                <strong>{video?.file.name || 'עדיין לא נבחר סרטון'}</strong>
              </div>
              <label className="video-select-button">
                <input
                  className="visually-hidden"
                  type="file"
                  accept="video/*,.mp4,.webm,.ogg,.mov,.m4v"
                  aria-label={video ? 'בחירת סרטון אחר מהמכשיר' : 'בחירת סרטון מהמכשיר'}
                  onChange={chooseVideo}
                />
                {video ? 'בחירת סרטון אחר' : 'בחירת סרטון'}
              </label>
            </div>
          </section>
          <CameraPreview videoPlaybackState={videoPlaybackState} />
        </div>

        <section className="learning-card session-card" aria-labelledby="session-title">
          <div className="learning-card-heading">
            <div>
              <span className="learning-card-kicker">הקצב שלך, בדרך שלך</span>
              <h2 id="session-title">סשן למידה</h2>
            </div>
            <span className={`session-status session-status--${sessionState}`} role="status">
              <span aria-hidden="true" />
              {sessionStatus}
            </span>
          </div>

          <div className="session-clock" aria-label={`זמן למידה פעיל ${formatElapsed(elapsedSeconds)}`}>
            <span>{formatElapsed(elapsedSeconds)}</span>
            <small>שעות : דקות : שניות</small>
          </div>

          <p className="session-description">
            הזמן נספר רק בזמן שהסשן פעיל. הפסקות אינן נכללות.
          </p>

          <div className="session-controls">
            {sessionState === 'ready' && (
              <p className="session-hint">
                {video ? 'הפעילו את הסרטון כדי להתחיל את מפגש הלמידה.' : 'בחרו סרטון כדי להתחיל מפגש למידה.'}
              </p>
            )}
            {sessionState === 'running' || sessionState === 'paused' ? (
              <button className="session-end-button" type="button" onClick={endSession}>
                סיום מפגש
              </button>
            ) : sessionState === 'ended' || sessionState === 'video-ended' ? (
              <>
                <p className="session-hint">
                  {sessionState === 'ended' ? 'המפגש הסתיים. הזמן הסופי נשמר בתצוגה.' : 'הסרטון הסתיים והזמן נעצר.'}
                </p>
                <button className="session-primary-button" type="button" onClick={startNewSession} disabled={!video}>
                  התחלת מפגש חדש
                </button>
              </>
            ) : null}
          </div>
        </section>

        <section className="learning-card monitor-card" aria-labelledby="monitor-title">
          <div className="learning-card-heading">
            <div>
              <span className="learning-card-kicker">מבט על התהליך</span>
              <h2 id="monitor-title">Focus Monitor</h2>
            </div>
            <span className="learning-card-icon learning-card-icon--blue" aria-hidden="true">◎</span>
          </div>
          <p className="monitor-notice">ניתוח ריכוז באמצעות AI יהיה זמין בקרוב</p>
          <div className="monitor-metrics">
            <div className="monitor-metric">
              <span>ציון ריכוז עתידי</span>
              <strong className="metric-placeholder" aria-label="עדיין אין נתונים">—</strong>
              <small>יוצג לאחר הפעלת הניתוח</small>
            </div>
            <div className="monitor-metric">
              <span>סטטוס ריכוז חי</span>
              <strong className="metric-pending">בהמתנה</strong>
              <small>לא מתבצע ניתוח כרגע</small>
            </div>
            <div className="monitor-metric">
              <span>ניתוח מצלמה</span>
              <strong className="metric-pending">לא הופעלה</strong>
              <small>תצוגת המצלמה אינה מנותחת</small>
            </div>
          </div>
        </section>

        <section className="learning-card timeline-card" aria-labelledby="timeline-title">
          <div className="learning-card-heading">
            <div>
              <span className="learning-card-kicker">לאורך הסשן</span>
              <h2 id="timeline-title">ציר זמן של ריכוז</h2>
            </div>
            <span className="learning-card-icon learning-card-icon--blue" aria-hidden="true">⌁</span>
          </div>
          <div className="timeline-empty-state">
            <div className="timeline-illustration" aria-hidden="true">
              <span /><span /><span /><span /><span />
            </div>
            <strong>ציר הזמן עדיין ריק</strong>
            <p>מדידות ריכוז עם חותמות זמן יוצגו כאן לאחר שהניתוח יהיה זמין.</p>
            <span className="timeline-empty-badge">עדיין לא נאספו מדידות</span>
          </div>
        </section>

        <section className="learning-card replay-card" aria-labelledby="replay-title">
          <div className="replay-art" aria-hidden="true">
            <span className="replay-play">▶</span>
            <span className="replay-spark replay-spark--one">✦</span>
            <span className="replay-spark replay-spark--two">✧</span>
          </div>
          <div className="replay-copy">
            <span className="learning-card-kicker">למידה חכמה יותר</span>
            <h2 id="replay-title">ReplayAI</h2>
            <p>כשהניתוח באמצעות AI יהיה זמין, יוצגו כאן קטעי וידאו מומלצים לחזרה — בהתאם לרגעים שכדאי להתעמק בהם.</p>
            <span className="replay-coming-soon">המלצות יופיעו כאן בעתיד</span>
          </div>
        </section>
      </div>
      <p className="learning-privacy-note">
        הסרטונים מנוגנים מקומית בדפדפן ואינם נשמרים או מועלים לשרת.
      </p>
    </main>
  );
}
