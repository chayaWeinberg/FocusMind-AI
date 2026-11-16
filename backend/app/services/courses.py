"""Course, lesson, enrollment, progress and video business logic.

Access rules (enforced here, for every endpoint):
- Catalog courses: visible to every signed-in user when published; read-only
  for learners. Learning (progress, sessions, video streams) requires
  enrollment. Content managers (role granted only from the CLI) may create,
  edit, publish/unpublish catalog courses and see drafts. A catalog course
  with enrolled learners cannot be deleted (unpublish it instead), and a
  catalog lesson with learner progress cannot be deleted.
- Personal courses: visible and editable only by the owner. Other users get
  404 (the course's existence is not revealed).
- The acting user always comes from the session cookie, never from the body.

Completion policy:
- Trackable videos (uploads and direct links): a lesson is completed when the
  player reports the video ended, or the saved position reaches 90 % of the
  duration. Opening a lesson never completes it.
- YouTube embeds cannot report a position, so they are completed manually
  ("mark as completed").
- Lessons without a video cannot be completed.
- Completion is permanent; later progress saves only move the position.
"""

from collections.abc import AsyncIterator
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.core.config import settings
from app.models.courses import CourseDocument, LessonDocument, LessonProgressDocument
from app.repositories.courses import (
    CourseRepository,
    EnrollmentRepository,
    LearningSessionRepository,
    LessonRepository,
    ProgressRepository,
    VideoAssetRepository,
    to_object_id,
)
from app.schemas.auth import RegisteredUser
from app.schemas.courses import (
    CourseCreate,
    CourseDetail,
    CourseOut,
    CourseProgress,
    CourseSummary,
    CourseUpdate,
    LessonContext,
    LessonCreate,
    LessonOut,
    LessonProgressOut,
    LessonUpdate,
    LessonVideoOut,
    ProgressUpdate,
)
from app.repositories.learning import GoalRepository, delete_lesson_learning_data
from app.services import video_storage
from app.services.external_video import parse_external_video, youtube_embed_url

COMPLETION_THRESHOLD = 0.9


class CourseError(Exception):
    status_code = 400

    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class NotFoundError(CourseError):
    status_code = 404


class ForbiddenError(CourseError):
    status_code = 403


class ConflictError(CourseError):
    status_code = 409


class PayloadTooLargeError(CourseError):
    status_code = 413


class UnsupportedMediaError(CourseError):
    status_code = 415


class InvalidInputError(CourseError):
    status_code = 422


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def is_trackable(video: dict) -> bool:
    source = video.get("source_type")
    return source == "upload" or (source == "external" and video.get("provider") == "direct")


def stream_url(asset_id: ObjectId) -> str:
    return f"/api/videos/{asset_id}/stream"


class CourseService:
    def __init__(self, database: AsyncDatabase, user: RegisteredUser) -> None:
        self.database = database
        self.user_id = ObjectId(user.id)
        self.is_manager = getattr(user, "role", "learner") == "content_manager"
        self.courses = CourseRepository(database)
        self.lessons = LessonRepository(database)
        self.enrollments = EnrollmentRepository(database)
        self.progress = ProgressRepository(database)
        self.assets = VideoAssetRepository(database)
        self.sessions = LearningSessionRepository(database)

    # --- access ---------------------------------------------------------

    def is_owner(self, course: CourseDocument) -> bool:
        return course["type"] == "personal" and course.get("owner_id") == self.user_id

    def can_manage(self, course: CourseDocument) -> bool:
        return self.is_owner(course) or (course["type"] == "catalog" and self.is_manager)

    async def can_learn(self, course: CourseDocument) -> bool:
        if course["type"] == "personal":
            return self.is_owner(course)
        return await self.enrollments.is_enrolled(self.user_id, course["_id"])

    def _visible(self, course: CourseDocument | None) -> bool:
        if course is None:
            return False
        if course["type"] == "personal":
            return self.is_owner(course)
        return course.get("status") == "published" or self.is_manager

    async def course_for_view(self, course_id: str) -> CourseDocument:
        object_id = to_object_id(course_id)
        course = await self.courses.find(object_id) if object_id else None
        if not self._visible(course):
            raise NotFoundError("Course not found.")
        return course

    async def course_for_edit(self, course_id: str) -> CourseDocument:
        course = await self.course_for_view(course_id)
        if not self.can_manage(course):
            raise ForbiddenError("Catalog courses cannot be modified.")
        return course

    async def lesson_for_view(self, lesson_id: str) -> tuple[LessonDocument, CourseDocument]:
        object_id = to_object_id(lesson_id)
        lesson = await self.lessons.find(object_id) if object_id else None
        course = await self.courses.find(lesson["course_id"]) if lesson else None
        if lesson is None or not self._visible(course):
            raise NotFoundError("Lesson not found.")
        return lesson, course

    async def lesson_for_edit(self, lesson_id: str) -> tuple[LessonDocument, CourseDocument]:
        lesson, course = await self.lesson_for_view(lesson_id)
        if not self.can_manage(course):
            raise ForbiddenError("Catalog lessons cannot be modified.")
        return lesson, course

    async def lesson_for_learning(self, lesson_id: str) -> tuple[LessonDocument, CourseDocument]:
        lesson, course = await self.lesson_for_view(lesson_id)
        if not await self.can_learn(course):
            raise ForbiddenError("Enroll in the course to learn this lesson.")
        return lesson, course

    # --- serialization --------------------------------------------------

    async def _video_out(self, video: dict) -> LessonVideoOut:
        source = video.get("source_type", "none")
        if source == "upload":
            asset = await self.assets.find(video["asset_id"])
            return LessonVideoOut(
                source_type="upload",
                url=stream_url(video["asset_id"]),
                original_name=asset["original_name"] if asset else None,
                size_bytes=asset["size_bytes"] if asset else None,
                trackable=True,
            )
        if source == "external":
            provider = video.get("provider", "direct")
            attribution = video.get("source") or {}
            return LessonVideoOut(
                source_type="external",
                provider=provider,
                url=video.get("url"),
                embed_url=youtube_embed_url(video["embed_id"]) if provider == "youtube" else None,
                trackable=provider == "direct",
                source_name=attribution.get("name"),
                source_url=attribution.get("page_url"),
                license=attribution.get("license"),
            )
        return LessonVideoOut(source_type="none", trackable=False)

    @staticmethod
    def _progress_out(progress: LessonProgressDocument | None) -> LessonProgressOut | None:
        if progress is None:
            return None
        return LessonProgressOut(
            position_seconds=progress.get("position_seconds", 0.0),
            duration_seconds=progress.get("duration_seconds"),
            completed=progress.get("completed", False),
            completed_at=progress.get("completed_at"),
            updated_at=progress.get("updated_at"),
        )

    async def _lesson_out(self, lesson: LessonDocument, progress: LessonProgressDocument | None) -> LessonOut:
        return LessonOut(
            id=str(lesson["_id"]),
            course_id=str(lesson["course_id"]),
            title=lesson["title"],
            description=lesson.get("description", ""),
            order=lesson["order"],
            duration_seconds=lesson.get("duration_seconds"),
            video=await self._video_out(lesson.get("video", {"source_type": "none"})),
            progress=self._progress_out(progress),
        )

    @staticmethod
    def _course_progress(lessons: list[LessonDocument], progress: dict[ObjectId, Any]) -> CourseProgress:
        total = len(lessons)
        completed = sum(1 for lesson in lessons if progress.get(lesson["_id"], {}).get("completed"))
        continue_lesson = next(
            (lesson for lesson in lessons if not progress.get(lesson["_id"], {}).get("completed")),
            lessons[-1] if lessons else None,
        )
        return CourseProgress(
            completed_lessons=completed,
            total_lessons=total,
            percent=round(100 * completed / total) if total else 0,
            continue_lesson_id=str(continue_lesson["_id"]) if continue_lesson else None,
        )

    def _course_out(
        self, course: CourseDocument, lesson_count: int, enrolled: bool, progress: CourseProgress | None
    ) -> CourseOut:
        return CourseOut(
            id=str(course["_id"]),
            title=course["title"],
            description=course.get("description", ""),
            category=course.get("category", ""),
            type=course["type"],
            status=course.get("status", "published"),
            is_owner=self.is_owner(course),
            enrolled=enrolled,
            lesson_count=lesson_count,
            progress=progress,
            created_at=course["created_at"],
            updated_at=course["updated_at"],
        )

    # --- courses --------------------------------------------------------

    async def list_catalog(self, query: str | None, category: str | None) -> list[CourseOut]:
        courses = await self.courses.list_catalog((query or "").strip()[:100] or None, category or None)
        ids = [course["_id"] for course in courses]
        counts = await self.lessons.count_by_course(ids)
        enrolled = set(await self.enrollments.course_ids_for_user(self.user_id))
        return [
            self._course_out(course, counts.get(course["_id"], 0), course["_id"] in enrolled, None)
            for course in courses
        ]

    async def catalog_categories(self) -> list[str]:
        return await self.courses.catalog_categories()

    async def my_courses(self) -> list[CourseOut]:
        personal = await self.courses.list_personal(self.user_id)
        enrolled_ids = await self.enrollments.course_ids_for_user(self.user_id)
        enrolled_courses = {
            course["_id"]: course
            for course in await self.courses.find_many(enrolled_ids)
            if course["type"] == "catalog" and course.get("status") == "published"
        }
        courses = personal + [enrolled_courses[cid] for cid in enrolled_ids if cid in enrolled_courses]
        ids = [course["_id"] for course in courses]
        progress_rows = await self.progress.for_courses(self.user_id, ids)
        result = []
        for course in courses:
            lessons = await self.lessons.list_for_course(course["_id"])
            progress = {row["lesson_id"]: row for row in progress_rows if row["course_id"] == course["_id"]}
            result.append(
                self._course_out(
                    course, len(lessons), course["_id"] in enrolled_courses, self._course_progress(lessons, progress)
                )
            )
        return result

    async def create_course(self, data: CourseCreate) -> CourseDetail:
        now = utcnow()
        course: CourseDocument = {
            "title": data.title,
            "description": data.description,
            "category": data.category,
            "type": "personal",
            "owner_id": self.user_id,
            "status": "published",
            "created_at": now,
            "updated_at": now,
        }
        course_id = await self.courses.insert(course)
        return await self.course_detail(str(course_id))

    async def course_detail(self, course_id: str) -> CourseDetail:
        course = await self.course_for_view(course_id)
        lessons = await self.lessons.list_for_course(course["_id"])
        progress = await self.progress.for_course(self.user_id, course["_id"])
        enrolled = course["type"] == "catalog" and await self.enrollments.is_enrolled(self.user_id, course["_id"])
        summary = self._course_out(course, len(lessons), enrolled, self._course_progress(lessons, progress))
        return CourseDetail(
            **summary.model_dump(),
            lessons=[await self._lesson_out(lesson, progress.get(lesson["_id"])) for lesson in lessons],
            can_edit=self.can_manage(course),
            can_learn=self.is_owner(course) or enrolled,
        )

    async def update_course(self, course_id: str, data: CourseUpdate) -> CourseDetail:
        course = await self.course_for_edit(course_id)
        changes = data.model_dump(exclude_unset=True, exclude_none=True)
        if "status" in changes and course["type"] != "catalog":
            raise InvalidInputError("Only catalog courses can be published or unpublished.")
        if changes:
            await self.courses.update(course["_id"], {**changes, **self._edit_marker(course), "updated_at": utcnow()})
        return await self.course_detail(course_id)

    @staticmethod
    def _edit_marker(course: CourseDocument) -> dict:
        # The seed never overwrites a catalog course a content manager edited.
        return {"edited_by_manager": True} if course["type"] == "catalog" else {}

    async def _touch(self, course: CourseDocument, now: datetime) -> None:
        if course["type"] == "catalog":
            await self.courses.update(course["_id"], {"updated_at": now, "edited_by_manager": True})
        else:
            await self.courses.touch(course["_id"], now)

    async def delete_course(self, course_id: str) -> None:
        course = await self.course_for_edit(course_id)
        if course["type"] == "catalog" and await self.database.enrollments.count_documents({"course_id": course["_id"]}):
            raise ConflictError("Catalog courses with enrolled learners cannot be deleted. Unpublish the course instead.")
        lessons = await self.lessons.list_for_course(course["_id"])
        await delete_lesson_learning_data(self.database, [lesson["_id"] for lesson in lessons])
        await GoalRepository(self.database).delete_for_course(course["_id"])
        asset_ids = [
            lesson["video"]["asset_id"] for lesson in lessons if lesson.get("video", {}).get("source_type") == "upload"
        ]
        await self.sessions.delete_for_course(course["_id"])
        await self.progress.delete_for_course(course["_id"])
        await self.enrollments.delete_for_course(course["_id"])
        await self.lessons.delete_for_course(course["_id"])
        await self.courses.delete(course["_id"])
        for asset_id in asset_ids:
            await self.release_asset(asset_id)

    async def enroll(self, course_id: str) -> tuple[CourseDetail, bool]:
        course = await self.course_for_view(course_id)
        if course["type"] != "catalog":
            raise ConflictError("Only catalog courses can be enrolled in.")
        created = await self.enrollments.enroll(
            {"user_id": self.user_id, "course_id": course["_id"], "enrolled_at": utcnow()}
        )
        return await self.course_detail(course_id), created

    async def course_progress(self, course_id: str) -> CourseProgress:
        course = await self.course_for_view(course_id)
        lessons = await self.lessons.list_for_course(course["_id"])
        return self._course_progress(lessons, await self.progress.for_course(self.user_id, course["_id"]))

    # --- lessons --------------------------------------------------------

    async def add_lesson(self, course_id: str, data: LessonCreate) -> LessonOut:
        course = await self.course_for_edit(course_id)
        video: dict = {"source_type": "none"}
        if data.external_url:
            video = self._external_video(data.external_url)
        now = utcnow()
        lesson: LessonDocument = {
            "course_id": course["_id"],
            "title": data.title,
            "description": data.description,
            "order": await self.lessons.next_order(course["_id"]),
            "video": video,
            "duration_seconds": data.duration_seconds,
            "created_at": now,
            "updated_at": now,
        }
        lesson_id = await self.lessons.insert(lesson)
        await self._touch(course, now)
        return await self._lesson_out({**lesson, "_id": lesson_id}, None)

    @staticmethod
    def _external_video(url: str, kind: str = "video") -> dict:
        from app.services.external_video import InvalidVideoUrlError

        try:
            return parse_external_video(url, kind)
        except InvalidVideoUrlError as error:
            raise InvalidInputError(str(error)) from None

    async def update_lesson(self, lesson_id: str, data: LessonUpdate) -> LessonOut:
        lesson, course = await self.lesson_for_edit(lesson_id)
        changes = data.model_dump(exclude_unset=True, exclude_none=True)
        now = utcnow()
        if changes:
            lesson = await self.lessons.update(lesson["_id"], {**changes, "updated_at": now})
            await self._touch(course, now)
        return await self._lesson_out(lesson, await self.progress.find(self.user_id, lesson["_id"]))

    async def reorder_lessons(self, course_id: str, lesson_ids: list[str]) -> CourseDetail:
        course = await self.course_for_edit(course_id)
        existing = {lesson["_id"] for lesson in await self.lessons.list_for_course(course["_id"])}
        ordered = [to_object_id(value) for value in lesson_ids]
        if None in ordered or len(set(ordered)) != len(ordered) or set(ordered) != existing:
            raise InvalidInputError("The new order must list every lesson of the course exactly once.")
        now = utcnow()
        await self.lessons.set_orders(course["_id"], ordered, now)
        await self._touch(course, now)
        return await self.course_detail(course_id)

    async def delete_lesson(self, lesson_id: str) -> None:
        lesson, course = await self.lesson_for_edit(lesson_id)
        if course["type"] == "catalog" and await self.database.lesson_progress.count_documents(
            {"lesson_id": lesson["_id"], "user_id": {"$ne": self.user_id}}
        ):
            raise ConflictError("Catalog lessons with learner progress cannot be deleted.")
        await delete_lesson_learning_data(self.database, [lesson["_id"]])
        await self.sessions.delete_for_lesson(lesson["_id"])
        await self.progress.delete_for_lesson(lesson["_id"])
        await self.lessons.delete(lesson["_id"])
        remaining = await self.lessons.list_for_course(course["_id"])
        now = utcnow()
        await self.lessons.set_orders(course["_id"], [item["_id"] for item in remaining], now)
        await self._touch(course, now)
        if lesson.get("video", {}).get("source_type") == "upload":
            await self.release_asset(lesson["video"]["asset_id"])

    async def lesson_context(self, lesson_id: str) -> LessonContext:
        lesson, course = await self.lesson_for_view(lesson_id)
        lessons = await self.lessons.list_for_course(course["_id"])
        index = next(i for i, item in enumerate(lessons) if item["_id"] == lesson["_id"])
        return LessonContext(
            lesson=await self._lesson_out(lesson, await self.progress.find(self.user_id, lesson["_id"])),
            course=CourseSummary(
                id=str(course["_id"]), title=course["title"], type=course["type"], can_edit=self.can_manage(course)
            ),
            previous_lesson_id=str(lessons[index - 1]["_id"]) if index > 0 else None,
            next_lesson_id=str(lessons[index + 1]["_id"]) if index + 1 < len(lessons) else None,
            lesson_number=index + 1,
            lesson_total=len(lessons),
            can_learn=await self.can_learn(course),
        )

    # --- videos ---------------------------------------------------------

    async def set_external_video(
        self, lesson_id: str, url: str, duration: float | None, kind: str = "video"
    ) -> LessonOut:
        lesson, course = await self.lesson_for_edit(lesson_id)
        return await self._replace_video(lesson, course, self._external_video(url, kind), duration)

    async def remove_video(self, lesson_id: str) -> LessonOut:
        lesson, course = await self.lesson_for_edit(lesson_id)
        empty: dict = {"source_type": "none"}
        if course["type"] == "catalog":
            empty["cleared_by_manager"] = True  # the catalog video tool will not refill it
        return await self._replace_video(lesson, course, empty, None, clear_duration=True)

    async def upload_video(
        self,
        lesson_id: str,
        chunks: AsyncIterator[bytes],
        declared_length: int | None,
        filename: str | None,
        duration: float | None,
    ) -> LessonOut:
        lesson, course = await self.lesson_for_edit(lesson_id)
        limit = settings.max_video_upload_bytes
        used = await self.assets.total_bytes(self.user_id)
        if declared_length is not None:
            if declared_length > limit:
                raise PayloadTooLargeError("The video is larger than the allowed upload size.")
            if used + declared_length > settings.user_video_quota_bytes:
                raise PayloadTooLargeError("Your video storage quota is full. Remove videos and try again.")
        try:
            upload = await video_storage.receive_upload(chunks, limit)
        except video_storage.UploadTooLargeError as error:
            raise PayloadTooLargeError(str(error)) from None
        except video_storage.UnsupportedVideoError as error:
            raise UnsupportedMediaError(str(error)) from None

        if used + upload.size_bytes > settings.user_video_quota_bytes:
            upload.discard()
            raise PayloadTooLargeError("Your video storage quota is full. Remove videos and try again.")

        asset_id = ObjectId()
        try:
            storage_name = video_storage.commit_upload(upload, str(asset_id))
        except OSError:
            upload.discard()
            raise
        try:
            await self.assets.insert({
                "_id": asset_id,
                "owner_id": self.user_id,
                "storage_name": storage_name,
                "content_type": upload.content_type,
                "size_bytes": upload.size_bytes,
                "original_name": video_storage.sanitize_filename(filename),
                "created_at": utcnow(),
            })
        except Exception:
            video_storage.delete_stored_file(storage_name)
            raise
        return await self._replace_video(
            lesson, course, {"source_type": "upload", "asset_id": asset_id}, duration, clear_duration=True
        )

    async def _replace_video(
        self, lesson: LessonDocument, course: CourseDocument, video: dict, duration: float | None,
        clear_duration: bool = False,
    ) -> LessonOut:
        previous = lesson.get("video", {})
        now = utcnow()
        changes: dict = {"video": video, "updated_at": now}
        if duration is not None or clear_duration:
            changes["duration_seconds"] = duration
        updated = await self.lessons.update(lesson["_id"], changes)
        await self._touch(course, now)
        if previous.get("source_type") == "upload" and previous.get("asset_id") != video.get("asset_id"):
            await self.release_asset(previous["asset_id"])
        return await self._lesson_out(updated, await self.progress.find(self.user_id, lesson["_id"]))

    async def release_asset(self, asset_id: ObjectId) -> None:
        """Deletes an uploaded video once no lesson references it any more."""
        if await self.lessons.count_asset_references(asset_id):
            return
        asset = await self.assets.find(asset_id)
        if asset is None:
            return
        await self.assets.delete(asset_id)
        video_storage.delete_stored_file(asset["storage_name"])

    async def asset_for_stream(self, asset_id: str) -> dict:
        object_id = to_object_id(asset_id)
        asset = await self.assets.find(object_id) if object_id else None
        if asset is None:
            raise NotFoundError("Video not found.")
        if asset["owner_id"] == self.user_id:
            return asset
        for lesson in await self.lessons.find_by_asset(asset["_id"]):
            course = await self.courses.find(lesson["course_id"])
            if self._visible(course) and (self.can_manage(course) or await self.can_learn(course)):
                return asset
        raise NotFoundError("Video not found.")

    # --- progress -------------------------------------------------------

    async def get_progress(self, lesson_id: str) -> LessonProgressOut:
        lesson, _ = await self.lesson_for_view(lesson_id)
        progress = await self.progress.find(self.user_id, lesson["_id"])
        return self._progress_out(progress) or LessonProgressOut(
            position_seconds=0, duration_seconds=lesson.get("duration_seconds"),
            completed=False, completed_at=None, updated_at=None,
        )

    async def save_progress(self, lesson_id: str, data: ProgressUpdate) -> LessonProgressOut:
        lesson, course = await self.lesson_for_learning(lesson_id)
        video = lesson.get("video", {})
        if not is_trackable(video):
            raise ConflictError("This lesson's video does not support saving the playback position.")
        duration = data.duration_seconds or lesson.get("duration_seconds")
        position = min(data.position_seconds, duration) if duration else data.position_seconds
        complete = data.ended or bool(duration and position >= COMPLETION_THRESHOLD * duration)
        now = utcnow()
        changes: dict = {"position_seconds": round(position, 2)}
        if duration:
            changes["duration_seconds"] = round(duration, 2)
        progress = await self.progress.save(self.user_id, lesson["_id"], course["_id"], changes, now, complete)
        if data.duration_seconds and not lesson.get("duration_seconds") and self.can_manage(course):
            await self.lessons.update(lesson["_id"], {"duration_seconds": round(data.duration_seconds, 2)})
        return self._progress_out(progress)

    async def complete_lesson(self, lesson_id: str) -> LessonProgressOut:
        lesson, course = await self.lesson_for_learning(lesson_id)
        video = lesson.get("video", {})
        if video.get("source_type", "none") == "none":
            raise ConflictError("A lesson without a video cannot be completed.")
        if is_trackable(video):
            raise ConflictError("This lesson is completed automatically when the video is watched to the end.")
        existing = await self.progress.find(self.user_id, lesson["_id"])
        changes = {"position_seconds": existing["position_seconds"] if existing else 0.0}
        progress = await self.progress.save(self.user_id, lesson["_id"], course["_id"], changes, utcnow(), True)
        return self._progress_out(progress)

    # --- catalog administration (content managers) -------------------------

    def require_manager(self) -> None:
        if not self.is_manager:
            raise ForbiddenError("Only content managers can manage the catalog.")

    async def admin_catalog(self) -> list[dict]:
        self.require_manager()
        courses = await self.database.courses.find({"type": "catalog"}).sort("title", 1).to_list(500)
        ids = [course["_id"] for course in courses]
        counts = await self.lessons.count_by_course(ids)
        cursor = await self.database.lessons.aggregate([
            {"$match": {"course_id": {"$in": ids}, "video.source_type": "none"}},
            {"$group": {"_id": "$course_id", "count": {"$sum": 1}}},
        ])
        missing = {row["_id"]: row["count"] async for row in cursor}
        cursor = await self.database.enrollments.aggregate([
            {"$match": {"course_id": {"$in": ids}}},
            {"$group": {"_id": "$course_id", "count": {"$sum": 1}}},
        ])
        enrollments = {row["_id"]: row["count"] async for row in cursor}
        mine = set(await self.enrollments.course_ids_for_user(self.user_id))
        return [
            {
                **self._course_out(course, counts.get(course["_id"], 0), course["_id"] in mine, None).model_dump(),
                "enrollment_count": enrollments.get(course["_id"], 0),
                "lessons_without_video": missing.get(course["_id"], 0),
            }
            for course in courses
        ]

    async def create_catalog_course(self, title: str, description: str, category: str, status: str) -> CourseDetail:
        self.require_manager()
        now = utcnow()
        course: CourseDocument = {
            "title": title,
            "description": description,
            "category": category,
            "type": "catalog",
            "owner_id": None,
            "status": status,
            "created_at": now,
            "updated_at": now,
        }
        course["created_by"] = self.user_id  # type: ignore[typeddict-unknown-key]
        course_id = await self.courses.insert(course)
        return await self.course_detail(str(course_id))
