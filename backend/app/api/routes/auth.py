import logging

from fastapi import APIRouter, HTTPException, Request, Response, status
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


def _secure_cookie() -> bool:
    return settings.environment == "production"


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect email or password.",
    )


@router.post(
    "/register",
    response_model=RegistrationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(registration: RegistrationRequest) -> RegistrationResponse:
    try:
        database = await get_db()
        user = await register_user(database, registration)
    except EmailAlreadyRegisteredError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from None
    except PyMongoError:
        logger.error("User registration failed due to a database error.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration could not be completed.",
        ) from None

    return RegistrationResponse(message="Registration successful.", user=user)


@router.post("/login", response_model=RegisteredUser)
async def login(credentials: LoginRequest, response: Response) -> RegisteredUser:
    try:
        database = await get_db()
        result = await authenticate_user(database, credentials)
    except PyMongoError:
        logger.error("User login failed due to a database error.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login could not be completed.",
        ) from None

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
        path="/api/auth",
    )
    return user


@router.get("/me", response_model=RegisteredUser)
async def get_current_user(request: Request) -> RegisteredUser:
    token = request.cookies.get(ACCESS_TOKEN_COOKIE)
    if token is None:
        raise _unauthorized()

    try:
        database = await get_db()
        user = await get_user_from_access_token(database, token)
    except PyMongoError:
        logger.error("Authenticated user lookup failed due to a database error.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User information could not be retrieved.",
        ) from None

    if user is None:
        raise _unauthorized()
    return user


@router.post("/logout")
async def logout(response: Response) -> dict[str, str]:
    response.delete_cookie(
        key=ACCESS_TOKEN_COOKIE,
        path="/api/auth",
        secure=_secure_cookie(),
        httponly=True,
        samesite="lax",
    )
    return {"message": "Logged out successfully."}
