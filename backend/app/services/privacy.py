"""What is stored about a learner's attention, and deleting it.

Stored (derived data only, never camera frames, images or face landmarks):
- learning sessions: start/end, active and break time;
- attention segments: state per stretch of video time;
- ReplayAI suggestions computed from them, bookmarks the learner created;
- quiz attempts.

The learner can delete sessions + segments (all, or older than N days),
optionally with bookmarks and quiz attempts. Suggestions are recomputed from
what remains. Course progress and the account itself are never deleted here.

Optional server-wide retention (ATTENTION_RETENTION_DAYS, off by default)
removes old sessions and segments on startup.
"""

from datetime import timedelta

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.core.config import settings
from app.repositories.learning import QuizRepository, ReplayRepository
from app.schemas.auth import RegisteredUser
from app.schemas.learning import DeletionResult, PrivacySummary
from app.services.courses import utcnow


class PrivacyService:
    def __init__(self, database: AsyncDatabase, user: RegisteredUser) -> None:
        self.database = database
        self.user_id = ObjectId(user.id)

    async def summary(self) -> PrivacySummary:
        criteria = {"user_id": self.user_id}
        oldest = await self.database.learning_sessions.find_one(criteria, sort=[("started_at", 1)])
        return PrivacySummary(
            sessions=await self.database.learning_sessions.count_documents(criteria),
            segments=await self.database.attention_segments.count_documents(criteria),
            suggestions=await self.database.replay_items.count_documents({**criteria, "kind": "auto"}),
            bookmarks=await self.database.replay_items.count_documents({**criteria, "kind": "bookmark"}),
            quiz_attempts=await self.database.quiz_attempts.count_documents(criteria),
            oldest_session_at=oldest["started_at"] if oldest else None,
            retention_days=settings.attention_retention_days,
        )

    async def delete(
        self, older_than_days: int | None, include_bookmarks: bool, include_quiz_attempts: bool
    ) -> DeletionResult:
        session_criteria: dict = {"user_id": self.user_id}
        dated: dict = {}
        if older_than_days:
            cutoff = utcnow() - timedelta(days=older_than_days)
            session_criteria["started_at"] = {"$lt": cutoff}
            dated = {"created_at": {"$lt": cutoff}}
        session_ids = [row["_id"] async for row in self.database.learning_sessions.find(session_criteria, {"_id": 1})]
        segments = await self.database.attention_segments.delete_many(
            {"user_id": self.user_id, "session_id": {"$in": session_ids}}
        )
        sessions = await self.database.learning_sessions.delete_many({"_id": {"$in": session_ids}, "user_id": self.user_id})

        replay = ReplayRepository(self.database)
        suggestions = 0
        if older_than_days is None:
            suggestions = await replay.delete_for_user(self.user_id, ["auto"])
        else:
            # Recomputed from the remaining segments on the next read.
            await self.database.replay_meta.delete_many({"user_id": self.user_id})
        bookmarks = 0
        if include_bookmarks:
            bookmarks = (await self.database.replay_items.delete_many(
                {"user_id": self.user_id, "kind": "bookmark", **dated}
            )).deleted_count
        attempts = 0
        if include_quiz_attempts:
            attempts = (await self.database.quiz_attempts.delete_many({"user_id": self.user_id, **dated})).deleted_count
        return DeletionResult(
            sessions=sessions.deleted_count,
            segments=segments.deleted_count,
            suggestions=suggestions,
            bookmarks=bookmarks,
            quiz_attempts=attempts,
        )


async def apply_retention(database: AsyncDatabase, days: int) -> int:
    """Server-wide: deletes sessions and segments older than ``days``."""
    if days <= 0:
        return 0
    cutoff = utcnow() - timedelta(days=days)
    session_ids = [row["_id"] async for row in database.learning_sessions.find({"started_at": {"$lt": cutoff}}, {"_id": 1})]
    if not session_ids:
        return 0
    await database.attention_segments.delete_many({"session_id": {"$in": session_ids}})
    result = await database.learning_sessions.delete_many({"_id": {"$in": session_ids}})
    await database.replay_meta.delete_many({})  # suggestions are recomputed lazily
    return result.deleted_count


__all__ = ["PrivacyService", "QuizRepository", "apply_retention"]
