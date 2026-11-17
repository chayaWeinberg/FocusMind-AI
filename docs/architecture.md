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
