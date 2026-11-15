# Attention engine

The engine estimates **where the user is looking relative to the screen**
from the local webcam. It does **not** measure concentration, understanding
or interest. Everything runs in the browser, and no calibration is needed.
On top of the gaze state it computes an **estimated concentration score**
(`concentration.js`), always presented as an estimate.

| State         | Meaning |
|---------------|---------|
| `ON_SCREEN`   | the combined head + eye gaze is within the user's learned screen-facing range |
| `OFF_SCREEN`  | the combined gaze is clearly beyond that range, or the head is turned far away |
| `FACE_ABSENT` | no face for a sustained period (~1 s) |
| `UNCERTAIN`   | still adapting, low landmark quality, eyes not measurable, or near the edge of the range. Always comes with a `reason` |

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
  └─ signals.js     combinedGaze(): gaze (degrees) = 0.6 * head + 80 * iris offset.
                    The iris is measured against the eye corners, which already
                    turn with the head, so only part of the head angle is added
  └─ baseline.js    passive adaptation: a ~2.5 s warm-up learns the user's
                    screen-facing direction (robust median of head and gaze);
                    afterwards it follows the user only from clearly
                    on-screen frames, and re-learns after a posture change
                    (distance or sideways shift held for ~2 s)
  └─ fusion.js      combined-gaze offset from the baseline / tolerance
                    (22° horizontal, 15° vertical, widened only by noise);
                    P(on screen) = logistic(6 · (1 − max ratio)), scaled by
                    signal quality; head-only fallback (18° / 14°) with a lower
                    confidence ceiling; extreme head turns are off-screen
  └─ temporal.js    exponentially decaying evidence per state (τ = 450 ms),
                    hysteresis, and a minimum dwell time per state
                    (on 350 ms, off 600 ms, absent 900 ms, uncertain 800 ms)
  └─ fatigue.js     blink events, long closures, possible yawns over sliding windows;
                    looking down (eyeLookDown) is not mistaken for closed eyes
  └─ concentration.js  score = 100 · gazeShare · (1 − fatigue penalty):
                    recency-weighted share of time looking at the screen (~12 s),
                    minus eye-closure share above normal blinking, long closures
                    (2 min), possible yawns (5 min) and a high blink rate;
                    capped at 25 while the eyes are closed for > 1.5 s
  └─ engine.js      composes the layers; pure JS, so it is tested with synthetic faces
useAttentionEngine.js   camera loop (requestVideoFrameCallback, pauses when the tab is hidden)
```

UI (in `features/learning`):
- `AttentionMonitor.jsx`: camera button, live preview, state, confidence,
  adaptation progress, reason, fatigue hint, the concentration estimate with
  what lowers it, a collapsible "measurement details" view (gaze offset vs.
  tolerance in degrees, eye quality, eye closure, mouth opening) and a
  "re-center" action.
- `attentionSessionStats.js` + `AttentionSessionSummary.jsx`: time per state,
  away episodes, longest on-screen streak, average concentration and a
  5-second-slot timeline, counted only while the learning video plays.

Why these choices:
- **Passive adaptation instead of calibration targets.** The baseline absorbs
  the camera position, the user's posture and the screen size while the user
  simply studies. Looking away never moves the baseline.
- **Iris offset in eye-width units**, so blinks and squints do not shift it.
- **Head-only fallback** keeps working through blinks, glare and glasses,
  with lower confidence.

Real-camera test protocol (Hebrew): [docs/attention-engine-testing.md](../../../../docs/attention-engine-testing.md)

## Tests

- `engine.test.js`: maths, signals, adaptive baseline, fusion cases,
  smoothing, fatigue, and an end-to-end run on a synthetic face
  (`testing/syntheticFace.js`).
- `learning/SmartLearningAttention.test.jsx`: the Smart Learning page with a
  mocked MediaPipe and a simulated user: adaptation, on/off screen, face
  absent, re-centering, camera off and session statistics.

## Known limitations

- The baseline is kept in memory only, so a page reload re-adapts (a few
  seconds). This is a deliberate privacy choice.
- The first seconds after starting the camera are assumed to be spent looking
  at the screen. Looking away during the warm-up skews the baseline; use
  "re-center" to fix it.
- Looking at the keyboard or a notebook counts as off-screen. That is correct
  for "looking at the screen", but not a sign of distraction.
- Accuracy drops with strong backlight, reflective glasses or a very small
  face in the image.
- The gaze model constants (`GAZE_MODEL` in `signals.js`) and the
  concentration weights are physically motivated estimates, not validated on
  real users yet. Use the protocol above, read the offsets in "measurement
  details", and adjust `GAZE_MODEL`, `BASELINE_DEFAULTS.tolerance`,
  `FUSION_DEFAULTS` and `CONCENTRATION_DEFAULTS` from the measurements.
