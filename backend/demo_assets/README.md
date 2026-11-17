# Demonstration videos (original FocusMind content)

16 short MP4 videos (about 90 seconds each, 13 MB in total), one for each lesson of
the three demonstration courses. They are labelled "סרטון הדגמה".

- **Origin:** generated for this project by `frontend/scripts/demo-videos/generate.mjs`
  (slides drawn and recorded in a browser). No third-party content is included.
- **Why they are in the repository:** a fresh cloud deployment needs no Windows
  machine, browser or local volume. The production image copies this folder.
- **Installation:** `DEMO_VIDEOS_DIR` points here and `SEED_CATALOG=true`, so the
  backend installs the videos on startup through the regular video storage.
  The installation is idempotent (by key and sha256). It never replaces uploads,
  videos chosen by people, or videos a content manager removed.
- **Regenerating:** `cd frontend; npm run demo-videos`, then copy
  `demo-videos/*.mp4` and `manifest.json` here.
