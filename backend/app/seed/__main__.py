"""python -m app.seed  ->  idempotently seeds the example catalog."""

import asyncio

from app.core.config import settings
from app.db.database import close_db, get_database, initialize_db
from app.seed.catalog import seed_catalog


async def main() -> None:
    await initialize_db(settings.mongo_uri, settings.mongo_db_name, settings.mongo_timeout_ms)
    try:
        count = await seed_catalog(get_database())
        print(f"Catalog seeded: {count} courses (existing data, edited courses and chosen videos kept).")
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(main())
