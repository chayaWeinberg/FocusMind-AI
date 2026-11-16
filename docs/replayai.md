# ReplayAI: review suggestions from recorded attention

ReplayAI suggests **video intervals that may be worth reviewing**. It uses
transparent, configurable rules on the attention segments the lesson player
already records. It does not infer comprehension or concentration, and it uses
no external AI service.

Code: `backend/app/services/replay_engine.py` (pure rules, unit-tested),
`backend/app/services/replay.py` (storage and status),
`frontend/src/features/replay/` (UI and replay mode).

## Input: attention segments

While a trackable video (an upload or a direct file link) plays, the browser
records **segments** (`frontend/src/features/learning/lessonPlayback.js`).
Each segment has one attention state and a continuous range of video time.
A segment is cut on every state change, seek, pause, buffering and
playback-rate change, and after 60 s. Each segment stores two clocks:

| Field | Meaning |
|---|---|
| `videoStart`, `videoEnd` | seconds **in the media** |
| `sessionStartMs`, `sessionEndMs`, `durationMs` | time since the session started, and how long the segment lasted for the learner |

**Replay timestamps come only from video time.** Session time is used for
two things only: how long something lasted for the learner (wall time, so a
look-away at 2x speed is not counted as twice as long), and detecting
pauses. Session time is never converted into a position in the video.

YouTube embeds cannot report a position, so they produce no segments and no
suggestions. The UI says so instead of inventing timestamps.

## States

| State | Meaning | Used by ReplayAI |
|---|---|---|
| `ON_SCREEN` | head and eyes point toward the screen | no; it is **not** proof of concentration |
| `OFF_SCREEN` | gaze away from the screen | yes (rules 1 and 2) |
| `FACE_ABSENT` | no face detected | yes, as its own reason (rule 3) |
| `UNCERTAIN` | the measurement was not reliable | never counted as anything |
| `NOT_MEASURED` | camera off | never counted as anything |

## Rules

Consecutive segments of the same state, in one session, form an **episode**
when they are at most 1.5 s apart in both video time and session time. So a
single UNCERTAIN tick or a 60-second segment cut does not split a look-away.
A pause or a seek in the middle does split it.

| # | Reason (`reasons` key) | Fires when | Setting (default) |
|---|---|---|---|
| 1 | `sustained_off_screen` | one OFF_SCREEN episode lasts long enough (wall time) | `REPLAY_SUSTAINED_OFF_SCREEN_SECONDS` (4) |
| 2 | `repeated_off_screen` | several look-aways close together in video time, in one session; each must be at least a glance and shorter than rule 1 | `REPLAY_REPEATED_COUNT` (3), `REPLAY_REPEATED_WINDOW_SECONDS` (30), `REPLAY_GLANCE_SECONDS` (1) |
| 3 | `face_absent` | one FACE_ABSENT episode lasts long enough | `REPLAY_FACE_ABSENT_SECONDS` (5) |
| 4 | `interruptions` | playback stops several times close together in video time: a pause or buffering of at least 2 s, then resuming at the same point. Seeks are not interruptions | `REPLAY_INTERRUPTION_COUNT` (3), `REPLAY_INTERRUPTION_WINDOW_SECONDS` (60) |

Glances shorter than `REPLAY_GLANCE_SECONDS` are ignored entirely, so normal
eye movement never produces suggestions.

## From events to intervals

1. Each event becomes an interval with context:
   `REPLAY_CONTEXT_BEFORE_SECONDS` (5) before and
   `REPLAY_CONTEXT_AFTER_SECONDS` (3) after.
2. The interval is clamped to `[0, duration]`. The duration is the lesson's,
   or the one the player reported. If neither is known, the furthest recorded
   position is used. Very short intervals are widened to 4 s.
3. Intervals that overlap or lie within `REPLAY_MERGE_GAP_SECONDS` (5) of each
   other are merged, across all sessions of the lesson. A merged interval keeps
   its per-reason counts, the number of events, the number of sessions, and the
   look-away and face-absent seconds.

Replays and rewinds simply produce more segments over the same video range.
Their events merge into the same suggestion, so nothing is duplicated.

## Storage and status (`replay_items`, `replay_meta`)

- Suggestions (`kind: "auto"`) are recomputed when a session ends. They are
  also recomputed lazily on read whenever the number of stored segments for
  that user and lesson, or the rules, changed (`replay_meta`).
- When a recomputed interval overlaps a stored suggestion, it keeps that
  suggestion's **id and status**. Reviewed and dismissed decisions survive,
  and nothing is duplicated.
- `dismissed` stays dismissed. A `reviewed` suggestion is reopened (status
  `new`, `reopened: true`) only when a session that started *after* the
  review added events to it.
- Suggestions without remaining evidence are removed. This happens, for
  example, after the learner deletes attention data.
- Bookmarks (`kind: "bookmark"`) are created only by the learner, as a point
  or a range. They are never changed by recomputation. Bookmarks are deleted,
  and suggestions are dismissed.
- Every query is scoped to the signed-in user. Another user gets 404.

## Replay in the player

The lesson page reuses the existing video element (`SmartLearningPage.jsx`):

1. Clicking a suggestion seeks to its start and plays.
2. On `timeupdate`, playback pauses at the interval's end. "ניגון חוזר"
   replays the interval, and "סימון כנבדק" marks it reviewed.
3. Seeking more than 2 s outside the interval leaves replay mode. Normal
   playback is then untouched.
4. A point bookmark plays from 3 s before the point, without an automatic stop.
5. `/learning/lessons/:lessonId/review/:itemId` (from the review page, the
   course page or the study plan) opens the lesson directly in replay mode.

## API

| Method | Path | |
|---|---|---|
| GET | `/api/lessons/{id}/replay` | suggestions and bookmarks of the lesson, `trackable`, the rules in use |
| POST | `/api/lessons/{id}/bookmarks` | `{startSeconds, endSeconds?, note?}` |
| GET | `/api/replay?status=pending\|new\|reviewed\|dismissed\|all&courseId=&kind=` | overview with lesson and course titles |
| PATCH | `/api/replay/{itemId}` | `{status: "new"\|"reviewed"\|"dismissed"}` |
| DELETE | `/api/replay/{itemId}` | bookmarks only |
| GET | `/api/replay/rules` | current thresholds |

## Limitations

- Gaze direction is not proof of attention or understanding. A suggestion
  only means that the recorded signals matched a rule.
- The camera estimate can be wrong: lighting, glasses, camera angle. Real
  webcam accuracy must be checked by hand (see
  [attention-engine-testing.md](attention-engine-testing.md)).
- No suggestions are made for YouTube or for local files on `/learning`.
- Recomputation is guarded by an in-process lock per user and lesson. With
  several backend workers, two concurrent recomputations could rarely create
  a duplicate, which the next recomputation then removes.
