"""Bundled lesson videos (FocusMind Academy): installed through the regular
video storage, idempotent, never overwriting people's videos, playable by
enrolled learners, and never installed into retired courses."""

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.services.demo_videos import DEMO_OWNER_ID, install_demo_videos
from tests.integration.test_courses_mongo import client, env, fake_video, sign_in, stored_files, upload  # noqa: F401
from tests.integration.test_learning_mongo import db_call, grant_manager

LESSONS = [
    ("python-academy", "lists-dicts", "רשימות"), ("python-academy", "functions", "פונקציות"),
    ("python-academy", "errors-files", "שגיאות"), ("sql-academy", "joins", "JOIN"),
    ("docker-academy", "compose", "Compose"),
]


def write_assets_dir(directory: Path, version: int = 1, seed: int = 0, lessons=LESSONS) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    videos = []
    for index, (course, key, title) in enumerate(lessons):
        name = f"{course}--{key}.mp4"
        data = fake_video(size=40_000 + index)
        data = data[:-1] + bytes([seed])  # different content per "generation"
        (directory / name).write_bytes(data)
        videos.append({"kind": "academy", "course": course, "key": key, "title": title, "file": name,
                       "durationSeconds": 180.0, "version": version})
    (directory / "manifest.json").write_text(json.dumps({"videos": videos}), encoding="utf-8")
    return directory


def test_academy_videos_install_idempotently_and_play_for_enrolled_learners(client: TestClient, env: dict, tmp_path: Path) -> None:
    assets = write_assets_dir(tmp_path / "assets")
    first = db_call(env, lambda db: install_demo_videos(db, assets))
    assert [outcome.action for outcome in first] == ["installed"] * 5
    files_after_first = stored_files(env["storage"])
    assert len(files_after_first) == 5

    # Restart / second run: nothing new is stored.
    second = db_call(env, lambda db: install_demo_videos(db, assets))
    assert [outcome.action for outcome in second] == ["unchanged"] * 5
    assert stored_files(env["storage"]) == files_after_first

    sign_in(client, "learner")
    course = next(row for row in client.get("/api/courses/catalog").json() if row["title"] == "Python בפועל")
    assert course["academy"] is True
    assert client.post(f"/api/courses/{course['id']}/enroll").status_code == 201
    lesson = client.get(f"/api/courses/{course['id']}").json()["lessons"][0]
    assert lesson["video"]["sourceType"] == "upload"
    assert lesson["video"]["academy"] is True and lesson["video"]["demo"] is False
    assert lesson["video"]["trackable"] is True and lesson["durationSeconds"] == 180.0
    # Streams through the authorized endpoint, with ranges.
    stream = client.get(lesson["video"]["url"], headers={"Range": "bytes=0-99"})
    assert stream.status_code == 206 and stream.headers["content-type"] == "video/mp4"
    # Progress and sessions work like any uploaded video.
    saved = client.put(f"/api/lessons/{lesson['id']}/progress", json={"positionSeconds": 30, "durationSeconds": 180})
    assert saved.status_code == 200 and saved.json()["positionSeconds"] == 30
    assert client.post("/api/learning-sessions", json={"lessonId": lesson["id"]}).json()["trackable"] is True

    # Not enrolled: no stream.
    sign_in(client, "stranger")
    assert client.get(lesson["video"]["url"]).status_code == 404

    # Bundled assets belong to no user (no quota, no personal data).
    asset = db_call(env, lambda db: db.video_assets.find_one({"demo_key": {"$regex": "^academy:"}}))
    assert asset["owner_id"] == DEMO_OWNER_ID


def test_new_generation_replaces_old_files_without_leftovers(client: TestClient, env: dict, tmp_path: Path) -> None:
    db_call(env, lambda db: install_demo_videos(db, write_assets_dir(tmp_path / "v1")))
    db_call(env, lambda db: install_demo_videos(db, write_assets_dir(tmp_path / "v2", version=2, seed=7)))
    assert len(stored_files(env["storage"])) == 5  # old files released
    assert db_call(env, lambda db: db.video_assets.count_documents({"demo_key": {"$regex": ":v1$"}})) == 0


def test_people_s_videos_are_never_replaced(client: TestClient, env: dict, tmp_path: Path) -> None:
    sign_in(client, "editor")
    grant_manager(env, "editor")
    client.cookies.clear()
    client.post("/api/auth/login", json={"email": "editor@example.com", "password": "correct horse battery staple"})
    python = next(row for row in client.get("/api/admin/catalog").json() if row["title"] == "Python בפועל")
    # Seed order: lists-dicts, functions, errors-files.
    by_order = client.get(f"/api/courses/{python['id']}").json()["lessons"]
    assert upload(client, by_order[1]["id"], fake_video()).status_code == 200  # a manager's own upload (functions)
    client.put(f"/api/lessons/{by_order[2]['id']}/video-url", json={"url": "https://cdn.example.com/own.mp4"})  # errors-files

    outcomes = {o.seed_key: o for o in db_call(env, lambda db: install_demo_videos(db, write_assets_dir(tmp_path / "d")))}
    assert outcomes["functions"].action == "skipped" and "uploaded" in outcomes["functions"].detail
    assert outcomes["errors-files"].action == "skipped" and "person" in outcomes["errors-files"].detail
    assert outcomes["lists-dicts"].action == "installed"


def test_retired_courses_never_get_videos(client: TestClient, env: dict, tmp_path: Path) -> None:
    from app.seed.catalog import RETIRED_COURSE_SLUGS
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    course_id = db_call(env, lambda db: _insert_retired(db, RETIRED_COURSE_SLUGS[0], now))
    assets = write_assets_dir(tmp_path / "old", lessons=[(RETIRED_COURSE_SLUGS[0], "intro", "היכרות")])
    [outcome] = db_call(env, lambda db: install_demo_videos(db, assets))
    assert outcome.action == "skipped"
    lesson = db_call(env, lambda db: db.lessons.find_one({"course_id": course_id}))
    assert lesson["video"]["source_type"] == "none"


async def _insert_retired(db, slug, now):
    course_id = (await db.courses.insert_one({
        "slug": slug, "title": "Old demo", "type": "catalog", "status": "published", "owner_id": None,
        "retired": True, "created_at": now, "updated_at": now,
    })).inserted_id
    await db.lessons.insert_one({"course_id": course_id, "seed_key": "intro", "title": "Intro", "order": 0,
                                 "video": {"source_type": "none"}, "created_at": now, "updated_at": now})
    return course_id
