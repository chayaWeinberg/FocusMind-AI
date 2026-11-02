# ── Stage: base Python image ───────────────────────────────────────────────────
FROM python:3.12-slim

# Prevents Python from writing .pyc files and enables unbuffered stdout/stderr
# so container logs appear immediately without buffering.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt \
    REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt \
    PIP_CERT=/etc/ssl/certs/ca-certificates.crt

# Set working directory inside the container
WORKDIR /app

# Install the NetFree certificates into Debian's trusted CA store. Debian
# requires one certificate per .crt file, so split the PEM bundle first.
COPY netfree-ca.pem netfree-sign-root.crt /tmp/
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /usr/local/share/ca-certificates/netfree \
    && cat /tmp/netfree-ca.pem /tmp/netfree-sign-root.crt | awk '/-----BEGIN CERTIFICATE-----/ { count++; certificate = sprintf("/usr/local/share/ca-certificates/netfree/netfree-%02d.crt", count) } certificate != "" { print > certificate } /-----END CERTIFICATE-----/ { close(certificate); certificate = "" } END { if (count == 0 || certificate != "") exit 1 }' \
    && update-ca-certificates \
    && rm /tmp/netfree-ca.pem

# Copy and install dependencies first (separate layer — cached unless
# requirements.txt changes, which keeps rebuilds fast).
COPY requirements.txt .
RUN pip install --no-cache-dir --cert "$PIP_CERT" -r requirements.txt

# Copy the application source code
COPY . .

# Expose the port uvicorn listens on (must match docker-compose.yml)
EXPOSE 8000

# Start the FastAPI application with uvicorn.
# --host 0.0.0.0 binds to all interfaces inside the container so Docker
# can route traffic to it. The host-side binding to 127.0.0.1 is handled
# by docker-compose.yml, not here.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
