# FocusMind AI

A smart learning platform with a Hebrew RTL interface: registration and login,
a personal dashboard, **courses and lessons** (a published catalog and personal
courses with uploaded videos or external links), and a Smart Learning player
with a study timer, saved playback progress, and browser-only, calibration-free
webcam attention detection built on MediaPipe.

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
browser, and drops the test database afterwards: real data is never touched.
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

```powershell
# Idempotent: creates/updates the Python, SQL and AI example courses only.
docker compose exec backend python -m app.seed      # Docker
cd backend; .venv\Scripts\python -m app.seed         # local backend
```

Or set `SEED_CATALOG=true` to seed on startup (off by default). Example lessons
have no video: no links are invented.

## Routes

| Path | Screen | Access |
|------|--------|--------|
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

Details on the data model, API, storage, progress rules and ReplayAI data:
[docs/courses.md](docs/courses.md).

## Project layout

```
backend/app/
  api/routes/auth.py      register, login, me, logout (HttpOnly JWT cookie)
  api/routes/courses.py   courses, lessons, enrollment, progress, uploads, video streaming
  api/routes/learning_sessions.py  ReplayAI-ready attention segments
  api/dependencies.py     database + current user (from the session cookie)
  core/config.py          settings from env / .env
  db/database.py          MongoDB client, get_db dependency, indexes, health ping
  services/courses.py     access rules, completion policy, video lifecycle
  services/video_storage.py  streamed uploads, type sniffing, byte ranges
  services/external_video.py link validation (direct files, YouTube allowlist)
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
                          monitor, session statistics, progress + segment saving
  features/vision/        shared camera + MediaPipe helpers
  features/attention-engine/  attention engine (signals, adaptive baseline, fusion, smoothing)
  styles/SignatureTheme.css   FocusMind Signature (Design 15)
```

## Privacy

Camera video and face landmarks are processed **in the browser only** and are
never stored or uploaded. For course lessons only derived attention states per
stretch of video time are saved (owner-only), never frames or landmarks.
Uploaded lesson videos are private to their owner and served only through an
authenticated endpoint.

## Further documentation

- [frontend/src/features/attention-engine/README.md](frontend/src/features/attention-engine/README.md): how the attention engine works
- [docs/courses.md](docs/courses.md): courses, lessons, video storage, progress and ReplayAI data
- [docs/attention-engine-testing.md](docs/attention-engine-testing.md): real-camera test protocol (Hebrew)
- [docs/deferred-work.md](docs/deferred-work.md): known issues and postponed improvements
