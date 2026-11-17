FROM node:22-alpine

WORKDIR /app

# Optional extra CA certificates (NetFree etc.) from frontend/certs/, so that
# `npm ci` works behind HTTPS-inspecting networks. Node reads them through
# NODE_EXTRA_CA_CERTS; an empty bundle is fine when there are none.
COPY certs/ /tmp/extra-ca/
RUN set -eu; \
    : > /etc/ssl/extra-ca.pem; \
    for file in /tmp/extra-ca/*.pem /tmp/extra-ca/*.crt; do \
      [ -f "$file" ] || continue; \
      cat "$file" >> /etc/ssl/extra-ca.pem; \
      echo >> /etc/ssl/extra-ca.pem; \
    done; \
    rm -rf /tmp/extra-ca
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/extra-ca.pem

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000", "--strictPort"]
