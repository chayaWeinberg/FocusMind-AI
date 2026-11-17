# FocusMind AI

A smart learning platform with a Hebrew RTL interface:

- **Courses and lessons**: a published catalog, managed by content managers,
  and personal courses with uploaded videos or external links.
- **Smart Learning player**: saved progress and browser-only, calibration-free
  webcam attention detection (MediaPipe).
- **Smart Timer**: active learning time, breaks and session history.
- **ReplayAI**: review suggestions from recorded attention, played back in the
  same player, plus manual bookmarks.
- **FocusInsights**: analytics from real data.
- **FocusCoach**: deterministic, explained study tips.
- **AdaptiveStudy**: a study goal and a plan for the next session.
- **QuizFlow**: manual review questions.
- **Privacy controls**: see what is stored and delete it.

No feature needs an external AI provider.

| Layer    | Stack |
|----------|-------|
| Frontend | React 18, Vite 6, Vitest, MediaPipe Tasks Vision |
| Backend  | Python FastAPI, PyMongo (async), PyJWT, bcrypt |
| Database | MongoDB 7 |

## Quick start (local, without Docker for the app)

Requirements: Node 22+, Python 3.12+, and MongoDB, either installed locally
or started with Docker as shown below.

```powershell
# 1. Configuration (once)
copy .env.example .env          # then edit SECRET_KEY and the passwords

# 2. Database only, in Docker
docker compose up -d mongo

# 3. Backend: http://localhost:8000 (API docs at /docs in development)
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload

# 4. Frontend: http://localhost:3000 (in a second terminal)
cd frontend
npm install
npm run dev
```

The frontend calls `/api/...` on its own origin. Vite forwards those requests
to the backend (`VITE_API_PROXY_TARGET`, default `http://localhost:8000`), so
the session cookie stays first-party and CORS is not needed in development.

### Everything in Docker

```powershell
docker compose up --build
```

## Tests

```powershell
# Backend: run from the project root
backend\.venv\Scripts\python -m pytest

# Frontend
cd frontend
npm test
npm run build
```

- **Unit tests** (`backend/tests/test_auth.py`) use an in-memory database.
- **Course tests** (`backend/tests/integration/test_courses_mongo.py`) cover
  courses, lessons, uploads, byte ranges, restart persistence, progress,
  enrollment, sessions and cross-user authorization (real MongoDB, temporary
  video folder).
- **ReplayAI rules** (`backend/tests/test_replay_engine.py`): thresholds,
  merging, pauses, seeks, playback speed and multiple sessions. No database.
- **Learning features** (`backend/tests/integration/test_learning_mongo.py`):
  ReplayAI persistence and status, Smart Timer heartbeat and history,
  insights, coach, study plan, quizzes, catalog administration, privacy
  deletion and authorization.
- **Integration tests** (`backend/tests/integration/`) use the real MongoDB
  from `.env`. Each run creates a random database and drops it afterwards.
  If MongoDB is not reachable they are **skipped**. With
  `FOCUSMIND_REQUIRE_MONGO=1`, as in CI, they **fail** instead.

### End-to-end tests (real browser)

```powershell
docker compose up -d mongo     # MongoDB must be running
cd frontend
npm run test:e2e               # Playwright with the installed Microsoft Edge
```

The run starts its own backend (port 8010, database `focusmind_e2e`, temporary
video folder) and Vite (port 3010), records a small MP4 test video in the
browser, and drops the test database afterwards. Real data is never touched.

The suites are:
- `courses.e2e.js`: authentication, courses, upload, streaming, playback,
  progress, catalog and access control;
- `learning.e2e.js`: ReplayAI replay of the exact interval in the real video,
  bookmarks, the review page, the Smart Timer, insights, the study goal,
  quizzes and authorization;
- `catalog-admin.e2e.js`: the role granted with the real CLI, then create,
  fill and publish a course.

ReplayAI e2e data is a controlled session sent through the API, because the
synthetic camera has no face.
The camera is Chromium's synthetic fake device, so these tests prove the
attention monitor runs with lesson playback, not real-webcam accuracy. Use
`E2E_BROWSER_CHANNEL=chrome` for Google Chrome.

CI (`.github/workflows/ci.yml`) runs both suites and the production build on
every push to `main` and on every pull request.

## NetFree and other HTTPS-filtering networks

Docker builds need the filter's root certificate. Copy the `.crt`/`.pem` files
into `backend/certs/` and `frontend/certs/`. Git ignores them; see the README
in each folder. Without such a network, leave the folders empty.

If a build fails with `short read: expected … bytes … unexpected EOF`, a base
image download was cut off. Pull the base image with the Docker daemon (it
retries and resumes layers), then build again:

```powershell
docker pull node:22-alpine      # or python:3.12-slim for the backend
docker compose build frontend
docker compose up -d --no-deps frontend   # MongoDB and volumes are untouched
```

## Example catalog

The catalog has 13 courses:
- **10 video-library courses (116 lessons):** each lesson links to a real Harvard CS50 or
  Microsoft Learn video. See [docs/catalog-library.md](docs/catalog-library.md).
- **3 demonstration courses:** their videos are generated locally and play offline, for testing
  Smart Learning and ReplayAI.

`python -m app.seed` imports both, idempotently.

```powershell
# Idempotent: creates/updates the Python, SQL and AI example courses only.
docker compose exec backend python -m app.seed      # Docker
cd backend; .venv\Scripts\python -m app.seed         # local backend
```

Or set `SEED_CATALOG=true` to seed on startup (off by default). The seed
creates lessons without videos.

Curated lecture videos (Harvard CS50, CC BY-NC-SA 4.0) are attached
separately. The tool checks what the server's network can reach (direct
MP4, YouTube or the external lecture page) and never overwrites a video
chosen by a person:

```powershell
docker compose exec backend python -m app.catalog_videos check
docker compose exec backend python -m app.catalog_videos apply      # --mode direct|youtube|page, --dry-run
docker compose exec backend python -m app.catalog_videos status
```

Every catalog lesson also has an original **demonstration video** ("סרטון הדגמה").
It is generated offline and played from the local backend, so the whole
Smart Learning and ReplayAI workflow can be tested without internet access:

```powershell
cd frontend; npm run demo-videos; cd ..                  # generate (local Edge, cached)
docker compose cp demo-videos backend:/tmp/demo-videos
docker compose exec backend python -m app.demo_videos install /tmp/demo-videos
```

Behind NetFree every external `.mp4` and YouTube is blocked. See
[docs/catalog-videos.md](docs/catalog-videos.md) for the verification and
how to replace links.

## Routes

| Path | Screen | Access |
|------|--------|--------|
| `/review` | ReplayAI: all suggestions and bookmarks | signed in (own data) |
| `/learning/lessons/:id/review/:itemId` | the lesson, replaying one interval | owner / enrolled |
| `/insights` | FocusInsights analytics and session history | signed in (own data) |
| `/study` | AdaptiveStudy goal and plan, plus FocusCoach | signed in (own data) |
| `/privacy` | what is measured and stored; data deletion | signed in (own data) |
| `/admin/catalog` | catalog management | content managers only |
| `/`, `/register` | Registration | public; signed-in users go to the dashboard |
| `/login` | Login | public; signed-in users go to the dashboard |
| `/dashboard` | Dashboard with real course progress | signed in |
| `/courses` | My courses (personal + enrolled catalog courses) | signed in |
| `/courses/catalog` | Catalog: search, category filter, enroll | signed in |
| `/courses/new` | Create a personal course | signed in |
| `/courses/:id` | Course details, lessons, progress | owner / any user for published catalog courses |
| `/courses/:id/edit` | Edit course, manage lessons and videos | owner of a personal course |
| `/learning/lessons/:id` | Smart Learning playing a course lesson | owner / enrolled |
| `/learning` | Smart Learning with a local file (nothing uploaded) | signed in |

Details: [docs/architecture.md](docs/architecture.md),
[docs/courses.md](docs/courses.md) (courses, storage, progress),
[docs/replayai.md](docs/replayai.md),
[docs/learning-features.md](docs/learning-features.md) (timer, insights, coach,
study plan, quizzes, catalog management, privacy, data model and API).

## Content managers (catalog)

Nobody is a content manager by default, and the API cannot grant the role.
Grant it from the command line:

```powershell
docker compose exec backend python -m app.admin grant editor@example.com   # Docker
cd backend; .venv\Scripts\python -m app.admin grant editor@example.com    # local
python -m app.admin revoke editor@example.com
python -m app.admin list
```

## Project layout

```
backend/app/
  api/routes/auth.py      register, login, me, logout (HttpOnly JWT cookie)
  api/routes/courses.py   courses, lessons, enrollment, progress, uploads, video streaming
  api/routes/learning_sessions.py  sessions (Smart Timer heartbeat, history) and attention segments
  api/routes/learning.py  ReplayAI, preferences, insights, coach, study plan, quizzes, catalog admin, privacy
  api/dependencies.py     database + current user (from the session cookie)
  core/config.py          settings from env / .env
  db/database.py          MongoDB client, get_db dependency, indexes, health ping
  services/courses.py     access rules, completion policy, video lifecycle
  services/video_storage.py  streamed uploads, type sniffing, byte ranges
  services/external_video.py link validation (direct files, YouTube allowlist)
  services/replay_engine.py  ReplayAI rules (pure, unit-tested); services/replay.py storage + status
  services/insights.py    FocusInsights, FocusCoach, AdaptiveStudy, preferences
  services/quiz.py        QuizFlow;  services/privacy.py  data summary, deletion, retention
  admin/                  python -m app.admin grant|revoke|list (content-manager role)
  repositories/ schemas/ models/
  seed/                   idempotent example catalog (python -m app.seed)
backend/tests/            unit tests + integration/ (real MongoDB)
frontend/src/
  App.jsx                 routing and auth guards
  components/AppShell.jsx shared sidebar layout
  features/auth/          pages, AuthContext, authApi
  features/courses/       My Courses, catalog, details, editor, coursesApi
  features/dashboard/
  features/learning/      Smart Learning (local file or course lesson), attention
                          monitor, Smart Timer, progress + segment saving
  features/replay/        ReplayAI panel, review page, replay mode
  features/insights/ coach/ study/ quiz/ privacy/ admin/
  components/charts/      dependency-free, RTL-aware charts
  features/vision/        shared camera + MediaPipe helpers
  features/attention-engine/  attention engine (signals, adaptive baseline, fusion, smoothing)
  styles/SignatureTheme.css   FocusMind Signature (Design 15)
```

## Privacy

Camera video and face landmarks are processed **in the browser only** and are
never stored or uploaded. For course lessons, only derived attention states
per stretch of video time are saved (owner only), never frames or landmarks.
Learners see what is stored, and can delete it, on `/privacy`.
`ATTENTION_RETENTION_DAYS` adds optional server-wide retention.
Uploaded lesson videos are private to their owner and served only through an
authenticated endpoint.

"Looking toward the screen" is **not** a concentration or comprehension score.
ReplayAI suggestions are review hints based on gaze direction and pauses.

## Further documentation

- [frontend/src/features/attention-engine/README.md](frontend/src/features/attention-engine/README.md): how the attention engine works
- [docs/architecture.md](docs/architecture.md): final architecture and main user journey
- [docs/courses.md](docs/courses.md): courses, lessons, video storage, progress and session data
- [docs/replayai.md](docs/replayai.md): ReplayAI rules, thresholds, storage and replay mode
- [docs/learning-features.md](docs/learning-features.md): Smart Timer, insights, coach, study plan, quizzes, catalog management, privacy
- [docs/user-guide.md](docs/user-guide.md): user guide (Hebrew)
- [docs/catalog-videos.md](docs/catalog-videos.md): catalog lecture videos, playback types, NetFree verification
- [docs/catalog-library.md](docs/catalog-library.md): the 10-course / 116-lesson video library, sources per lesson and measured accessibility
- [docs/attention-engine-testing.md](docs/attention-engine-testing.md): real-camera test protocol (Hebrew)
- [docs/deferred-work.md](docs/deferred-work.md): known issues and postponed improvements
