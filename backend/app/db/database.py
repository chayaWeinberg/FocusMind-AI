from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase

_client: AsyncMongoClient | None = None
_db: AsyncDatabase | None = None


async def connect_to_db(mongo_uri: str, db_name: str) -> None:
    global _client, _db

    _client = AsyncMongoClient(mongo_uri)
    _db = _client[db_name]


async def close_db() -> None:
    global _client, _db

    if _client is not None:
        await _client.aclose()
        _client = None
        _db = None


async def get_db() -> AsyncDatabase:
    if _db is None:
        raise RuntimeError("Database is not connected")
    return _db


async def create_indexes() -> None:
    db = await get_db()
    await db.users.create_index("email", unique=True)
