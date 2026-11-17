# Bundled lesson videos (original FocusMind content)

This folder holds the **FocusMind Academy**: 15 full lessons, about 3 minutes each, in 5 courses
(Python, JavaScript, SQL, algorithms, Docker). Everything here was created for this project;
no third-party content is included.

- **Content:** explanation captions, code and output, step-by-step traces and a "check
  yourself" question in every lesson. There is no narration.
- **Source and recording:** `frontend/scripts/academy-videos/lessons.mjs`, recorded with
  `npm run academy-videos` (in `frontend/`), which writes here directly. Manifest entries have
  `"kind": "academy"`.
- **Why it is in the repository:** a fresh deployment needs no Windows machine, browser or
  local volume. The production image copies this folder and installs it on startup
  (`SEED_CATALOG=true`, `DEMO_VIDEOS_DIR`).
- **Installation** is idempotent, by key and sha256. It never replaces videos that people
  uploaded or chose, or videos a content manager removed, and it skips retired courses.

The 16 short demonstration videos of the three retired demonstration courses were removed
from this folder on 17.11.2026. They remain in Git history, and installed copies stay in
existing databases.
