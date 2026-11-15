"""Courses, lessons, uploads, progress, sessions and authorization against a
real MongoDB (a throwaway database) and a temporary video storage folder."""

import asyncio
import os
import uuid
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pymongo import AsyncMongoClient

from app.core.config import settings
from app.main import app
from app.seed.catalog import CATALOG

MP4_HEADER = b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom"
WEBM_HEADER = b"\x1a\x45\xdf\xa3\x9f\x42\x86\x81\x01\x42\xf7\x81\x01\x42\x82\x84webm"


def fake_video(header: bytes = MP4_HEADER, size: int = 300_000) -> bytes:
    body = bytes((index * 31 + 7) % 251 for index in range(size - len(header)))
    return header + body


@pytest.fixture
def env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Iterator[dict]:
    database_name = f"focusmind_courses_test_{uuid.uuid4().hex}"
    monkeypatch.setattr(settings, "mongo_db_name", database_name)
    monkeypatch.setattr(settings, "video_storage_dir", tmp_path / "videos")
    monkeypatch.setattr(settings, "seed_catalog", True)
    try:
        yield {"database": database_name, "storage": tmp_path / "videos"}
    finally:
        async def drop() -> None:
            client = AsyncMongoClient(settings.mongo_uri)
            try:
                await client.drop_database(database_name)
            finally:
                await client.close()

        asyncio.run(drop())


@pytest.fixture
def client(env: dict) -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


def sign_in(client: TestClient, name: str) -> None:
    email = f"{name}@example.com"
    password = "correct horse battery staple"
    client.post(
        "/api/auth/register",
        json={"displayName": name.title(), "email": email, "password": password, "confirmPassword": password},
    )
    client.cookies.clear()
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200


def create_course(client: TestClient, title: str = "My course") -> dict:
    response = client.post("/api/courses", json={"title": title, "description": "Notes", "category": "Math"})
    assert response.status_code == 201, response.text
    return response.json()


def add_lesson(client: TestClient, course_id: str, title: str, **extra) -> dict:
    response = client.post(f"/api/courses/{course_id}/lessons", json={"title": title, **extra})
    assert response.status_code == 201, response.text
    return response.json()


def upload(client: TestClient, lesson_id: str, data: bytes, **params) -> "object":
    return client.put(
        f"/api/lessons/{lesson_id}/video",
        content=data,
        params=params,
        headers={"Content-Type": "application/octet-stream", "X-File-Name": "..%2F..%2Flesson%20one.mp4"},
    )


def stored_files(storage: Path) -> list[str]:
    return sorted(path.name for path in storage.glob("*") if path.is_file())


def test_requires_authentication(client: TestClient) -> None:
    for method, path in [
        ("get", "/api/courses/mine"),
        ("get", "/api/courses/catalog"),
        ("post", "/api/courses"),
        ("get", f"/api/videos/{'0' * 24}/stream"),
    ]:
        assert getattr(client, method)(path).status_code == 401


def test_personal_course_full_workflow(client: TestClient, env: dict) -> None:
    sign_in(client, "ada")
    course = create_course(client)
    assert course["type"] == "personal" and course["isOwner"] and course["canEdit"]

    first = add_lesson(client, course["id"], "Lesson one")
    second = add_lesson(client, course["id"], "Lesson two")
    third = add_lesson(client, course["id"], "Lesson three", externalUrl="https://cdn.example.com/media/intro.webm")
    assert third["video"] == {
        "sourceType": "external", "provider": "direct", "url": "https://cdn.example.com/media/intro.webm",
        "embedUrl": None, "originalName": None, "sizeBytes": None, "trackable": True,
    }

    # Upload a supported video; the client's filename is display-only.
    video = fake_video()
    response = upload(client, first["id"], video, durationSeconds=120)
    assert response.status_code == 200, response.text
    uploaded = response.json()["video"]
    assert uploaded["sourceType"] == "upload" and uploaded["trackable"]
    assert uploaded["originalName"] == "lesson one.mp4"
    assert uploaded["sizeBytes"] == len(video)
    assert len(stored_files(env["storage"])) == 1
    assert stored_files(env["storage"])[0].endswith(".mp4")

    # An external YouTube link on another lesson.
    response = client.put(
        f"/api/lessons/{second['id']}/video-url", json={"url": "https://youtu.be/dQw4w9WgXcQ"}
    )
    assert response.status_code == 200
    youtube = response.json()["video"]
    assert youtube["provider"] == "youtube" and not youtube["trackable"]
    assert youtube["embedUrl"].startswith("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")

    # Smart Learning context for the first lesson.
    context = client.get(f"/api/lessons/{first['id']}").json()
    assert context["course"]["title"] == "My course"
    assert context["nextLessonId"] == second["id"] and context["previousLessonId"] is None
    assert (context["lessonNumber"], context["lessonTotal"], context["canLearn"]) == (1, 3, True)
    assert context["lesson"]["progress"] is None  # opening never creates progress

    # Watch part of the video: the position is saved, not completed.
    saved = client.put(f"/api/lessons/{first['id']}/progress", json={"positionSeconds": 42.5, "durationSeconds": 120})
    assert saved.status_code == 200
    assert saved.json()["positionSeconds"] == 42.5 and not saved.json()["completed"]
    # Leave and return: the position is restored.
    resumed = client.get(f"/api/lessons/{first['id']}").json()["lesson"]["progress"]
    assert resumed["positionSeconds"] == 42.5

    # Positions beyond the duration are clamped; 90 % completes the lesson.
    done = client.put(f"/api/lessons/{first['id']}/progress", json={"positionSeconds": 110, "durationSeconds": 120}).json()
    assert done["completed"] and done["completedAt"]
    # Completion is permanent even when rewinding.
    again = client.put(f"/api/lessons/{first['id']}/progress", json={"positionSeconds": 5}).json()
    assert again["completed"] and again["positionSeconds"] == 5 and again["completedAt"] == done["completedAt"]

    # Trackable lessons cannot be completed manually; YouTube lessons can.
    assert client.post(f"/api/lessons/{first['id']}/complete").status_code == 409
    assert client.put(f"/api/lessons/{second['id']}/progress", json={"positionSeconds": 3}).status_code == 409
    assert client.post(f"/api/lessons/{second['id']}/complete").json()["completed"]

    progress = client.get(f"/api/courses/{course['id']}/progress").json()
    assert progress == {"completedLessons": 2, "totalLessons": 3, "percent": 67, "continueLessonId": third["id"]}
    mine = client.get("/api/courses/mine").json()
    assert [item["id"] for item in mine] == [course["id"]]
    assert mine[0]["progress"]["percent"] == 67 and mine[0]["lessonCount"] == 3

    # Edit and reorder.
    assert client.patch(f"/api/courses/{course['id']}", json={"title": "Renamed"}).json()["title"] == "Renamed"
    assert client.patch(f"/api/lessons/{second['id']}", json={"description": "Updated"}).json()["description"] == "Updated"
    reordered = client.put(
        f"/api/courses/{course['id']}/lessons/order", json={"lessonIds": [third["id"], first["id"], second["id"]]}
    ).json()
    assert [lesson["id"] for lesson in reordered["lessons"]] == [third["id"], first["id"], second["id"]]
    bad_order = client.put(f"/api/courses/{course['id']}/lessons/order", json={"lessonIds": [first["id"]]})
    assert bad_order.status_code == 422

    # Lesson without a video cannot be completed.
    empty = add_lesson(client, course["id"], "Lesson four")
    assert client.post(f"/api/lessons/{empty['id']}/complete").status_code == 409

    # Replacing an uploaded video removes the old file; deleting the course removes everything.
    upload(client, first["id"], fake_video(WEBM_HEADER))
    files = stored_files(env["storage"])
    assert len(files) == 1 and files[0].endswith(".webm")
    assert client.delete(f"/api/courses/{course['id']}").status_code == 204
    assert stored_files(env["storage"]) == []
    assert client.get(f"/api/courses/{course['id']}").status_code == 404
    assert client.get(f"/api/lessons/{first['id']}").status_code == 404


def test_upload_validation_and_limits(client: TestClient, env: dict, monkeypatch: pytest.MonkeyPatch) -> None:
    sign_in(client, "ada")
    lesson = add_lesson(client, create_course(client)["id"], "Lesson")

    assert upload(client, lesson["id"], b"#!/bin/sh\necho not a video\n" * 100).status_code == 415
    assert upload(client, lesson["id"], b"").status_code == 415
    mov = b"\x00\x00\x00\x14ftypqt  \x00\x00\x00\x00" + b"x" * 1000
    assert upload(client, lesson["id"], mov).status_code == 415

    monkeypatch.setattr(settings, "max_video_upload_bytes", 100_000)
    assert upload(client, lesson["id"], fake_video(size=200_000)).status_code == 413
    monkeypatch.setattr(settings, "max_video_upload_bytes", 10_000_000)
    monkeypatch.setattr(settings, "user_video_quota_bytes", 400_000)
    assert upload(client, lesson["id"], fake_video(size=300_000)).status_code == 200
    other = add_lesson(client, create_course(client, "Second")["id"], "Lesson")
    assert upload(client, other["id"], fake_video(size=300_000)).status_code == 413

    # No partial files are left behind.
    assert list((env["storage"] / ".incoming").glob("*")) == []
    assert len(stored_files(env["storage"])) == 1


@pytest.mark.parametrize(
    "url",
    [
        "http://cdn.example.com/video.mp4",
        "https://example.com/some/article",
        "https://127.0.0.1/video.mp4",
        "https://localhost/video.mp4",
        "https://user:secret@cdn.example.com/video.mp4",
        "https://www.youtube.com/channel/abc",
        "javascript:alert(1)",
    ],
)
def test_rejects_unsupported_external_links(client: TestClient, url: str) -> None:
    sign_in(client, "ada")
    lesson = add_lesson(client, create_course(client)["id"], "Lesson")
    response = client.put(f"/api/lessons/{lesson['id']}/video-url", json={"url": url})
    assert response.status_code == 422
    assert "detail" in response.json()


def test_range_streaming_and_persistence_after_restart(env: dict) -> None:
    video = fake_video(size=250_000)
    with TestClient(app) as client:
        sign_in(client, "ada")
        lesson = add_lesson(client, create_course(client)["id"], "Lesson")
        stream = upload(client, lesson["id"], video).json()["video"]["url"]

        full = client.get(stream)
        assert full.status_code == 200 and full.content == video
        assert full.headers["accept-ranges"] == "bytes"
        assert full.headers["content-type"] == "video/mp4"
        assert full.headers["x-content-type-options"] == "nosniff"

        part = client.get(stream, headers={"Range": "bytes=1000-1999"})
        assert part.status_code == 206
        assert part.headers["content-range"] == f"bytes 1000-1999/{len(video)}"
        assert part.content == video[1000:2000]

        open_ended = client.get(stream, headers={"Range": "bytes=249000-"})
        assert open_ended.status_code == 206 and open_ended.content == video[249000:]
        suffix = client.get(stream, headers={"Range": "bytes=-500"})
        assert suffix.content == video[-500:]
        assert client.get(stream, headers={"Range": f"bytes={len(video)}-"}).status_code == 416
        head = client.head(stream)
        assert head.status_code == 200 and head.headers["content-length"] == str(len(video))
        cookies = dict(client.cookies)

    # A new application instance (service restart) still serves the same file.
    with TestClient(app, cookies=cookies) as restarted:
        again = restarted.get(stream, headers={"Range": "bytes=0-99"})
        assert again.status_code == 206 and again.content == video[:100]


def test_users_cannot_access_each_others_private_courses(client: TestClient) -> None:
    sign_in(client, "ada")
    course = create_course(client)
    lesson = add_lesson(client, course["id"], "Private lesson")
    stream = upload(client, lesson["id"], fake_video()).json()["video"]["url"]
    client.put(f"/api/lessons/{lesson['id']}/progress", json={"positionSeconds": 10, "durationSeconds": 100})

    sign_in(client, "grace")
    assert client.get("/api/courses/mine").json() == []
    for method, path, body in [
        ("get", f"/api/courses/{course['id']}", None),
        ("patch", f"/api/courses/{course['id']}", {"title": "Hijacked"}),
        ("delete", f"/api/courses/{course['id']}", None),
        ("post", f"/api/courses/{course['id']}/lessons", {"title": "Injected"}),
        ("get", f"/api/lessons/{lesson['id']}", None),
        ("patch", f"/api/lessons/{lesson['id']}", {"title": "Hijacked"}),
        ("delete", f"/api/lessons/{lesson['id']}", None),
        ("get", f"/api/lessons/{lesson['id']}/progress", None),
        ("put", f"/api/lessons/{lesson['id']}/progress", {"positionSeconds": 99, "ended": True}),
        ("post", f"/api/lessons/{lesson['id']}/complete", None),
        ("put", f"/api/lessons/{lesson['id']}/video-url", {"url": "https://cdn.example.com/x.mp4"}),
        ("delete", f"/api/lessons/{lesson['id']}/video", None),
        ("get", stream, None),
        ("post", "/api/learning-sessions", {"lessonId": lesson["id"]}),
    ]:
        kwargs = {"json": body} if body is not None else {}
        response = client.request(method.upper(), path, **kwargs)
        assert response.status_code == 404, (method, path, response.status_code)
    assert upload(client, lesson["id"], fake_video()).status_code == 404
    # The client cannot choose an owner.
    assert client.post("/api/courses", json={"title": "Mine", "ownerId": "x"}).status_code == 422

    sign_in(client, "ada")
    intact = client.get(f"/api/courses/{course['id']}").json()
    assert intact["title"] == "My course" and len(intact["lessons"]) == 1
    assert intact["lessons"][0]["progress"]["positionSeconds"] == 10


def test_catalog_browse_enroll_and_progress(client: TestClient) -> None:
    sign_in(client, "ada")
    catalog = client.get("/api/courses/catalog").json()
    assert len(catalog) == len(CATALOG)
    assert all(course["type"] == "catalog" and not course["enrolled"] for course in catalog)
    assert "תכנות" in client.get("/api/courses/catalog/categories").json()
    sql = client.get("/api/courses/catalog", params={"q": "SQL"}).json()
    assert [course["title"] for course in sql] == ["יסודות SQL"]
    assert client.get("/api/courses/catalog", params={"category": "נתונים"}).json()[0]["id"] == sql[0]["id"]

    course_id = sql[0]["id"]
    detail = client.get(f"/api/courses/{course_id}").json()
    assert not detail["canEdit"] and not detail["canLearn"] and len(detail["lessons"]) == 5
    assert all(lesson["video"]["sourceType"] == "none" for lesson in detail["lessons"])
    lesson_id = detail["lessons"][0]["id"]

    # Read-only for users; learning requires enrollment.
    assert client.patch(f"/api/courses/{course_id}", json={"title": "Hacked"}).status_code == 403
    assert client.post(f"/api/courses/{course_id}/lessons", json={"title": "Injected"}).status_code == 403
    assert client.delete(f"/api/courses/{course_id}").status_code == 403
    assert client.put(f"/api/lessons/{lesson_id}/video-url", json={"url": "https://a.example.com/v.mp4"}).status_code == 403
    assert client.post(f"/api/lessons/{lesson_id}/complete").status_code == 403

    assert client.post(f"/api/courses/{course_id}/enroll").status_code == 201
    assert client.post(f"/api/courses/{course_id}/enroll").status_code == 200  # no duplicate
    mine = client.get("/api/courses/mine").json()
    assert [course["id"] for course in mine] == [course_id]
    assert mine[0]["enrolled"] and mine[0]["progress"] == {
        "completedLessons": 0, "totalLessons": 5, "percent": 0, "continueLessonId": lesson_id,
    }
    # Seeded lessons have no video yet, so they cannot be completed.
    assert client.post(f"/api/lessons/{lesson_id}/complete").status_code == 409

    # Another user's enrollment and progress are independent.
    sign_in(client, "grace")
    assert client.get("/api/courses/mine").json() == []
    assert not client.get(f"/api/courses/{course_id}").json()["enrolled"]


def test_seed_is_idempotent(env: dict) -> None:
    for _ in range(2):
        with TestClient(app) as client:
            pass
    with TestClient(app) as client:
        sign_in(client, "ada")
        catalog = client.get("/api/courses/catalog").json()
        assert len(catalog) == len(CATALOG)
        for course in catalog:
            expected = next(item for item in CATALOG if item["title"] == course["title"])
            assert course["lessonCount"] == len(expected["lessons"])


def test_learning_session_segments(client: TestClient) -> None:
    sign_in(client, "ada")
    course = create_course(client)
    lesson = add_lesson(client, course["id"], "Lesson", externalUrl="https://cdn.example.com/v.mp4")
    empty = add_lesson(client, course["id"], "No video")
    assert client.post("/api/learning-sessions", json={"lessonId": empty["id"]}).status_code == 409

    session = client.post("/api/learning-sessions", json={"lessonId": lesson["id"]})
    assert session.status_code == 201
    session_id = session.json()["id"]
    segments = [
        # Watched 0-10 s on screen, looked away 10-14 s, then rewound and replayed 5-9 s at 1.5x.
        {"seq": 0, "sessionStartMs": 0, "sessionEndMs": 10_000, "videoStart": 0, "videoEnd": 10,
         "playbackRate": 1, "state": "ON_SCREEN", "durationMs": 10_000, "concentration": 92},
        {"seq": 1, "sessionStartMs": 10_000, "sessionEndMs": 14_000, "videoStart": 10, "videoEnd": 14,
         "playbackRate": 1, "state": "OFF_SCREEN", "durationMs": 4_000},
        {"seq": 2, "sessionStartMs": 20_000, "sessionEndMs": 22_700, "videoStart": 5, "videoEnd": 9,
         "playbackRate": 1.5, "state": "UNCERTAIN", "durationMs": 2_700},
    ]
    response = client.post(f"/api/learning-sessions/{session_id}/segments", json={"segments": segments})
    assert response.json() == {"accepted": 3}
    # A retried batch is not duplicated.
    retry = client.post(f"/api/learning-sessions/{session_id}/segments", json={"segments": segments[1:]})
    assert retry.json() == {"accepted": 0}

    invalid = {**segments[0], "seq": 3, "state": "FOCUSED"}
    assert client.post(f"/api/learning-sessions/{session_id}/segments", json={"segments": [invalid]}).status_code == 422
    backwards = {**segments[0], "seq": 3, "videoStart": 20, "videoEnd": 10}
    assert client.post(f"/api/learning-sessions/{session_id}/segments", json={"segments": [backwards]}).status_code == 422

    ended = client.post(f"/api/learning-sessions/{session_id}/end", json={"activeMs": 22_700}).json()
    assert ended["endedAt"] and ended["activeMs"] == 22_700 and ended["segmentCount"] == 3
    detail = client.get(f"/api/learning-sessions/{session_id}").json()
    assert [segment["state"] for segment in detail["segments"]] == ["ON_SCREEN", "OFF_SCREEN", "UNCERTAIN"]
    assert detail["segments"][2]["videoStart"] == 5 and detail["segments"][2]["sessionStartMs"] == 20_000

    sign_in(client, "grace")
    assert client.get(f"/api/learning-sessions/{session_id}").status_code == 404
    assert client.post(f"/api/learning-sessions/{session_id}/segments", json={"segments": segments}).status_code == 404


def test_uploaded_videos_live_outside_temporary_container_paths() -> None:
    # Compose mounts a named volume at /data/videos; the default is a project folder.
    assert settings.video_storage_dir.is_absolute()
    assert os.path.basename(str(settings.video_storage_dir)) == "videos"
