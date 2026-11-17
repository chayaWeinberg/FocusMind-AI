"""ReplayAI, Smart Timer, FocusInsights, FocusCoach, AdaptiveStudy, QuizFlow,
catalog administration and privacy against a real MongoDB (throwaway
database, see the fixtures in test_courses_mongo)."""

import asyncio
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from fastapi.testclient import TestClient
from pymongo import AsyncMongoClient

from app.core.config import settings
from tests.integration.test_courses_mongo import add_lesson, client, create_course, env, sign_in  # noqa: F401

VIDEO = "https://cdn.example.com/media/lesson.mp4"


def segment(seq: int, state: str, video_start: float, seconds: float, session_start_ms: int, rate: float = 1.0) -> dict:
    return {
        "seq": seq, "sessionStartMs": session_start_ms, "sessionEndMs": session_start_ms + int(seconds * 1000),
        "videoStart": video_start, "videoEnd": round(video_start + seconds * rate, 3), "playbackRate": rate,
        "state": state, "durationMs": int(seconds * 1000),
    }


def look_away_session(client: TestClient, lesson_id: str, at: float = 30, seconds: float = 6, active_ms: int = 60_000) -> str:
    session_id = client.post("/api/learning-sessions", json={"lessonId": lesson_id}).json()["id"]
    segments = [
        segment(0, "ON_SCREEN", 0, at, 0),
        segment(1, "OFF_SCREEN", at, seconds, int(at * 1000)),
        segment(2, "ON_SCREEN", at + seconds, 20, int((at + seconds) * 1000)),
    ]
    assert client.post(f"/api/learning-sessions/{session_id}/segments", json={"segments": segments}).json() == {"accepted": 3}
    ended = client.post(f"/api/learning-sessions/{session_id}/end", json={"activeMs": active_ms, "breakMs": 0})
    assert ended.status_code == 200
    return session_id


def db_call(env: dict, action):
    async def run():
        mongo = AsyncMongoClient(settings.mongo_uri)
        try:
            return await action(mongo[env["database"]])
        finally:
            await mongo.close()

    return asyncio.run(run())


def lesson_with_video(client: TestClient, title: str = "Lesson", course_title: str = "My course") -> tuple[dict, dict]:
    course = create_course(client, course_title)
    lesson = add_lesson(client, course["id"], title, externalUrl=VIDEO, durationSeconds=300)
    return course, lesson


# --- ReplayAI --------------------------------------------------------------------


def test_replay_suggestions_are_generated_from_video_time_and_persist(client: TestClient, env: dict) -> None:
    sign_in(client, "ada")
    course, lesson = lesson_with_video(client)
    empty = client.get(f"/api/lessons/{lesson['id']}/replay").json()
    assert empty["trackable"] and empty["items"] == [] and empty["analyzedSegments"] == 0

    look_away_session(client, lesson["id"], at=120, seconds=6)
    replay = client.get(f"/api/lessons/{lesson['id']}/replay").json()
    [item] = replay["items"]
    assert item["kind"] == "auto" and item["status"] == "new"
    assert (item["startSeconds"], item["endSeconds"]) == (115, 129)  # 120-126 s plus context
    assert item["reasons"] == {"sustained_off_screen": 1}
    assert item["offScreenSeconds"] == 6.0
    assert replay["rules"]["sustainedOffScreenSeconds"] == 4.0

    # Survives logout/login (stored in MongoDB, not recomputed into duplicates).
    client.post("/api/auth/logout")
    client.cookies.clear()
    sign_in(client, "ada")
    again = client.get(f"/api/lessons/{lesson['id']}/replay").json()["items"]
    assert [entry["id"] for entry in again] == [item["id"]]

    # Overview across lessons with titles.
    overview = client.get("/api/replay", params={"status": "pending"}).json()
    assert [(entry["id"], entry["lessonTitle"], entry["courseTitle"]) for entry in overview] == [(item["id"], "Lesson", "My course")]


def test_review_status_survives_recomputation_and_reopens_only_with_new_evidence(client: TestClient, env: dict) -> None:
    sign_in(client, "ada")
    _, lesson = lesson_with_video(client)
    look_away_session(client, lesson["id"], at=60)
    [item] = client.get(f"/api/lessons/{lesson['id']}/replay").json()["items"]

    reviewed = client.patch(f"/api/replay/{item['id']}", json={"status": "reviewed"}).json()
    assert reviewed["status"] == "reviewed" and reviewed["reviewedAt"]

    # Forcing a recomputation (rules unchanged) keeps the same item and status.
    db_call(env, lambda db: db.replay_meta.delete_many({}))
    [same] = client.get(f"/api/lessons/{lesson['id']}/replay").json()["items"]
    assert same["id"] == item["id"] and same["status"] == "reviewed"

    # A later session with a new look-away in the same range reopens it.
    look_away_session(client, lesson["id"], at=61)
    [reopened] = client.get(f"/api/lessons/{lesson['id']}/replay").json()["items"]
    assert reopened["id"] == item["id"] and reopened["status"] == "new" and reopened["reopened"]
    assert reopened["sessionCount"] == 2 and reopened["reasons"] == {"sustained_off_screen": 2}

    # Dismissed stays dismissed even with more evidence.
    client.patch(f"/api/replay/{item['id']}", json={"status": "dismissed"})
    look_away_session(client, lesson["id"], at=62)
    [dismissed] = client.get(f"/api/lessons/{lesson['id']}/replay").json()["items"]
    assert dismissed["status"] == "dismissed"


def test_bookmarks_are_separate_from_suggestions(client: TestClient) -> None:
    sign_in(client, "ada")
    _, lesson = lesson_with_video(client)
    point = client.post(f"/api/lessons/{lesson['id']}/bookmarks", json={"startSeconds": 42, "note": "נוסחה חשובה"})
    assert point.status_code == 201
    assert point.json()["kind"] == "bookmark" and point.json()["endSeconds"] is None
    span = client.post(f"/api/lessons/{lesson['id']}/bookmarks", json={"startSeconds": 100, "endSeconds": 900}).json()
    assert span["endSeconds"] == 300  # clamped to the lesson duration
    assert client.post(f"/api/lessons/{lesson['id']}/bookmarks", json={"startSeconds": 50, "endSeconds": 40}).status_code == 422

    assert client.patch(f"/api/replay/{span['id']}", json={"status": "dismissed"}).status_code == 409
    assert client.patch(f"/api/replay/{span['id']}", json={"status": "reviewed"}).json()["status"] == "reviewed"
    assert client.delete(f"/api/replay/{span['id']}").status_code == 204
    items = client.get(f"/api/lessons/{lesson['id']}/replay").json()["items"]
    assert [entry["kind"] for entry in items] == ["bookmark"]

    look_away_session(client, lesson["id"], at=150)
    [suggestion] = [entry for entry in client.get(f"/api/lessons/{lesson['id']}/replay").json()["items"] if entry["kind"] == "auto"]
    assert client.delete(f"/api/replay/{suggestion['id']}").status_code == 409  # dismissed, not deleted


def test_youtube_lessons_get_no_invented_timestamps(client: TestClient) -> None:
    sign_in(client, "ada")
    course = create_course(client)
    lesson = add_lesson(client, course["id"], "YouTube", externalUrl="https://youtu.be/dQw4w9WgXcQ")
    replay = client.get(f"/api/lessons/{lesson['id']}/replay").json()
    assert replay["trackable"] is False and replay["items"] == []
    assert client.post(f"/api/lessons/{lesson['id']}/bookmarks", json={"startSeconds": 5}).status_code == 409
    # Timer-only session: time is kept, segments are refused.
    session = client.post("/api/learning-sessions", json={"lessonId": lesson["id"]}).json()
    assert session["trackable"] is False
    rejected = client.post(f"/api/learning-sessions/{session['id']}/segments", json={"segments": [segment(0, "OFF_SCREEN", 0, 9, 0)]})
    assert rejected.status_code == 409
    assert client.post(f"/api/learning-sessions/{session['id']}/end", json={"activeMs": 120_000}).json()["activeMs"] == 120_000


def test_replay_items_are_private(client: TestClient) -> None:
    sign_in(client, "ada")
    _, lesson = lesson_with_video(client)
    look_away_session(client, lesson["id"])
    [item] = client.get(f"/api/lessons/{lesson['id']}/replay").json()["items"]
    sign_in(client, "grace")
    assert client.get(f"/api/lessons/{lesson['id']}/replay").status_code == 404
    assert client.patch(f"/api/replay/{item['id']}", json={"status": "reviewed"}).status_code == 404
    assert client.delete(f"/api/replay/{item['id']}").status_code == 404
    assert client.get("/api/replay").json() == []
    client.cookies.clear()
    assert client.get("/api/replay").status_code == 401


# --- Smart Timer -----------------------------------------------------------------


def test_heartbeat_keeps_time_of_interrupted_sessions_and_history(client: TestClient, env: dict) -> None:
    sign_in(client, "ada")
    _, lesson = lesson_with_video(client, "Timer lesson")
    session_id = client.post("/api/learning-sessions", json={"lessonId": lesson["id"]}).json()["id"]
    assert client.post(f"/api/learning-sessions/{session_id}/heartbeat", json={"activeMs": 90_000, "breakMs": 30_000}).status_code == 200
    # A late heartbeat never lowers the stored time.
    late = client.post(f"/api/learning-sessions/{session_id}/heartbeat", json={"activeMs": 10_000, "breakMs": 0}).json()
    assert late["activeMs"] == 90_000 and late["breakMs"] == 30_000

    [active] = client.get("/api/learning-sessions").json()
    assert active["status"] == "active" and active["lessonTitle"] == "Timer lesson"

    # The tab was closed: no end, heartbeat 20 minutes ago.
    db_call(env, lambda db: db.learning_sessions.update_one(
        {"_id": ObjectId(session_id)}, {"$set": {"last_seen_at": datetime.now(timezone.utc) - timedelta(minutes=20)}}
    ))
    [interrupted] = client.get("/api/learning-sessions").json()
    assert interrupted["status"] == "interrupted" and interrupted["activeMs"] == 90_000

    sign_in(client, "grace")
    assert client.get("/api/learning-sessions").json() == []
    assert client.post(f"/api/learning-sessions/{session_id}/heartbeat", json={"activeMs": 1}).status_code == 404


def test_preferences_defaults_validation_and_persistence(client: TestClient) -> None:
    sign_in(client, "ada")
    assert client.get("/api/me/preferences").json() == {"studyMinutes": 25, "breakMinutes": 5, "breakReminders": True}
    saved = client.put("/api/me/preferences", json={"studyMinutes": 45, "breakMinutes": 10, "breakReminders": False})
    assert saved.json() == {"studyMinutes": 45, "breakMinutes": 10, "breakReminders": False}
    assert client.put("/api/me/preferences", json={"studyMinutes": 1, "breakMinutes": 10, "breakReminders": True}).status_code == 422
    assert client.get("/api/me/preferences").json()["studyMinutes"] == 45


# --- FocusInsights & FocusCoach --------------------------------------------------


def test_insights_use_real_data_and_the_learner_timezone(client: TestClient, env: dict) -> None:
    sign_in(client, "ada")
    empty = client.get("/api/insights").json()
    assert empty["totals"]["activeMs"] == 0 and empty["totals"]["sessionCount"] == 0
    assert all(day["activeMs"] == 0 for day in empty["daily"]) and len(empty["daily"]) == 14
    assert empty["streak"] == {"current": 0, "longest": 0, "activeToday": False}
    assert empty["quizzes"]["averagePercent"] is None

    course, lesson = lesson_with_video(client, course_title="Algebra")
    look_away_session(client, lesson["id"], at=30, seconds=6, active_ms=180_000)
    client.put(f"/api/lessons/{lesson['id']}/progress", json={"positionSeconds": 300, "durationSeconds": 300, "ended": True})

    # Yesterday's session (moved back in time) for the streak.
    yesterday = datetime.now(timezone.utc) - timedelta(days=1)
    second = look_away_session(client, lesson["id"], at=200, seconds=1, active_ms=120_000)
    db_call(env, lambda db: db.learning_sessions.update_one({"_id": ObjectId(second)}, {"$set": {"started_at": yesterday}}))

    data = client.get("/api/insights", params={"tzOffsetMinutes": -120}).json()
    assert data["totals"]["activeMs"] == 300_000 and data["totals"]["sessionCount"] == 2
    assert data["totals"]["lessonsCompleted"] == 1
    assert data["daily"][-1]["activeMs"] == 180_000 and data["daily"][-2]["activeMs"] == 120_000
    assert data["streak"] == {"current": 2, "longest": 2, "activeToday": True}
    assert data["attention"]["OFF_SCREEN"] == 7_000 and data["attention"]["ON_SCREEN"] == 270_000
    assert data["attention"]["UNCERTAIN"] == 0 and data["attention"]["NOT_MEASURED"] == 0
    assert data["byCourse"][0] == {
        "courseId": course["id"], "title": "Algebra", "type": "personal", "activeMs": 300_000,
        "completedLessons": 1, "totalLessons": 1, "percent": 100,
    }
    assert data["replay"]["suggested"] == 1 and data["replay"]["pending"] == 1
    assert len(data["recentSessions"]) == 2 and data["recentSessions"][0]["videoSeconds"] > 0

    sign_in(client, "grace")
    assert client.get("/api/insights").json()["totals"]["activeMs"] == 0


def test_coach_tips_are_explained_by_stored_evidence(client: TestClient) -> None:
    sign_in(client, "ada")
    assert [tip["kind"] for tip in client.get("/api/coach").json()] == ["start_learning"]

    course = create_course(client, "Physics")
    first = add_lesson(client, course["id"], "Forces", externalUrl=VIDEO, durationSeconds=300)
    second = add_lesson(client, course["id"], "Energy", externalUrl=VIDEO, durationSeconds=300)
    look_away_session(client, first["id"], at=40)
    client.put(f"/api/lessons/{first['id']}/progress", json={"positionSeconds": 300, "durationSeconds": 300, "ended": True})
    client.put(f"/api/lessons/{second['id']}/progress", json={"positionSeconds": 90, "durationSeconds": 300})

    tips = client.get("/api/coach").json()
    kinds = [tip["kind"] for tip in tips]
    assert kinds[:2] == ["review_before_next", "continue_lesson"]
    review = tips[0]
    assert review["lessonId"] == first["id"] and review["evidence"]["count"] == 1
    assert review["evidence"]["nextLessonTitle"] == "Energy"
    assert tips[1]["lessonId"] == second["id"] and tips[1]["evidence"]["positionSeconds"] == 90


# --- AdaptiveStudy --------------------------------------------------------------


def test_study_goal_and_plan_fit_the_available_time(client: TestClient) -> None:
    sign_in(client, "ada")
    assert client.get("/api/study/goal").json() is None
    assert client.get("/api/study/plan").json()["suggestedSession"] is None

    course = create_course(client, "Chemistry")
    lessons = [
        add_lesson(client, course["id"], f"Lesson {index}", externalUrl=VIDEO, durationSeconds=600) for index in range(1, 5)
    ]
    add_lesson(client, course["id"], "Reading", durationSeconds=None)
    look_away_session(client, lessons[0]["id"], at=100)
    client.put(f"/api/lessons/{lessons[0]['id']}/progress", json={"positionSeconds": 240, "durationSeconds": 600})

    target = (datetime.now(timezone.utc) + timedelta(days=14)).date().isoformat()
    goal = client.put("/api/study/goal", json={
        "courseId": course["id"], "sessionMinutes": 20, "weeklyMinutes": 120, "targetDate": target,
    })
    assert goal.status_code == 200 and goal.json()["courseTitle"] == "Chemistry"

    plan = client.get("/api/study/plan").json()
    steps = plan["suggestedSession"]["steps"]
    assert [step["type"] for step in steps] == ["replay", "continue", "lesson"]
    assert steps[1]["seconds"] == 360 and steps[1]["startSeconds"] == 240
    assert plan["suggestedSession"]["plannedSeconds"] <= 20 * 60
    assert plan["progress"]["totalLessons"] == 5 and plan["progress"]["daysLeft"] in (13, 14, 15)
    assert plan["progress"]["weeklyTargetMinutes"] == 120 and plan["progress"]["weeklyDoneMinutes"] == 1
    assert [lesson["title"] for lesson in plan["unfinishedLessons"]][-1] == "Reading"
    assert plan["unfinishedLessons"][-1]["hasVideo"] is False

    assert client.put("/api/study/goal", json={"courseId": course["id"], "sessionMinutes": 2}).status_code == 422
    sign_in(client, "grace")
    assert client.put("/api/study/goal", json={"courseId": course["id"], "sessionMinutes": 30}).status_code == 404


# --- QuizFlow -------------------------------------------------------------------


def test_quiz_questions_attempts_and_privacy(client: TestClient) -> None:
    sign_in(client, "ada")
    _, lesson = lesson_with_video(client)
    question = client.post(f"/api/lessons/{lesson['id']}/quiz/questions", json={
        "prompt": "כמה זה 2+2?", "options": ["3", "4", "5"], "correctIndex": 1, "explanation": "חיבור פשוט",
    })
    assert question.status_code == 201 and question.json()["correctIndex"] == 1
    second = client.post(f"/api/lessons/{lesson['id']}/quiz/questions", json={
        "prompt": "מה הצבע של השמיים?", "options": ["כחול", "ירוק"], "correctIndex": 0,
    }).json()
    bad = {"prompt": "שאלה", "options": ["א", "א"], "correctIndex": 0}
    assert client.post(f"/api/lessons/{lesson['id']}/quiz/questions", json=bad).status_code == 422
    assert client.post(f"/api/lessons/{lesson['id']}/quiz/questions", json={**bad, "options": ["א", "ב"], "correctIndex": 4}).status_code == 422

    attempt = client.post(f"/api/lessons/{lesson['id']}/quiz/attempts", json={"answers": [
        {"questionId": question.json()["id"], "choice": 1}, {"questionId": second["id"], "choice": 1},
    ]})
    assert attempt.status_code == 201
    result = attempt.json()
    assert (result["score"], result["total"], result["percent"]) == (1, 2, 50)
    assert [entry["correct"] for entry in result["results"]] == [True, False]
    assert result["results"][1]["correctIndex"] == 0

    quiz = client.get(f"/api/lessons/{lesson['id']}/quiz").json()
    assert quiz["attemptCount"] == 1 and quiz["lastAttempt"]["percent"] == 50
    summary = client.get(f"/api/courses/{lesson['courseId']}/learning-summary").json()
    assert summary["lessons"][0]["questionCount"] == 2 and summary["lessons"][0]["lastQuizPercent"] == 50
    # Quizzes never block completion.
    done = client.put(f"/api/lessons/{lesson['id']}/progress", json={"positionSeconds": 300, "durationSeconds": 300, "ended": True})
    assert done.json()["completed"] is True
    assert "retry_quiz" in [tip["kind"] for tip in client.get("/api/coach").json()]

    sign_in(client, "grace")
    assert client.get(f"/api/lessons/{lesson['id']}/quiz").status_code == 404
    assert client.delete(f"/api/quiz/questions/{second['id']}").status_code == 404


# --- catalog administration ------------------------------------------------------


def grant_manager(env: dict, name: str) -> None:
    db_call(env, lambda db: db.users.update_one({"email": f"{name}@example.com"}, {"$set": {"role": "content_manager"}}))


def test_only_content_managers_manage_the_catalog(client: TestClient, env: dict) -> None:
    sign_in(client, "learner")
    assert client.get("/api/auth/me").json()["role"] == "learner"
    assert client.get("/api/admin/catalog").status_code == 403
    assert client.post("/api/admin/catalog", json={"title": "Hack"}).status_code == 403
    seeded = client.get("/api/courses/catalog").json()[0]
    assert client.patch(f"/api/courses/{seeded['id']}", json={"status": "draft"}).status_code == 403

    sign_in(client, "editor")
    grant_manager(env, "editor")
    client.cookies.clear()
    client.post("/api/auth/login", json={"email": "editor@example.com", "password": "correct horse battery staple"})
    assert client.get("/api/auth/me").json()["role"] == "content_manager"

    draft = client.post("/api/admin/catalog", json={"title": "Statistics", "category": "נתונים"}).json()
    assert draft["status"] == "draft" and draft["type"] == "catalog" and draft["canEdit"]
    lesson = add_lesson(client, draft["id"], "Mean and median", externalUrl=VIDEO)
    admin_rows = {row["title"]: row for row in client.get("/api/admin/catalog").json()}
    assert admin_rows["Statistics"]["lessonsWithoutVideo"] == 0 and admin_rows["Statistics"]["status"] == "draft"

    # Drafts are invisible to learners.
    sign_in(client, "learner")
    assert "Statistics" not in [row["title"] for row in client.get("/api/courses/catalog").json()]
    assert client.get(f"/api/courses/{draft['id']}").status_code == 404

    client.cookies.clear()
    client.post("/api/auth/login", json={"email": "editor@example.com", "password": "correct horse battery staple"})
    published = client.patch(f"/api/courses/{draft['id']}", json={"status": "published"}).json()
    assert published["status"] == "published"
    personal = create_course(client, "Mine")
    assert client.patch(f"/api/courses/{personal['id']}", json={"status": "draft"}).status_code == 422

    sign_in(client, "learner")
    assert client.post(f"/api/courses/{draft['id']}/enroll").status_code == 201
    client.put(f"/api/lessons/{lesson['id']}/progress", json={"positionSeconds": 10, "durationSeconds": 100})
    assert client.patch(f"/api/lessons/{lesson['id']}", json={"title": "x" * 5}).status_code == 403

    client.cookies.clear()
    client.post("/api/auth/login", json={"email": "editor@example.com", "password": "correct horse battery staple"})
    assert client.delete(f"/api/lessons/{lesson['id']}").status_code == 409  # learner progress exists
    assert client.delete(f"/api/courses/{draft['id']}").status_code == 409  # enrolled learners
    assert client.patch(f"/api/courses/{draft['id']}", json={"status": "draft"}).json()["status"] == "draft"


def test_seed_does_not_overwrite_a_course_a_manager_edited(client: TestClient, env: dict) -> None:
    from app.seed.catalog import seed_catalog

    sign_in(client, "editor")
    grant_manager(env, "editor")
    client.cookies.clear()
    client.post("/api/auth/login", json={"email": "editor@example.com", "password": "correct horse battery staple"})
    course = next(row for row in client.get("/api/admin/catalog").json() if row["title"] == "Python בפועל")
    client.patch(f"/api/courses/{course['id']}", json={"title": "Python - edited", "status": "draft"})

    db_call(env, lambda db: seed_catalog(db))
    rows = {row["id"]: row for row in client.get("/api/admin/catalog").json()}
    assert rows[course["id"]]["title"] == "Python - edited" and rows[course["id"]]["status"] == "draft"


# --- privacy --------------------------------------------------------------------


def test_learner_can_delete_attention_data_without_losing_progress(client: TestClient) -> None:
    sign_in(client, "ada")
    _, lesson = lesson_with_video(client)
    look_away_session(client, lesson["id"])
    client.post(f"/api/lessons/{lesson['id']}/bookmarks", json={"startSeconds": 3})
    client.put(f"/api/lessons/{lesson['id']}/progress", json={"positionSeconds": 100, "durationSeconds": 300})
    client.get(f"/api/lessons/{lesson['id']}/replay")

    summary = client.get("/api/privacy/summary").json()
    assert summary["sessions"] == 1 and summary["segments"] == 3 and summary["suggestions"] == 1 and summary["bookmarks"] == 1

    deleted = client.delete("/api/privacy/learning-data").json()
    assert deleted == {"sessions": 1, "segments": 3, "suggestions": 1, "bookmarks": 0, "quizAttempts": 0}
    after = client.get("/api/privacy/summary").json()
    assert after["sessions"] == 0 and after["segments"] == 0 and after["bookmarks"] == 1
    assert client.get(f"/api/lessons/{lesson['id']}/progress").json()["positionSeconds"] == 100
    assert [item["kind"] for item in client.get(f"/api/lessons/{lesson['id']}/replay").json()["items"]] == ["bookmark"]

    # Older-than: recent data is kept.
    look_away_session(client, lesson["id"])
    kept = client.delete("/api/privacy/learning-data", params={"olderThanDays": 30, "includeBookmarks": True}).json()
    assert kept["sessions"] == 0
