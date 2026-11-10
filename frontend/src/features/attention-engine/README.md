# Attention engine (next milestone — not implemented yet)

This folder will hold the new, modular attention engine. So far it contains
only the **output contract** (`contracts.js`). The existing experiments in
`features/learning` stay untouched and keep working. They are the reference
and the source of test data for the new engine.

## What the engine may and may not claim

The engine estimates **where the user is looking relative to the screen**.
That is not concentration. A person can look at the screen and not focus, or
look away while thinking. Outputs are therefore:

| State        | Meaning                                                    |
|--------------|------------------------------------------------------------|
| `ON_SCREEN`  | head and eyes are consistent with looking at the screen   |
| `OFF_SCREEN` | consistent evidence of looking away                       |
| `FACE_ABSENT`| no face for a sustained period                            |
| `UNCERTAIN`  | low-quality or conflicting signals; always has a `reason` |

*Possible* fatigue indicators (blink rate, long eye closure, yawns) are
reported **next to** the state, never as a diagnosis.

## Layers

```
features/vision            (shared, exists)  camera stream + MediaPipe loader + blendshape helper
        │  landmarks, transformation matrix, blendshapes, timestamp
        ▼
signals/                   pure functions, one per signal, each returns {value, quality}
  headPose · eyeGaze (iris) · blendshapeGaze · faceQuality · blink/EAR · mouth/jawOpen
        ▼
calibration/               per-user profile (on-screen targets + look-away targets)
        ▼
fusion/                    combines signals into a raw state + confidence + reason
        ▼
temporal/                  hysteresis / dwell-time smoothing, face-absent timer,
                           fatigue indicators over sliding windows
        ▼
useAttentionEngine()       React hook: AttentionFrame stream (contracts.js)
        ▼
session/                   aggregates per-session summaries (local only)
```

Each layer is plain JavaScript without React or DOM access, except the hook,
so all of them can be unit-tested on recorded data.

## Reusable pieces from the experiments

| Existing module (`features/learning`) | Reuse in the new engine |
|---|---|
| `features/vision/cameraStream.js`, `faceLandmarker.js` | used directly (already extracted) |
| `headPoseEstimator.js` (yaw/pitch/roll from transformation matrix) | `signals/headPose` — reuse the maths |
| `eyeGazeEstimator.js` (iris position in eye corners + eye aspect ratio) | `signals/eyeGaze` and the blink/EAR signal |
| `screenCalibrationCollector.js` (5 screen targets, keyboard, 4 look-away targets) | `calibration/` — keep the procedure, simplify the API |
| `personalizedScreenAttention.js` (per-feature-group median/scale profiles, evidence thresholds, drift detection) | best existing classifier; port its ideas to `fusion/` |
| `createPersonalizedAttentionSmoother` | starting point for `temporal/` |
| `liveGazeDiagnosticRecorder.js`, `screenAttentionDiagnosticRecorder.js` | JSON recordings → offline test fixtures for the engine |
| `screenAttentionEstimator.js` / `screenAttentionTracker.js` (fixed thresholds) | baseline to compare against; do not port |
| `WebGazerExperimentPage.jsx` (dev-only `/__experiments/webgazer`) | regression-based screen point estimate; optional extra signal, evaluate before using |

`useFaceLandmarker.js` combines the detection loop with every experiment. The
new engine should copy its loop handling (requestVideoFrameCallback with a
timeout fallback, pausing when the tab is hidden, cleanup when a track ends)
into a small dedicated hook, not extend it.

## Privacy rules

- Frames, landmarks and calibration data never leave the browser.
- Nothing is persisted automatically. Diagnostic JSON is downloaded only when
  the user clicks a button, and the `.gitignore` excludes those files.
- No cloud face analysis.
