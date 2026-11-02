import asyncio
import base64
import hashlib
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from pymongo.errors import DuplicateKeyError
from pymongo.asynchronous.database import AsyncDatabase

from app.core.config import settings
from app.models.user import UserDocument
from app.repositories.users import UserRepository
from app.schemas.auth import LoginRequest, RegisteredUser, RegistrationRequest

ACCESS_TOKEN_COOKIE = "focusmind_access_token"
ACCESS_TOKEN_TTL = timedelta(minutes=30)
JWT_ALGORITHM = "HS256"

class EmailAlreadyRegisteredError(Exception):
    pass


def _password_digest(password: str) -> bytes:
    return base64.b64encode(hashlib.sha256(password.encode("utf-8")).digest())


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_password_digest(password), bcrypt.gensalt()).decode("ascii")


def verify_password(password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(_password_digest(password), hashed_password.encode("ascii"))


def create_access_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {"sub": user_id, "iat": now, "exp": now + ACCESS_TOKEN_TTL},
        settings.secret_key.get_secret_value(),
        algorithm=JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> str | None:
    try:
        payload = jwt.decode(
            token,
            settings.secret_key.get_secret_value(),
            algorithms=[JWT_ALGORITHM],
        )
    except jwt.InvalidTokenError:
        return None

    subject = payload.get("sub")
    return subject if isinstance(subject, str) else None


async def register_user(
    database: AsyncDatabase, registration: RegistrationRequest
) -> RegisteredUser:
    hashed_password = await asyncio.to_thread(hash_password, registration.password)
    user: UserDocument = {
        "display_name": registration.display_name,
        "email": str(registration.email),
        "hashed_password": hashed_password,
        "created_at": datetime.now(timezone.utc),
    }

    try:
        user_id = await UserRepository(database).create_user(user)
    except DuplicateKeyError as exception:
        raise EmailAlreadyRegisteredError from exception

    return RegisteredUser(
        id=str(user_id),
        displayName=registration.display_name,
        email=registration.email,
    )


async def authenticate_user(
    database: AsyncDatabase, credentials: LoginRequest
) -> tuple[RegisteredUser, str] | None:
    repository = UserRepository(database)
    user = await repository.find_by_email(str(credentials.email))
    if user is None or "_id" not in user:
        return None

    valid_password = await asyncio.to_thread(
        verify_password, credentials.password, user["hashed_password"]
    )
    if not valid_password:
        return None

    authenticated_user = RegisteredUser(
        id=str(user["_id"]),
        displayName=user["display_name"],
        email=user["email"],
    )
    return authenticated_user, create_access_token(authenticated_user.id)


async def get_user_from_access_token(
    database: AsyncDatabase, token: str
) -> RegisteredUser | None:
    user_id = decode_access_token(token)
    if user_id is None:
        return None

    user = await UserRepository(database).find_by_id(user_id)
    if user is None or "_id" not in user:
        return None

    return RegisteredUser(
        id=str(user["_id"]),
        displayName=user["display_name"],
        email=user["email"],
    )
