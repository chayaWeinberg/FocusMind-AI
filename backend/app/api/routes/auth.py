import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import PyMongoError

from app.core.config import settings
from app.db.database import get_db
from app.schemas.auth import (
    LoginRequest,
    RegisteredUser,
    RegistrationRequest,
    RegistrationResponse,
)
from app.services.auth import (
    ACCESS_TOKEN_COOKIE,
    ACCESS_TOKEN_TTL,
    EmailAlreadyRegisteredError,
    authenticate_user,
    get_user_from_access_token,
    register_user,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger(__name__)

Database = Annotated[AsyncDatabase, Depends(get_db)]

# The cookie is scoped to /api so that future authenticated endpoints
# (sessions, analytics, ...) receive it, while static frontend requests do not.
COOKIE_PATH = "/api"
# Older builds scoped the cookie to /api/auth; logout clears that one too.
LEGACY_COOKIE_PATHS = ("/api/auth",)


def _secure_cookie() -> bool:
    return settings.environment == "production"


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect email or password.",
    )


def _database_error(action: str, detail: str) -> HTTPException:
    logger.error("%s failed due to a database error.", action)
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=detail,
    )


@router.post(
    "/register",
    response_model=RegistrationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    registration: RegistrationRequest, database: Database
) -> RegistrationResponse:
    try:
        user = await register_user(database, registration)
    except EmailAlreadyRegisteredError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from None
    except PyMongoError:
        raise _database_error(
            "User registration", "Registration could not be completed."
        ) from None

    return RegistrationResponse(message="Registration successful.", user=user)


@router.post("/login", response_model=RegisteredUser)
async def login(
    credentials: LoginRequest, response: Response, database: Database
) -> RegisteredUser:
    try:
        result = await authenticate_user(database, credentials)
    except PyMongoError:
        raise _database_error("User login", "Login could not be completed.") from None

    if result is None:
        raise _unauthorized()

    user, token = result
    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE,
        value=token,
        max_age=int(ACCESS_TOKEN_TTL.total_seconds()),
        httponly=True,
        secure=_secure_cookie(),
        samesite="lax",
        path=COOKIE_PATH,
    )
    response.headers["Cache-Control"] = "no-store"
    return user


@router.get("/me", response_model=RegisteredUser)
async def get_current_user(
    request: Request, response: Response, database: Database
) -> RegisteredUser:
    token = request.cookies.get(ACCESS_TOKEN_COOKIE)
    if not token:
        raise _unauthorized()

    try:
        user = await get_user_from_access_token(database, token)
    except PyMongoError:
        raise _database_error(
            "Authenticated user lookup", "User information could not be retrieved."
        ) from None

    if user is None:
        raise _unauthorized()
    response.headers["Cache-Control"] = "no-store"
    return user


@router.post("/logout")
async def logout(response: Response) -> dict[str, str]:
    for path in (COOKIE_PATH, *LEGACY_COOKIE_PATHS):
        response.delete_cookie(
            key=ACCESS_TOKEN_COOKIE,
            path=path,
            secure=_secure_cookie(),
            httponly=True,
            samesite="lax",
        )
    return {"message": "Logged out successfully."}
