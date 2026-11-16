"""ReplayAI persistence: suggestions computed from attention segments, plus
manual bookmarks, with the learner's review status.

Recomputing is safe and idempotent:
- suggestions are recomputed when a session ends and lazily when the number
  of recorded segments for the lesson changed since the last computation
  (stored in ``replay_meta``), or when the rules changed;
- a new interval inherits the id and the status of the stored suggestion it
  overlaps most, so reviewed/dismissed decisions survive recomputation and
  nothing is duplicated;
- a dismissed suggestion stays dismissed; a reviewed one is reopened only
  when a *later* session added new events to it (``reopened``);
- stored suggestions that no longer have evidence are removed.
Bookmarks are created only by the learner and are never touched by this.
"""

import asyncio
import logging
from datetime import datetime

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.core.config import settings
from app.repositories.courses import LessonRepository, ProgressRepository, to_object_id
from app.repositories.learning import ReplayRepository
from app.schemas.auth import RegisteredUser
from app.schemas.learning import BookmarkCreate, LessonReplayOut, ReplayItemOut
from app.services.courses import ConflictError, CourseService, NotFoundError, is_trackable, utcnow
from app.services.replay_engine import ReplayRules, overlap_seconds, recommend_intervals

logger = logging.getLogger(__name__)

_locks: dict[tuple[ObjectId, ObjectId], asyncio.Lock] = {}

SEGMENT_FIELDS = {
    "_id": 0, "session_id": 1, "seq": 1, "session_start_ms": 1, "session_end_ms": 1,
    "video_start": 1, "video_end": 1, "playback_rate": 1, "state": 1, "duration_ms": 1,
}


def current_rules() -> ReplayRules:
    return ReplayRules(
        sustained_off_screen_seconds=settings.replay_sustained_off_screen_seconds,
        glance_seconds=settings.replay_glance_seconds,
        repeated_count=settings.replay_repeated_count,
        repeated_window_seconds=settings.replay_repeated_window_seconds,
        face_absent_seconds=settings.replay_face_absent_seconds,
        interruption_count=settings.replay_interruption_count,
        interruption_window_seconds=settings.replay_interruption_window_seconds,
        context_before_seconds=settings.replay_context_before_seconds,
        context_after_seconds=settings.replay_context_after_seconds,
        merge_gap_seconds=settings.replay_merge_gap_seconds,
    )


def rules_payload() -> dict[str, float]:
    from pydantic.alias_generators import to_camel

    return {to_camel(name): value for name, value in current_rules().as_dict().items()}


def item_out(item: dict, lesson_title: str | None = None, course_title: str | None = None) -> ReplayItemOut:
    return ReplayItemOut(
        id=str(item["_id"]),
        lesson_id=str(item["lesson_id"]),
        course_id=str(item["course_id"]),
        kind=item["kind"],
        start_seconds=item["start_seconds"],
        end_seconds=item.get("end_seconds"),
        status=item.get("status", "new"),
        reasons=item.get("reasons", {}),
        event_count=item.get("event_count", 0),
        session_count=item.get("session_count", 0),
        off_screen_seconds=round(item.get("off_screen_ms", 0) / 1000, 1),
        face_absent_seconds=round(item.get("face_absent_ms", 0) / 1000, 1),
        note=item.get("note", ""),
        reopened=bool(item.get("reopened")),
        created_at=item["created_at"],
        updated_at=item["updated_at"],
        reviewed_at=item.get("reviewed_at"),
        lesson_title=lesson_title,
        course_title=course_title,
    )


class ReplayService:
    def __init__(self, database: AsyncDatabase, user: RegisteredUser) -> None:
        self.database = database
        self.user_id = ObjectId(user.id)
        self.courses = CourseService(database, user)
        self.items = ReplayRepository(database)
        self.lessons = LessonRepository(database)
        self.progress = ProgressRepository(database)
        self._segments = database["attention_segments"]
        self._sessions = database["learning_sessions"]

    # --- recomputation ---------------------------------------------------

    async def _duration(self, lesson: dict) -> float | None:
        if lesson.get("duration_seconds"):
            return float(lesson["duration_seconds"])
        progress = await self.progress.find(self.user_id, lesson["_id"])
        return float(progress["duration_seconds"]) if progress and progress.get("duration_seconds") else None

    async def refresh(self, lesson: dict, force: bool = False) -> int:
        """Recomputes the lesson's suggestions if needed. Returns segments analyzed."""
        key = (self.user_id, lesson["_id"])
        lock = _locks.setdefault(key, asyncio.Lock())
        async with lock:
            criteria = {"user_id": self.user_id, "lesson_id": lesson["_id"]}
            count = await self._segments.count_documents(criteria)
            rules = current_rules()
            meta = await self.items.meta(self.user_id, lesson["_id"])
            if not force and meta and meta.get("segment_count") == count and meta.get("rules") == rules.as_dict():
                return count
            segments = await self._segments.find(criteria, SEGMENT_FIELDS).to_list(None)
            intervals = recommend_intervals(segments, await self._duration(lesson), rules)
            session_ids = {session_id for interval in intervals for session_id in interval.session_ids}
            started = {
                row["_id"]: row["started_at"]
                async for row in self._sessions.find(
                    {"_id": {"$in": list(session_ids)}, "user_id": self.user_id}, {"started_at": 1}
                )
            }
            await self._store(lesson, intervals, started)
            await self.items.set_meta(
                self.user_id, lesson["_id"],
                {"segment_count": count, "rules": rules.as_dict(), "computed_at": utcnow()},
            )
            return count

    async def _store(self, lesson: dict, intervals: list, started: dict[ObjectId, datetime]) -> None:
        existing = await self.items.auto_for_lesson(self.user_id, lesson["_id"])
        used: set[ObjectId] = set()
        now = utcnow()
        for interval in intervals:
            candidates = [
                (overlap_seconds(interval.start, interval.end, item["start_seconds"], item["end_seconds"]), item)
                for item in existing
                if item["_id"] not in used
            ]
            candidates = [pair for pair in candidates if pair[0] > 0]
            match = max(candidates, key=lambda pair: pair[0])[1] if candidates else None
            evidence_at = max((started[sid] for sid in interval.session_ids if sid in started), default=now)
            fields = {
                "start_seconds": interval.start,
                "end_seconds": interval.end,
                "reasons": interval.reasons,
                "event_count": interval.event_count,
                "session_count": len(interval.session_ids),
                "off_screen_ms": interval.off_screen_ms,
                "face_absent_ms": interval.face_absent_ms,
                "evidence_at": evidence_at,
            }
            if match is None:
                await self.items.insert({
                    **fields,
                    "user_id": self.user_id,
                    "lesson_id": lesson["_id"],
                    "course_id": lesson["course_id"],
                    "kind": "auto",
                    "status": "new",
                    "note": "",
                    "reopened": False,
                    "reviewed_at": None,
                    "created_at": now,
                    "updated_at": now,
                })
                continue
            used.add(match["_id"])
            changes = dict(fields)
            reviewed_at = match.get("reviewed_at")
            if (
                match.get("status") == "reviewed"
                and reviewed_at is not None
                and evidence_at > reviewed_at
                and interval.event_count > match.get("event_count", 0)
            ):
                changes.update(status="new", reopened=True)
            if any(match.get(name) != value for name, value in changes.items()):
                changes["updated_at"] = now
                await self.items.update(self.user_id, match["_id"], changes)
        await self.items.delete_ids(self.user_id, [item["_id"] for item in existing if item["_id"] not in used])

    async def refresh_safely(self, lesson_id: ObjectId) -> None:
        """Used after a session ends: a failure must not fail the request."""
        try:
            lesson = await self.lessons.find(lesson_id)
            if lesson is not None:
                await self.refresh(lesson)
        except Exception:  # noqa: BLE001 - logged, recomputed lazily on next read
            logger.exception("ReplayAI recomputation failed; it will be retried on the next read.")

    async def refresh_stale(self) -> None:
        cursor = await self._segments.aggregate([
            {"$match": {"user_id": self.user_id}},
            {"$group": {"_id": "$lesson_id", "count": {"$sum": 1}}},
        ])
        counts = {row["_id"]: row["count"] async for row in cursor}
        metas = await self.items.metas(self.user_id)
        rules = current_rules().as_dict()
        for lesson_id, count in counts.items():
            meta = metas.get(lesson_id)
            if meta and meta.get("segment_count") == count and meta.get("rules") == rules:
                continue
            lesson = await self.lessons.find(lesson_id)
            if lesson is not None:
                await self.refresh(lesson)

    # --- reading ---------------------------------------------------------

    async def for_lesson(self, lesson_id: str) -> LessonReplayOut:
        lesson, _ = await self.courses.lesson_for_learning(lesson_id)
        trackable = is_trackable(lesson.get("video", {}))
        analyzed = await self.refresh(lesson) if trackable else 0
        items = await self.items.for_lesson(self.user_id, lesson["_id"]) if trackable else []
        return LessonReplayOut(
            lesson_id=str(lesson["_id"]),
            trackable=trackable,
            duration_seconds=await self._duration(lesson),
            analyzed_segments=analyzed,
            items=[item_out(item) for item in items],
            rules=rules_payload(),
        )

    async def overview(self, status: str | None, course_id: str | None, kind: str | None) -> list[ReplayItemOut]:
        await self.refresh_stale()
        criteria: dict = {}
        if status == "pending":
            criteria["status"] = "new"
        elif status in ("new", "reviewed", "dismissed"):
            criteria["status"] = status
        if kind in ("auto", "bookmark"):
            criteria["kind"] = kind
        if course_id:
            object_id = to_object_id(course_id)
            if object_id is None:
                return []
            criteria["course_id"] = object_id
        items = await self.items.find_items(self.user_id, criteria)
        return await self._with_titles(items)

    async def _with_titles(self, items: list[dict]) -> list[ReplayItemOut]:
        lesson_ids = list({item["lesson_id"] for item in items})
        lessons = {row["_id"]: row async for row in self.database.lessons.find({"_id": {"$in": lesson_ids}}, {"title": 1, "order": 1, "course_id": 1})}
        course_ids = list({row["course_id"] for row in lessons.values()})
        courses = {row["_id"]: row async for row in self.database.courses.find({"_id": {"$in": course_ids}}, {"title": 1})}
        result = []
        for item in sorted(items, key=lambda row: (str(row["course_id"]), lessons.get(row["lesson_id"], {}).get("order", 0), row["start_seconds"])):
            lesson = lessons.get(item["lesson_id"])
            if lesson is None:
                continue
            result.append(item_out(item, lesson.get("title"), courses.get(lesson["course_id"], {}).get("title")))
        return result

    # --- learner actions -------------------------------------------------

    async def _own_item(self, item_id: str) -> dict:
        object_id = to_object_id(item_id)
        item = await self.items.find(self.user_id, object_id) if object_id else None
        if item is None:
            raise NotFoundError("Replay item not found.")
        return item

    async def set_status(self, item_id: str, status: str) -> ReplayItemOut:
        item = await self._own_item(item_id)
        if item["kind"] == "bookmark" and status == "dismissed":
            raise ConflictError("Bookmarks are deleted, not dismissed.")
        now = utcnow()
        changes: dict = {"status": status, "updated_at": now, "reopened": False}
        changes["reviewed_at"] = now if status == "reviewed" else item.get("reviewed_at")
        return item_out(await self.items.update(self.user_id, item["_id"], changes))

    async def add_bookmark(self, lesson_id: str, data: BookmarkCreate) -> ReplayItemOut:
        lesson, course = await self.courses.lesson_for_learning(lesson_id)
        if not is_trackable(lesson.get("video", {})):
            raise ConflictError("Bookmarks need a video whose playback position can be read.")
        duration = await self._duration(lesson)
        start, end = data.start_seconds, data.end_seconds
        if duration:
            start = min(start, duration)
            end = min(end, duration) if end is not None else None
            if end is not None and end <= start:
                end = None
        now = utcnow()
        item = {
            "user_id": self.user_id,
            "lesson_id": lesson["_id"],
            "course_id": course["_id"],
            "kind": "bookmark",
            "start_seconds": round(start, 2),
            "end_seconds": round(end, 2) if end is not None else None,
            "status": "new",
            "reasons": {},
            "event_count": 0,
            "session_count": 0,
            "off_screen_ms": 0,
            "face_absent_ms": 0,
            "note": data.note,
            "reopened": False,
            "reviewed_at": None,
            "created_at": now,
            "updated_at": now,
        }
        item["_id"] = await self.items.insert(item)
        return item_out(item)

    async def delete_bookmark(self, item_id: str) -> None:
        item = await self._own_item(item_id)
        if item["kind"] != "bookmark":
            raise ConflictError("Suggestions are dismissed, not deleted.")
        await self.items.delete(self.user_id, item["_id"])
