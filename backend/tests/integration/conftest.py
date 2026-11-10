import os

import pytest
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from app.core.config import settings


def _mongo_is_reachable() -> bool:
    client = MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=2000)
    try:
        # A real command, so missing credentials are detected (ping alone is
        # allowed without authentication).
        client[settings.mongo_db_name].list_collection_names()
    except PyMongoError:
        return False
    finally:
        client.close()
    return True


@pytest.fixture(scope="session", autouse=True)
def require_mongo() -> None:
    if _mongo_is_reachable():
        return
    message = (
        "MongoDB is not reachable with MONGO_URI from the environment/.env; "
        "start it with `docker compose up -d mongo`."
    )
    if os.environ.get("FOCUSMIND_REQUIRE_MONGO") == "1":
        pytest.fail(message)
    pytest.skip(message)
