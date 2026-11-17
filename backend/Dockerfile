FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt \
    REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt \
    PIP_CERT=/etc/ssl/certs/ca-certificates.crt

WORKDIR /app

# Optional extra CA certificates (NetFree etc.) from backend/certs/.
# The folder always exists (it contains a README), so the build works with or
# without certificates. Debian needs one certificate per .crt file, so PEM
# bundles are split. ca-certificates is already present in python:*-slim.
COPY certs/ /tmp/extra-ca/
RUN set -eu; \
    mkdir -p /usr/local/share/ca-certificates/extra; \
    count=0; \
    for file in /tmp/extra-ca/*.pem /tmp/extra-ca/*.crt; do \
      [ -f "$file" ] || continue; \
      awk -v prefix="/usr/local/share/ca-certificates/extra/$(basename "$file")" \
        '/-----BEGIN CERTIFICATE-----/ { n++; out = sprintf("%s-%02d.crt", prefix, n) } out != "" { print > out } /-----END CERTIFICATE-----/ { close(out); out = "" }' \
        "$file"; \
      count=$((count + 1)); \
    done; \
    update-ca-certificates; \
    rm -rf /tmp/extra-ca; \
    echo "Installed extra CA files: $count"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
# Original demonstration videos (manifest.json + MP4), installed on startup
# when SEED_CATALOG=true.
COPY demo_assets ./demo_assets

# Run as an unprivileged user. /data/videos is the mount point of the
# persistent video volume (a Docker volume locally, a Cloud Storage bucket on
# Cloud Run); a fresh named volume inherits this ownership.
RUN useradd --create-home --uid 10001 focusmind \
    && mkdir -p /data/videos \
    && chown -R focusmind:focusmind /data/videos

# Production defaults. Secrets (SECRET_KEY, MONGO_URI) are never baked in: on
# Cloud Run they come from Secret Manager, locally from docker compose.
# The client and the API share one domain behind the Load Balancer, so no CORS
# origins are needed.
ENV ENV=production \
    VIDEO_STORAGE_DIR=/data/videos \
    DEMO_VIDEOS_DIR=/app/demo_assets \
    CORS_ORIGINS=[] \
    PORT=8000
USER focusmind

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\", \"8000\")}/health', timeout=4)"

# The Load Balancer terminates HTTPS in front of the container; --proxy-headers
# makes the real client IP visible (login rate limiting).
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*' --timeout-graceful-shutdown 20"]
