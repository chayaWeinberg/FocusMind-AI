// What a lesson's video can actually do in FocusMind. Shown on course pages
// and in the player, so nothing advertises attention tracking or ReplayAI
// where they cannot work.

export const LEARNING_MODES = Object.freeze({
  smart: {
    key: 'smart',
    label: 'למידה חכמה מלאה',
    detail: 'מתנגן בתוך FocusMind: שמירת התקדמות, מעקב קשב מסונכרן לזמן הסרטון ו-ReplayAI.',
  },
  embedded: {
    key: 'embedded',
    label: 'וידאו מוטמע – מעקב חלקי',
    detail: 'YouTube מתנגן בתוך הדף, אבל מיקום הצפייה אינו נשמר, ואין מעקב קשב או ReplayAI. השעון מופעל ידנית.',
  },
  external: {
    key: 'external',
    label: 'קישור חיצוני בלבד',
    detail: 'הסרטון נפתח באתר המקור. אין שמירת מיקום, מעקב קשב או ReplayAI. השעון מופעל ידנית.',
  },
  blocked: {
    key: 'blocked',
    label: 'חסום ברשת הנוכחית',
    detail: 'בבדיקה ברשת המסוננת (NetFree) הסרטון היה חסום. אפשר לנסות את קישור המקור מרשת אחרת.',
  },
  unavailable: {
    key: 'unavailable',
    label: 'אין סרטון עדיין',
    detail: 'לשיעור הזה עוד לא הוסף סרטון.',
  },
});

/** The learning mode of a lesson video (LessonVideoOut), using the measured network status when known. */
export function learningModeOf(video, resource = null) {
  if (!video || video.sourceType === 'none') return LEARNING_MODES.unavailable;
  const blocked = resource?.netfree?.status === 'blocked';
  if (video.sourceType === 'upload') return LEARNING_MODES.smart;
  if (video.provider === 'direct') return blocked ? LEARNING_MODES.blocked : LEARNING_MODES.smart;
  if (video.provider === 'youtube') return blocked ? LEARNING_MODES.blocked : LEARNING_MODES.embedded;
  return blocked ? LEARNING_MODES.blocked : LEARNING_MODES.external;
}

export function LearningModeBadge({ mode }) {
  return (
    <span className={`learning-mode learning-mode--${mode.key}`} title={mode.detail}>
      {mode.key === 'smart' && <span aria-hidden="true">● </span>}
      {mode.label}
    </span>
  );
}
