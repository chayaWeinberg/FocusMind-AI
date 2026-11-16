"""Curated catalog videos: check, attach and list.

    python -m app.catalog_videos check                 # reachability from this server's network
    python -m app.catalog_videos apply                 # attach the best reachable candidate per lesson
    python -m app.catalog_videos apply --mode page     # force one type: direct | youtube | page
    python -m app.catalog_videos apply --dry-run
    python -m app.catalog_videos status                # what each catalog lesson plays now

In Docker:  docker compose exec backend python -m app.catalog_videos apply
Re-running is safe: lessons with their own video are never touched.
"""

import argparse
import asyncio

from app.core.config import settings
from app.db.database import close_db, get_database, initialize_db
from app.seed.catalog_videos import LESSON_VIDEOS
from app.services.catalog_videos import MODES, apply_choices, choose, probe


def check_all() -> dict[str, dict[str, str]]:
    results: dict[str, dict[str, str]] = {}
    for entry in LESSON_VIDEOS:
        lecture = entry.lecture
        if lecture.key not in results:
            results[lecture.key] = {kind: probe(kind, url) for kind, url in lecture.candidates()}
            row = results[lecture.key]
            print(f"{lecture.key:10} direct={row['direct']:11} youtube={row['youtube']:11} page={row['page']:11} {lecture.name}")
    return results


async def run(command: str, mode: str, dry_run: bool) -> None:
    if command == "check":
        check_all()
        return
    await initialize_db(settings.mongo_uri, settings.mongo_db_name, settings.mongo_timeout_ms)
    try:
        database = get_database()
        if command == "status":
            async for course in database.courses.find({"type": "catalog"}).sort("title", 1):
                print(f"\n{course['title']} ({course.get('status')})")
                async for lesson in database.lessons.find({"course_id": course["_id"]}).sort("order", 1):
                    video = lesson.get("video", {})
                    label = video.get("provider") or video.get("source_type")
                    print(f"  {lesson['order'] + 1}. {lesson['title']}: {label} {video.get('url', '')}".rstrip())
            return
        results = check_all() if mode == "auto" else {}
        choices = {
            (entry.course_slug, entry.seed_key): choose(results.get(entry.lecture.key, {}), mode)
            for entry in LESSON_VIDEOS
        }
        for outcome in await apply_choices(database, choices, dry_run=dry_run):
            print(f"{outcome.action:13} {outcome.course_slug}/{outcome.seed_key}: {outcome.detail}")
    finally:
        await close_db()


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.catalog_videos")
    parser.add_argument("command", choices=["check", "apply", "status"])
    parser.add_argument("--mode", choices=MODES, default="auto")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    asyncio.run(run(args.command, args.mode, args.dry_run))


if __name__ == "__main__":
    main()
