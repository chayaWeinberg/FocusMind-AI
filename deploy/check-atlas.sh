#!/usr/bin/env bash
# Checks, before any cloud deployment, that the server image works with the
# real MongoDB Atlas database: connection string, password, Network Access and
# whether the local network lets port 27017 through.
#
#   bash deploy/check-atlas.sh
#
# The connection string is typed at a hidden prompt and passed to the
# container only through its environment; it is never written to a file.
# Uses a separate database (focusmind_check), which is dropped at the end,
# so the real "focusmind" database stays untouched.

set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE=focusmind-server:latest
NAME=focusmind-atlas-check
PORT=8001
DB=focusmind_check

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "Building the server image (first time only)…"
  docker build -q -t "$IMAGE" backend >/dev/null
fi

echo "Paste the MongoDB Atlas connection string (mongodb+srv://USER:PASSWORD@...)."
echo "The input is hidden."
read -r -s -p "MONGO_URI: " MONGO_URI; echo
case "$MONGO_URI" in
  mongodb+srv://*|mongodb://*) ;;
  *) echo "That does not look like a MongoDB connection string." >&2; exit 1;;
esac
case "$MONGO_URI" in *"<db_password>"*|*"<password>"*)
  echo "Replace <db_password> with the real password first." >&2; exit 1;;
esac

SECRET_KEY="$(head -c 48 /dev/urandom | base64 | tr '+/' '-_' | tr -d '=\n')"
docker rm -f "$NAME" >/dev/null 2>&1 || true
export MONGO_URI SECRET_KEY
MSYS_NO_PATHCONV=1 docker run -d --name "$NAME" -p "127.0.0.1:${PORT}:8000" \
  -e MONGO_URI -e SECRET_KEY -e MONGO_DB_NAME="$DB" -e SEED_CATALOG=true \
  "$IMAGE" >/dev/null
unset MONGO_URI SECRET_KEY

cleanup() {
  docker exec "$NAME" python -c "
import asyncio, os
from pymongo import AsyncMongoClient
async def main():
    client = AsyncMongoClient(os.environ['MONGO_URI'])
    await client.drop_database(os.environ['MONGO_DB_NAME'])
    await client.close()
asyncio.run(main())" >/dev/null 2>&1 || true
  docker rm -f "$NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Starting the server against Atlas (up to a minute)…"
status=000
for _ in $(seq 1 30); do
  status="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/health" || true)"
  [ "$status" = 200 ] && break
  if [ "$(docker inspect -f '{{.State.Running}}' "$NAME" 2>/dev/null)" != "true" ]; then break; fi
  sleep 2
done

if [ "$status" = 200 ]; then
  echo
  echo "  OK  The server connected to Atlas: $(curl -s "http://127.0.0.1:${PORT}/health")"
  sh scripts/verify-deployment.sh "http://127.0.0.1:${PORT}" --journey | grep -E "OK|FAIL|RESULT" | grep -v "home page\|client route\|React app" || true
  echo
  echo "Atlas is ready for the cloud deployment. (The test database '$DB' is deleted now.)"
else
  echo
  echo "  FAIL  The server could not use Atlas (health: $status). Last server log lines:"
  docker logs --tail 15 "$NAME" 2>&1 | sed 's#mongodb+srv://[^ ]*#mongodb+srv://***#g'
  echo
  echo "Common causes:"
  echo "  - wrong user or password (Atlas → Database Access), or <db_password> left in the string"
  echo "  - Atlas → Network Access does not include 0.0.0.0/0 (or this computer's IP)"
  echo "  - the local network (NetFree / antivirus) blocks port 27017 — then try from another network;"
  echo "    Cloud Run is not affected by this computer's network"
  exit 1
fi
