"""HTTP security layer shared by the API and the served frontend.

- Private API responses are never cached (``no-store``): after logout, the
  browser's Back button or another user of the same browser cannot get them
  from the HTTP cache.
- Cross-site write requests are rejected (CSRF defense in depth on top of the
  SameSite=Lax session cookie): a POST/PUT/PATCH/DELETE whose ``Origin`` is
  neither this site nor an allowed CORS origin gets 403.
- Standard browser hardening headers, and a Content-Security-Policy for the
  HTML pages of the production frontend.
"""

from urllib.parse import urlsplit

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.config import settings

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# The app loads everything from its own origin (MediaPipe model and WASM are
# served locally). YouTube is the only allowed embed; external direct videos
# may come from any https host.
CONTENT_SECURITY_POLICY = "; ".join([
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
])

COMMON_HEADERS = [
    (b"x-content-type-options", b"nosniff"),
    (b"referrer-policy", b"strict-origin-when-cross-origin"),
    (b"permissions-policy", b"camera=(self), microphone=(), geolocation=()"),
    (b"x-frame-options", b"DENY"),
]


def _header(scope: Scope, name: bytes) -> str | None:
    for key, value in scope.get("headers", []):
        if key == name:
            return value.decode("latin-1")
    return None


def origin_allowed(origin: str, scope: Scope) -> bool:
    """Same site, a configured CORS origin, or (development only) localhost."""
    if origin in settings.cors_origins:
        return True
    parts = urlsplit(origin)
    if not parts.scheme or not parts.netloc:
        return False
    hosts = {_header(scope, b"host"), _header(scope, b"x-forwarded-host")}
    if parts.netloc in hosts:
        return True
    # The Vite dev server proxies /api with a rewritten Host header.
    return settings.environment == "development" and parts.hostname in {"localhost", "127.0.0.1", "::1"}


class SecurityMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        path: str = scope.get("path", "")
        is_api = path == "/api" or path.startswith("/api/")
        origin = _header(scope, b"origin")
        if is_api and scope.get("method") in UNSAFE_METHODS and origin and origin != "null" and not origin_allowed(origin, scope):
            await _reject(send)
            return
        if origin == "null" and is_api and scope.get("method") in UNSAFE_METHODS:
            await _reject(send)
            return

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = [(key, value) for key, value in message.get("headers", []) if not (is_api and key.lower() in (b"cache-control", b"pragma"))]
                present = {key.lower() for key, _ in headers}
                headers += [(key, value) for key, value in COMMON_HEADERS if key not in present]
                if is_api:
                    headers += [(b"cache-control", b"no-store"), (b"pragma", b"no-cache")]
                else:
                    content_type = next((value for key, value in headers if key.lower() == b"content-type"), b"")
                    if content_type.startswith(b"text/html"):
                        headers.append((b"content-security-policy", CONTENT_SECURITY_POLICY.encode()))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_headers)


async def _reject(send: Send) -> None:
    body = b'{"detail":"Cross-site request blocked."}'
    await send({
        "type": "http.response.start",
        "status": 403,
        "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode()), *COMMON_HEADERS],
    })
    await send({"type": "http.response.body", "body": body})
