#!/usr/bin/env bash
# FocusMind AI — one-command deployment to Google Cloud (assignment 4).
#
#   Browser ─▶ https://DOMAIN ─▶ Load Balancer (HTTPS, managed certificate, static IP)
#                                   ├─ /api/* and /health ─▶ Cloud Run: focusmind-server (8000)
#                                   └─ everything else    ─▶ Cloud Run: focusmind-client (3000)
#
# Usage (Git Bash, from the project root, after `gcloud auth login`):
#
#   bash deploy/deploy-gcp.sh PROJECT_ID DOMAIN [REGION]
#   bash deploy/deploy-gcp.sh my-project-123 focusmind.ddns.net
#
# Safe to run again: every step skips what already exists, and a re-run
# rebuilds and redeploys both images (new tag each time).
#
# Secrets never touch the disk or the repository: the MongoDB Atlas connection
# string is typed at a hidden prompt (first run only) and stored straight in
# Secret Manager; SECRET_KEY is generated randomly in memory.
#
# Details and the reasoning behind each choice: docs/DEPLOYMENT-HE.md

set -euo pipefail

PROJECT_ID="${1:?usage: deploy-gcp.sh PROJECT_ID DOMAIN [REGION]}"
DOMAIN="${2:?usage: deploy-gcp.sh PROJECT_ID DOMAIN [REGION]}"
REGION="${3:-me-west1}"

SERVER=focusmind-server
CLIENT=focusmind-client
REPO="$REGION-docker.pkg.dev/$PROJECT_ID/focusmind"
BUCKET="$PROJECT_ID-focusmind-videos"
SA_NAME=focusmind-run
SA="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"
TAG="v$(date +%Y%m%d-%H%M%S)"

cd "$(dirname "$0")/.."

# --- gcloud on Windows (Git Bash) ------------------------------------------------
if command -v gcloud.cmd >/dev/null 2>&1; then
  gcloud() { gcloud.cmd "$@"; }
elif ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud was not found. Install the Google Cloud CLI first." >&2
  exit 1
fi
# Networks that inspect HTTPS (Avast, NetFree): optional extra CA bundle.
if [ -n "${GCLOUD_CA_BUNDLE:-}" ]; then
  export REQUESTS_CA_BUNDLE="$GCLOUD_CA_BUNDLE" SSL_CERT_FILE="$GCLOUD_CA_BUNDLE"
fi

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
exists() { "$@" >/dev/null 2>&1; }

gcloud config set project "$PROJECT_ID" >/dev/null

# --- 0. Billing must be an active Free Trial (never upgrade) ----------------------
step "Checking billing"
if [ "$(gcloud billing projects describe "$PROJECT_ID" --format='value(billingEnabled)')" != "True" ]; then
  echo "Billing is not enabled for $PROJECT_ID. Link it to an active Free Trial billing account first:" >&2
  echo "  https://console.cloud.google.com/billing/linkedaccount?project=$PROJECT_ID" >&2
  exit 1
fi

# --- 1. APIs ----------------------------------------------------------------------
step "Enabling APIs (first time takes a minute)"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com \
  secretmanager.googleapis.com storage.googleapis.com compute.googleapis.com

# --- 2. Secrets (Secret Manager) --------------------------------------------------
step "Secrets"
if ! exists gcloud secrets describe focusmind-secret-key; then
  # 48 random bytes, URL-safe; generated in memory and piped straight in.
  head -c 48 /dev/urandom | base64 | tr '+/' '-_' | tr -d '=\n' |
    gcloud secrets create focusmind-secret-key --replication-policy=automatic --data-file=-
else
  echo "focusmind-secret-key already exists"
fi
if ! exists gcloud secrets describe focusmind-mongo-uri; then
  echo "Paste the MongoDB Atlas connection string (mongodb+srv://USER:PASSWORD@...)."
  echo "The input is hidden and goes straight to Secret Manager."
  read -r -s -p "MONGO_URI: " MONGO_URI; echo
  case "$MONGO_URI" in
    mongodb+srv://*|mongodb://*) ;;
    *) echo "That does not look like a MongoDB connection string." >&2; exit 1;;
  esac
  case "$MONGO_URI" in *"<db_password>"*|*"<password>"*)
    echo "Replace <db_password> with the real password first." >&2; exit 1;;
  esac
  printf '%s' "$MONGO_URI" | gcloud secrets create focusmind-mongo-uri --replication-policy=automatic --data-file=-
  unset MONGO_URI
else
  echo "focusmind-mongo-uri already exists"
fi

# --- 3. Video storage (Cloud Storage, private) ------------------------------------
step "Video bucket"
if ! exists gcloud storage buckets describe "gs://$BUCKET"; then
  gcloud storage buckets create "gs://$BUCKET" --location="$REGION" \
    --uniform-bucket-level-access --public-access-prevention
else
  echo "gs://$BUCKET already exists"
fi

# --- 4. Service account for the server --------------------------------------------
step "Service account and permissions"
if ! exists gcloud iam service-accounts describe "$SA"; then
  gcloud iam service-accounts create "$SA_NAME" --display-name="FocusMind Cloud Run server"
fi
for secret in focusmind-secret-key focusmind-mongo-uri; do
  gcloud secrets add-iam-policy-binding "$secret" --member="serviceAccount:$SA" \
    --role=roles/secretmanager.secretAccessor >/dev/null
done
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member="serviceAccount:$SA" \
  --role=roles/storage.objectAdmin >/dev/null

# --- 5. Build both images (Cloud Build) -------------------------------------------
step "Building images ($TAG)"
if ! exists gcloud artifacts repositories describe focusmind --location="$REGION"; then
  gcloud artifacts repositories create focusmind --repository-format=docker --location="$REGION"
fi
gcloud builds submit backend  --tag "$REPO/server:$TAG"
gcloud builds submit frontend --tag "$REPO/client:$TAG"

# --- 6. Cloud Run (two services, reachable only through the Load Balancer) --------
step "Deploying $SERVER"
gcloud run deploy "$SERVER" --image="$REPO/server:$TAG" --region="$REGION" \
  --service-account="$SA" --allow-unauthenticated \
  --ingress=internal-and-cloud-load-balancing \
  --port=8000 --memory=1Gi --cpu=1 --timeout=3600 \
  --min-instances=0 --max-instances=3 --execution-environment=gen2 \
  --set-secrets=SECRET_KEY=focusmind-secret-key:latest,MONGO_URI=focusmind-mongo-uri:latest \
  --set-env-vars=MONGO_DB_NAME=focusmind,SEED_CATALOG=true,MAX_VIDEO_UPLOAD_BYTES=31457280,USER_VIDEO_QUOTA_BYTES=1073741824,ACCESS_TOKEN_TTL_MINUTES=120 \
  --add-volume=name=videos,type=cloud-storage,bucket="$BUCKET",mount-options="uid=10001;gid=10001" \
  --add-volume-mount=volume=videos,mount-path=/data/videos \
  --startup-probe=httpGet.path=/health,initialDelaySeconds=5,periodSeconds=10,failureThreshold=12

step "Deploying $CLIENT"
gcloud run deploy "$CLIENT" --image="$REPO/client:$TAG" --region="$REGION" \
  --allow-unauthenticated --ingress=internal-and-cloud-load-balancing \
  --port=3000 --memory=256Mi --cpu=1 --min-instances=0 --max-instances=3

# --- 7. Load Balancer --------------------------------------------------------------
step "Load Balancer"
exists gcloud compute addresses describe focusmind-ip --global ||
  gcloud compute addresses create focusmind-ip --global
IP="$(gcloud compute addresses describe focusmind-ip --global --format='value(address)')"

for svc in server client; do
  exists gcloud compute network-endpoint-groups describe "focusmind-$svc-neg" --region="$REGION" ||
    gcloud compute network-endpoint-groups create "focusmind-$svc-neg" --region="$REGION" \
      --network-endpoint-type=serverless --cloud-run-service="focusmind-$svc"
  if ! exists gcloud compute backend-services describe "focusmind-$svc-backend" --global; then
    gcloud compute backend-services create "focusmind-$svc-backend" --global \
      --load-balancing-scheme=EXTERNAL_MANAGED
    gcloud compute backend-services add-backend "focusmind-$svc-backend" --global \
      --network-endpoint-group="focusmind-$svc-neg" --network-endpoint-group-region="$REGION"
  fi
done

if ! exists gcloud compute url-maps describe focusmind-lb --global; then
  gcloud compute url-maps create focusmind-lb --global --default-service=focusmind-client-backend
  gcloud compute url-maps add-path-matcher focusmind-lb --global --path-matcher-name=routes \
    --default-service=focusmind-client-backend \
    --path-rules="/api/*=focusmind-server-backend,/health=focusmind-server-backend" \
    --new-hosts="*"
fi

exists gcloud compute ssl-certificates describe focusmind-cert --global ||
  gcloud compute ssl-certificates create focusmind-cert --domains="$DOMAIN" --global

exists gcloud compute target-https-proxies describe focusmind-https-proxy --global ||
  gcloud compute target-https-proxies create focusmind-https-proxy --global \
    --url-map=focusmind-lb --ssl-certificates=focusmind-cert

exists gcloud compute forwarding-rules describe focusmind-https-rule --global ||
  gcloud compute forwarding-rules create focusmind-https-rule --global \
    --load-balancing-scheme=EXTERNAL_MANAGED --address=focusmind-ip \
    --target-https-proxy=focusmind-https-proxy --ports=443

# http:// → https:// (the camera only works on HTTPS)
if ! exists gcloud compute url-maps describe focusmind-http-redirect --global; then
  printf '%s\n' 'name: focusmind-http-redirect' 'defaultUrlRedirect:' \
    '  redirectResponseCode: MOVED_PERMANENTLY_DEFAULT' '  httpsRedirect: true' |
    gcloud compute url-maps import focusmind-http-redirect --global --quiet   # YAML from stdin
fi
exists gcloud compute target-http-proxies describe focusmind-http-proxy --global ||
  gcloud compute target-http-proxies create focusmind-http-proxy --global --url-map=focusmind-http-redirect
exists gcloud compute forwarding-rules describe focusmind-http-rule --global ||
  gcloud compute forwarding-rules create focusmind-http-rule --global \
    --load-balancing-scheme=EXTERNAL_MANAGED --address=focusmind-ip \
    --target-http-proxy=focusmind-http-proxy --ports=80

# --- Done ---------------------------------------------------------------------------
CERT="$(gcloud compute ssl-certificates describe focusmind-cert --global --format='value(managed.status)')"
cat <<EOF

=====================================================================
 Deployed images: $TAG
 Load Balancer IP: $IP
 Certificate:      $CERT   (PROVISIONING is normal; up to 60 minutes)

 Next, at your domain provider (e.g. No-IP):
   A record  $DOMAIN  ->  $IP   (this address only)

 When the certificate is ACTIVE:
   sh scripts/verify-deployment.sh https://$DOMAIN --journey
=====================================================================
EOF
