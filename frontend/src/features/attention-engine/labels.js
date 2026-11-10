// Hebrew texts for the attention engine UI. Wording is deliberately about
// *gaze direction*, never about concentration.

import { ATTENTION_REASONS as R, ATTENTION_STATES as S, FATIGUE_INDICATORS as F } from './contracts.js';
import { CALIBRATION_FAILURES as C } from './calibration.js';

export const STATE_LABELS = Object.freeze({
  [S.ON_SCREEN]: 'מבט לכיוון המסך',
  [S.OFF_SCREEN]: 'מבט מחוץ למסך',
  [S.FACE_ABSENT]: 'לא זוהו פנים',
  [S.UNCERTAIN]: 'לא ניתן לקבוע בוודאות',
});

export const REASON_TEXTS = Object.freeze({
  [R.GAZE_ON_SCREEN]: 'תנוחת הראש ומיקום האישונים תואמים מבט למסך לפי הכיול האישי.',
  [R.HEAD_TURNED_AWAY]: 'הראש מופנה הרחק מהטווח שנמדד בזמן הכיול.',
  [R.GAZE_OFF_SCREEN]: 'נקודת המבט המשוערת נמצאת מחוץ לגבולות המסך.',
  [R.NO_FACE]: 'לא זוהו פנים בתמונת המצלמה.',
  [R.LOW_LANDMARK_QUALITY]: 'הפנים קטנות מדי, חתוכות בשולי התמונה או לא ברורות. התקרבו ומרכזו את הפנים.',
  [R.EYES_NOT_MEASURABLE]: 'לא ניתן למדוד את העיניים כרגע (מצמוץ, עיניים עצומות, השתקפות או משקפיים).',
  [R.SIGNALS_DISAGREE]: 'תנוחת הראש ומיקום העיניים מצביעים על כיוונים שונים.',
  [R.NEAR_SCREEN_EDGE]: 'המבט קרוב לשולי המסך, ולכן התוצאה אינה חד-משמעית.',
  [R.NOT_CALIBRATED]: 'בלי כיול אישי המנוע מזהה רק פנייה ברורה של הראש. בצעו כיול כדי לקבל זיהוי מבט.',
  [R.OUTSIDE_CALIBRATION]: 'התנוחה או המרחק מהמצלמה השתנו מאז הכיול. מומלץ לבצע כיול מחדש.',
  [R.CAMERA_UNAVAILABLE]: 'המצלמה כבויה.',
  [R.PAUSED]: 'הניתוח מושהה (הלשונית מוסתרת או שהמצלמה נעצרה).',
  [R.CALIBRATING]: 'מתבצע כיול. הביטו בנקודות שעל המסך.',
});

export const FATIGUE_TEXTS = Object.freeze({
  [F.BLINK_RATE_HIGH]: 'קצב מצמוץ גבוה מהרגיל',
  [F.LONG_EYE_CLOSURE]: 'עצימת עיניים ממושכת',
  [F.YAWN]: 'ייתכן פיהוק',
});

export const CALIBRATION_FAILURE_TEXTS = Object.freeze({
  [C.FACE_NOT_DETECTED]: 'הכיול נכשל: הפנים לא זוהו מספיק זמן באחת הנקודות. שבו מול המצלמה בתאורה טובה ונסו שוב.',
  [C.NOT_ENOUGH_VARIATION]: 'הכיול נכשל: לא נמדד שינוי בין הנקודות. הקפידו להביט בכל נקודה כשהיא מופיעה.',
  [C.INACCURATE]: 'הכיול לא היה מדויק מספיק. נסו שוב, בלי לזוז מהמקום ותוך הבטה ישירה בכל נקודה.',
  [C.CANCELLED]: 'הכיול בוטל.',
});

export const QUALITY_TEXTS = Object.freeze({
  excellent: 'מצוין',
  good: 'טוב',
  fair: 'בינוני',
  poor: 'חלש',
  none: '—',
});

export const MODEL_USED_TEXTS = Object.freeze({
  full: 'ראש + עיניים',
  'head-only': 'ראש בלבד',
  'head-range': 'כלל טווח הראש',
  none: '—',
});
