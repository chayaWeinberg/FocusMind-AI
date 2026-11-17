#!/bin/sh
# Checks a running FocusMind AI deployment (your domain behind the Load Balancer, or the local rehearsal).
#
#   sh scripts/verify-deployment.sh https://YOUR-DOMAIN
#   sh scripts/verify-deployment.sh http://localhost:8080 --journey
#
# Without --journey nothing is written. With --journey a throwaway account
# (verify-<time>@example.com) is registered to check login, the catalog and
# video streaming; it stays in the database, so delete it afterwards if needed.
set -u
BASE="${1:?usage: verify-deployment.sh <base-url> [--journey]}"
BASE="${BASE%/}"
JOURNEY="${2:-}"
FAILED=0
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

check() { # name, expected, actual
  if [ "$2" = "$3" ]; then echo "  OK    $1"; else echo "  FAIL  $1 (expected $2, got $3)"; FAILED=1; fi
}
status() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "FocusMind AI deployment check: $BASE"
check "health endpoint answers 200" 200 "$(status "$BASE/health")"
check "API health answers 200" 200 "$(status "$BASE/api/health")"
check "database is connected" true "$(curl -s "$BASE/health" | sed -n 's/.*"database":[ ]*\([a-z]*\).*/\1/p')"
check "home page is served" 200 "$(status "$BASE/")"
check "client route returns the app" 200 "$(status "$BASE/courses/catalog")"
check "home page is the React app" 1 "$(curl -s "$BASE/" | grep -c '<div id="root">')"
check "unknown API path is a 404" 404 "$(status "$BASE/api/does-not-exist")"
check "API needs a session" 401 "$(status "$BASE/api/courses/mine")"
check "API docs are disabled" 0 "$(curl -s "$BASE/docs" | grep -ci swagger)"
case "$BASE" in https://*) check "HTTPS redirect / certificate" 200 "$(status "$BASE/api/health")";; esac

if [ "$JOURNEY" = "--journey" ]; then
  EMAIL="verify-$(date +%s)@example.com"; PASS="verify-$(date +%s)-pass"
  BODY="{\"displayName\":\"Verify\",\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"confirmPassword\":\"$PASS\"}"
  check "registration" 201 "$(status -H 'Content-Type: application/json' -d "$BODY" "$BASE/api/auth/register")"
  check "login" 200 "$(status -c "$JAR" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" "$BASE/api/auth/login")"
  check "current user" 200 "$(status -b "$JAR" "$BASE/api/auth/me")"
  CATALOG="$(curl -s -b "$JAR" "$BASE/api/courses/catalog")"
  COUNT="$(printf '%s' "$CATALOG" | grep -o '"type":"catalog"' | wc -l | tr -d ' ')"
  [ "$COUNT" -ge 1 ] 2>/dev/null && echo "  OK    catalog has $COUNT courses" || { echo "  FAIL  catalog is empty"; FAILED=1; }
fi

if [ "$FAILED" = 0 ]; then echo "RESULT: all checks passed"; else echo "RESULT: some checks FAILED"; fi
exit "$FAILED"
