"""Learning sessions and attention segments (data for the future ReplayAI).

A session is one continuous visit to a lesson's player. While the video plays,
the browser sends *segments*: stretches with a single attention state and a
contiguous range of video time. Segments are cut on every state change, seek,
pause and playback-rate change, so

- video time (videoStart..videoEnd, seconds in the media) and
- session time (sessionStartMs..sessionEndMs, since the session started)

stay independent. Replays simply produce more segments over the same video
range. Only derived states are stored: never frames, images or landmarks.
States are stored as measured: UNCERTAIN and NOT_MEASURED are kept separate so
they are never counted as focused or distracted.
"""

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.models.courses import AttentionSegmentDocument
from app.repositories.courses import LearningSessionRepository, to_object_id
from app.schemas.auth import RegisteredUser
from app.schemas.courses import SegmentBatch, SegmentOut, SessionDetail, SessionOut
from app.services.courses import ConflictError, CourseService, NotFoundError, is_trackable, utcnow


class LearningSessionService:
    def __init__(self, database: AsyncDatabase, user: RegisteredUser) -> None:
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
            segment_count=session.get("segment_count", 0),
        )

    async def start(self, lesson_id: str) -> SessionOut:
        lesson, course = await self.courses.lesson_for_learning(lesson_id)
        if not is_trackable(lesson.get("video", {})):
            raise ConflictError("Attention segments need a video whose playback position can be read.")
        session = {
            "user_id": self.user_id,
            "course_id": course["_id"],
            "lesson_id": lesson["_id"],
            "started_at": utcnow(),
            "ended_at": None,
            "active_ms": 0,
            "segment_count": 0,
        }
        session["_id"] = await self.sessions.insert(session)
        return self._out(session)

    async def add_segments(self, session_id: str, batch: SegmentBatch) -> int:
        session = await self._own_session(session_id)
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

    async def end(self, session_id: str, active_ms: int) -> SessionOut:
        session = await self._own_session(session_id)
        return self._out(await self.sessions.end(session["_id"], active_ms, utcnow()))

    async def detail(self, session_id: str) -> SessionDetail:
        session = await self._own_session(session_id)
        segments = await self.sessions.segments(session["_id"])
        return SessionDetail(
            **self._out(session).model_dump(),
            segments=[SegmentOut(**{key: segment[key] for key in SegmentOut.model_fields}) for segment in segments],
        )
