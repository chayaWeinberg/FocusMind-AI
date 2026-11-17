from collections.abc import Iterator
from datetime import datetime, timedelta, timezone
from http.cookies import SimpleCookie
from types import SimpleNamespace

import jwt
import pytest
from bson import ObjectId
from fastapi.testclient import TestClient
from pydantic import SecretStr, ValidationError

from app.api.routes import auth as auth_routes
from app.core.config import Settings, settings
from app.db import database as database_module
from app.db.database import get_db
from app.main import app
from app.schemas.auth import LoginRequest
from app.services import auth as auth_service
from app.services.auth import (
    ACCESS_TOKEN_COOKIE,
    ACCESS_TOKEN_TTL,
    JWT_ALGORITHM,
    create_access_token,
    hash_password,
)


def set_cookies(response) -> list[SimpleCookie]:
    """Parse every Set-Cookie header separately (logout sends more than one)."""
    parsed = []
    for header in response.headers.get_list("set-cookie"):
        cookie = SimpleCookie()
        cookie.load(header)
        parsed.append(cookie)
    return parsed


def session_cookie(response, path: str = auth_routes.COOKIE_PATH):
    for cookie in set_cookies(response):
        morsel = cookie.get(ACCESS_TOKEN_COOKIE)
        if morsel is not None and morsel["path"] == path:
            return morsel
    raise AssertionError(f"No {ACCESS_TOKEN_COOKIE} cookie for path {path}")


class FakeUsersCollection:
    def __init__(self) -> None:
        self.documents: list[dict] = []

    async def insert_one(self, document: dict) -> SimpleNamespace:
        stored = {**document, "_id": ObjectId()}
        self.documents.append(stored)
        return SimpleNamespace(inserted_id=stored["_id"])

    async def find_one(self, query: dict) -> dict | None:
        return next(
            (
                document
                for document in self.documents
                if all(document.get(key) == value for key, value in query.items())
            ),
            None,
        )


class FakeRevokedTokensCollection:
    def __init__(self) -> None:
        self.ids: set[str] = set()

    async def find_one(self, query: dict, projection: dict | None = None) -> dict | None:
        return {"_id": query["_id"]} if query["_id"] in self.ids else None

    async def update_one(self, query: dict, update: dict, upsert: bool = False) -> None:
        self.ids.add(query["_id"])


class FakeDatabase:
    def __init__(self) -> None:
        self.users = FakeUsersCollection()
        self.revoked_tokens = FakeRevokedTokensCollection()

    def __getitem__(self, collection_name: str):
        assert collection_name in {"users", "revoked_tokens"}
        return getattr(self, collection_name)


@pytest.fixture
def auth_client() -> Iterator[tuple[TestClient, FakeDatabase]]:
    database = FakeDatabase()

    async def fake_get_db() -> FakeDatabase:
        return database

    app.dependency_overrides[get_db] = fake_get_db
    try:
        # No "with": the lifespan (real MongoDB connection) must not run here.
        yield TestClient(app), database
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def registered_user(auth_client: tuple[TestClient, FakeDatabase]) -> dict:
    _, database = auth_client
    user = {
        "display_name": "Test User",
        "email": "user@example.com",
        "hashed_password": hash_password("password123"),
        "created_at": datetime.now(timezone.utc),
        "_id": ObjectId(),
    }
    database.users.documents.append(user)
    return user


def test_login_sets_secure_session_cookie_and_returns_safe_user(
    auth_client: tuple[TestClient, FakeDatabase],
    registered_user: dict,
) -> None:
    client, _ = auth_client
    assert registered_user["email"] == "user@example.com"
    response = client.post(
        "/api/auth/login",
        json={"email": " USER@EXAMPLE.COM ", "password": "password123"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "id": str(registered_user["_id"]),
        "displayName": "Test User",
        "email": "user@example.com",
        "role": "learner",
    }
    assert "hashed_password" not in response.text
    assert "password123" not in response.text
    assert ACCESS_TOKEN_COOKIE not in response.json()

    cookie = session_cookie(response)
    assert cookie["httponly"]
    assert cookie["samesite"].lower() == "lax"
    assert cookie["secure"] == ""
    assert cookie["max-age"] == str(int(ACCESS_TOKEN_TTL.total_seconds()))
    assert cookie["path"] == "/api"
    assert cookie.value not in response.text
    assert response.headers["cache-control"] == "no-store"


@pytest.mark.parametrize(
    "credentials",
    [
        {"email": "user@example.com", "password": "wrong-password"},
        {"email": "unknown@example.com", "password": "password123"},
    ],
)
def test_login_uses_same_generic_error_for_invalid_credentials(
    auth_client: tuple[TestClient, FakeDatabase],
    registered_user: dict,
    credentials: dict,
) -> None:
    assert registered_user["email"] == "user@example.com"
    response = auth_client[0].post("/api/auth/login", json=credentials)

    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password."


@pytest.mark.parametrize(
    "credentials",
    [
        {"password": "password123"},
        {"email": "user@example.com"},
        {"email": "not-an-email", "password": "password123"},
        {"email": "user@example.com", "password": ""},
        {"email": "user@example.com", "password": "password123", "extra": True},
    ],
)
def test_login_rejects_missing_or_invalid_input(
    auth_client: tuple[TestClient, FakeDatabase], credentials: dict
) -> None:
    assert auth_client[0].post("/api/auth/login", json=credentials).status_code == 422


def test_login_request_normalizes_email() -> None:
    request = LoginRequest(email="  USER@Example.COM  ", password="password123")

    assert str(request.email) == "user@example.com"


def test_authenticated_me_returns_user_and_missing_cookie_is_unauthorized(
    auth_client: tuple[TestClient, FakeDatabase],
    registered_user: dict,
) -> None:
    client, _ = auth_client
    assert registered_user["email"] == "user@example.com"
    login_response = client.post(
        "/api/auth/login",
        json={"email": "user@example.com", "password": "password123"},
    )
    assert login_response.status_code == 200

    response = client.get("/api/auth/me")
    assert response.status_code == 200
    assert response.json() == login_response.json()
    assert "hashed_password" not in response.text
    assert ACCESS_TOKEN_COOKIE not in response.json()

    client.cookies.clear()
    assert client.get("/api/auth/me").status_code == 401


def test_registration_password_hash_can_be_used_to_log_in(
    auth_client: tuple[TestClient, FakeDatabase],
) -> None:
    client, _ = auth_client
    registration = client.post(
        "/api/auth/register",
        json={
            "displayName": "Test User",
            "email": "user@example.com",
            "password": "password123",
            "confirmPassword": "password123",
        },
    )
    login = client.post(
        "/api/auth/login",
        json={"email": "user@example.com", "password": "password123"},
    )

    assert registration.status_code == 201
    assert login.status_code == 200
    assert login.json() == registration.json()["user"]


def test_weak_signing_secret_is_rejected() -> None:
    with pytest.raises(ValidationError):
        Settings.model_validate(
            {
                "mongo_uri": "mongodb://localhost:27017",
                "mongo_db_name": "focusmind_test",
                "secret_key": SecretStr("too-short"),
                "cors_origins": ["http://localhost:3000"],
            }
        )


def test_production_session_cookie_is_secure(
    auth_client: tuple[TestClient, FakeDatabase],
    registered_user: dict,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "environment", "production")
    assert registered_user["email"] == "user@example.com"
    response = auth_client[0].post(
        "/api/auth/login",
        json={"email": "user@example.com", "password": "password123"},
    )

    assert response.status_code == 200
    assert session_cookie(response)["secure"]

    logout_response = auth_client[0].post("/api/auth/logout")
    for path in ("/api", "/api/auth"):
        cleared_cookie = session_cookie(logout_response, path)
        assert cleared_cookie["secure"]
        assert cleared_cookie["httponly"]
        assert cleared_cookie["samesite"].lower() == "lax"
        assert cleared_cookie["max-age"] == "0"


@pytest.mark.parametrize("token_kind", ["invalid", "expired"])
def test_me_rejects_invalid_or_expired_tokens(
    auth_client: tuple[TestClient, FakeDatabase], token_kind: str
) -> None:
    client, _ = auth_client
    if token_kind == "invalid":
        token = "not-a-valid-jwt"
    else:
        token = jwt.encode(
            {
                "sub": str(ObjectId()),
                "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
            },
            settings.secret_key.get_secret_value(),
            algorithm=JWT_ALGORITHM,
        )

    client.cookies.set(ACCESS_TOKEN_COOKIE, token, path="/api")
    assert client.get("/api/auth/me").status_code == 401


def test_me_rejects_tokens_without_expiry_or_with_a_foreign_signature(
    auth_client: tuple[TestClient, FakeDatabase],
    registered_user: dict,
) -> None:
    client, _ = auth_client
    user_id = str(registered_user["_id"])
    now = datetime.now(timezone.utc)
    tokens = [
        jwt.encode(
            {"sub": user_id, "iat": now},
            settings.secret_key.get_secret_value(),
            algorithm=JWT_ALGORITHM,
        ),
        jwt.encode(
            {"sub": user_id, "iat": now, "exp": now + timedelta(minutes=5)},
            "another-signing-key-with-at-least-32-bytes",
            algorithm=JWT_ALGORITHM,
        ),
    ]
    for token in tokens:
        client.cookies.set(ACCESS_TOKEN_COOKIE, token, path="/api")
        assert client.get("/api/auth/me").status_code == 401


def test_me_rejects_a_user_that_no_longer_exists(
    auth_client: tuple[TestClient, FakeDatabase],
) -> None:
    client, _ = auth_client
    client.cookies.set(
        ACCESS_TOKEN_COOKIE, create_access_token(str(ObjectId())), path="/api"
    )

    assert client.get("/api/auth/me").status_code == 401


def test_logout_clears_cookie_with_matching_attributes(
    auth_client: tuple[TestClient, FakeDatabase],
) -> None:
    response = auth_client[0].post("/api/auth/logout")

    assert response.status_code == 200
    assert response.json() == {"message": "Logged out successfully."}
    # Clears the current cookie and the one older builds scoped to /api/auth.
    for path in ("/api", "/api/auth"):
        cookie = session_cookie(response, path)
        assert cookie["max-age"] == "0"
        assert cookie["httponly"]
        assert cookie["samesite"].lower() == "lax"
        assert cookie["secure"] == ""


def test_login_for_unknown_email_still_runs_password_verification(
    auth_client: tuple[TestClient, FakeDatabase],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str] = []
    original_verify = auth_service.verify_password

    def tracking_verify(password: str, hashed_password: str) -> bool:
        calls.append(hashed_password)
        return original_verify(password, hashed_password)

    monkeypatch.setattr(auth_service, "verify_password", tracking_verify)
    response = auth_client[0].post(
        "/api/auth/login",
        json={"email": "nobody@example.com", "password": "password123"},
    )

    assert response.status_code == 401
    assert calls == [auth_service._DUMMY_PASSWORD_HASH]


def test_corrupted_stored_hash_fails_closed(
    auth_client: tuple[TestClient, FakeDatabase],
    registered_user: dict,
) -> None:
    registered_user["hashed_password"] = "not-a-bcrypt-hash"
    response = auth_client[0].post(
        "/api/auth/login",
        json={"email": "user@example.com", "password": "password123"},
    )

    assert response.status_code == 401


def test_overlong_passwords_are_rejected(
    auth_client: tuple[TestClient, FakeDatabase],
) -> None:
    client, _ = auth_client
    huge = "x" * 257
    assert client.post(
        "/api/auth/login", json={"email": "user@example.com", "password": huge}
    ).status_code == 422
    response = client.post(
        "/api/auth/register",
        json={
            "displayName": "Test User",
            "email": "user@example.com",
            "password": huge,
            "confirmPassword": huge,
        },
    )
    assert response.status_code == 422
    assert huge not in response.text


def test_wildcard_cors_origin_is_rejected() -> None:
    with pytest.raises(ValidationError):
        Settings.model_validate(
            {
                "mongo_uri": "mongodb://localhost:27017",
                "mongo_db_name": "focusmind_test",
                "secret_key": SecretStr("x" * 40),
                "cors_origins": ["*"],
            }
        )


def test_requests_return_503_when_database_is_not_connected(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(database_module, "_db", None)
    response = TestClient(app).post(
        "/api/auth/login",
        json={"email": "user@example.com", "password": "password123"},
    )

    assert response.status_code == 503
    assert "mongodb" not in response.text.lower()


def test_health_reports_database_state(monkeypatch: pytest.MonkeyPatch) -> None:
    client = TestClient(app)

    async def healthy() -> bool:
        return True

    async def unhealthy() -> bool:
        return False

    monkeypatch.setattr("app.main.ping_db", healthy)
    assert client.get("/api/health").json() == {"status": "ok", "database": True}

    monkeypatch.setattr("app.main.ping_db", unhealthy)
    response = client.get("/api/health")
    assert response.status_code == 503
    assert response.json() == {"status": "degraded", "database": False}


def test_health_is_also_served_at_root_path(monkeypatch: pytest.MonkeyPatch) -> None:
    # The Load Balancer sends /health to the server container.
    async def healthy() -> bool:
        return True

    monkeypatch.setattr("app.main.ping_db", healthy)
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": True}


def test_logout_revokes_the_token_on_the_server(
    auth_client: tuple[TestClient, FakeDatabase],
    registered_user: dict,
) -> None:
    client, _ = auth_client
    login = client.post("/api/auth/login", json={"email": "user@example.com", "password": "password123"})
    stolen = session_cookie(login).value  # e.g. copied before logout
    assert client.get("/api/auth/me").status_code == 200

    assert client.post("/api/auth/logout").status_code == 200
    client.cookies.clear()
    client.cookies.set(ACCESS_TOKEN_COOKIE, stolen, path="/api")
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/courses/mine").status_code == 401

    # A new login gets a new, working token.
    client.cookies.clear()
    client.post("/api/auth/login", json={"email": "user@example.com", "password": "password123"})
    assert client.get("/api/auth/me").status_code == 200


def test_tokens_without_an_id_are_rejected(
    auth_client: tuple[TestClient, FakeDatabase],
    registered_user: dict,
) -> None:
    client, _ = auth_client
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {"sub": str(registered_user["_id"]), "iat": now, "exp": now + timedelta(minutes=5)},
        settings.secret_key.get_secret_value(),
        algorithm=JWT_ALGORITHM,
    )
    client.cookies.set(ACCESS_TOKEN_COOKIE, token, path="/api")
    assert client.get("/api/auth/me").status_code == 401


def test_private_api_responses_are_never_cached(
    auth_client: tuple[TestClient, FakeDatabase],
    registered_user: dict,
) -> None:
    client, _ = auth_client
    client.post("/api/auth/login", json={"email": "user@example.com", "password": "password123"})
    for path in ("/api/auth/me", "/api/does-not-exist"):
        response = client.get(path)
        assert response.headers["cache-control"] == "no-store"
        assert response.headers["pragma"] == "no-cache"
        assert response.headers["x-content-type-options"] == "nosniff"
        assert response.headers["x-frame-options"] == "DENY"


def test_cross_site_write_requests_are_blocked(
    auth_client: tuple[TestClient, FakeDatabase],
    registered_user: dict,
) -> None:
    client, _ = auth_client
    client.post("/api/auth/login", json={"email": "user@example.com", "password": "password123"})
    # A page on another site cannot use the visitor's session to write.
    for origin in ("https://evil.example", "null"):
        response = client.post("/api/courses", json={"title": "x"}, headers={"Origin": origin})
        assert response.status_code == 403
        assert response.json() == {"detail": "Cross-site request blocked."}
        assert client.post("/api/auth/logout", headers={"Origin": origin}).status_code == 403
    assert client.get("/api/auth/me").status_code == 200  # still signed in
    # The site itself (same host) is allowed.
    assert client.post("/api/auth/logout", headers={"Origin": "http://testserver"}).status_code == 200
