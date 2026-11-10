import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import CameraPreview from './CameraPreview.jsx';
import FocusIllustration from '../../components/FocusIllustration.jsx';
import SignatureBrand from '../../components/SignatureBrand.jsx';
import { isAttentionEngineEnabled } from '../../config/featureFlags.js';

// Loaded only when the development flag is on, so production bundles do not
// include the new engine.
const AttentionEnginePanel = lazy(() => import('../attention-engine/AttentionEnginePanel.jsx'));
import './SmartLearningPage.css';

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
  // Read once per mount: the new engine (dev flag) or the legacy gaze experiment.
  const [attentionEngineEnabled] = useState(isAttentionEngineEnabled);
  const [video, setVideo] = useState(null);
  const [videoPlaybackState, setVideoPlaybackState] = useState('paused');
  const [sessionState, setSessionState] = useState('ready');
  const [personalizedAttention, setPersonalizedAttention] = useState({
    state: 'UNKNOWN',
    recalibrationSuggested: false,
    reason: 'calibration-unavailable',
    modelReady: false,
  });
  const [isCounting, setIsCounting] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const videoRef = useRef(null);
  const videoInputRef = useRef(null);
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
  function updatePersonalizedAttention(
    state,
    recalibrationSuggested = false,
    reason = null,
    modelReady,
  ) {
    setPersonalizedAttention((current) => ({
      state,
      recalibrationSuggested,
      reason: reason || (state === 'UNKNOWN' ? 'insufficient-measurements' : null),
      modelReady: typeof modelReady === 'boolean' ? modelReady : current.modelReady,
    }));
  }

  return (
    <main className="signature-production smart-learning-page gaze-experiment-page" dir="rtl" lang="he">
      <section className="signature-page signature-learning-page">
        <header className="signature-learning-header">
          <SignatureBrand />
          <nav aria-label="ניווט ראשי">
            <a href="/dashboard">לוח הבקרה</a>
            <a href="/learning" className="is-active" aria-current="page">למידה חכמה</a>
          </nav>
          <a className="signature-learning-back" href="/dashboard">חזרה ללוח הבקרה <span aria-hidden="true">←</span></a>
        </header>

        <div className="gaze-experiment">
          <div className="gaze-experiment-heading">
            <span>ניסוי למידה אישי</span>
            <h1>ניסוי זיהוי מבט</h1>
          </div>

          {attentionEngineEnabled ? (
            <Suspense fallback={<p role="status">טוענים את מנוע זיהוי המבט…</p>}>
              <AttentionEnginePanel />
            </Suspense>
          ) : (
          <>
          <section className="gaze-attention-card" aria-label="סטטוס זיהוי מבט">
            <span className="gaze-attention-kicker">זיהוי מבט בזמן אמת</span>
            <strong
              className={`gaze-attention-state signature-attention-state--${personalizedAttention.state.toLowerCase()}`}
              role="status"
              aria-live="polite"
              aria-label="סטטוס מבט על המסך"
            >
              {personalizedAttention.modelReady
                ? ({
                  LOOKING_AT_SCREEN: 'מסתכלת על המסך',
                  LOOKING_AWAY: 'מבט מחוץ למסך',
                  UNKNOWN: 'לא ניתן לקבוע',
                }[personalizedAttention.state] || 'לא ניתן לקבוע')
                : 'ממתין להשלמת כיול'}
            </strong>
            <p>
              {!personalizedAttention.modelReady
                ? 'השלימו את שלבי הכיול שמופיעים מתחת לתצוגת המצלמה כדי להתחיל בבדיקה.'
                : personalizedAttention.recalibrationSuggested
                  ? 'נראה שינוי בתנוחה. מומלץ לבצע כיול מחדש.'
                  : personalizedAttention.state === 'UNKNOWN'
                    ? ({
                      'face-not-detected': 'לא זוהו פנים. מקמו את הפנים מול המצלמה.',
                      'calibration-drift': 'התנוחה השתנתה ביחס לכיול. מומלץ לבצע כיול מחדש.',
                      'outside-calibration-coverage': 'המדידה מחוץ לטווח הכיול. שבו מול המסך.',
                      'insufficient-measurements': 'לא התקבלו מספיק מדידות יציבות. בדקו את מיקום הפנים והתאורה.',
                      'conflicting-feature-evidence': 'מדדי המבט אינם מסכימים. הביטו ישר והמתינו רגע.',
                      'ambiguous-calibration-match': 'המבט אינו תואם בבירור לדוגמאות הכיול.',
                      'calibration-unavailable': 'הכיול אינו זמין. יש להתחיל מחדש.',
                      'camera-unavailable': 'הפעילו את המצלמה כדי להמשיך בבדיקה.',
                      'analysis-paused': 'ההערכה נעצרה. הפעילו את המצלמה מחדש כדי להמשיך.',
                      'analysis-unavailable': 'לא ניתן להפעיל את הניתוח. נסו להפעיל מחדש את המצלמה.',
                    }[personalizedAttention.reason] || 'לא ניתן לקבוע את כיוון המבט כרגע.')
                    : 'ההערכה משתמשת במדידות הכיול האישי, ללא ציון ריכוז.'}
            </p>
          </section>

          <CameraPreview
            className="gaze-experiment-camera"
            videoPlaybackState={videoPlaybackState}
            onPersonalizedAttention={updatePersonalizedAttention}
            experimentMode
            modelReady={personalizedAttention.modelReady}
          />
          </>
          )}

          <details className="gaze-learning-tools">
            <summary>נגן וידאו, שעון למידה וכלים נוספים</summary>
            <div className="signature-learning-layout">
              <section className="signature-learning-main">
                <section className="signature-video-card" aria-labelledby="video-title">
                  <h2 className="signature-learning-video-title" id="video-title">נגן וידאו</h2>
                  <div className="signature-video-scene">
                    {video ? (
                      <video
                        ref={videoRef}
                        key={video.url}
                        className="local-video-player signature-local-video"
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
                </section>

                <div className="signature-learning-actions">
                  <span>
                    {sessionState === 'ready' && (video ? 'הפעילו את הסרטון כדי להתחיל את המפגש.' : 'בחרו סרטון כדי להתחיל מפגש למידה.')}
                    {sessionState === 'running' && 'הזמן נספר בזמן שהסרטון מופעל.'}
                    {sessionState === 'paused' && 'המפגש מושהה. אפשר להמשיך בניגון הסרטון.'}
                    {sessionState === 'ended' && 'המפגש הסתיים והזמן הסופי נשמר בתצוגה.'}
                    {sessionState === 'video-ended' && 'הסרטון הסתיים והזמן נעצר.'}
                  </span>
                  {(sessionState === 'running' || sessionState === 'paused') && (
                    <button className="signature-primary-button" type="button" onClick={endSession}>
                      סיום מפגש
                    </button>
                  )}
                  {(sessionState === 'ended' || sessionState === 'video-ended') && (
                    <button className="signature-primary-button" type="button" onClick={startNewSession} disabled={!video}>
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
                    <h2 id="timeline-title">ציר זמן של ריכוז</h2>
                    <p>ציר הזמן עדיין ריק</p>
                    <p>מדידות ריכוז עם חותמות זמן יוצגו כאן לאחר שהניתוח יהיה זמין.</p>
                    <span>עדיין לא נאספו מדידות</span>
                  </section>
                  <section aria-labelledby="replay-title">
                    <h2 id="replay-title">ReplayAI</h2>
                    <p>כשהניתוח באמצעות AI יהיה זמין, יוצגו כאן קטעי וידאו מומלצים לחזרה — בהתאם לרגעים שכדאי להתעמק בהם.</p>
                    <span>המלצות יופיעו כאן בעתיד</span>
                  </section>
                </div>
              </section>
              <aside className="signature-learning-side" aria-label="כלי למידה">
                <section className="signature-timer-card" aria-labelledby="session-title">
                  <small id="session-title">שעון מפגש</small>
                  <strong aria-label={`זמן למידה פעיל ${formatElapsed(elapsedSeconds)}`}>
                    <span>{formatElapsed(elapsedSeconds)}</span>
                  </strong>
                  <span>שעות : דקות : שניות</span>
                  <span role="status">{sessionStatus}</span>
                </section>
                <section className="signature-assistant-card" aria-labelledby="assistant-title">
                  <span aria-hidden="true">✧</span>
                  <small>מבט על התהליך</small>
                  <h2 id="assistant-title">Focus Monitor</h2>
                  <p>ניתוח ריכוז באמצעות AI יהיה זמין בקרוב</p>
                  <div className="signature-learning-monitor-metrics">
                    <div><span>ציון ריכוז עתידי</span><strong aria-label="עדיין אין נתונים">—</strong><small>יוצג לאחר הפעלת הניתוח</small></div>
                    <div><span>סטטוס ריכוז חי</span><strong>בהמתנה</strong><small>לא מתבצע ניתוח כרגע</small></div>
                    <div><span>ניתוח מצלמה</span><strong>לא הופעלה</strong><small>תצוגת המצלמה אינה מנותחת</small></div>
                  </div>
                </section>
              </aside>
            </div>
          </details>
          <p className="gaze-experiment-privacy">
            תצוגת המצלמה ונתוני הכיול נשארים בדפדפן ואינם מוקלטים או מועלים.
          </p>
        </div>
      </section>
    </main>
  );
}
