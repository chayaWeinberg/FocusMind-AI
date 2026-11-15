"""Shared FastAPI dependencies: database and the authenticated user.

The user identity always comes from the server-side session cookie, never
from request bodies or query parameters.
"""

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import PyMongoError

from app.db.database import get_db
from app.schemas.auth import RegisteredUser
from app.services.auth import ACCESS_TOKEN_COOKIE, get_user_from_access_token

Database = Annotated[AsyncDatabase, Depends(get_db)]


async def get_current_user(request: Request, database: Database) -> RegisteredUser:
    token = request.cookies.get(ACCESS_TOKEN_COOKIE)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required.")
    try:
        user = await get_user_from_access_token(database, token)
    except PyMongoError:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Service temporarily unavailable."
        ) from None
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required.")
    return user


CurrentUser = Annotated[RegisteredUser, Depends(get_current_user)]
