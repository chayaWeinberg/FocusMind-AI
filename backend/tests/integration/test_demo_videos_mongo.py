"""Demonstration videos: installed through the regular video storage,
idempotent, never overwriting people's videos, playable by enrolled learners."""

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.services.catalog_videos import apply_choices
from app.services.demo_videos import DEMO_OWNER_ID, install_demo_videos
from app.seed.catalog_videos import LESSON_VIDEOS
from tests.integration.test_courses_mongo import client, env, fake_video, sign_in, stored_files, upload  # noqa: F401
from tests.integration.test_learning_mongo import db_call, grant_manager

LESSONS = [
    ("python-for-beginners", "intro", "היכרות"), ("python-for-beginners", "loops", "לולאות"),
    ("python-for-beginners", "functions", "פונקציות"), ("sql-fundamentals", "select", "SELECT"),
    ("intro-to-ai", "responsible-ai", "אחראית"),
]


def write_demo_dir(directory: Path, version: int = 1, seed: int = 0) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    videos = []
    for index, (course, key, title) in enumerate(LESSONS):
        name = f"{course}--{key}.mp4"
        data = fake_video(size=40_000 + index)
        data = data[:-1] + bytes([seed])  # different content per "generation"
        (directory / name).write_bytes(data)
        videos.append({"course": course, "key": key, "title": title, "file": name, "durationSeconds": 90.0, "version": version})
    (directory / "manifest.json").write_text(json.dumps({"videos": videos}), encoding="utf-8")
    return directory


def test_demo_videos_install_idempotently_and_keep_the_source_link(client: TestClient, env: dict, tmp_path: Path) -> None:
    db_call(env, lambda db: apply_choices(db, {(e.course_slug, e.seed_key): "page" for e in LESSON_VIDEOS}))
    demo_dir = write_demo_dir(tmp_path / "demo")
    first = db_call(env, lambda db: install_demo_videos(db, demo_dir))
    assert [outcome.action for outcome in first] == ["installed"] * 5
    files_after_first = stored_files(env["storage"])
    assert len(files_after_first) == 5

    # Restart / second run: nothing new is stored.
    second = db_call(env, lambda db: install_demo_videos(db, demo_dir))
    assert [outcome.action for outcome in second] == ["unchanged"] * 5
    assert stored_files(env["storage"]) == files_after_first

    sign_in(client, "learner")
    course = next(row for row in client.get("/api/courses/catalog").json() if row["title"] == "Python למתחילים")
    assert client.post(f"/api/courses/{course['id']}/enroll").status_code == 201
    lesson = client.get(f"/api/courses/{course['id']}").json()["lessons"][0]
    assert lesson["video"]["sourceType"] == "upload" and lesson["video"]["demo"] is True
    assert lesson["video"]["trackable"] is True and lesson["durationSeconds"] == 90.0
    assert lesson["reference"] == {
        "name": "CS50P, Lecture 0: Functions, Variables",
        "url": "https://cs50.harvard.edu/python/2022/weeks/0/", "license": "CC BY-NC-SA 4.0",
    }
    # Streams through the authorized endpoint, with ranges.
    stream = client.get(lesson["video"]["url"], headers={"Range": "bytes=0-99"})
    assert stream.status_code == 206 and stream.headers["content-type"] == "video/mp4"
    # Progress and sessions work like any uploaded video.
    saved = client.put(f"/api/lessons/{lesson['id']}/progress", json={"positionSeconds": 30, "durationSeconds": 90})
    assert saved.status_code == 200 and saved.json()["positionSeconds"] == 30
    assert client.post("/api/learning-sessions", json={"lessonId": lesson["id"]}).json()["trackable"] is True

    # Not enrolled: no stream.
    sign_in(client, "stranger")
    assert client.get(lesson["video"]["url"]).status_code == 404

    # Demo assets belong to no user (no quota, no personal data).
    asset = db_call(env, lambda db: db.video_assets.find_one({"demo_key": {"$exists": True}}))
    assert asset["owner_id"] == DEMO_OWNER_ID
    responsible = db_call(env, lambda db: db.lessons.find_one({"seed_key": "responsible-ai"}))
    assert responsible["video"]["source_type"] == "upload" and "reference" not in responsible


def test_new_generation_replaces_old_demo_files_without_leftovers(client: TestClient, env: dict, tmp_path: Path) -> None:
    db_call(env, lambda db: install_demo_videos(db, write_demo_dir(tmp_path / "v1")))
    db_call(env, lambda db: install_demo_videos(db, write_demo_dir(tmp_path / "v2", version=2, seed=7)))
    assert len(stored_files(env["storage"])) == 5  # old files released
    assert db_call(env, lambda db: db.video_assets.count_documents({"demo_key": {"$regex": ":v1$"}})) == 0


def test_people_s_videos_are_never_replaced(client: TestClient, env: dict, tmp_path: Path) -> None:
    sign_in(client, "editor")
    grant_manager(env, "editor")
    client.cookies.clear()
    client.post("/api/auth/login", json={"email": "editor@example.com", "password": "correct horse battery staple"})
    python = next(row for row in client.get("/api/admin/catalog").json() if row["title"] == "Python למתחילים")
    lessons = {lesson["title"]: lesson for lesson in client.get(f"/api/courses/{python['id']}").json()["lessons"]}
    assert upload(client, lessons["פונקציות"]["id"], fake_video()).status_code == 200  # a manager's own upload
    client.put(f"/api/lessons/{lessons['לולאות']['id']}/video-url", json={"url": "https://cdn.example.com/own.mp4"})

    outcomes = {o.seed_key: o for o in db_call(env, lambda db: install_demo_videos(db, write_demo_dir(tmp_path / "d")))}
    assert outcomes["functions"].action == "skipped" and "uploaded" in outcomes["functions"].detail
    assert outcomes["loops"].action == "skipped" and "person" in outcomes["loops"].detail
    assert outcomes["intro"].action == "installed"
    # The catalog link tool never replaces a demo video either.
    after = db_call(env, lambda db: apply_choices(db, {(e.course_slug, e.seed_key): "page" for e in LESSON_VIDEOS}))
    assert {o.action for o in after if o.seed_key in ("intro", "select")} == {"skipped"}
