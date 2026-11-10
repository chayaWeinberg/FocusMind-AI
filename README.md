# FocusMind AI

A smart learning platform with a Hebrew RTL interface: registration and login,
a personal dashboard, and a learning page with a local video player, a study
timer, and browser-only webcam gaze experiments built on MediaPipe.

| Layer    | Stack |
|----------|-------|
| Frontend | React 18, Vite 6, Vitest, MediaPipe Tasks Vision, WebGazer.js (experiment) |
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
- **Integration tests** (`backend/tests/integration/`) use the real MongoDB
  from `.env`. Each run creates a random database and drops it afterwards.
  If MongoDB is not reachable they are **skipped**. With
  `FOCUSMIND_REQUIRE_MONGO=1`, as in CI, they **fail** instead.

CI (`.github/workflows/ci.yml`) runs both suites and the production build on
every push to `main` and on every pull request.

## NetFree and other HTTPS-filtering networks

Docker builds need the filter's root certificate. Copy the `.crt`/`.pem` files
into `backend/certs/` and `frontend/certs/`. Git ignores them; see the README
in each folder. Without such a network, leave the folders empty.

## Routes

| Path | Screen | Access |
|------|--------|--------|
| `/`, `/register` | Registration | public; signed-in users go to the dashboard |
| `/login` | Login | public; signed-in users go to the dashboard |
| `/dashboard` | Dashboard | signed in |
| `/learning` | Smart learning and gaze experiment | signed in |
| `/__experiments/webgazer` | WebGazer experiment | development build only |
| `/__experiments/attention-engine` | New attention engine and diagnostics | development build only |
| `/learning?engine=new` | Learning page with the new engine instead of the legacy experiment | development flag (`?engine=legacy` reverts) |

## Project layout

```
backend/app/
  api/routes/auth.py      register, login, me, logout (HttpOnly JWT cookie)
  core/config.py          settings from env / .env
  db/database.py          MongoDB client, get_db dependency, health ping
  services/ repositories/ schemas/ models/
backend/tests/            unit tests + integration/ (real MongoDB)
frontend/src/
  App.jsx                 routing and auth guards
  features/auth/          pages, AuthContext, authApi (the only API client)
  features/dashboard/
  features/learning/      learning page + EXPERIMENTAL gaze modules and diagnostics
  features/vision/        shared camera + MediaPipe helpers
  features/attention-engine/  attention engine v1 (signals, calibration, fusion, smoothing, UI)
  styles/SignatureTheme.css   FocusMind Signature (Design 15)
```

## Privacy

Camera video, face landmarks and calibration data are processed **in the
browser only** and are never uploaded. Diagnostic JSON files are saved only
when the user clicks download. Git ignores them, because they contain facial
measurements.

## Further documentation

- [frontend/src/features/attention-engine/README.md](frontend/src/features/attention-engine/README.md): how the attention engine works
- [docs/attention-engine-testing.md](docs/attention-engine-testing.md): real-camera test protocol (Hebrew)
- [docs/deferred-work.md](docs/deferred-work.md): known issues and postponed improvements
