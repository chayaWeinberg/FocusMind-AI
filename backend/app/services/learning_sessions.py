"""Learning sessions (Smart Timer) and attention segments (ReplayAI input).

A session is one continuous visit to a lesson's player.

Clocks (never mixed):
- active_ms: time the video actually played (paused and buffering time are not
  counted). For YouTube embeds, whose position cannot be read, it is the time
  the learner ran the session timer manually.
- break_ms: breaks the learner took from the Smart Timer.
- video time: positions in the media, stored only in segments.

The browser sends a heartbeat every 15 s with the current active/break time,
so an interrupted visit (tab closed, crash, network loss) keeps the time it
had; such a session has no ended_at and an old last_seen_at ("interrupted").

While a trackable video plays, the browser sends *segments*: stretches with a
single attention state and a contiguous range of video time. Segments are cut
on every state change, seek, pause and playback-rate change, so video time
(videoStart..videoEnd) and session time (sessionStartMs..sessionEndMs) stay
independent. Only derived states are stored: never frames, images or
landmarks. UNCERTAIN and NOT_MEASURED are kept separate so they are never
counted as focused or distracted.
"""

from datetime import timedelta

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.models.courses import AttentionSegmentDocument
from app.repositories.courses import LearningSessionRepository, to_object_id
from app.schemas.auth import RegisteredUser
from app.schemas.courses import SegmentBatch, SegmentOut, SessionDetail, SessionOut
from app.schemas.learning import SessionHistoryItem
from app.services.courses import ConflictError, CourseService, NotFoundError, is_trackable, utcnow

# A session without an end whose last heartbeat is older than this was interrupted.
INTERRUPTED_AFTER = timedelta(minutes=10)


def session_status(session: dict, now) -> str:
    if session.get("ended_at"):
        return "ended"
    last_seen = session.get("last_seen_at") or session["started_at"]
    return "interrupted" if now - last_seen > INTERRUPTED_AFTER else "active"


class LearningSessionService:
    def __init__(self, database: AsyncDatabase, user: RegisteredUser) -> None:
        self.database = database
        self.user = user
        self.courses = CourseService(database, user)
        self.sessions = LearningSessionRepository(database)
        self.user_id = ObjectId(user.id)

    async def _own_session(self, session_id: str) -> dict:
        object_id = to_object_id(session_id)
        session = await self.sessions.find(object_id) if object_id else None
        if session is None or session["user_id"] != self.user_id:
            raise NotFoundError("Learning session not found.")
        return session

    @staticmethod
    def _out(session: dict) -> SessionOut:
        return SessionOut(
            id=str(session["_id"]),
            lesson_id=str(session["lesson_id"]),
            course_id=str(session["course_id"]),
            started_at=session["started_at"],
            ended_at=session.get("ended_at"),
            active_ms=session.get("active_ms", 0),
            break_ms=session.get("break_ms", 0),
            segment_count=session.get("segment_count", 0),
            trackable=session.get("trackable", True),
        )

    async def start(self, lesson_id: str) -> SessionOut:
        lesson, course = await self.courses.lesson_for_learning(lesson_id)
        video = lesson.get("video", {})
        if video.get("source_type", "none") == "none":
            raise ConflictError("A lesson without a video cannot be learned yet.")
        now = utcnow()
        session = {
            "user_id": self.user_id,
            "course_id": course["_id"],
            "lesson_id": lesson["_id"],
            "started_at": now,
            "last_seen_at": now,
            "ended_at": None,
            "active_ms": 0,
            "break_ms": 0,
            "segment_count": 0,
            "trackable": is_trackable(video),
        }
        session["_id"] = await self.sessions.insert(session)
        return self._out(session)

    async def add_segments(self, session_id: str, batch: SegmentBatch) -> int:
        session = await self._own_session(session_id)
        if not session.get("trackable", True):
            raise ConflictError("Attention segments need a video whose playback position can be read.")
        now = utcnow()
        documents: list[AttentionSegmentDocument] = [
            {
                "session_id": session["_id"],
                "user_id": self.user_id,
                "course_id": session["course_id"],
                "lesson_id": session["lesson_id"],
                "seq": segment.seq,
                "session_start_ms": segment.session_start_ms,
                "session_end_ms": segment.session_end_ms,
                "video_start": round(segment.video_start, 3),
                "video_end": round(segment.video_end, 3),
                "playback_rate": segment.playback_rate,
                "state": segment.state,
                "duration_ms": segment.duration_ms,
                "concentration": segment.concentration,
                "created_at": now,
            }
            for segment in batch.segments
        ]
        return await self.sessions.add_segments(session["_id"], documents)

    async def heartbeat(self, session_id: str, active_ms: int, break_ms: int) -> SessionOut:
        session = await self._own_session(session_id)
        return self._out(await self.sessions.heartbeat(session["_id"], active_ms, break_ms, utcnow()))

    async def end(self, session_id: str, active_ms: int, break_ms: int = 0) -> SessionOut:
        from app.services.replay import ReplayService

        session = await self._own_session(session_id)
        ended = await self.sessions.end(session["_id"], active_ms, break_ms, utcnow())
        if session.get("trackable", True) and ended.get("segment_count", 0):
            await ReplayService(self.database, self.user).refresh_safely(session["lesson_id"])
        return self._out(ended)

    async def detail(self, session_id: str) -> SessionDetail:
        session = await self._own_session(session_id)
        segments = await self.sessions.segments(session["_id"])
        return SessionDetail(
            **self._out(session).model_dump(),
            segments=[SegmentOut(**{key: segment[key] for key in SegmentOut.model_fields}) for segment in segments],
        )

    async def history(self, limit: int = 20) -> list[SessionHistoryItem]:
        sessions = await self.sessions.recent(self.user_id, max(1, min(limit, 100)))
        return await history_items(self.database, self.sessions, sessions)


async def history_items(database: AsyncDatabase, repository: LearningSessionRepository, sessions: list[dict]) -> list[SessionHistoryItem]:
    lesson_ids = list({row["lesson_id"] for row in sessions})
    course_ids = list({row["course_id"] for row in sessions})
    lessons = {row["_id"]: row["title"] async for row in database.lessons.find({"_id": {"$in": lesson_ids}}, {"title": 1})}
    courses = {row["_id"]: row["title"] async for row in database.courses.find({"_id": {"$in": course_ids}}, {"title": 1})}
    video = await repository.video_seconds([row["_id"] for row in sessions])
    now = utcnow()
    return [
        SessionHistoryItem(
            id=str(row["_id"]),
            lesson_id=str(row["lesson_id"]),
            course_id=str(row["course_id"]),
            lesson_title=lessons.get(row["lesson_id"], ""),
            course_title=courses.get(row["course_id"], ""),
            started_at=row["started_at"],
            ended_at=row.get("ended_at"),
            last_seen_at=row.get("last_seen_at"),
            active_ms=row.get("active_ms", 0),
            break_ms=row.get("break_ms", 0),
            video_seconds=round(video.get(row["_id"], 0.0), 1),
            segment_count=row.get("segment_count", 0),
            trackable=row.get("trackable", True),
            status=session_status(row, now),
        )
        for row in sessions
    ]
