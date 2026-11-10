import logging

from fastapi import HTTPException, status
from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import PyMongoError

logger = logging.getLogger(__name__)

_client: AsyncMongoClient | None = None
_db: AsyncDatabase | None = None


async def connect_to_db(mongo_uri: str, db_name: str, timeout_ms: int = 5000) -> None:
    global _client, _db

    await close_db()
    _client = AsyncMongoClient(
        mongo_uri,
        serverSelectionTimeoutMS=timeout_ms,
        connectTimeoutMS=timeout_ms,
        tz_aware=True,
    )
    _db = _client[db_name]


async def close_db() -> None:
    global _client, _db

    if _client is not None:
        await _client.aclose()
    _client = None
    _db = None


def get_database() -> AsyncDatabase:
    if _db is None:
        raise RuntimeError("Database is not connected")
    return _db


async def get_db() -> AsyncDatabase:
    """FastAPI dependency that returns the connected database.

    Tests replace it with ``app.dependency_overrides[get_db]``.
    """
    if _db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service temporarily unavailable.",
        )
    return _db


async def ping_db() -> bool:
    if _client is None:
        return False
    try:
        await _client.admin.command("ping")
    except PyMongoError:
        return False
    return True


async def create_indexes() -> None:
    db = get_database()
    await db.users.create_index("email", unique=True)


async def initialize_db(mongo_uri: str, db_name: str, timeout_ms: int = 5000) -> None:
    """Connect and create indexes, failing fast with a readable message."""
    await connect_to_db(mongo_uri, db_name, timeout_ms)
    try:
        await create_indexes()
    except PyMongoError as exception:
        await close_db()
        # Never log the URI itself: it may contain credentials.
        logger.error(
            "Could not initialize MongoDB (%s). Check that MongoDB is running and "
            "that MONGO_URI / MONGO_DB_NAME in .env are correct.",
            type(exception).__name__,
        )
        raise RuntimeError("MongoDB initialization failed.") from None
