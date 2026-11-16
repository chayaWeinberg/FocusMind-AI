"""MongoDB access for ReplayAI items, preferences, study goals and quizzes.

Every query is scoped by ``user_id`` (or by a lesson the service already
authorized). Access rules live in the services.

Collections:
- replay_items      auto recommendations (kind "auto") and bookmarks ("bookmark")
- replay_meta       per user+lesson: how many segments the stored suggestions used
- user_preferences  Smart Timer settings, one document per user
- study_goals       AdaptiveStudy goal, one document per user
- quiz_questions    multiple-choice review questions of a lesson
- quiz_attempts     graded answers of one user
"""

from datetime import datetime

from bson import ObjectId
from pymongo import ASCENDING, DESCENDING, ReturnDocument
from pymongo.asynchronous.database import AsyncDatabase


async def create_learning_indexes(database: AsyncDatabase) -> None:
    await database.replay_items.create_index([("user_id", ASCENDING), ("lesson_id", ASCENDING), ("start_seconds", ASCENDING)])
    await database.replay_items.create_index([("user_id", ASCENDING), ("status", ASCENDING), ("course_id", ASCENDING)])
    await database.replay_items.create_index("lesson_id")
    await database.replay_meta.create_index([("user_id", ASCENDING), ("lesson_id", ASCENDING)], unique=True)
    await database.user_preferences.create_index("user_id", unique=True)
    await database.study_goals.create_index("user_id", unique=True)
    await database.quiz_questions.create_index([("lesson_id", ASCENDING), ("created_at", ASCENDING)])
    await database.quiz_questions.create_index("author_id")
    await database.quiz_attempts.create_index([("user_id", ASCENDING), ("lesson_id", ASCENDING), ("created_at", DESCENDING)])
    await database.quiz_attempts.create_index("lesson_id")
    await database.learning_sessions.create_index([("user_id", ASCENDING), ("started_at", DESCENDING)])
    await database.attention_segments.create_index([("user_id", ASCENDING), ("created_at", ASCENDING)])


class ReplayRepository:
    def __init__(self, database: AsyncDatabase) -> None:
        self._items = database["replay_items"]
        self._meta = database["replay_meta"]

    async def for_lesson(self, user_id: ObjectId, lesson_id: ObjectId) -> list[dict]:
        return await self._items.find({"user_id": user_id, "lesson_id": lesson_id}).sort(
            "start_seconds", ASCENDING
        ).to_list(None)

    async def auto_for_lesson(self, user_id: ObjectId, lesson_id: ObjectId) -> list[dict]:
        return await self._items.find({"user_id": user_id, "lesson_id": lesson_id, "kind": "auto"}).to_list(None)

    async def find_items(self, user_id: ObjectId, criteria: dict, limit: int = 500) -> list[dict]:
        return await self._items.find({**criteria, "user_id": user_id}).sort(
            [("course_id", ASCENDING), ("lesson_id", ASCENDING), ("start_seconds", ASCENDING)]
        ).limit(limit).to_list(None)

    async def find(self, user_id: ObjectId, item_id: ObjectId) -> dict | None:
        return await self._items.find_one({"_id": item_id, "user_id": user_id})

    async def insert(self, item: dict) -> ObjectId:
        return (await self._items.insert_one(item)).inserted_id

    async def update(self, user_id: ObjectId, item_id: ObjectId, changes: dict) -> dict | None:
        return await self._items.find_one_and_update(
            {"_id": item_id, "user_id": user_id}, {"$set": changes}, return_document=ReturnDocument.AFTER
        )

    async def delete(self, user_id: ObjectId, item_id: ObjectId) -> None:
        await self._items.delete_one({"_id": item_id, "user_id": user_id})

    async def delete_ids(self, user_id: ObjectId, item_ids: list[ObjectId]) -> None:
        if item_ids:
            await self._items.delete_many({"_id": {"$in": item_ids}, "user_id": user_id})

    async def counts(self, user_id: ObjectId) -> dict[tuple[str, str], int]:
        cursor = await self._items.aggregate([
            {"$match": {"user_id": user_id}},
            {"$group": {"_id": {"kind": "$kind", "status": "$status"}, "count": {"$sum": 1}}},
        ])
        return {(row["_id"]["kind"], row["_id"]["status"]): row["count"] async for row in cursor}

    async def meta(self, user_id: ObjectId, lesson_id: ObjectId) -> dict | None:
        return await self._meta.find_one({"user_id": user_id, "lesson_id": lesson_id})

    async def metas(self, user_id: ObjectId) -> dict[ObjectId, dict]:
        return {row["lesson_id"]: row async for row in self._meta.find({"user_id": user_id})}

    async def set_meta(self, user_id: ObjectId, lesson_id: ObjectId, fields: dict) -> None:
        await self._meta.update_one(
            {"user_id": user_id, "lesson_id": lesson_id}, {"$set": fields}, upsert=True
        )

    async def delete_for_user(self, user_id: ObjectId, kinds: list[str]) -> int:
        result = await self._items.delete_many({"user_id": user_id, "kind": {"$in": kinds}})
        await self._meta.delete_many({"user_id": user_id})
        return result.deleted_count

    async def delete_for_lesson(self, lesson_id: ObjectId) -> None:
        await self._items.delete_many({"lesson_id": lesson_id})
        await self._meta.delete_many({"lesson_id": lesson_id})

    async def delete_for_lessons(self, lesson_ids: list[ObjectId]) -> None:
        if lesson_ids:
            await self._items.delete_many({"lesson_id": {"$in": lesson_ids}})
            await self._meta.delete_many({"lesson_id": {"$in": lesson_ids}})


class PreferencesRepository:
    def __init__(self, database: AsyncDatabase) -> None:
        self._preferences = database["user_preferences"]

    async def find(self, user_id: ObjectId) -> dict | None:
        return await self._preferences.find_one({"user_id": user_id})

    async def save(self, user_id: ObjectId, fields: dict, now: datetime) -> dict:
        return await self._preferences.find_one_and_update(
            {"user_id": user_id},
            {"$set": {**fields, "updated_at": now}, "$setOnInsert": {"created_at": now}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )


class GoalRepository:
    def __init__(self, database: AsyncDatabase) -> None:
        self._goals = database["study_goals"]

    async def find(self, user_id: ObjectId) -> dict | None:
        return await self._goals.find_one({"user_id": user_id})

    async def save(self, user_id: ObjectId, fields: dict, now: datetime) -> dict:
        return await self._goals.find_one_and_update(
            {"user_id": user_id},
            {"$set": {**fields, "updated_at": now}, "$setOnInsert": {"created_at": now}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )

    async def delete(self, user_id: ObjectId) -> None:
        await self._goals.delete_one({"user_id": user_id})

    async def delete_for_course(self, course_id: ObjectId) -> None:
        await self._goals.delete_many({"course_id": course_id})


class QuizRepository:
    def __init__(self, database: AsyncDatabase) -> None:
        self._questions = database["quiz_questions"]
        self._attempts = database["quiz_attempts"]

    async def visible_questions(self, user_id: ObjectId, lesson_id: ObjectId) -> list[dict]:
        return await self._questions.find(
            {"lesson_id": lesson_id, "$or": [{"author_id": user_id}, {"shared": True}]}
        ).sort([("created_at", ASCENDING), ("_id", ASCENDING)]).to_list(200)

    async def question_counts(self, user_id: ObjectId, lesson_ids: list[ObjectId]) -> dict[ObjectId, int]:
        cursor = await self._questions.aggregate([
            {"$match": {"lesson_id": {"$in": lesson_ids}, "$or": [{"author_id": user_id}, {"shared": True}]}},
            {"$group": {"_id": "$lesson_id", "count": {"$sum": 1}}},
        ])
        return {row["_id"]: row["count"] async for row in cursor}

    async def find_question(self, question_id: ObjectId) -> dict | None:
        return await self._questions.find_one({"_id": question_id})

    async def insert_question(self, question: dict) -> ObjectId:
        return (await self._questions.insert_one(question)).inserted_id

    async def delete_question(self, question_id: ObjectId) -> None:
        await self._questions.delete_one({"_id": question_id})

    async def insert_attempt(self, attempt: dict) -> ObjectId:
        return (await self._attempts.insert_one(attempt)).inserted_id

    async def attempts(self, user_id: ObjectId, lesson_id: ObjectId, limit: int = 10) -> list[dict]:
        return await self._attempts.find({"user_id": user_id, "lesson_id": lesson_id}).sort(
            "created_at", DESCENDING
        ).limit(limit).to_list(None)

    async def latest_attempts(self, user_id: ObjectId) -> list[dict]:
        """The most recent attempt of every lesson the user answered."""
        cursor = await self._attempts.aggregate([
            {"$match": {"user_id": user_id}},
            {"$sort": {"created_at": -1}},
            {"$group": {"_id": "$lesson_id", "attempt": {"$first": "$$ROOT"}}},
        ])
        return [row["attempt"] async for row in cursor]

    async def attempt_stats(self, user_id: ObjectId) -> dict:
        cursor = await self._attempts.aggregate([
            {"$match": {"user_id": user_id}},
            {"$group": {"_id": None, "count": {"$sum": 1}, "score": {"$sum": "$score"}, "total": {"$sum": "$total"}}},
        ])
        rows = await cursor.to_list(None)
        return rows[0] if rows else {"count": 0, "score": 0, "total": 0}

    async def delete_attempts_for_user(self, user_id: ObjectId) -> int:
        return (await self._attempts.delete_many({"user_id": user_id})).deleted_count

    async def delete_for_lessons(self, lesson_ids: list[ObjectId]) -> None:
        if lesson_ids:
            await self._questions.delete_many({"lesson_id": {"$in": lesson_ids}})
            await self._attempts.delete_many({"lesson_id": {"$in": lesson_ids}})


async def delete_lesson_learning_data(database: AsyncDatabase, lesson_ids: list[ObjectId]) -> None:
    """Called when lessons (or their course) are deleted by their owner."""
    await ReplayRepository(database).delete_for_lessons(lesson_ids)
    await QuizRepository(database).delete_for_lessons(lesson_ids)
