// Camera helpers shared by the learning page, experiments and the future
// attention engine. Video never leaves the browser.

export function isCameraSupported() {
  return typeof navigator !== 'undefined'
    && typeof navigator.mediaDevices?.getUserMedia === 'function';
}

export function stopStream(stream) {
  stream?.getTracks?.().forEach((track) => track.stop());
}

export function hasLiveVideoTrack(stream) {
  return Boolean(stream?.getVideoTracks?.().some((track) => track.readyState !== 'ended'));
}

export function getCameraErrorMessage(error) {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'הגישה למצלמה נדחתה. אפשר לאשר גישה למצלמה בהגדרות הדפדפן ולנסות שוב.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'לא נמצאה מצלמה זמינה במכשיר.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'לא ניתן להפעיל את המצלמה. ייתכן שהיא נמצאת בשימוש באפליקציה אחרת.';
    case 'OverconstrainedError':
      return 'המצלמה הזמינה אינה תומכת בהגדרות הנדרשות.';
    default:
      return 'אירעה שגיאה בעת הפעלת המצלמה. אפשר לנסות שוב.';
  }
}
