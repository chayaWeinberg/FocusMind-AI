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

# Run as an unprivileged user.
RUN useradd --create-home --uid 10001 focusmind
USER focusmind

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
