# FocusMind AI — client container (production).
# Builds the React app and serves the static files with nginx on port 3000.
# The API is a separate container: in Google Cloud the Load Balancer sends
# /api/* and /health to it, and everything else here. Locally the same routing
# is rehearsed with docker-compose.prod.yml.
#
#   docker build -t focusmind-client ./frontend
#
# Development (Vite dev server with hot reload) uses Dockerfile.dev.

# --- 1. React production build ---------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /build

# Optional extra CA certificates (NetFree etc.) from frontend/certs/, so that
# `npm ci` works behind HTTPS-inspecting networks. Empty bundle when there are none.
COPY certs/ /tmp/extra-ca/
RUN set -eu; : > /etc/ssl/extra-ca.pem; \
    for file in /tmp/extra-ca/*.pem /tmp/extra-ca/*.crt; do \
      [ -f "$file" ] && { cat "$file"; echo; } >> /etc/ssl/extra-ca.pem; \
    done; \
    rm -rf /tmp/extra-ca
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/extra-ca.pem

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Same-origin API: the browser calls /api on the domain that served the page.
ENV VITE_API_URL=
RUN npm run build

# --- 2. Static file server ---------------------------------------------------------
FROM nginx:1.27-alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /build/dist /usr/share/nginx/html

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:3000/ || exit 1
