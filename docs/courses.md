# Courses, lessons and the lesson player

## Overview

```
React (features/courses, features/learning)
   │  same-origin /api/... with the HttpOnly session cookie
   ▼
FastAPI routes (api/routes/courses.py, learning_sessions.py)
   │  current user from the cookie (api/dependencies.py), never from the body
   ▼
Services (services/courses.py: access rules, completion, video lifecycle)
   ├── repositories/courses.py ──► MongoDB
   └── services/video_storage.py ──► VIDEO_STORAGE_DIR (Docker volume video_data)
```

Two course types share the same screens and the same Smart Learning player:

| | Catalog | Personal |
|---|---|---|
| Created by | the application (seed) | a signed-in user |
| Visible to | every signed-in user (when published) | the owner only |
| Editable by | content managers (role granted from the CLI) | the owner |
| Learning | after enrolling | the owner |

Other users get **404** for a private course, its lessons, its progress and
its videos, so its existence is not revealed. Catalog edits by learners return
**403**. Content managers also see draft catalog courses. See
[learning-features.md](learning-features.md#catalog-management-content-managers).

## Data model (MongoDB)

| Collection | Key fields | Indexes |
|---|---|---|
| `courses` | title, description, category, type (`catalog`/`personal`), owner_id (personal only), status, slug (seeded), created_at, updated_at | type+status+title; owner_id+updated_at; unique slug (partial) |
| `lessons` | course_id, title, description, order, video {source_type `none`/`upload`/`external`, asset_id, url, provider `direct`/`youtube`, embed_id}, duration_seconds | course_id+order; video.asset_id; unique course_id+seed_key (partial) |
| `enrollments` | user_id, course_id, enrolled_at | **unique** user_id+course_id |
| `lesson_progress` | user_id, lesson_id, course_id, position_seconds, duration_seconds, completed, completed_at, updated_at | **unique** user_id+lesson_id; user_id+course_id |
| `video_assets` | owner_id, storage_name, content_type (sniffed), size_bytes, original_name (display only), created_at | owner_id |
| `learning_sessions` | user_id, course_id, lesson_id, started_at, ended_at, active_ms, segment_count | user_id+lesson_id+started_at |
| `attention_segments` | session_id, user_id, course_id, lesson_id, seq, session_start_ms, session_end_ms, video_start, video_end, playback_rate, state, duration_ms, concentration | **unique** session_id+seq; user_id+lesson_id+video_start |

## API (all require a signed-in user)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/courses/catalog?q=&category=` | list/search published catalog courses |
| GET | `/api/courses/catalog/categories` | catalog categories |
| GET | `/api/courses/mine` | personal + enrolled courses, with progress |
| POST | `/api/courses` | create a personal course |
| GET / PATCH / DELETE | `/api/courses/{id}` | details (lessons + progress) / edit / delete (owner) |
| POST | `/api/courses/{id}/enroll` | enroll in a catalog course (201 new, 200 already) |
| GET | `/api/courses/{id}/progress` | completed lessons, percent, lesson to continue |
| POST | `/api/courses/{id}/lessons` | add a lesson (optional `externalUrl`) |
| PUT | `/api/courses/{id}/lessons/order` | reorder (`lessonIds`, every lesson exactly once) |
| GET | `/api/lessons/{id}` | lesson + course + previous/next (player context) |
| PATCH / DELETE | `/api/lessons/{id}` | edit / remove a lesson |
| PUT | `/api/lessons/{id}/video` | upload: raw body = the file, `X-File-Name` header, `?durationSeconds=` |
| PUT | `/api/lessons/{id}/video-url` | set an external link |
| DELETE | `/api/lessons/{id}/video` | remove the lesson's video |
| GET, HEAD | `/api/videos/{assetId}/stream` | authorized streaming with HTTP byte ranges |
| GET / PUT | `/api/lessons/{id}/progress` | read / save the playback position |
| POST | `/api/lessons/{id}/complete` | manual completion (YouTube lessons only) |
| POST | `/api/learning-sessions` | start a session for a lesson |
| POST | `/api/learning-sessions/{id}/segments` | add attention segments (idempotent by `seq`) |
| POST | `/api/learning-sessions/{id}/end` | end a session |
| GET | `/api/learning-sessions/{id}` | the owner's session with its segments |

Errors are `{"detail": ...}` with 401, 403, 404, 409, 413, 415, 416 or 422.
Messages are safe to show; the frontend maps them to Hebrew.

## Uploaded videos

- Streamed straight to a temporary `.part` file in the storage folder (never
  held in memory), then renamed atomically to `<asset id>.<ext>`.
- The type is detected from the first bytes: **MP4, WebM, Ogg**. QuickTime
  `.mov` and Matroska `.mkv` are rejected because browsers often cannot play
  them. Client filenames and MIME types are not trusted; names are generated
  by the server and re-validated before any filesystem access.
- Limits: `MAX_VIDEO_UPLOAD_BYTES` (default 1 GiB per file),
  `USER_VIDEO_QUOTA_BYTES` (default 5 GiB per user). Exceeding them returns 413
  and leaves no partial file. Leftovers of interrupted uploads are removed on
  startup.
- Storage: `VIDEO_STORAGE_DIR`. Locally `backend/storage/videos` (ignored by
  Git); in Docker the named volume `video_data` at `/data/videos`, so videos
  survive container recreation. There is no public static folder: files are
  served only by `/api/videos/{id}/stream` after an authorization check
  (owner, or a lesson the user may learn).
- Replacing or removing a video, deleting a lesson or a course deletes the
  file once no lesson references it any more.

## External links

- **Direct files** (`https://…/video.mp4|.webm|.ogv|.m4v`): played by the
  browser's video element, so the position is saved and attention segments are
  recorded. The remote host may still refuse playback (hotlink protection,
  missing CORS for some features, unsupported codec); the player then shows a
  clear message instead of failing silently.
- **YouTube** (explicit allowlist: youtube.com, youtu.be, youtube-nocookie.com):
  embedded via `youtube-nocookie.com` in a sandboxed iframe. Without loading the
  provider's script the page cannot read the position, so position saving and
  attention-to-video segments are **not** available. The session timer is
  started manually, and the lesson is marked completed manually.
- **External pages** (`kind: "page"`, chosen explicitly in the editor): a web
  page that shows the video. Learners get an "open the video on the external
  website" link. There is no position, no progress tracking and no ReplayAI,
  completion is manual, and the player explains this. See
  [catalog-videos.md](catalog-videos.md).
- Everything else (web pages not marked as pages, other providers, `http://`, IP addresses,
  localhost, credentials in the URL) is rejected. The server never fetches or
  proxies external URLs.

## Progress and completion

- Opening a lesson never creates progress. The position is saved only after
  the video actually played: at most every 10 s while playing, and immediately
  on pause, after seeking, at the end, when the tab is hidden and when leaving
  the page (`keepalive` requests).
- The saved value is the **video position**, never the session timer.
- On return the player resumes from the saved position (unless it is within
  5 s of the end), with a "start from the beginning" option.
- A trackable lesson is **completed** when the video ends or the saved position
  reaches **90 %** of the duration. YouTube lessons are completed manually.
  Lessons without a video cannot be completed. Completion is permanent.
- Course progress = completed lessons / all lessons of the course. "Continue"
  opens the first lesson that is not completed.
- Only users who may learn a lesson can save its progress: the owner of a
  personal course, or a user enrolled in the catalog course.

## ReplayAI session data

How suggestions are computed from this data: [replayai.md](replayai.md).


While a trackable lesson plays, every 500 ms stats tick records the attention
state and the video position. Ticks are merged into **segments**: stretches
with one state, one playback rate and continuous video time. A segment is cut
on a state change, a seek or jump, a playback-rate change, a pause or
buffering, and after 60 s. Each segment stores both clocks:

- `videoStart` / `videoEnd`: seconds in the media,
- `sessionStartMs` / `sessionEndMs`: time since the session started,

so pauses, seeks, replays (the same video range appears again in a later
segment) and 1.5x/2x playback are represented correctly. States are stored as
measured: `ON_SCREEN`, `OFF_SCREEN`, `FACE_ABSENT`, `UNCERTAIN`, and
`NOT_MEASURED` (camera off). Uncertain and unmeasured time is never turned into
focus or distraction. The optional `concentration` is the average estimated
score of the segment. No frames, images or landmarks are stored; sessions and
segments are readable only by their owner.

## Running and testing

```powershell
docker compose up -d --build backend frontend   # keeps MongoDB and its volume
docker compose exec backend python -m app.seed  # example catalog (idempotent)

backend\.venv\Scripts\python -m pytest          # backend (integration needs MongoDB)
cd frontend; npm test; npm run build            # frontend
```

| Suite | What it covers |
|---|---|
| `backend/tests/integration/test_courses_mongo.py` | API rules against real MongoDB: uploads, byte ranges, restart persistence, progress, completion, enrollment, sessions, cross-user access |
| `frontend/src/features/courses/Courses.test.jsx` | course screens with a fake backend |
| `frontend/src/features/learning/SmartLearningLesson.test.jsx` | lesson player + attention monitor with a simulated face (mocked MediaPipe) |
| `backend/tests/test_replay_engine.py`, `backend/tests/integration/test_learning_mongo.py` | ReplayAI rules; learning features against real MongoDB |
| `frontend/src/features/replay/*.test.*` | ReplayAI UI and replay mode, Smart Timer, quizzes, insights, study plan, coach, privacy, admin |
| `frontend/e2e/learning.e2e.js`, `catalog-admin.e2e.js` | the same features in real Edge |
| `frontend/e2e/courses.e2e.js` (`npm run test:e2e`) | real Edge against an isolated backend/database: sign-up and login, course + 3 lessons, real MP4 upload, external links, real MediaPipe on the fake camera feeding segments, save/resume, completion, course progress, catalog enrollment, access control |

Camera honesty: the Vitest suites use a *simulated face*; the Playwright suite
uses Chromium's *synthetic camera* (no face, so the real model reports "no face
detected"). Neither measures accuracy with a real webcam and a real person;
that remains a manual test (see the steps in the final report or
[attention-engine-testing.md](attention-engine-testing.md)).
