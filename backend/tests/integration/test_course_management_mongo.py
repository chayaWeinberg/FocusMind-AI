"""Course management against a real MongoDB: the retired demonstration courses,
leaving a catalog course (unenroll) and deleting one's own course."""

from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.seed.catalog import RETIRED_COURSE_SLUGS, seed_catalog
from app.services.auth import ACCESS_TOKEN_COOKIE
from tests.integration.test_courses_mongo import add_lesson, client, create_course, env, fake_video, sign_in, stored_files, upload  # noqa: F401
from tests.integration.test_learning_mongo import db_call, grant_manager, look_away_session

VIDEO = "https://cdn.example.com/media/lesson.mp4"


async def _old_demo_course(db, user_id):
    """A database from before the retirement: a demo course with a learner's data."""
    now = datetime.now(timezone.utc)
    course_id = (await db.courses.insert_one({
        "slug": RETIRED_COURSE_SLUGS[1], "title": "יסודות SQL", "type": "catalog", "status": "published",
        "owner_id": None, "demo_lab": True, "category": "נתונים", "description": "", "created_at": now, "updated_at": now,
    })).inserted_id
    lesson_id = (await db.lessons.insert_one({
        "course_id": course_id, "seed_key": "select", "title": "SELECT", "order": 0, "duration_seconds": 90,
        "video": {"source_type": "external", "provider": "direct", "url": VIDEO}, "created_at": now, "updated_at": now,
    })).inserted_id
    await db.enrollments.insert_one({"user_id": user_id, "course_id": course_id, "enrolled_at": now})
    await db.lesson_progress.insert_one({"user_id": user_id, "course_id": course_id, "lesson_id": lesson_id,
                                         "position_seconds": 40, "duration_seconds": 90, "completed": False, "updated_at": now})
    return course_id, lesson_id


def test_retired_demo_courses_are_hidden_kept_and_never_recreated(client: TestClient, env: dict) -> None:
    sign_in(client, "ada")
    from bson import ObjectId
    user_id = ObjectId(client.get("/api/auth/me").json()["id"])
    course_id, lesson_id = db_call(env, lambda db: _old_demo_course(db, user_id))
    assert client.get("/api/courses/mine").json()[0]["title"] == "יסודות SQL"  # visible before the retirement

    db_call(env, seed_catalog)  # what startup does
    titles = [course["title"] for course in client.get("/api/courses/catalog").json()]
    assert "יסודות SQL" not in titles and len(titles) == 15
    assert client.get("/api/courses/mine").json() == []
    assert client.get(f"/api/courses/{course_id}").status_code == 404
    assert client.get(f"/api/lessons/{lesson_id}").status_code == 404
    assert client.post(f"/api/courses/{course_id}/enroll").status_code == 404
    # No course of the old seed exists other than the retired copy.
    for slug in RETIRED_COURSE_SLUGS:
        assert db_call(env, lambda db, slug=slug: db.courses.count_documents({"slug": slug, "retired": {"$ne": True}})) == 0

    # Nothing was deleted: the learner's history is still stored (reversible).
    stored = db_call(env, lambda db: db.courses.find_one({"_id": course_id}))
    assert stored["retired"] is True
    assert db_call(env, lambda db: db.enrollments.count_documents({"course_id": course_id})) == 1
    assert db_call(env, lambda db: db.lesson_progress.count_documents({"lesson_id": lesson_id})) == 1

    # Restart: startup seeds again. Still hidden, still not recreated.
    db_call(env, seed_catalog)
    assert "יסודות SQL" not in [course["title"] for course in client.get("/api/courses/catalog").json()]
    assert db_call(env, lambda db: db.courses.count_documents({"slug": RETIRED_COURSE_SLUGS[1]})) == 1

    # Content managers do not see it either; unsetting the flag would restore it.
    sign_in(client, "editor")
    grant_manager(env, "editor")
    client.cookies.clear()
    client.post("/api/auth/login", json={"email": "editor@example.com", "password": "correct horse battery staple"})
    assert "יסודות SQL" not in [row["title"] for row in client.get("/api/admin/catalog").json()]
    db_call(env, lambda db: db.courses.update_one({"_id": course_id}, {"$unset": {"retired": ""}}))
    assert "יסודות SQL" in [row["title"] for row in client.get("/api/admin/catalog").json()]


def test_leaving_a_catalog_course_keeps_history_and_allows_enrolling_again(client: TestClient, env: dict) -> None:
    sign_in(client, "ada")
    catalog = {row["title"]: row for row in client.get("/api/courses/catalog").json()}
    course = catalog["SQL לניתוח נתונים"]
    assert client.post(f"/api/courses/{course['id']}/enroll").status_code == 201
    lesson = client.get(f"/api/courses/{course['id']}").json()["lessons"][0]
    # Give the lesson a playable link so progress and ReplayAI can be recorded (test setup).
    db_call(env, lambda db: db.lessons.update_one({"_id": __import__("bson").ObjectId(lesson["id"])},
                                                   {"$set": {"video": {"source_type": "external", "provider": "direct", "url": VIDEO}, "duration_seconds": 300}}))
    client.put(f"/api/lessons/{lesson['id']}/progress", json={"positionSeconds": 75, "durationSeconds": 300})
    look_away_session(client, lesson["id"], at=60)
    assert client.get("/api/replay").json() != []
    client.put("/api/study/goal", json={"courseId": course["id"], "sessionMinutes": 20})
    sign_in(client, "grace")
    assert client.post(f"/api/courses/{course['id']}/enroll").status_code == 201

    # Ada leaves the course.
    sign_in(client, "ada")
    assert client.request("DELETE", f"/api/courses/{course['id']}/enroll").status_code == 204
    assert client.get("/api/courses/mine").json() == []
    assert course["title"] in [row["title"] for row in client.get("/api/courses/catalog").json()]  # still in the catalog
    assert client.get(f"/api/courses/{course['id']}").json()["enrolled"] is False
    # Learning needs enrollment again; the learner's own history stays readable.
    assert client.put(f"/api/lessons/{lesson['id']}/progress", json={"positionSeconds": 80, "durationSeconds": 300}).status_code == 403
    assert client.post("/api/learning-sessions", json={"lessonId": lesson["id"]}).status_code == 403
    assert client.get("/api/replay").json() == []  # hidden while not enrolled
    assert client.get("/api/study/goal").json() is None  # the goal for this course is gone
    assert client.request("DELETE", f"/api/courses/{course['id']}/enroll").status_code == 404  # not enrolled any more
    # The course, its lessons and the other learner are untouched.
    assert len(client.get(f"/api/courses/{course['id']}").json()["lessons"]) == 3
    assert db_call(env, lambda db: db.enrollments.count_documents({"course_id": __import__("bson").ObjectId(course["id"])})) == 1

    # Enrolling again restores the private history.
    assert client.post(f"/api/courses/{course['id']}/enroll").status_code == 201
    assert client.get(f"/api/lessons/{lesson['id']}/progress").json()["positionSeconds"] == 75
    assert client.get("/api/replay").json() != []

    # Personal courses are deleted, not left; unknown ids reveal nothing.
    own = create_course(client, "Private")
    assert client.request("DELETE", f"/api/courses/{own['id']}/enroll").status_code == 409
    assert client.request("DELETE", "/api/courses/000000000000000000000000/enroll").status_code == 404


def test_deleting_an_own_course_removes_its_data_and_nothing_else(client: TestClient, env: dict) -> None:
    sign_in(client, "grace")
    other = create_course(client, "Grace course")
    other_lesson = add_lesson(client, other["id"], "Grace lesson", externalUrl=VIDEO, durationSeconds=300)
    client.put(f"/api/lessons/{other_lesson['id']}/progress", json={"positionSeconds": 10, "durationSeconds": 300})
    grace_token = client.cookies.get(ACCESS_TOKEN_COOKIE)

    sign_in(client, "ada")
    course = create_course(client, "Ada course")
    uploaded = add_lesson(client, course["id"], "Uploaded")
    assert upload(client, uploaded["id"], fake_video()).status_code == 200
    linked = add_lesson(client, course["id"], "Linked", externalUrl=VIDEO, durationSeconds=300)
    client.put(f"/api/lessons/{linked['id']}/progress", json={"positionSeconds": 30, "durationSeconds": 300})
    look_away_session(client, linked["id"], at=60)
    client.post(f"/api/lessons/{linked['id']}/bookmarks", json={"startSeconds": 5})
    question = client.post(f"/api/lessons/{linked['id']}/quiz/questions", json={"prompt": "What does JOIN do?", "options": ["joins", "deletes"], "correctIndex": 0}).json()
    client.post(f"/api/lessons/{linked['id']}/quiz/attempts", json={"answers": [{"questionId": question["id"], "choice": 0}]})
    client.put("/api/study/goal", json={"courseId": course["id"], "sessionMinutes": 20})
    assert len(stored_files(env["storage"])) == 1

    # Not allowed: someone else's course, an Academy course.
    assert client.delete(f"/api/courses/{other['id']}").status_code == 404
    academy = next(row for row in client.get("/api/courses/catalog").json() if row["academy"])
    assert client.delete(f"/api/courses/{academy['id']}").status_code == 403

    assert client.delete(f"/api/courses/{course['id']}").status_code == 204
    assert client.delete(f"/api/courses/{course['id']}").status_code == 404  # a repeated request does nothing
    assert client.get("/api/courses/mine").json() == []
    assert client.get(f"/api/lessons/{linked['id']}").status_code == 404
    from bson import ObjectId
    oid = ObjectId(course["id"])
    lesson_ids = [ObjectId(uploaded["id"]), ObjectId(linked["id"])]

    async def leftovers(db):
        return {
            "lessons": await db.lessons.count_documents({"course_id": oid}),
            "progress": await db.lesson_progress.count_documents({"lesson_id": {"$in": lesson_ids}}),
            "sessions": await db.learning_sessions.count_documents({"course_id": oid}),
            "segments": await db.attention_segments.count_documents({"lesson_id": {"$in": lesson_ids}}),
            "replay": await db.replay_items.count_documents({"lesson_id": {"$in": lesson_ids}}),
            "questions": await db.quiz_questions.count_documents({"lesson_id": {"$in": lesson_ids}}),
            "attempts": await db.quiz_attempts.count_documents({"lesson_id": {"$in": lesson_ids}}),
            "goals": await db.study_goals.count_documents({"course_id": oid}),
        }

    assert db_call(env, leftovers) == dict.fromkeys(
        ["lessons", "progress", "sessions", "segments", "replay", "questions", "attempts", "goals"], 0)
    assert stored_files(env["storage"]) == []  # the uploaded file is released

    # The Academy course and Grace's data are untouched.
    assert academy["title"] in [row["title"] for row in client.get("/api/courses/catalog").json()]
    client.cookies.clear()
    client.cookies.set(ACCESS_TOKEN_COOKIE, grace_token, path="/api")
    assert client.get(f"/api/courses/{other['id']}").json()["title"] == "Grace course"
    assert client.get(f"/api/lessons/{other_lesson['id']}/progress").json()["positionSeconds"] == 10
