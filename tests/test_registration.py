import asyncio
import base64
import hashlib
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
import uuid
from typing import NoReturn

import bcrypt
import pytest
from fastapi.testclient import TestClient
from pymongo import AsyncMongoClient, MongoClient
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import PyMongoError

from app.core.config import settings
from app.main import app
from app.schemas.auth import RegistrationRequest


@pytest.fixture
def registration_client(monkeypatch: pytest.MonkeyPatch) -> Iterator[tuple[TestClient, str]]:
    mongo_uri = settings.mongo_uri
    test_database_name = f"focusmind_registration_test_{uuid.uuid4().hex}"
    monkeypatch.setattr(settings, "mongo_db_name", test_database_name)

    try:
        with TestClient(app) as client:
            yield client, test_database_name
    finally:
        async def drop_test_database() -> None:
            mongo_client = AsyncMongoClient(mongo_uri)
            try:
                await mongo_client.drop_database(test_database_name)
            finally:
                await mongo_client.close()

        asyncio.run(drop_test_database())


def valid_registration(**overrides: str) -> dict[str, str]:
    registration = {
        "displayName": "Ada Lovelace",
        "email": "Ada@example.com",
        "password": "correct horse battery staple",
        "confirmPassword": "correct horse battery staple",
    }
    registration.update(overrides)
    return registration


def test_successful_registration_returns_safe_user(
    registration_client: tuple[TestClient, str],
) -> None:
    client, _ = registration_client
    response = client.post(
        "/api/auth/register",
        json=valid_registration(email="Ada@Example.COM"),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["message"] == "Registration successful."
    assert body["user"]["displayName"] == "Ada Lovelace"
    assert body["user"]["email"] == "ada@example.com"
    assert set(body["user"]) == {"id", "displayName", "email"}
    assert "correct horse battery staple" not in response.text
    assert "hashed_password" not in response.text


def test_invalid_email_is_rejected_without_echoing_password(
    registration_client: tuple[TestClient, str],
) -> None:
    client, _ = registration_client
    secret = "password-not-to-echo"
    response = client.post(
        "/api/auth/register",
        json=valid_registration(email="not-an-email", password=secret, confirmPassword=secret),
    )

    assert response.status_code == 422
    assert secret not in response.text


def test_short_password_is_rejected_without_echoing_password(
    registration_client: tuple[TestClient, str],
) -> None:
    client, _ = registration_client
    secret = "S3c!"
    response = client.post(
        "/api/auth/register",
        json=valid_registration(password=secret, confirmPassword=secret),
    )

    assert response.status_code == 422
    assert secret not in response.text


def test_mismatched_passwords_are_rejected_without_echoing_them(
    registration_client: tuple[TestClient, str],
) -> None:
    client, _ = registration_client
    password = "first-password"
    confirmation = "second-password"
    response = client.post(
        "/api/auth/register",
        json=valid_registration(password=password, confirmPassword=confirmation),
    )

    assert response.status_code == 422
    assert password not in response.text
    assert confirmation not in response.text


@pytest.mark.parametrize("display_name", ["A", "A" * 31])
def test_invalid_display_name_length_is_rejected(
    registration_client: tuple[TestClient, str],
    display_name: str,
) -> None:
    client, _ = registration_client
    response = client.post(
        "/api/auth/register",
        json=valid_registration(displayName=display_name),
    )

    assert response.status_code == 422


@pytest.mark.parametrize(
    "field",
    ["displayName", "email", "password", "confirmPassword"],
)
def test_registration_fields_are_required(
    registration_client: tuple[TestClient, str],
    field: str,
) -> None:
    client, _ = registration_client
    registration = valid_registration()
    registration.pop(field)
    response = client.post("/api/auth/register", json=registration)

    assert response.status_code == 422
    assert "correct horse battery staple" not in response.text


def test_duplicate_email_returns_conflict(
    registration_client: tuple[TestClient, str],
) -> None:
    client, _ = registration_client
    first = client.post("/api/auth/register", json=valid_registration())
    duplicate = client.post(
        "/api/auth/register",
        json=valid_registration(email="ADA@example.com"),
    )

    assert first.status_code == 201
    assert duplicate.status_code == 409
    assert "correct horse battery staple" not in duplicate.text


def test_database_errors_return_generic_response(
    registration_client: tuple[TestClient, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.api.routes import auth

    async def fail_registration(
        database: AsyncDatabase, registration: RegistrationRequest
    ) -> NoReturn:
        del database, registration
        raise PyMongoError("database detail that must not be returned")

    monkeypatch.setattr(auth, "register_user", fail_registration)
    client, _ = registration_client
    response = client.post("/api/auth/register", json=valid_registration())

    assert response.status_code == 500
    assert response.json() == {"detail": "Registration could not be completed."}
    assert "database detail" not in response.text


def test_password_is_stored_only_as_bcrypt_hash(
    registration_client: tuple[TestClient, str],
) -> None:
    client, test_database_name = registration_client
    password = "correct horse battery staple"
    response = client.post(
        "/api/auth/register",
        json=valid_registration(password=password, confirmPassword=password),
    )
    assert response.status_code == 201

    mongo_client = MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=5000)
    try:
        user = mongo_client[test_database_name].users.find_one(
            {"email": "ada@example.com"}
        )
    finally:
        mongo_client.close()

    assert user is not None
    assert "password" not in user
    assert user["hashed_password"].startswith(("$2a$", "$2b$", "$2y$"))
    password_digest = base64.b64encode(hashlib.sha256(password.encode("utf-8")).digest())
    assert bcrypt.checkpw(password_digest, user["hashed_password"].encode("ascii"))


def test_concurrent_registrations_only_create_one_user(
    registration_client: tuple[TestClient, str],
) -> None:
    client, test_database_name = registration_client
    registration = valid_registration()

    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(
            executor.map(
                lambda _: client.post("/api/auth/register", json=registration),
                range(2),
            )
        )

    assert sorted(response.status_code for response in responses) == [201, 409]

    mongo_client = MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=5000)
    try:
        user_count = mongo_client[test_database_name].users.count_documents(
            {"email": "ada@example.com"}
        )
    finally:
        mongo_client.close()

    assert user_count == 1
