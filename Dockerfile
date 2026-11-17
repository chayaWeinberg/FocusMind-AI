# FocusMind AI — production image (one container: FastAPI API + built React app).
# Works on Google Cloud Run, any Docker host, and locally with
# docker-compose.prod.yml. Linux build; no dependency on a developer machine.
#
#   docker build -t focusmind-ai .
#
# Optional extra CA certificates (e.g. NetFree on a local network) are read
# from frontend/certs and backend/certs; they are ignored by Git, and the build
# works without them (as on Cloud Build).

# --- 1. React production build ---------------------------------------------------
FROM node:22-alpine AS frontend
WORKDIR /build
COPY frontend/certs/ /tmp/extra-ca/
RUN set -eu; : > /etc/ssl/extra-ca.pem; \
    for file in /tmp/extra-ca/*.pem /tmp/extra-ca/*.crt; do [ -f "$file" ] && { cat "$file"; echo; } >> /etc/ssl/extra-ca.pem; done; \
    rm -rf /tmp/extra-ca
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/extra-ca.pem
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# Same-origin API: the app calls /api on the host that served it.
ENV VITE_API_URL=
RUN npm run build

# --- 2. FastAPI runtime ----------------------------------------------------------
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt \
    PIP_CERT=/etc/ssl/certs/ca-certificates.crt
WORKDIR /app

COPY backend/certs/ /tmp/extra-ca/
RUN set -eu; mkdir -p /usr/local/share/ca-certificates/extra; \
    for file in /tmp/extra-ca/*.pem /tmp/extra-ca/*.crt; do \
      [ -f "$file" ] || continue; \
      awk -v prefix="/usr/local/share/ca-certificates/extra/$(basename "$file")" \
        '/-----BEGIN CERTIFICATE-----/ { n++; out = sprintf("%s-%02d.crt", prefix, n) } out != "" { print > out } /-----END CERTIFICATE-----/ { close(out); out = "" }' "$file"; \
    done; \
    update-ca-certificates; rm -rf /tmp/extra-ca

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY backend/demo_assets ./demo_assets
COPY --from=frontend /build/dist ./frontend_dist

RUN useradd --create-home --uid 10001 focusmind \
    && mkdir -p /data/videos && chown -R focusmind:focusmind /data/videos
USER focusmind

# Production defaults; secrets (SECRET_KEY, MONGO_URI) come from the platform.
ENV ENV=production \
    FRONTEND_DIST_DIR=/app/frontend_dist \
    DEMO_VIDEOS_DIR=/app/demo_assets \
    VIDEO_STORAGE_DIR=/data/videos \
    SEED_CATALOG=true \
    CORS_ORIGINS=[] \
    PORT=8080

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\", \"8080\")}/api/health', timeout=4)"

# Cloud Run sends PORT and terminates HTTPS in front of the container;
# --proxy-headers makes the real client IP visible (rate limiting).
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --proxy-headers --forwarded-allow-ips='*' --timeout-graceful-shutdown 20"]
