import { useCallback, useEffect, useRef, useState } from 'react';
import { getCameraErrorMessage, isCameraSupported, stopStream } from './cameraStream.js';

export const CAMERA_CONSTRAINTS = Object.freeze({
  audio: false,
  video: {
    facingMode: 'user',
    width: { ideal: 640 },
    height: { ideal: 480 },
  },
});

/**
 * Owns a local camera MediaStream: start/stop, error messages, cleanup on
 * unmount and when the track ends (camera unplugged, permission revoked).
 */
export default function useCameraStream() {
  const [stream, setStream] = useState(null);
  const [status, setStatus] = useState('off'); // off | starting | on | error
  const [error, setError] = useState('');
  const streamRef = useRef(null);
  const requestRef = useRef(false);
  const mountedRef = useRef(true);

  const stop = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
    if (mountedRef.current) {
      setStream(null);
      setStatus('off');
    }
  }, []);

  const start = useCallback(async () => {
    if (requestRef.current || streamRef.current) return;
    if (!isCameraSupported()) {
      setStatus('error');
      setError('הדפדפן או המכשיר אינם תומכים בגישה למצלמה.');
      return;
    }
    requestRef.current = true;
    setStatus('starting');
    setError('');
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      if (!mountedRef.current) {
        stopStream(cameraStream);
        return;
      }
      cameraStream.getVideoTracks().forEach((track) => {
        track.addEventListener?.('ended', () => {
          if (streamRef.current === cameraStream) stop();
        });
      });
      streamRef.current = cameraStream;
      setStream(cameraStream);
      setStatus('on');
    } catch (cameraError) {
      if (mountedRef.current) {
        setStatus('error');
        setError(getCameraErrorMessage(cameraError));
      }
    } finally {
      requestRef.current = false;
    }
  }, [stop]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, []);

  return { stream, status, error, start, stop };
}
