"""Idempotent import of the expanded catalog (app/seed/catalog_library.py).

- Courses are matched by slug, lessons by (course, seed_key): running it again
  updates texts and metadata, never duplicates anything.
- A course a content manager edited (edited_by_manager) is left untouched.
- A lesson's video is set only when the lesson has no video or its video was
  set by the catalog tools (catalog_video_key). Uploads, links chosen by
  people and videos a manager removed are never replaced. The kind chosen
  earlier (page / youtube / direct, see `python -m app.catalog_videos apply`)
  is kept.
- Users, enrollments and progress are never modified.

Every lesson stores its `resource`: provider, original title, language,
license, the verified links (page, YouTube, direct file), the verified
duration and the network accessibility measured with a real browser
(app/seed/catalog_netfree.json).
"""

import json
from datetime import datetime, timezone
from pathlib import Path

from pymongo.asynchronous.database import AsyncDatabase

from app.repositories.courses import CourseRepository
from app.seed.catalog_library import LIBRARY
from app.seed.catalog_videos import library_entries
from app.services.catalog_videos import video_document

NETFREE_FILE = Path(__file__).with_name("catalog_netfree.json")
DEFAULT_KIND = "page"  # the only kind verified to open behind NetFree


def netfree_results() -> dict:
    if NETFREE_FILE.is_file():
        return json.loads(NETFREE_FILE.read_text(encoding="utf-8"))
    return {"checked_at": None, "lessons": {}}


def lesson_resource(course: dict, lesson: dict, netfree: dict) -> dict:
    video = lesson["video"]
    measured = netfree["lessons"].get(f"{course['slug']}/{lesson['key']}")
    return {
        "provider": video["provider"],
        "source_title": video["source_title"],
        "language": video["language"],
        "license": video["license"],
        "page_url": video["page_url"],
        "youtube_url": f"https://www.youtube.com/watch?v={video['youtube_id']}" if video.get("youtube_id") else None,
        "direct_url": video.get("direct_url"),
        "duration_seconds": video.get("duration_seconds"),
        "netfree": {
            "status": measured["status"] if measured else "unverified",
            "detail": measured.get("detail") if measured else None,
            "checked_at": netfree.get("checked_at") if measured else None,
        },
    }


async def seed_library(database: AsyncDatabase) -> tuple[int, int]:
    courses = CourseRepository(database)
    entries = {(entry.course_slug, entry.seed_key): entry for entry in library_entries()}
    netfree = netfree_results()
    now = datetime.now(timezone.utc)
    course_count = lesson_count = 0
    for course in LIBRARY:
        existing = await database.courses.find_one({"slug": course["slug"]}, {"edited_by_manager": 1})
        if existing and existing.get("edited_by_manager"):
            continue  # a content manager owns this course now
        course_id = await courses.upsert_seeded(
            course["slug"],
            {
                "title": course["title"],
                "description": course["description"],
                "category": course["category"],
                "difficulty": course["difficulty"],
                "type": "catalog",
                "owner_id": None,
                "status": "published",
            },
            now,
        )
        course_count += 1
        for order, lesson in enumerate(course["lessons"]):
            entry = entries[(course["slug"], lesson["key"])]
            current = await database.lessons.find_one({"course_id": course_id, "seed_key": lesson["key"]})
            changes = {
                "title": lesson["title"],
                "description": lesson["description"],
                "order": order,
                "resource": lesson_resource(course, lesson, netfree),
                "updated_at": now,
            }
            video = (current or {}).get("video") or {"source_type": "none"}
            ours = bool(video.get("catalog_video_key"))
            if current is None or (video.get("source_type") == "none" and not video.get("cleared_by_manager")) or ours:
                kind = video["catalog_video_key"].rsplit(":", 1)[-1] if ours else DEFAULT_KIND
                if kind not in dict(entry.lecture.candidates()):
                    kind = DEFAULT_KIND
                changes["video"] = video_document(entry, kind)
                changes["duration_seconds"] = lesson["video"].get("duration_seconds")
            await database.lessons.update_one(
                {"course_id": course_id, "seed_key": lesson["key"]},
                {"$set": changes, "$setOnInsert": {"created_at": now, "course_id": course_id, "seed_key": lesson["key"]}},
                upsert=True,
            )
            lesson_count += 1
    return course_count, lesson_count
