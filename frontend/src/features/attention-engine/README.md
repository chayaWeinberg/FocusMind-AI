# Attention engine (v1, development flag)

The engine estimates **where the user is looking relative to the screen**
from the local webcam. It does **not** measure concentration, understanding
or interest. Everything runs in the browser.

| State         | Meaning |
|---------------|---------|
| `ON_SCREEN`   | the calibrated gaze estimate is inside the screen |
| `OFF_SCREEN`  | gaze estimate outside the screen, or head turned far beyond the calibrated range |
| `FACE_ABSENT` | no face for a sustained period (~1 s) |
| `UNCERTAIN`   | not calibrated, low landmark quality, eyes not measurable, signals disagree, near the screen edge, or the user moved since calibration. Always comes with a `reason` |

*Possible* fatigue indicators (blink rate above 30/min, eye closure longer
than 1.5 s, sustained mouth opening that may be a yawn) are reported next to
the state and never change it.

## How it works

```
MediaPipe Face Landmarker (VIDEO mode, ~15 fps, local WASM + model)
  └─ signals.js     head yaw/pitch/roll + position (transformation matrix),
                    iris offset per eye in the eye's own axis (roll-compensated),
                    eye aspect ratio, blink/jaw blendshapes,
                    quality 0..1 for face, head and eyes
  └─ calibration.js 9 screen targets (~20 s). Ridge regression maps
                    [yaw, pitch, irisH, irisV] -> screen (x, y), plus a
                    head-only model as a fallback. The expected error comes
                    from leave-one-target-out cross-validation
  └─ fusion.js      P(on screen) = logistic(1.7 · signed distance to the screen
                    edge / model error), scaled by signal quality; rules for
                    face absent, head far outside the calibrated range, user
                    moved since calibration, contradicting head/eye models
  └─ temporal.js    exponentially decaying evidence per state (τ = 450 ms),
                    hysteresis, and a minimum dwell time per state
                    (on 350 ms, off 600 ms, absent 900 ms, uncertain 800 ms)
  └─ fatigue.js     blink events, long closures, possible yawns over sliding windows
  └─ engine.js      composes the layers; pure JS, so it is tested with synthetic faces
useAttentionEngine.js   camera loop (requestVideoFrameCallback, pauses when the tab is hidden)
AttentionEnginePanel.jsx diagnostic UI: state, confidence, reason, gaze map, timeline, signals
```

Why these choices:
- **Personal calibration instead of fixed thresholds.** The fixed-threshold
  experiments broke with each camera position. The regression's intercepts
  and gains absorb the user, the camera height/offset and the screen size.
- **Iris offset in eye-width units.** The legacy estimator divided the
  vertical offset by the lid opening, which changes with blinks and squints.
- **An honest error estimate.** Training error is optimistic.
  Leave-one-target-out error predicts how far a new gaze point will be off,
  and it directly sets how soft the on-screen probability is.
- **Head-only fallback** keeps working through blinks, glare and glasses,
  with lower confidence.

## Enabling it

- `/__experiments/attention-engine`: development only, no login needed.
- `/learning?engine=new`: replaces the legacy gaze experiment on the Smart
  Learning page. The choice is remembered in this browser, and
  `?engine=legacy` switches back. You can also set
  `VITE_FEATURE_ATTENTION_ENGINE=true` in `frontend/.env.local`.
- Production builds never enable it and do not load its code.

Real-camera test protocol (Hebrew): [docs/attention-engine-testing.md](../../../../docs/attention-engine-testing.md)

## Tests

- `engine.test.js`: maths, signals, calibration (including another
  user/camera and failures), fusion cases, smoothing, fatigue, and an
  end-to-end run on a synthetic face (`testing/syntheticFace.js`).
- `AttentionEnginePanel.test.jsx`: the full UI with a mocked MediaPipe and a
  simulated user: calibration through the overlay, on/off screen, face
  absent, cancelling, camera off, and the feature flag.

## Known limitations (v1)

- The calibration is kept in memory only, so a page reload needs a new one.
  This is a deliberate privacy choice.
- Looking at the keyboard or a notebook counts as off-screen. That is correct
  for "looking at the screen", but not a sign of distraction.
- Accuracy drops with strong backlight, reflective glasses, a very small face
  in the image, or after moving the chair. Moving is detected and triggers a
  recalibration hint.
- The browser viewport is used as "the screen", expanded by a 5 % margin.
- Not validated on real users yet. Use the protocol above and adjust
  `FUSION_DEFAULTS` / `TEMPORAL_DEFAULTS` from the measurements.
