// Hebrew texts for the attention monitor. Gaze wording is about direction, and
// the concentration score is always presented as an estimate.

import { ATTENTION_REASONS as R, ATTENTION_STATES as S, FATIGUE_INDICATORS as F } from './contracts.js';
import { CONCENTRATION_FACTORS as CF, CONCENTRATION_LEVELS as C } from './concentration.js';

export const STATE_LABELS = Object.freeze({
  [S.ON_SCREEN]: 'מבט לכיוון המסך',
  [S.OFF_SCREEN]: 'מבט מחוץ למסך',
  [S.FACE_ABSENT]: 'לא זוהו פנים',
  [S.UNCERTAIN]: 'לא ניתן לקבוע בוודאות',
});

export const REASON_TEXTS = Object.freeze({
  [R.GAZE_ON_SCREEN]: 'הראש והעיניים מופנים למסך.',
  [R.HEAD_TURNED_AWAY]: 'הראש מופנה הרחק מהמסך.',
  [R.GAZE_OFF_SCREEN]: 'העיניים מופנות הרחק מהמסך.',
  [R.NO_FACE]: 'לא זוהו פנים מול המצלמה.',
  [R.LOW_LANDMARK_QUALITY]: 'הפנים קטנות מדי או חתוכות בתמונה. התקרבו ומרכזו את הפנים מול המצלמה.',
  [R.EYES_NOT_MEASURABLE]: 'לא ניתן למדוד את העיניים כרגע (עיניים עצומות, השתקפות או משקפיים).',
  [R.NEAR_SCREEN_EDGE]: 'המבט קרוב לגבול המסך, ולכן התוצאה אינה חד-משמעית.',
  [R.ADAPTING]: 'מתאימים את עצמנו למיקום שלכם. הביטו במסך כרגיל לכמה שניות.',
  [R.CAMERA_UNAVAILABLE]: 'המצלמה כבויה. הפעילו אותה כדי לעקוב אחר כיוון המבט.',
  [R.PAUSED]: 'המעקב מושהה כשהלשונית אינה גלויה.',
});

export const FATIGUE_TEXTS = Object.freeze({
  [F.BLINK_RATE_HIGH]: 'קצב מצמוץ גבוה מהרגיל',
  [F.LONG_EYE_CLOSURE]: 'עצימת עיניים ממושכת',
  [F.YAWN]: 'ייתכן פיהוק',
});

export const CONCENTRATION_LEVEL_LABELS = Object.freeze({
  [C.HIGH]: 'ריכוז גבוה',
  [C.MEDIUM]: 'ריכוז בינוני',
  [C.LOW]: 'ריכוז נמוך',
});

export const CONCENTRATION_FACTOR_TEXTS = Object.freeze({
  [CF.EYES_CLOSED_NOW]: 'העיניים עצומות כרגע',
  [CF.LOOKING_AWAY]: 'המבט היה הרבה מחוץ למסך בזמן האחרון',
  [CF.LONG_CLOSURES]: 'עצימות עיניים ממושכות בדקות האחרונות',
  [CF.YAWNS]: 'פיהוקים בדקות האחרונות',
  [CF.EYE_CLOSURE]: 'העיניים עצומות יותר מהרגיל',
  [CF.BLINK_RATE]: 'קצב מצמוץ גבוה',
});

export const GAZE_MODEL_LABELS = Object.freeze({
  'head+eyes': 'ראש + עיניים',
  head: 'ראש בלבד',
  none: '—',
});
