"""Brute-force protection on login and registration (in-memory database)."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.services import rate_limit
from tests.test_auth import auth_client, registered_user  # noqa: F401


@pytest.fixture
def limiter(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setattr(settings, "auth_rate_limit_enabled", True)
    rate_limit.reset()
    yield
    rate_limit.reset()


def test_repeated_failed_logins_are_slowed_down_but_success_is_not(auth_client, registered_user, limiter) -> None:  # noqa: F811
    client, _ = auth_client
    good = {"email": "user@example.com", "password": "password123"}
    for _ in range(5):  # successful logins never count
        assert client.post("/api/auth/login", json=good).status_code == 200
    for _ in range(rate_limit.LOGIN_FAILURES_PER_EMAIL[0]):
        assert client.post("/api/auth/login", json={**good, "password": "wrong-password"}).status_code == 401
    blocked = client.post("/api/auth/login", json=good)
    assert blocked.status_code == 429
    assert "password" not in blocked.text.lower() or "wrong" not in blocked.text.lower()


def test_registration_is_limited_per_client(auth_client, limiter, monkeypatch: pytest.MonkeyPatch) -> None:  # noqa: F811
    client, _ = auth_client
    monkeypatch.setattr(rate_limit, "REGISTRATIONS_PER_IP", (3, 3600))
    codes = [
        client.post("/api/auth/register", json={
            "displayName": f"User {index}", "email": f"u{index}@example.com",
            "password": "password123", "confirmPassword": "password123",
        }).status_code
        for index in range(4)
    ]
    assert codes == [201, 201, 201, 429]


def test_disabled_limiter_never_blocks(auth_client) -> None:  # noqa: F811
    client: TestClient = auth_client[0]
    assert settings.auth_rate_limit_enabled is False  # tests disable it by default
    for _ in range(12):
        client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "x"})
    assert client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "x"}).status_code == 401
