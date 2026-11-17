"""The expanded catalog: real, specific video links per lesson, imported
idempotently without overwriting people's changes."""

import re
from urllib.parse import urlsplit

from fastapi.testclient import TestClient

from app.seed.catalog import seed_catalog
from app.seed.catalog_library import LIBRARY
from app.services.catalog_videos import apply_choices
from app.seed.catalog_videos import library_entries
from app.services.external_video import parse_external_video
from tests.integration.test_courses_mongo import client, env, sign_in  # noqa: F401
from tests.integration.test_learning_mongo import db_call, grant_manager

# A lesson must point at one video's own page, never at a course homepage.
VIDEO_PAGE = re.compile(
    r"^https://(learn\.microsoft\.com/en-us/shows/[a-z0-9-]+/[a-z0-9-]+/"
    r"|cs50\.harvard\.edu/[a-z]+/\d{4}/(weeks/\d+|shorts/[a-z_]+)/)$"
)


def test_library_data_is_specific_and_complete() -> None:
    assert len(LIBRARY) == 10
    lessons = [lesson for course in LIBRARY for lesson in course["lessons"]]
    assert len(lessons) == 116
    for course in LIBRARY:
        assert course["difficulty"] in ("beginner", "intermediate", "advanced")
        assert course["title"] and course["description"] and course["category"]
        keys = [lesson["key"] for lesson in course["lessons"]]
        assert len(keys) == len(set(keys)), course["slug"]
        for lesson in course["lessons"]:
            video = lesson["video"]
            assert VIDEO_PAGE.match(video["page_url"]), video["page_url"]
            assert video["provider"] in ("Microsoft Learn", "Harvard CS50")
            assert video["source_title"] and video["language"] == "en" and video["license"]
            if video["direct_url"]:
                assert urlsplit(video["direct_url"]).scheme == "https" and video["direct_url"].endswith(".mp4")
                # Must be accepted by FocusMind's own link validation (e.g. no raw spaces).
                assert parse_external_video(video["direct_url"])["provider"] == "direct", video["direct_url"]
            assert parse_external_video(video["page_url"], "page")["provider"] == "page"
            if video["youtube_id"]:
                assert re.fullmatch(r"[A-Za-z0-9_-]{11}", video["youtube_id"])
            assert video["duration_seconds"] is None or video["duration_seconds"] > 0


def catalog(client: TestClient) -> dict:
    return {row["title"]: row for row in client.get("/api/courses/catalog").json()}


def test_import_is_idempotent_and_exposes_sources(client: TestClient, env: dict) -> None:
    sign_in(client, "learner")
    rows = catalog(client)
    assert len(rows) == 15  # 5 Academy + 10 library courses (the 3 demonstration courses are retired)
    python = rows["תכנות ב-Python"]
    assert python["difficulty"] == "beginner" and python["lessonCount"] == 13
    assert "Python למתחילים" not in rows
    assert rows["Python בפועל"]["academy"] is True
    assert python["externalLibrary"] is True and python["academy"] is False
    # Academy courses come first in the catalog.
    ordered = [row["title"] for row in client.get("/api/courses/catalog").json()]
    assert set(ordered[:5]) == {"Python בפועל", "JavaScript לדפדפן", "SQL לניתוח נתונים", "אלגוריתמים בפועל", "Docker למפתחים"}

    lessons = client.get(f"/api/courses/{python['id']}").json()["lessons"]
    assert [lesson["order"] for lesson in lessons] == list(range(13))
    first = lessons[0]
    assert first["video"]["provider"] == "page" and first["video"]["url"] == first["resource"]["pageUrl"]
    assert first["resource"]["provider"] == "Microsoft Learn"
    assert first["resource"]["sourceTitle"] == "Python for Beginners [2 of 44] Introducing Python"
    assert first["resource"]["durationSeconds"] == 189
    assert first["resource"]["netfree"]["status"] in ("playable", "page_only", "blocked", "unverified")

    async def counts(db):
        return await db.courses.count_documents({"type": "catalog"}), await db.lessons.count_documents({})

    before = db_call(env, counts)
    db_call(env, seed_catalog)
    db_call(env, seed_catalog)
    assert db_call(env, counts) == before == (15, 15 + 116)


def test_import_keeps_people_s_changes_and_the_chosen_kind(client: TestClient, env: dict) -> None:
    sign_in(client, "editor")
    grant_manager(env, "editor")
    client.cookies.clear()
    client.post("/api/auth/login", json={"email": "editor@example.com", "password": "correct horse battery staple"})
    rows = catalog(client)
    git = rows["Git ו-GitHub"]
    client.patch(f"/api/courses/{git['id']}", json={"title": "Git – גרסה שלנו"})
    react = rows["React"]
    react_lessons = client.get(f"/api/courses/{react['id']}").json()["lessons"]
    own = react_lessons[0]
    assert client.put(f"/api/lessons/{own['id']}/video-url", json={"url": "https://cdn.example.com/own.webm"}).status_code == 200

    # Switch the algorithms course to its direct files, as `apply --mode direct` would.
    algo_keys = {(entry.course_slug, entry.seed_key): "direct" for entry in library_entries() if entry.course_slug == "algorithms-data-structures"}
    db_call(env, lambda db: apply_choices(db, algo_keys))
    db_call(env, seed_catalog)

    rows = catalog(client)
    assert "Git – גרסה שלנו" in rows and "Git ו-GitHub" not in rows  # edited course untouched
    kept = client.get(f"/api/lessons/{own['id']}").json()["lesson"]["video"]
    assert kept["url"] == "https://cdn.example.com/own.webm"  # a person's link is never replaced
    algo = client.get(f"/api/courses/{rows['אלגוריתמים ומבני נתונים']['id']}").json()["lessons"]
    assert algo[0]["video"]["provider"] == "direct" and algo[0]["video"]["trackable"] is True
    assert algo[0]["video"]["url"].startswith("https://cdn.cs50.net/")
