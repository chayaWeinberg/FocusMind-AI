# FocusMind AI architecture

```
Browser (React SPA, Hebrew RTL, FocusMind Signature design)
  ├─ Camera ─► MediaPipe Face Landmarker (in the browser, local model files)
  │            └─► attention engine ─► state per 500 ms tick (never uploaded)
  ├─ Lesson player (one <video>): progress, segments, replay mode, Smart Timer
  └─ same-origin /api/... with the HttpOnly session cookie
        │  (Vite proxy in development and Docker)
        ▼
FastAPI  routes ─► services (access rules, business logic) ─► repositories ─► MongoDB
                    └─ video_storage ─► VIDEO_STORAGE_DIR (Docker volume video_data)
```

## Course attention model (ONNX, in the browser)

- `frontend/public/models/attention/v4_2.onnx`: the course model (GRU with
  attention, trained on EngageNet and DAiSEE). Input `[1, 100, 478, 3]` raw
  MediaPipe landmarks; first output = score 0..1 (higher = more attentive).
- `features/attention-model/`: `landmarkWindow.js` keeps the last 100 frames
  at 10 per second (resets after more than 1 s without a face);
  `useAttentionModel.js` runs the model every 2 s on a full window;
  `attentionModel.js` loads ONNX Runtime Web (WASM only, single thread, files
  in `/ort`, copied at build time). About 1 s to load, ~50 ms per window.
- The first score appears after ~10 s of face in view. Without a face the
  monitor shows "לא זוהו פנים" and no score is computed.
- The score is the main measure: shown as "ציון קשב" (0.00–1.00 with the five
  trained levels), sent per segment as `attentionScore`, averaged per session
  in the history, and it drives the low-attention alert (below 0.4 for 4 s).
  The calibration-free engine's 0–100% concentration estimate stays as a
  second, explained measure and is the fallback when the model has no score.

## Layers (backend)

| Layer | Files | Responsibility |
|---|---|---|
| Routes | `app/api/routes/{auth,courses,learning_sessions,learning}.py` | HTTP, validation (pydantic schemas), status codes |
| Dependencies | `app/api/dependencies.py` | database; current user from the cookie (never from the request body) |
| Services | `app/services/courses.py` | course, lesson, enrollment, progress and video rules; content-manager permissions |
| | `learning_sessions.py` | sessions, segments, heartbeat, history |
| | `replay_engine.py`, `replay.py` | ReplayAI rules, storage and status |
| | `insights.py` | FocusInsights, FocusCoach, AdaptiveStudy, preferences |
| | `quiz.py`, `privacy.py` | QuizFlow; data summary, deletion and retention |
| Repositories | `app/repositories/{users,courses,learning}.py` | MongoDB access only; every user query is scoped by `user_id` |
| Errors | `CourseError` subclasses | 401/403/404/409/413/415/416/422 with safe English details, mapped to Hebrew in the frontend |

## Frontend

| Folder | Content |
|---|---|
| `src/App.jsx` | routing (hand-written, no router library) and authentication guards |
| `components/` | `AppShell` (sidebar navigation), `ConfirmButton`, `charts/` |
| `features/auth` | login, registration, session context |
| `features/courses` | My Courses, catalog, course page, course editor, API client |
| `features/learning` | Smart Learning page (lesson player), attention monitor, Smart Timer, persistence |
| `features/attention-engine` | calibration-free attention engine (unchanged by the courses/ReplayAI work) |
| `features/replay` | ReplayAI panel, review page, replay-mode logic |
| `features/insights`, `coach`, `study`, `quiz`, `privacy`, `admin` | the remaining product features |

## Main user journey

Login → Dashboard (progress, streak, FocusCoach) → My Courses → Course page
(lessons, review badges, ReplayAI list) → Smart Learning (video, camera,
Smart Timer, ReplayAI, QuizFlow) → Review (`/review`) → Insights
(`/insights`) → Study plan (`/study`).

## Principles

- Only derived data is stored. Camera frames and landmarks never leave the
  browser.
- Video time and session time are separate. Replay positions use video time
  only.
- No invented data: empty states instead of sample numbers, no generated
  questions or summaries without real content, no timestamps for providers
  without position tracking.
- Every feature works without an external AI provider.
- Private by default: personal courses and all learning data are visible to
  their owner only. Other users get 404.

More detail: [courses.md](courses.md), [replayai.md](replayai.md),
[learning-features.md](learning-features.md), the attention engine
[README](../frontend/src/features/attention-engine/README.md), and the
[user guide (Hebrew)](USER-GUIDE-HE.md).
