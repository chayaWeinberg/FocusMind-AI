"""Grant or revoke the catalog content-manager role (command line only).

    python -m app.admin grant  user@example.com
    python -m app.admin revoke user@example.com
    python -m app.admin list

Nobody becomes a content manager automatically; there is no API for it.
The user must sign in again (or reload the page) to see the change.
"""

import argparse
import asyncio
import sys

from app.core.config import settings
from app.db.database import close_db, get_database, initialize_db


async def run(action: str, email: str | None) -> int:
    await initialize_db(settings.mongo_uri, settings.mongo_db_name, settings.mongo_timeout_ms)
    try:
        users = get_database().users
        if action == "list":
            async for user in users.find({"role": "content_manager"}, {"email": 1}):
                print(user["email"])
            return 0
        normalized = (email or "").strip().lower()
        if action == "grant":
            result = await users.update_one({"email": normalized}, {"$set": {"role": "content_manager"}})
        else:
            result = await users.update_one({"email": normalized}, {"$unset": {"role": ""}})
        if result.matched_count == 0:
            print(f"No account with the email {normalized!r}.", file=sys.stderr)
            return 1
        print(f"{normalized}: {'content manager' if action == 'grant' else 'learner'}.")
        return 0
    finally:
        await close_db()


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.admin", description=__doc__.splitlines()[0])
    parser.add_argument("action", choices=["grant", "revoke", "list"])
    parser.add_argument("email", nargs="?")
    args = parser.parse_args()
    if args.action != "list" and not args.email:
        parser.error("an email is required")
    raise SystemExit(asyncio.run(run(args.action, args.email)))


if __name__ == "__main__":
    main()
