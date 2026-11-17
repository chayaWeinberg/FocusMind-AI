"""Curated catalog videos: classification, reachability rules, and the safe,
idempotent apply step against a real MongoDB (throwaway database)."""

import io
import urllib.error

import pytest
from fastapi.testclient import TestClient

from app.seed.catalog_videos import all_entries
from app.services import catalog_videos
from app.services.catalog_videos import BLOCKED, PLAYABLE, REACHABLE, UNAVAILABLE, apply_choices, choose, probe
from app.services.external_video import InvalidVideoUrlError, parse_external_video
from tests.integration.test_courses_mongo import client, env, fake_video, sign_in, upload  # noqa: F401
from tests.integration.test_learning_mongo import db_call, grant_manager

PAGE = "https://cs50.harvard.edu/python/2022/weeks/0/"


class FakeResponse:
    def __init__(self, status: int, content_type: str, body: bytes) -> None:
        self.status = status
        self.headers = type("H", (), {"get_content_type": lambda _self: content_type})()
        self._body = io.BytesIO(body)

    def read(self, size: int = -1) -> bytes:
        return self._body.read(size)

    def __enter__(self):
        return self

    def __exit__(self, *args) -> None:
        return None


def test_external_pages_are_accepted_only_when_marked_as_pages() -> None:
    with pytest.raises(InvalidVideoUrlError):
        parse_external_video(PAGE)  # an ordinary page is not a video file
    assert parse_external_video(PAGE, "page") == {"source_type": "external", "provider": "page", "url": PAGE}
    # Files and YouTube keep their own (better) type even when marked as a page.
    assert parse_external_video("https://cdn.example.com/a.mp4", "page")["provider"] == "direct"
    assert parse_external_video("https://youtu.be/dQw4w9WgXcQ", "page")["provider"] == "youtube"
    for bad in ("http://cs50.harvard.edu/", "https://127.0.0.1/x", "https://localhost/page"):
        with pytest.raises(InvalidVideoUrlError):
            parse_external_video(bad, "page")


def test_probe_tells_real_video_from_filter_block_pages(monkeypatch: pytest.MonkeyPatch) -> None:
    def serve(response):
        def fake_urlopen(request, timeout, context):
            if isinstance(response, Exception):
                raise response
            return response
        monkeypatch.setattr(catalog_videos.urllib.request, "urlopen", fake_urlopen)

    serve(FakeResponse(206, "video/mp4", b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 20))
    assert probe("direct", "https://cdn.example.com/a.mp4") == PLAYABLE
    serve(FakeResponse(200, "text/html", b"<html>not a video</html>"))
    assert probe("direct", "https://cdn.example.com/a.mp4") == UNAVAILABLE  # HTTP 200 alone proves nothing
    serve(urllib.error.HTTPError("u", 418, "I'm a teapot", {}, io.BytesIO(b'<iframe src="//netfree.link/block/">')))
    assert probe("direct", "https://cdn.example.com/a.mp4") == BLOCKED
    serve(FakeResponse(200, "text/html", b'<html><iframe src="//netfree.link/block/#x"></iframe></html>'))
    assert probe("page", PAGE) == BLOCKED
    serve(FakeResponse(200, "text/html", b"<html><h1>Week 0</h1></html>"))
    assert probe("page", PAGE) == REACHABLE
    serve(urllib.error.URLError("offline"))
    assert probe("youtube", "https://www.youtube.com/watch?v=JP7ITIXGpHk") == UNAVAILABLE


def test_choose_prefers_the_most_integrated_reachable_candidate() -> None:
    assert choose({"direct": PLAYABLE, "youtube": REACHABLE, "page": REACHABLE}, "auto") == "direct"
    assert choose({"direct": BLOCKED, "youtube": REACHABLE, "page": REACHABLE}, "auto") == "youtube"
    assert choose({"direct": BLOCKED, "youtube": BLOCKED, "page": REACHABLE}, "auto") == "page"  # NetFree today
    assert choose({"direct": BLOCKED, "youtube": BLOCKED, "page": BLOCKED}, "auto") is None
    assert choose({}, "direct") == "direct"


COURSE = "python-programming"  # a library course: every lesson has a direct, YouTube or page candidate


def test_every_curated_url_is_a_valid_supported_link() -> None:
    entries = all_entries()
    assert len(entries) == 116  # the library; the retired demonstration courses have none
    for entry in entries:
        for kind, url in entry.lecture.candidates():
            assert parse_external_video(url, "page" if kind == "page" else "video")["provider"] == kind
        assert entry.match in ("full", "partial")


def choices_for(mode: str, course: str = COURSE) -> dict:
    return {(entry.course_slug, entry.seed_key): mode for entry in all_entries() if entry.course_slug == course}


def test_apply_attaches_videos_safely_and_idempotently(client: TestClient, env: dict) -> None:
    sign_in(client, "editor")
    grant_manager(env, "editor")
    client.cookies.clear()
    client.post("/api/auth/login", json={"email": "editor@example.com", "password": "correct horse battery staple"})
    catalog = {row["title"]: row for row in client.get("/api/admin/catalog").json()}
    python = client.get(f"/api/courses/{catalog['תכנות ב-Python']['id']}").json()
    lessons = python["lessons"]
    total = len(lessons)
    # The seed links every library lesson to its page; a manager's own upload,
    # and a video the manager removed on purpose, must stay as they are.
    own, removed = lessons[1], lessons[2]
    assert upload(client, own["id"], fake_video()).status_code == 200
    client.delete(f"/api/lessons/{removed['id']}/video")

    outcomes = db_call(env, lambda db: apply_choices(db, choices_for("page")))
    by_key = {outcome.seed_key: outcome for outcome in outcomes if outcome.course_slug == COURSE}
    own_key, removed_key = list(by_key)[1], list(by_key)[2]
    assert by_key[own_key].action == "skipped" and "own video" in by_key[own_key].detail
    assert by_key[removed_key].action == "skipped" and "removed" in by_key[removed_key].detail
    assert sum(outcome.action == "unchanged" for outcome in by_key.values()) == total - 2

    # A direct run switches only the tool-set videos, then is idempotent.
    switched = db_call(env, lambda db: apply_choices(db, choices_for("direct")))
    assert sum(outcome.action == "attached" for outcome in switched) == total - 2
    again = db_call(env, lambda db: apply_choices(db, choices_for("direct")))
    assert {outcome.action for outcome in again} == {"unchanged", "skipped"}

    detail = client.get(f"/api/courses/{python['id']}").json()
    video = {lesson["id"]: lesson["video"] for lesson in detail["lessons"]}
    assert video[own["id"]]["sourceType"] == "upload"
    assert video[removed["id"]]["sourceType"] == "none"
    first = video[lessons[0]["id"]]
    assert first["sourceType"] == "external" and first["provider"] == "direct" and first["trackable"] is True
    assert first["academy"] is False and first["demo"] is False
    # The tool itself never marks a course as edited by a manager (here a
    # course the manager did not touch).
    other = db_call(env, lambda db: apply_choices(db, choices_for("direct", "react")))
    assert "attached" in {outcome.action for outcome in other}
    course = db_call(env, lambda db: db.courses.find_one({"slug": "react"}))
    assert not course.get("edited_by_manager")


def test_external_page_lessons_are_learned_without_tracking(client: TestClient, env: dict) -> None:
    sign_in(client, "learner")
    course = next(row for row in client.get("/api/courses/catalog").json() if row["title"] == "SQL ומסדי נתונים")
    client.post(f"/api/courses/{course['id']}/enroll")
    lesson = client.get(f"/api/courses/{course['id']}").json()["lessons"][1]
    assert lesson["video"]["provider"] == "page" and lesson["video"]["trackable"] is False
    assert lesson["video"]["url"] == lesson["resource"]["pageUrl"]

    assert client.put(f"/api/lessons/{lesson['id']}/progress", json={"positionSeconds": 5}).status_code == 409
    replay = client.get(f"/api/lessons/{lesson['id']}/replay").json()
    assert replay["trackable"] is False and replay["items"] == []
    session = client.post("/api/learning-sessions", json={"lessonId": lesson["id"]}).json()
    assert session["trackable"] is False
    assert client.post(f"/api/lessons/{lesson['id']}/complete").json()["completed"] is True


def test_editors_choose_the_page_type_explicitly(client: TestClient) -> None:
    sign_in(client, "owner")
    course = client.post("/api/courses", json={"title": "Pages"}).json()
    lesson = client.post(f"/api/courses/{course['id']}/lessons", json={"title": "Lesson"}).json()
    rejected = client.put(f"/api/lessons/{lesson['id']}/video-url", json={"url": PAGE})
    assert rejected.status_code == 422
    saved = client.put(f"/api/lessons/{lesson['id']}/video-url", json={"url": PAGE, "kind": "page"})
    assert saved.status_code == 200 and saved.json()["video"]["provider"] == "page"
