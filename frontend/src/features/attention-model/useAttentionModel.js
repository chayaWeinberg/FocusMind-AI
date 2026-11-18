// React binding for the course attention model: collects a sliding window of
// face landmarks (10 per second) and, once 100 frames (~10 s) are collected,
// runs the model every RUN_INTERVAL_MS on the latest window. Without a face
// for more than a second the window starts over and no score is shown.

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadAttentionModel } from './attentionModel.js';
import { createLandmarkWindow } from './landmarkWindow.js';

export const RUN_INTERVAL_MS = 2000;

/**
 * @param {{ active: boolean, onScore?: (score: number|null) => void, loader?: typeof loadAttentionModel }} options
 *   `active`: the camera is on (the model is loaded on first activation).
 */
export default function useAttentionModel({ active, onScore, loader = loadAttentionModel }) {
  const [status, setStatus] = useState('off'); // off | loading | collecting | ready | error
  const [score, setScore] = useState(null);
  const [progress, setProgress] = useState(0);
  const modelRef = useRef(null);
  const windowRef = useRef(null);
  if (!windowRef.current) windowRef.current = createLandmarkWindow();
  const busyRef = useRef(false);
  const lastRunRef = useRef(Number.NEGATIVE_INFINITY);
  const shownProgressRef = useRef(0);
  const scoreRef = useRef(null);
  const onScoreRef = useRef(onScore);
  onScoreRef.current = onScore;

  const publishScore = useCallback((value) => {
    if (scoreRef.current === value) return;
    scoreRef.current = value;
    setScore(value);
    onScoreRef.current?.(value);
  }, []);

  useEffect(() => {
    if (!active) {
      windowRef.current.reset();
      shownProgressRef.current = 0;
      setProgress(0);
      publishScore(null);
      setStatus('off');
      return undefined;
    }
    let cancelled = false;
    setStatus('loading');
    loader()
      .then((model) => {
        if (cancelled) {
          model.release();
          return;
        }
        modelRef.current = model;
        setStatus('collecting');
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Attention model failed to load.', error);
        setStatus('error');
      });
    return () => {
      cancelled = true;
      modelRef.current?.release();
      modelRef.current = null;
    };
  }, [active, loader, publishScore]);

  /** Called for every analysed camera frame: first face's landmarks, or null. */
  const push = useCallback((landmarks, at) => {
    const frames = windowRef.current;
    const stored = frames.push(landmarks, at);
    const collected = frames.progress();
    if (Math.abs(collected - shownProgressRef.current) >= 0.05 || (collected === 0 && shownProgressRef.current !== 0)) {
      shownProgressRef.current = collected;
      setProgress(collected);
    }
    if (!frames.full()) {
      // Not enough frames (start, or the face was missing): no score.
      if (scoreRef.current !== null) {
        publishScore(null);
        if (modelRef.current) setStatus('collecting');
      }
      return;
    }
    const model = modelRef.current;
    if (!stored || !model || busyRef.current || at - lastRunRef.current < RUN_INTERVAL_MS) return;
    busyRef.current = true;
    lastRunRef.current = at;
    model.score(frames.toTensorData())
      .then((value) => {
        if (modelRef.current !== model) return;
        publishScore(value);
        setStatus('ready');
      })
      .catch((error) => {
        console.error('Attention model inference failed.', error);
        setStatus('error');
      })
      .finally(() => {
        busyRef.current = false;
      });
  }, [publishScore]);

  return { status, score, progress, push };
}
