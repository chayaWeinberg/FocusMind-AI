"""Account isolation (broken object-level authorization / IDOR) against a real
MongoDB: user B, signed in with a valid session, tries every private object of
user A by its id, with every HTTP method the API offers, and must get a
404 that reveals nothing. A's data must be unchanged and B's own lists empty.
Complements test_users_cannot_access_each_others_private_courses."""

from fastapi.testclient import TestClient

from app.services.auth import ACCESS_TOKEN_COOKIE
from tests.integration.test_courses_mongo import add_lesson, client, create_course, env, fake_video, sign_in, upload  # noqa: F401
from tests.integration.test_learning_mongo import look_away_session

VIDEO = "https://cdn.example.com/media/lesson.mp4"


def build_private_world(client: TestClient) -> dict:
    """User A: a private course with an uploaded video and a linked lesson, progress,
    a learning session with attention segments, ReplayAI items, a bookmark, a quiz with
    an attempt, a study goal and preferences."""
    sign_in(client, "alice")
    course = create_course(client, "Alice private course")
    uploaded = add_lesson(client, course["id"], "Uploaded lesson")
    stream = upload(client, uploaded["id"], fake_video()).json()["video"]["url"]
    lesson = add_lesson(client, course["id"], "Linked lesson", externalUrl=VIDEO, durationSeconds=300)
    client.put(f"/api/lessons/{lesson['id']}/progress", json={"positionSeconds": 120, "durationSeconds": 300})
    session_id = look_away_session(client, lesson["id"], at=60)
    [suggestion] = client.get(f"/api/lessons/{lesson['id']}/replay").json()["items"]
    bookmark = client.post(f"/api/lessons/{lesson['id']}/bookmarks", json={"startSeconds": 30, "note": "secret note"}).json()
    question = client.post(f"/api/lessons/{lesson['id']}/quiz/questions", json={
        "prompt": "Alice's question", "options": ["a", "b"], "correctIndex": 0,
    }).json()
    client.post(f"/api/lessons/{lesson['id']}/quiz/attempts", json={"answers": [{"questionId": question["id"], "choice": 0}]})
    assert client.put("/api/study/goal", json={"courseId": course["id"], "sessionMinutes": 30}).status_code == 200
    client.put("/api/me/preferences", json={"studyMinutes": 50, "breakMinutes": 10, "breakReminders": False})
    me = client.get("/api/auth/me").json()
    return {
        "user": me, "token": client.cookies.get(ACCESS_TOKEN_COOKIE), "course": course, "uploaded": uploaded,
        "lesson": lesson, "stream": stream, "session": session_id, "suggestion": suggestion, "bookmark": bookmark,
        "question": question,
    }


def test_another_account_cannot_reach_any_private_object(client: TestClient) -> None:
    a = build_private_world(client)
    course, lesson, session = a["course"]["id"], a["lesson"]["id"], a["session"]
    segment = {"seq": 9, "sessionStartMs": 0, "sessionEndMs": 1000, "videoStart": 0, "videoEnd": 1,
               "playbackRate": 1, "state": "OFF_SCREEN", "durationMs": 1000}

    sign_in(client, "bob")
    attempts = [
        # courses and lessons
        ("GET", f"/api/courses/{course}", None),
        ("GET", f"/api/courses/{course}/progress", None),
        ("GET", f"/api/courses/{course}/learning-summary", None),
        ("POST", f"/api/courses/{course}/enroll", None),
        ("PUT", f"/api/courses/{course}/lessons/order", {"lessonIds": [lesson, a["uploaded"]["id"]]}),
        ("PATCH", f"/api/courses/{course}", {"title": "Hijacked"}),
        ("DELETE", f"/api/courses/{course}", None),
        ("GET", f"/api/lessons/{lesson}", None),
        ("PATCH", f"/api/lessons/{lesson}", {"title": "Hijacked"}),
        ("PUT", f"/api/lessons/{lesson}/video-url", {"url": "https://cdn.example.com/other.mp4"}),
        ("DELETE", f"/api/lessons/{a['uploaded']['id']}/video", None),
        ("GET", a["stream"], None),
        ("GET", f"/api/lessons/{lesson}/progress", None),
        ("PUT", f"/api/lessons/{lesson}/progress", {"positionSeconds": 1, "durationSeconds": 300}),
        ("POST", f"/api/lessons/{lesson}/complete", None),
        # learning sessions and attention events
        ("GET", f"/api/learning-sessions/{session}", None),
        ("POST", f"/api/learning-sessions/{session}/segments", {"segments": [segment]}),
        ("POST", f"/api/learning-sessions/{session}/heartbeat", {"activeMs": 1, "breakMs": 0}),
        ("POST", f"/api/learning-sessions/{session}/end", {"activeMs": 1, "breakMs": 0}),
        ("POST", "/api/learning-sessions", {"lessonId": lesson}),
        # ReplayAI and bookmarks
        ("GET", f"/api/lessons/{lesson}/replay", None),
        ("POST", f"/api/lessons/{lesson}/bookmarks", {"startSeconds": 5}),
        ("PATCH", f"/api/replay/{a['suggestion']['id']}", {"status": "reviewed"}),
        ("PATCH", f"/api/replay/{a['bookmark']['id']}", {"status": "reviewed"}),
        ("DELETE", f"/api/replay/{a['bookmark']['id']}", None),
        # quizzes
        ("GET", f"/api/lessons/{lesson}/quiz", None),
        ("GET", f"/api/lessons/{lesson}/quiz/attempts", None),
        ("POST", f"/api/lessons/{lesson}/quiz/questions", {"prompt": "Injected", "options": ["x", "y"], "correctIndex": 0}),
        ("POST", f"/api/lessons/{lesson}/quiz/attempts", {"answers": [{"questionId": a["question"]["id"], "choice": 0}]}),
        ("DELETE", f"/api/quiz/questions/{a['question']['id']}", None),
        # study plan for someone else's course
        ("PUT", "/api/study/goal", {"courseId": course, "sessionMinutes": 30}),
    ]
    for method, path, body in attempts:
        response = client.request(method, path, **({"json": body} if body is not None else {}))
        assert response.status_code == 404, (method, path, response.status_code, response.text)
        # Nothing of A's data leaks in the error body.
        assert "Alice" not in response.text and "secret" not in response.text

    # Upload into A's lesson is refused too.
    assert upload(client, a["uploaded"]["id"], fake_video()).status_code == 404

    # B's own views contain nothing of A, whatever ids the browser adds.
    for path in ("/api/courses/mine", "/api/replay", "/api/learning-sessions"):
        assert client.get(path, params={"userId": a["user"]["id"], "ownerId": a["user"]["id"]}).json() in ([], {"items": []}), path
    insights = client.get("/api/insights", params={"userId": a["user"]["id"]}).json()
    assert "Alice" not in str(insights) and "Linked lesson" not in str(insights)
    assert client.get("/api/study/goal").json() is None
    assert client.get("/api/me/preferences").json()["studyMinutes"] == 25
    summary = client.get("/api/privacy/summary").json()
    assert "Alice" not in str(summary)
    # B deleting "all learning data" only deletes B's.
    assert client.request("DELETE", "/api/privacy/learning-data", json={"scope": "all", "includeBookmarks": True, "includeQuizzes": True}).status_code in (200, 204)
    assert client.get("/api/auth/me").json()["email"] == "bob@example.com"

    # A's data is untouched.
    client.cookies.clear()
    client.cookies.set(ACCESS_TOKEN_COOKIE, a["token"], path="/api")
    assert client.get(f"/api/courses/{course}").json()["title"] == "Alice private course"
    assert client.get(f"/api/lessons/{lesson}/progress").json()["positionSeconds"] == 120
    items = {item["id"]: item for item in client.get(f"/api/lessons/{lesson}/replay").json()["items"]}
    assert items[a["suggestion"]["id"]]["status"] == "new"
    assert items[a["bookmark"]["id"]]["note"] == "secret note"
    assert len(client.get(f"/api/lessons/{lesson}/quiz").json()["questions"]) == 1
    assert client.get(f"/api/learning-sessions/{session}").status_code == 200
    assert client.get("/api/study/goal").json()["courseId"] == course
    assert client.get("/api/me/preferences").json()["studyMinutes"] == 50
    assert client.get(a["stream"]).status_code == 200


def test_shared_catalog_lessons_keep_progress_and_replay_per_account(client: TestClient) -> None:
    """Both users learn the same public catalog lesson: each sees only their own data."""
    sign_in(client, "alice")
    catalog = client.get("/api/courses/catalog").json()
    course = next(entry for entry in catalog if entry["externalLibrary"])  # lessons with a video link
    client.post(f"/api/courses/{course['id']}/enroll")
    lesson = client.get(f"/api/courses/{course['id']}").json()["lessons"][0]
    client.put(f"/api/lessons/{lesson['id']}/progress", json={"positionSeconds": 50, "durationSeconds": 90})
    bookmark = client.post(f"/api/lessons/{lesson['id']}/bookmarks", json={"startSeconds": 20, "note": "alice only"})
    alice_session = client.post("/api/learning-sessions", json={"lessonId": lesson["id"]}).json()["id"]

    sign_in(client, "bob")
    # Public content stays public: browsing the catalog course works without enrolling...
    assert client.get(f"/api/courses/{course['id']}").status_code == 200
    # ...but learning it needs enrollment, and nothing of Alice's shows up.
    client.post(f"/api/courses/{course['id']}/enroll")
    assert client.get(f"/api/lessons/{lesson['id']}/progress").json()["positionSeconds"] == 0
    replay = client.get(f"/api/lessons/{lesson['id']}/replay").json()
    assert replay["items"] == []
    if bookmark.status_code == 201:
        assert client.request("PATCH", f"/api/replay/{bookmark.json()['id']}", json={"status": "reviewed"}).status_code == 404
    assert client.get(f"/api/learning-sessions/{alice_session}").status_code == 404
    details = client.get(f"/api/courses/{course['id']}").json()
    assert all((entry.get("progress") or {}).get("positionSeconds", 0) == 0 for entry in details["lessons"])


def test_learners_cannot_use_admin_powers_directly(client: TestClient) -> None:
    sign_in(client, "mallory")
    seeded = client.get("/api/courses/catalog").json()[0]
    seeded_lesson = client.get(f"/api/courses/{seeded['id']}").json()["lessons"][0]
    for method, path, body in [
        ("GET", "/api/admin/catalog", None),
        ("POST", "/api/admin/catalog", {"title": "Fake course"}),
        ("PATCH", f"/api/courses/{seeded['id']}", {"status": "draft"}),
        ("PATCH", f"/api/courses/{seeded['id']}", {"title": "Defaced"}),
        ("DELETE", f"/api/courses/{seeded['id']}", None),
        ("POST", f"/api/courses/{seeded['id']}/lessons", {"title": "Injected"}),
        ("PATCH", f"/api/lessons/{seeded_lesson['id']}", {"title": "Defaced"}),
        ("DELETE", f"/api/lessons/{seeded_lesson['id']}", None),
        ("PUT", f"/api/lessons/{seeded_lesson['id']}/video-url", {"url": "https://cdn.example.com/x.mp4"}),
        ("DELETE", f"/api/lessons/{seeded_lesson['id']}/video", None),
    ]:
        response = client.request(method, path, **({"json": body} if body is not None else {}))
        assert response.status_code in (403, 404), (method, path, response.status_code)
    # The role cannot be self-assigned through any request field.
    registration = client.post("/api/auth/register", json={
        "displayName": "Eve", "email": "eve@example.com", "password": "pass-word-123",
        "confirmPassword": "pass-word-123", "role": "content_manager",
    })
    assert registration.status_code == 422  # unknown fields are refused outright
    sign_in(client, "eve")
    assert client.patch("/api/courses/" + seeded["id"], json={"role": "content_manager"}).status_code in (403, 422)
    assert client.get("/api/auth/me").json()["role"] == "learner"
    assert client.get("/api/courses/catalog").json()[0]["title"] == seeded["title"]
