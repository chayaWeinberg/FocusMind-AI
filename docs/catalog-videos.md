# Catalog videos and NetFree

The catalog has two kinds of video lessons.

## FocusMind Academy (plays inside FocusMind)

The FocusMind Academy has 15 original lessons, about 3 minutes each, in 5 courses.
- The files are bundled in `backend/demo_assets/` and installed on startup (`SEED_CATALOG=true`
  plus `DEMO_VIDEOS_DIR`), or by hand:
  `python -m app.demo_videos install <dir> --kind academy`.
- They are stored like uploads and streamed by `/api/videos/{id}/stream`, also behind NetFree.
  Position, progress, attention segments and ReplayAI all work.
- To change the content, edit `frontend/scripts/academy-videos/lessons.mjs`, raise
  `ACADEMY_VERSION`, then run `npm run academy-videos`. The script records in local Edge and
  writes to `backend/demo_assets/`.

The three earlier demonstration courses, with their short "סרטון הדגמה" videos, were
**retired** on 17.11.2026. The slugs are listed in `RETIRED_COURSE_SLUGS` in
`app/seed/catalog.py`. They are hidden everywhere, and they are never recreated or given
videos. Their data is kept, so the change is reversible.

## External lecture links (the library)

The 10 library courses (116 lessons) link to Harvard CS50 and Microsoft Learn lectures.
- The data is in `backend/app/seed/catalog_library.py`, documented in
  [catalog-library.md](catalog-library.md).
- FocusMind only links to them. Nothing is downloaded or re-hosted.
- Each lesson has up to three candidates: `direct`, `youtube` and `page`. The tool
  `python -m app.catalog_videos check|apply|status` chooses one.

## Playback types

| Type | Example | In FocusMind | Position / progress | ReplayAI |
|---|---|---|---|---|
| Uploaded MP4/WebM | your own file | authenticated player | saved | yes |
| Direct MP4/WebM (`direct`) | `https://cdn.cs50.net/...-720p.mp4` | same player | saved | yes |
| YouTube (`youtube`) | `youtube-nocookie.com` embed | sandboxed iframe | not available; manual completion | no |
| External page (`page`) | `https://cs50.harvard.edu/...` | an **"open the video on the external website"** link | not available; manual timer and completion | no, and the player says why |

An ordinary web page is never treated as a video file. In the editor it must
be chosen explicitly as "עמוד אינטרנט שמציג את הסרטון". If you paste a web
page as a video link, it is rejected.

## Verification behind NetFree (2026-11-16)

Measured on the development machine, through its real NetFree connection.
The same check was later run on the library links (see catalog-library.md). Three methods were used:

1. **Microsoft Edge (Playwright):**
   - a real `<video>` element given the MP4;
   - a `youtube-nocookie` embed with autoplay;
   - opening the lecture page.
2. **HTTP range requests** (`curl`).
3. **The backend container:** `python -m app.catalog_videos check`.

| Candidate | Result | Detail |
|---|---|---|
| Direct MP4 (cdn.cs50.net) | **blocked** | HTTP 418 NetFree block page. The rule is `http://*/*.mp4*`, so *every* external `.mp4` URL is blocked, not only CS50. The player reports `MEDIA_ERR_SRC_NOT_SUPPORTED`. |
| YouTube embed | **blocked** | HTTP 418 for the embed and for the video stream |
| Lecture page (cs50.harvard.edu) | **page opens** | HTTP 200, the page loads in Edge. **Its own videos (YouTube/MP4) are blocked as well.** |

Other sources checked, all blocked (HTTP 418, default block):
- Wikimedia Commons;
- archive.org;
- Khan Academy;
- MIT OCW;
- youtube.com;
- kan.org.il.

`player.vimeo.com` answered with a redirect (302); no Vimeo video was
verified.

**Conclusion:** no external video was verified as playable on this NetFree
connection. The lessons were attached as **external pages**, which open
(verified). Whether the lecture video then plays on that page is
**UNVERIFIED** and expected to be blocked. Uploaded videos are not affected:
they stream from your own server, without `.mp4` in the URL and without
passing through the filter.

## Replacing a blocked link

1. **Ask NetFree to open the source.** If NetFree opens `cdn.cs50.net`, run:

   ```powershell
   docker compose exec backend python -m app.catalog_videos check   # see what is reachable now
   docker compose exec backend python -m app.catalog_videos apply   # switches to the best reachable type
   ```

   With the MP4s reachable, the lessons switch to direct playback with
   progress and ReplayAI.
2. **Force a type** with `apply --mode direct|youtube|page`, for example
   `--mode direct` on a server without filtering. Use `--dry-run` first.
3. **Per lesson, by hand** (content managers, "ניהול הקטלוג", then the course
   editor, then "סרטון"):
   - upload a file you have the right to use;
   - or paste another link: "קובץ וידאו ישיר או YouTube", or "עמוד אינטרנט
     שמציג את הסרטון".

   A video chosen by a person is never replaced by the tool. A video a manager
   removed stays removed.
4. To add or replace candidates permanently, edit
   `backend/app/seed/catalog_videos.py`. Use real URLs from the source's own
   pages only, and record the match and the verification.

`python -m app.catalog_videos status` lists what every catalog lesson uses now.

## Safety

The tool:
- changes only seeded catalog lessons that have no video, or whose video it
  set itself (`catalog_video_key`);
- never touches uploads, links chosen by people, or videos removed by a
  manager (`cleared_by_manager`);
- never changes users, enrollments, progress or files;
- does not mark the course as edited.

Running it again is a no-op ("unchanged").
