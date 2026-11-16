"""Install the generated demonstration videos into the catalog lessons.

    python -m app.demo_videos install <directory with manifest.json>
    python -m app.demo_videos install <directory> --dry-run

Docker (the files are generated on the host, see docs/catalog-videos.md):
    docker compose cp demo-videos backend:/tmp/demo-videos
    docker compose exec backend python -m app.demo_videos install /tmp/demo-videos

Safe to run again: identical videos are reported as "unchanged".
"""

import argparse
import asyncio
from pathlib import Path

from app.core.config import settings
from app.db.database import close_db, get_database, initialize_db
from app.services.demo_videos import install_demo_videos


async def run(directory: Path, dry_run: bool) -> int:
    await initialize_db(settings.mongo_uri, settings.mongo_db_name, settings.mongo_timeout_ms)
    try:
        outcomes = await install_demo_videos(get_database(), directory, dry_run)
    finally:
        await close_db()
    for outcome in outcomes:
        print(f"{outcome.action:13} {outcome.course_slug}/{outcome.seed_key}: {outcome.detail}")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.demo_videos")
    parser.add_argument("command", choices=["install"])
    parser.add_argument("directory", type=Path)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    raise SystemExit(asyncio.run(run(args.directory.resolve(), args.dry_run)))


if __name__ == "__main__":
    main()
