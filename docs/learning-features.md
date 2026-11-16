# Smart Timer, FocusInsights, FocusCoach, AdaptiveStudy, QuizFlow, catalog management and privacy

All features work **without any external AI provider or paid API**. They
are deterministic and computed from data stored for the signed-in user.
ReplayAI has its own document: [replayai.md](replayai.md).

## Smart Timer

Code: `frontend/src/features/learning/smartTimer.js`, `SmartTimerCard.jsx`,
`useLessonPersistence.js`, `backend/app/services/learning_sessions.py`.

| Clock | Counted when | Stored as |
|---|---|---|
| Active learning time | the video actually plays. Paused, seeking and buffering time is not counted. For YouTube, while the learner runs the session timer | `learning_sessions.active_ms` |
| Break time | only while a break the learner started is running | `learning_sessions.break_ms` |
| Video position | the media's own `currentTime` | progress and segments |

- **Study rhythm**: `/api/me/preferences`, with `studyMinutes` (default 25),
  `breakMinutes` (5) and `breakReminders` (on). After one study block of
  active time, a gentle reminder offers a break. The video is never paused
  automatically. A break starts only when the learner clicks, and that click
  pauses the video. "Continue learning" starts a new block.
- **Persistence and recovery**: the session is created on the first playback
  (for YouTube, when the timer starts). A heartbeat every 15 s, plus when the
  tab is hidden or the page is left, stores active and break time with `$max`.
  A refresh, a crash or a closed tab therefore keeps the time measured until
  then.
- **Interrupted sessions**: a session with no end and a last heartbeat older
  than 10 minutes is shown as "נקטע" in the history. A refresh starts a new
  session, and the old one keeps its time.
- Local files on `/learning` are timed in the browser only. Nothing is sent
  to the server.

## FocusInsights (`/insights`, `GET /api/insights?tzOffsetMinutes=`)

Every value comes from MongoDB aggregations over the learner's own data:

- active learning time today, this week, per day (14 days), per week
  (8 weeks, starting Sunday) and in total; session count; break time;
- learning time and progress per course (from `my_courses`);
- completed lessons, in total and this week;
- the distribution of the five attention states (stored segment durations),
  and per week the share of "looking toward the screen" out of *measured*
  time (ON_SCREEN + OFF_SCREEN + FACE_ABSENT);
- ReplayAI counts (suggested, pending, reviewed, dismissed, bookmarks), quiz
  attempts and the average score;
- the study streak: consecutive days with at least 1 minute of active time;
- the 10 latest sessions, with their status.

Days follow the browser's clock: the browser sends `getTimezoneOffset()`.
New users see an empty state, never sample numbers. The wording is
"זמן מבט לכיוון המסך", never a concentration score.

Charts are dependency-free HTML/CSS. They follow RTL order (oldest on the
right), show values on hover and keyboard focus, and include a hidden table
for screen readers. The state colors passed the palette validator: teal
`#00909a`, orange `#d9783f`, purple `#7b5ea7`, plus neutral grays for
UNCERTAIN and a hatched gray for NOT_MEASURED.

## FocusCoach (`GET /api/coach`)

Deterministic tips, each with its evidence, shown in Hebrew on the dashboard
and the study page:

| Tip | Evidence |
|---|---|
| `take_break` | 50 minutes or more of active learning in the last two hours |
| `review_before_next` | a completed lesson still has pending suggestions, and the next lesson is not completed |
| `review_flagged` | pending suggestions in a lesson |
| `continue_lesson` | an unfinished lesson with a saved position (most recent first) |
| `return_to_bookmark` | pending bookmarks |
| `retry_quiz` | mistakes in the latest attempt of a lesson's quiz |
| `goal_behind` | the weekly goal is below 80 % of the expected pace so far |
| `resume_course` | an unfinished course not touched for 3 days, or never started |
| `start_learning` | the learner has no courses yet |

There is **no LLM integration**. With no transcripts or analyzed video
content, AI-written summaries or advice about a video would be invented. The
deterministic coach covers the required guidance without one. Any future
optional LLM integration must be configurable, must work only on real text
content, and must keep this coach as the fallback.

## AdaptiveStudy (`/study`)

- `PUT /api/study/goal`, with `{courseId, sessionMinutes, weeklyMinutes?, targetDate?}`.
  There is one goal per user, and only for a course the user may learn.
- `GET /api/study/plan` returns:
  - progress toward the goal: lessons, weekly minutes in that course, days
    left and lessons per week needed;
  - unfinished lessons, with the remaining time (duration minus saved
    position);
  - pending review items;
  - a **suggested next session** that fits `sessionMinutes`, built in this
    order:
    1. pending suggestions and bookmarks of the course, in lesson order;
    2. continuing the started lesson from its saved position;
    3. the next lessons, in order.

    Planning stops at a lesson whose length is unknown and says so.

## QuizFlow

- Multiple-choice questions with 2-6 options and exactly one correct answer,
  plus an optional explanation.
- Learners write private questions for any lesson they can learn. Content
  managers write questions on catalog lessons that are **shared** with every
  learner of that lesson.
- Correct answers are sent only to the question's author, or after answering.
  The server grades attempts and stores them per user (`quiz_attempts`).
- The learner can review the mistakes from the last attempt. Course pages
  show the question count and the last score per lesson
  (`/api/courses/{id}/learning-summary`).
- Quizzes never block lesson completion.
- There is no automatic generation: lessons have no transcript or analyzed
  text, so generated questions would be invented.

| Method | Path |
|---|---|
| GET | `/api/lessons/{id}/quiz` |
| POST | `/api/lessons/{id}/quiz/questions` |
| DELETE | `/api/quiz/questions/{questionId}` (author only) |
| POST / GET | `/api/lessons/{id}/quiz/attempts` |

## Catalog management (content managers)

- The role `content_manager` is granted **only from the command line**, and
  nobody gets it automatically:

  ```powershell
  docker compose exec backend python -m app.admin grant editor@example.com
  docker compose exec backend python -m app.admin revoke editor@example.com
  docker compose exec backend python -m app.admin list
  ```

  The user then signs in again, or reloads the page.
- Content managers see "ניהול הקטלוג" (`/admin/catalog`), where they can:
  - create draft catalog courses;
  - edit them in the existing course editor: lessons, order, uploaded videos
    and supported links;
  - publish or unpublish them.

  Drafts are invisible to learners.
- Safety rules:
  - a catalog course with enrolled learners cannot be deleted. Unpublish it
    instead;
  - a catalog lesson with learner progress cannot be deleted;
  - the seed never overwrites a course a manager edited (`edited_by_manager`).
- Lessons without a video show "אין עדיין סרטון". No videos or links are
  invented, and nothing is downloaded or scraped.
- API:
  - `GET /api/admin/catalog`, which includes drafts, enrollment counts and
    lessons without a video;
  - `POST /api/admin/catalog`;
  - `PATCH /api/courses/{id}` with `{status}`.

  All of them return 403 for learners.

## Privacy and retention

- The camera is processed in the browser. Frames, images and face landmarks
  are never stored or uploaded.
- Stored, and visible to the owner only:
  - sessions, with their active and break time;
  - attention segments, one state per stretch of video time;
  - ReplayAI suggestions and bookmarks;
  - quiz attempts;
  - progress.
- `/privacy` explains each state and what is stored, and shows the counts
  (`GET /api/privacy/summary`).
- `DELETE /api/privacy/learning-data?olderThanDays=&includeBookmarks=&includeQuizAttempts=`
  deletes sessions and segments (and optionally bookmarks and quiz attempts).
  It asks for confirmation in the UI first. Suggestions are recomputed from
  what remains. Progress, courses and the account are never deleted here.
- `ATTENTION_RETENTION_DAYS` (default 0, which keeps everything) removes old
  sessions and segments server-wide on startup.

## Data model additions

| Collection | Key fields | Indexes |
|---|---|---|
| `replay_items` | user_id, lesson_id, course_id, kind (`auto`/`bookmark`), start_seconds, end_seconds, status, reasons, event_count, session_count, off_screen_ms, face_absent_ms, note, reopened, reviewed_at, evidence_at | user+lesson+start; user+status+course; lesson |
| `replay_meta` | user_id, lesson_id, segment_count, rules, computed_at | unique user+lesson |
| `user_preferences` | user_id, study_minutes, break_minutes, break_reminders | unique user |
| `study_goals` | user_id, course_id, session_minutes, weekly_minutes, target_date | unique user |
| `quiz_questions` | lesson_id, course_id, author_id, shared, prompt, options, correct_index, explanation | lesson+created; author |
| `quiz_attempts` | user_id, lesson_id, course_id, results, score, total, created_at | user+lesson+created; lesson |
| `learning_sessions` (new fields) | break_ms, trackable, last_seen_at | + user+started_at |
| `users` (new field) | role (`content_manager`, CLI only) | |

All additions are backward compatible: missing fields fall back to defaults,
and indexes are created on startup. No existing data is migrated or removed.
Deleting a lesson or course also removes its suggestions, bookmarks,
questions and attempts.
