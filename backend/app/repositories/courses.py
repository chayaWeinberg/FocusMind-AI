"""MongoDB access for courses, lessons, enrollments, progress, video assets
and learning sessions. Repositories only talk to MongoDB; access control lives
in app.services.courses."""

import re
from datetime import datetime

from bson import ObjectId
from pymongo import ASCENDING, DESCENDING, ReturnDocument
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import BulkWriteError, DuplicateKeyError

from app.models.courses import (
    AttentionSegmentDocument,
    CourseDocument,
    EnrollmentDocument,
    LearningSessionDocument,
    LessonDocument,
    LessonProgressDocument,
    VideoAssetDocument,
)


def to_object_id(value: str) -> ObjectId | None:
    return ObjectId(value) if isinstance(value, str) and ObjectId.is_valid(value) else None


async def create_course_indexes(database: AsyncDatabase) -> None:
    await database.courses.create_index([("type", ASCENDING), ("status", ASCENDING), ("title", ASCENDING)])
    await database.courses.create_index([("owner_id", ASCENDING), ("updated_at", DESCENDING)])
    await database.courses.create_index(
        "slug", unique=True, partialFilterExpression={"slug": {"$type": "string"}}
    )
    await database.lessons.create_index([("course_id", ASCENDING), ("order", ASCENDING)])
    await database.lessons.create_index("video.asset_id", sparse=True)
    await database.lessons.create_index(
        [("course_id", ASCENDING), ("seed_key", ASCENDING)],
        unique=True,
        partialFilterExpression={"seed_key": {"$type": "string"}},
    )
    await database.enrollments.create_index([("user_id", ASCENDING), ("course_id", ASCENDING)], unique=True)
    await database.enrollments.create_index("course_id")
    await database.lesson_progress.create_index([("user_id", ASCENDING), ("lesson_id", ASCENDING)], unique=True)
    await database.lesson_progress.create_index([("user_id", ASCENDING), ("course_id", ASCENDING)])
    await database.lesson_progress.create_index("lesson_id")
    await database.video_assets.create_index("owner_id")
    await database.learning_sessions.create_index([("user_id", ASCENDING), ("lesson_id", ASCENDING), ("started_at", DESCENDING)])
    await database.learning_sessions.create_index("course_id")
    await database.attention_segments.create_index([("session_id", ASCENDING), ("seq", ASCENDING)], unique=True)
    await database.attention_segments.create_index([("user_id", ASCENDING), ("lesson_id", ASCENDING), ("video_start", ASCENDING)])


class CourseRepository:
    def __init__(self, database: AsyncDatabase) -> None:
        self._courses = database["courses"]

    async def insert(self, course: CourseDocument) -> ObjectId:
        return (await self._courses.insert_one(course)).inserted_id

    async def find(self, course_id: ObjectId) -> CourseDocument | None:
        return await self._courses.find_one({"_id": course_id})

    async def find_many(self, course_ids: list[ObjectId]) -> list[CourseDocument]:
        return await self._courses.find({"_id": {"$in": course_ids}}).to_list(None)

    async def list_catalog(self, query: str | None, category: str | None) -> list[CourseDocument]:
        criteria: dict = {"type": "catalog", "status": "published"}
        if category:
            criteria["category"] = category
        if query:
            pattern = re.compile(re.escape(query), re.IGNORECASE)
            criteria["$or"] = [{"title": pattern}, {"description": pattern}, {"category": pattern}]
        return await self._courses.find(criteria).sort("title", ASCENDING).limit(200).to_list(None)

    async def catalog_categories(self) -> list[str]:
        values = await self._courses.distinct("category", {"type": "catalog", "status": "published"})
        return sorted(value for value in values if value)

    async def list_personal(self, owner_id: ObjectId) -> list[CourseDocument]:
        return await self._courses.find({"type": "personal", "owner_id": owner_id}).sort(
            "updated_at", DESCENDING
        ).to_list(None)

    async def update(self, course_id: ObjectId, changes: dict) -> CourseDocument | None:
        return await self._courses.find_one_and_update(
            {"_id": course_id}, {"$set": changes}, return_document=ReturnDocument.AFTER
        )

    async def touch(self, course_id: ObjectId, now: datetime) -> None:
        await self._courses.update_one({"_id": course_id}, {"$set": {"updated_at": now}})

    async def delete(self, course_id: ObjectId) -> None:
        await self._courses.delete_one({"_id": course_id})

    async def upsert_seeded(self, slug: str, fields: dict, now: datetime) -> ObjectId:
        document = await self._courses.find_one_and_update(
            {"slug": slug},
            {"$set": {**fields, "updated_at": now}, "$setOnInsert": {"created_at": now, "slug": slug}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        return document["_id"]


class LessonRepository:
    def __init__(self, database: AsyncDatabase) -> None:
        self._lessons = database["lessons"]

    async def insert(self, lesson: LessonDocument) -> ObjectId:
        return (await self._lessons.insert_one(lesson)).inserted_id

    async def find(self, lesson_id: ObjectId) -> LessonDocument | None:
        return await self._lessons.find_one({"_id": lesson_id})

    async def list_for_course(self, course_id: ObjectId) -> list[LessonDocument]:
        return await self._lessons.find({"course_id": course_id}).sort(
            [("order", ASCENDING), ("_id", ASCENDING)]
        ).to_list(None)

    async def count_by_course(self, course_ids: list[ObjectId]) -> dict[ObjectId, int]:
        pipeline = [
            {"$match": {"course_id": {"$in": course_ids}}},
            {"$group": {"_id": "$course_id", "count": {"$sum": 1}}},
        ]
        cursor = await self._lessons.aggregate(pipeline)
        return {row["_id"]: row["count"] async for row in cursor}

    async def next_order(self, course_id: ObjectId) -> int:
        last = await self._lessons.find_one({"course_id": course_id}, sort=[("order", DESCENDING)])
        return (last["order"] + 1) if last else 0

    async def update(self, lesson_id: ObjectId, changes: dict) -> LessonDocument | None:
        return await self._lessons.find_one_and_update(
            {"_id": lesson_id}, {"$set": changes}, return_document=ReturnDocument.AFTER
        )

    async def set_orders(self, course_id: ObjectId, ordered_ids: list[ObjectId], now: datetime) -> None:
        for index, lesson_id in enumerate(ordered_ids):
            await self._lessons.update_one(
                {"_id": lesson_id, "course_id": course_id}, {"$set": {"order": index, "updated_at": now}}
            )

    async def delete(self, lesson_id: ObjectId) -> None:
        await self._lessons.delete_one({"_id": lesson_id})

    async def delete_for_course(self, course_id: ObjectId) -> None:
        await self._lessons.delete_many({"course_id": course_id})

    async def count_asset_references(self, asset_id: ObjectId) -> int:
        return await self._lessons.count_documents({"video.asset_id": asset_id})

    async def find_by_asset(self, asset_id: ObjectId) -> list[LessonDocument]:
        return await self._lessons.find({"video.asset_id": asset_id}).to_list(None)

    async def upsert_seeded(self, course_id: ObjectId, seed_key: str, fields: dict, now: datetime) -> None:
        await self._lessons.update_one(
            {"course_id": course_id, "seed_key": seed_key},
            {
                "$set": {**fields, "updated_at": now},
                "$setOnInsert": {"created_at": now, "video": {"source_type": "none"}, "duration_seconds": None},
            },
            upsert=True,
        )


class EnrollmentRepository:
    def __init__(self, database: AsyncDatabase) -> None:
        self._enrollments = database["enrollments"]

    async def enroll(self, enrollment: EnrollmentDocument) -> bool:
        """Returns False when the user was already enrolled."""
        try:
            await self._enrollments.insert_one(enrollment)
        except DuplicateKeyError:
            return False
        return True

    async def is_enrolled(self, user_id: ObjectId, course_id: ObjectId) -> bool:
        return await self._enrollments.find_one({"user_id": user_id, "course_id": course_id}) is not None

    async def course_ids_for_user(self, user_id: ObjectId) -> list[ObjectId]:
        cursor = self._enrollments.find({"user_id": user_id}).sort("enrolled_at", DESCENDING)
        return [row["course_id"] async for row in cursor]

    async def delete_for_course(self, course_id: ObjectId) -> None:
        await self._enrollments.delete_many({"course_id": course_id})


class ProgressRepository:
    def __init__(self, database: AsyncDatabase) -> None:
        self._progress = database["lesson_progress"]

    async def find(self, user_id: ObjectId, lesson_id: ObjectId) -> LessonProgressDocument | None:
        return await self._progress.find_one({"user_id": user_id, "lesson_id": lesson_id})

    async def for_course(self, user_id: ObjectId, course_id: ObjectId) -> dict[ObjectId, LessonProgressDocument]:
        cursor = self._progress.find({"user_id": user_id, "course_id": course_id})
        return {row["lesson_id"]: row async for row in cursor}

    async def for_courses(self, user_id: ObjectId, course_ids: list[ObjectId]) -> list[LessonProgressDocument]:
        return await self._progress.find({"user_id": user_id, "course_id": {"$in": course_ids}}).to_list(None)

    async def save(
        self,
        user_id: ObjectId,
        lesson_id: ObjectId,
        course_id: ObjectId,
        changes: dict,
        now: datetime,
        complete: bool,
    ) -> LessonProgressDocument:
        update = {
            "$set": {**changes, "course_id": course_id, "updated_at": now},
            "$setOnInsert": {"completed": False, "completed_at": None},
        }
        query = {"user_id": user_id, "lesson_id": lesson_id}
        try:
            document = await self._progress.find_one_and_update(
                query, update, upsert=True, return_document=ReturnDocument.AFTER
            )
        except DuplicateKeyError:
            # Two concurrent first saves: the unique index kept one, retry as update.
            document = await self._progress.find_one_and_update(
                query, update, return_document=ReturnDocument.AFTER
            )
        if complete and not document["completed"]:
            # Completion is permanent and keeps its first timestamp.
            completed = await self._progress.find_one_and_update(
                {"_id": document["_id"], "completed": False},
                {"$set": {"completed": True, "completed_at": now}},
                return_document=ReturnDocument.AFTER,
            )
            document = completed or await self._progress.find_one({"_id": document["_id"]})
        return document

    async def delete_for_lesson(self, lesson_id: ObjectId) -> None:
        await self._progress.delete_many({"lesson_id": lesson_id})

    async def delete_for_course(self, course_id: ObjectId) -> None:
        await self._progress.delete_many({"course_id": course_id})


class VideoAssetRepository:
    def __init__(self, database: AsyncDatabase) -> None:
        self._assets = database["video_assets"]

    async def insert(self, asset: VideoAssetDocument) -> None:
        await self._assets.insert_one(asset)

    async def find(self, asset_id: ObjectId) -> VideoAssetDocument | None:
        return await self._assets.find_one({"_id": asset_id})

    async def total_bytes(self, owner_id: ObjectId) -> int:
        cursor = await self._assets.aggregate(
            [{"$match": {"owner_id": owner_id}}, {"$group": {"_id": None, "total": {"$sum": "$size_bytes"}}}]
        )
        rows = await cursor.to_list(None)
        return int(rows[0]["total"]) if rows else 0

    async def delete(self, asset_id: ObjectId) -> None:
        await self._assets.delete_one({"_id": asset_id})


class LearningSessionRepository:
    def __init__(self, database: AsyncDatabase) -> None:
        self._sessions = database["learning_sessions"]
        self._segments = database["attention_segments"]

    async def insert(self, session: LearningSessionDocument) -> ObjectId:
        return (await self._sessions.insert_one(session)).inserted_id

    async def find(self, session_id: ObjectId) -> LearningSessionDocument | None:
        return await self._sessions.find_one({"_id": session_id})

    async def add_segments(self, session_id: ObjectId, segments: list[AttentionSegmentDocument]) -> int:
        """Inserts segments; retried batches (same seq) are ignored. Returns how many were new."""
        try:
            result = await self._segments.insert_many(segments, ordered=False)
            inserted = len(result.inserted_ids)
        except BulkWriteError as error:
            inserted = error.details.get("nInserted", 0)
            if any(item.get("code") != 11000 for item in error.details.get("writeErrors", [])):
                raise
        if inserted:
            await self._sessions.update_one({"_id": session_id}, {"$inc": {"segment_count": inserted}})
        return inserted

    async def end(
        self, session_id: ObjectId, active_ms: int, break_ms: int, now: datetime
    ) -> LearningSessionDocument | None:
        return await self._sessions.find_one_and_update(
            {"_id": session_id},
            {"$set": {"ended_at": now, "last_seen_at": now}, "$max": {"active_ms": active_ms, "break_ms": break_ms}},
            return_document=ReturnDocument.AFTER,
        )

    async def heartbeat(
        self, session_id: ObjectId, active_ms: int, break_ms: int, now: datetime
    ) -> LearningSessionDocument | None:
        # $max: a late or repeated heartbeat can never lower the stored time.
        return await self._sessions.find_one_and_update(
            {"_id": session_id},
            {"$set": {"last_seen_at": now}, "$max": {"active_ms": active_ms, "break_ms": break_ms}},
            return_document=ReturnDocument.AFTER,
        )

    async def recent(self, user_id: ObjectId, limit: int, before: datetime | None = None) -> list[LearningSessionDocument]:
        criteria: dict = {"user_id": user_id}
        if before is not None:
            criteria["started_at"] = {"$lt": before}
        return await self._sessions.find(criteria).sort("started_at", DESCENDING).limit(limit).to_list(None)

    async def video_seconds(self, session_ids: list[ObjectId]) -> dict[ObjectId, float]:
        """Seconds of media played per session (sum of segment video ranges)."""
        if not session_ids:
            return {}
        cursor = await self._segments.aggregate([
            {"$match": {"session_id": {"$in": session_ids}}},
            {"$group": {"_id": "$session_id", "seconds": {"$sum": {"$subtract": ["$video_end", "$video_start"]}}}},
        ])
        return {row["_id"]: float(row["seconds"]) async for row in cursor}

    async def segments(self, session_id: ObjectId) -> list[AttentionSegmentDocument]:
        return await self._segments.find({"session_id": session_id}).sort("seq", ASCENDING).to_list(None)

    async def delete_for_lesson(self, lesson_id: ObjectId) -> None:
        await self._segments.delete_many({"lesson_id": lesson_id})
        await self._sessions.delete_many({"lesson_id": lesson_id})

    async def delete_for_course(self, course_id: ObjectId) -> None:
        await self._segments.delete_many({"course_id": course_id})
        await self._sessions.delete_many({"course_id": course_id})
