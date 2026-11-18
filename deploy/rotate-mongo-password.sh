#!/usr/bin/env bash
# Replace the MongoDB Atlas password used by the cloud server (after changing
# it in Atlas → Database Access, e.g. because it leaked).
#
#   MONGO_URI_TEMPLATE='mongodb+srv://USER:<db_password>@HOST/...' \
#     bash deploy/rotate-mongo-password.sh PROJECT_ID [REGION]
#
# 1. asks for the new password (hidden) and adds it as a new version of the
#    focusmind-mongo-uri secret (the old version is disabled);
# 2. rolls out a new revision of the server, which reads the latest version;
# 3. waits until the server is ready again.

set -euo pipefail
PROJECT_ID="${1:?usage: rotate-mongo-password.sh PROJECT_ID [REGION]}"
REGION="${2:-me-west1}"
SERVER=focusmind-server
cd "$(dirname "$0")/.."

export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'
if command -v gcloud.cmd >/dev/null 2>&1; then
  gcloud() { gcloud.cmd "$@"; }
fi
if [ -n "${GCLOUD_CA_BUNDLE:-}" ]; then
  export REQUESTS_CA_BUNDLE="$GCLOUD_CA_BUNDLE" SSL_CERT_FILE="$GCLOUD_CA_BUNDLE"
fi
gcloud config set project "$PROJECT_ID" >/dev/null

# shellcheck source=deploy/read-mongo-uri.sh
. deploy/read-mongo-uri.sh
read_mongo_uri

echo
echo "==> Adding the new connection string to Secret Manager"
previous="$(gcloud secrets versions list focusmind-mongo-uri --filter='state=ENABLED' --format='value(name)' | head -n 1)"
printf '%s' "$MONGO_URI" | gcloud secrets versions add focusmind-mongo-uri --data-file=-
unset MONGO_URI

echo
echo "==> Rolling out a new server revision (reads the new secret version)"
gcloud run services update "$SERVER" --region="$REGION" --async \
  --update-env-vars="SECRET_ROTATED_AT=$(date -u +%Y%m%dT%H%M%SZ)"
for _ in $(seq 1 60); do
  sleep 10
  ready="$(gcloud run services describe "$SERVER" --region="$REGION" --format='value(status.conditions[0].status)' 2>/dev/null || true)"
  case "$ready" in
    True)
      echo "  $SERVER is ready: $(gcloud run services describe "$SERVER" --region="$REGION" --format='value(status.latestReadyRevisionName)')"
      if [ -n "$previous" ]; then
        gcloud secrets versions disable "$previous" --secret=focusmind-mongo-uri >/dev/null
        echo "  old secret version $previous disabled"
      fi
      echo
      echo "Done: the server now uses the new password."
      exit 0 ;;
    False)
      echo "  $SERVER failed to start with the new password:" >&2
      gcloud run services describe "$SERVER" --region="$REGION" --format='value(status.conditions[0].message)' >&2
      echo "  (the previous revision keeps serving; check the password and run again)" >&2
      exit 1 ;;
  esac
done
echo "  $SERVER is not ready after 10 minutes." >&2
exit 1
