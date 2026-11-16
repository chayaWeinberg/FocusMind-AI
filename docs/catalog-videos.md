# Catalog videos and NetFree

## Demonstration videos (play inside FocusMind, also behind NetFree)

Every catalog lesson (16 of 16) has an **original demonstration video**
(labeled "סרטון הדגמה"), about 90 seconds of slides about the lesson's topic:
- explanations, code examples, tables and diagrams;
- an on-screen clock and progress bar, so seeking and replay are visible.

They are uploaded videos like any other:
- stored in the video volume and streamed by `/api/videos/{id}/stream`;
- position, progress, attention segments and ReplayAI all work.

They are not full lectures. Where a CS50 lecture matches, it stays as the
lesson's **reference** ("ההרצאה המלאה באתר המקור"), and that link may be
blocked by NetFree.

| Step | Command |
|---|---|
| Generate (offline, local Microsoft Edge; about 7 minutes the first time, then cached) | `cd frontend; npm run demo-videos` |
| Copy into the backend container | `docker compose cp demo-videos backend:/tmp/demo-videos` |
| Install (idempotent) | `docker compose exec backend python -m app.demo_videos install /tmp/demo-videos` |
| Remove the temporary copy | `docker compose exec -u root backend rm -rf /tmp/demo-videos` |

In Git Bash, prefix the commands with `MSYS_NO_PATHCONV=1`; otherwise `/tmp/...` is rewritten to a Windows path. PowerShell needs no prefix.

- **Output:** `demo-videos/*.mp4` plus `manifest.json` (duration, size,
  sha256, version). Git ignores this folder. Only the generator
  (`frontend/scripts/demo-videos/`) and the installer are committed.
- **No ffmpeg needed:** Edge renders the slides on a canvas and records
  H.264 MP4 with MediaRecorder. Every file is checked for its full duration;
  a short recording is retried.
- **The installer:**
  - stores files through the normal video storage, owned by a non-user demo
    owner (no quota);
  - is idempotent by demo key and sha256, so restarting Docker adds nothing;
  - releases files of an older demo version;
  - never replaces uploads or links chosen by people, or videos a manager
    removed.

  The external link tool (below) never replaces a demo video either.
- **Changing the content:** edit `frontend/scripts/demo-videos/lessons.mjs`,
  raise `DEMO_VERSION`, then generate and install again.

## External lecture links

The example catalog lessons are linked to lectures from Harvard University's
**CS50** open courses (CS50P, CS50 SQL, CS50 AI). The license is
**CC BY-NC-SA 4.0**, and attribution is shown in the player.

- Every URL was taken from the course's official week page, never composed
  by hand.
- FocusMind only links to them. Nothing is downloaded or re-hosted.
- Data: `backend/app/seed/catalog_videos.py`. Tool: `python -m app.catalog_videos`.

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

## Lessons and candidates

The lecture notes were checked for each lesson's topics. The direct link for
each lecture is `https://cdn.cs50.net/<path>-720p.mp4`. The YouTube link is
`https://www.youtube.com/watch?v=<id>`.

| Course / lesson | CS50 lecture | Match | Page (`page`) | MP4 path | YouTube id |
|---|---|---|---|---|---|
| Python / היכרות עם Python | CS50P 0 Functions, Variables | partial: no installation | https://cs50.harvard.edu/python/2022/weeks/0/ | `python/2022/x/lectures/0/lecture0` | `JP7ITIXGpHk` |
| Python / משתנים וטיפוסי נתונים | CS50P 0 | full | same | same | same |
| Python / תנאים וקבלת החלטות | CS50P 1 Conditionals | full | https://cs50.harvard.edu/python/2022/weeks/1/ | `python/2022/x/lectures/1/lecture1` | `_b6NgY_pMdw` |
| Python / לולאות | CS50P 2 Loops | full | https://cs50.harvard.edu/python/2022/weeks/2/ | `python/2022/x/lectures/2/lecture2` | `-7xg8pGcP6w` |
| Python / פונקציות | CS50P 0 | full | weeks/0 | lecture0 | `JP7ITIXGpHk` |
| Python / רשימות ומילונים | CS50P 2 | full: lists and dicts | weeks/2 | lecture2 | `-7xg8pGcP6w` |
| SQL / מה זה מסד נתונים רלציוני | CS50 SQL 1 Relating | full | https://cs50.harvard.edu/sql/2024/weeks/1/ | `sql/2023/x/lectures/1/lecture1` | `_2t18Hy9Z0Y` |
| SQL / שליפת נתונים עם SELECT | CS50 SQL 0 Querying | full | https://cs50.harvard.edu/sql/2024/weeks/0/ | `sql/2023/x/lectures/0/lecture0` | `vHYeChEf2lA` |
| SQL / פונקציות סיכום | CS50 SQL 0 | partial: GROUP BY/HAVING are in lecture 1 | weeks/0 | lecture0 | `vHYeChEf2lA` |
| SQL / חיבור טבלאות | CS50 SQL 1 | full | weeks/1 | lecture1 | `_2t18Hy9Z0Y` |
| SQL / הוספה ועדכון נתונים | CS50 SQL 3 Writing | full | https://cs50.harvard.edu/sql/2024/weeks/3/ | `sql/2023/x/lectures/3/lecture3` | `BD08USRd2M8` |
| AI / מהי בינה מלאכותית | CS50 AI 0 Search | partial: a short intro, then search | https://cs50.harvard.edu/ai/2024/weeks/0/ | `ai/2020/spring/lectures/0/lecture0` | `WbzNRTTrX0g` |
| AI / למידת מכונה | CS50 AI 4 Learning | full | https://cs50.harvard.edu/ai/2024/weeks/4/ | `ai/2020/spring/lectures/4/lecture4` | `-g0iJjnO2_w` |
| AI / רשתות נוירונים | CS50 AI 5 Neural Networks | full | https://cs50.harvard.edu/ai/2024/weeks/5/ | `ai/2020/spring/lectures/5/lecture5` | `J1QD9hLDEDY` |
| AI / מודלי שפה | CS50 AI 6 Language | full | https://cs50.harvard.edu/ai/2024/weeks/6/ | `ai/2023/x/lectures/6/lecture6` | `QAZc9xsQNjQ` |
| AI / בינה מלאכותית אחראית | none | | no video: no CS50 lecture covers it, so none is invented | | |

## Verification behind NetFree (2026-11-16)

Measured on the development machine, through its real NetFree connection.
Three methods were used, with the same result for all ten lectures:

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
