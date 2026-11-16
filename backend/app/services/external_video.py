"""Validation of external lesson video links.

The server never fetches these URLs (no proxying, no downloading): it only
classifies them. Supported:

- ``direct``: an https link to a browser-playable file (.mp4, .webm, .ogv,
  .m4v). Played by the browser's <video> element, so the position can be
  saved and restored. The remote host may still block playback (CORS,
  hotlink protection, codecs); the player reports that to the user.
- ``youtube``: an explicit trusted provider, embedded through
  youtube-nocookie.com. The position cannot be tracked without loading the
  provider's script, so these lessons are completed manually.

- ``page``: only when the editor explicitly says the link is a *web page*
  that shows a video (``kind="page"``). It is never played inside FocusMind:
  learners get a clearly labelled "open on the external website" link, the
  position is not tracked, and ReplayAI is unavailable.

Anything else (an ordinary web page given as a video link, other providers)
is rejected with a clear error.
"""

import ipaddress
import re
from typing import Any
from urllib.parse import parse_qs, urlsplit

DIRECT_EXTENSIONS = (".mp4", ".webm", ".ogv", ".ogg", ".m4v")
YOUTUBE_HOSTS = frozenset({
    "youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be",
    "youtube-nocookie.com", "www.youtube-nocookie.com",
})
_YOUTUBE_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")


class InvalidVideoUrlError(ValueError):
    """``str(error)`` is safe to show to users."""


def _youtube_id(host: str, path: str, query: str) -> str | None:
    if host == "youtu.be":
        candidate = path.strip("/").split("/")[0]
    elif path == "/watch":
        candidate = (parse_qs(query).get("v") or [""])[0]
    else:
        parts = path.strip("/").split("/")
        candidate = parts[1] if len(parts) >= 2 and parts[0] in {"embed", "shorts", "live"} else ""
    return candidate if _YOUTUBE_ID.fullmatch(candidate) else None


def parse_external_video(url: str, kind: str = "video") -> dict[str, Any]:
    """Returns the lesson ``video`` sub-document for a supported link.

    ``kind="page"`` accepts any public https page as an external video page
    (direct files and YouTube links are still recognised as such).
    """
    if any(char.isspace() for char in url) or len(url) > 2048:
        raise InvalidVideoUrlError("The link is not a valid address.")
    try:
        parts = urlsplit(url)
        host = (parts.hostname or "").lower()
        _ = parts.port  # raises for an invalid port
    except ValueError:
        raise InvalidVideoUrlError("The link is not a valid address.") from None

    if parts.scheme != "https":
        raise InvalidVideoUrlError("Only secure https links are supported.")
    if not host or parts.username or parts.password:
        raise InvalidVideoUrlError("The link is not a valid address.")
    if host == "localhost" or host.endswith(".localhost") or host.endswith(".local"):
        raise InvalidVideoUrlError("Links to local or private addresses are not allowed.")
    try:
        ipaddress.ip_address(host.strip("[]"))
    except ValueError:
        pass
    else:
        raise InvalidVideoUrlError("Links to IP addresses are not allowed; use a public domain name.")

    if host in YOUTUBE_HOSTS:
        video_id = _youtube_id(host, parts.path, parts.query)
        if video_id is None:
            raise InvalidVideoUrlError("This YouTube link does not point to a single video.")
        return {
            "source_type": "external",
            "provider": "youtube",
            "url": f"https://www.youtube.com/watch?v={video_id}",
            "embed_id": video_id,
        }

    if parts.path.lower().endswith(DIRECT_EXTENSIONS):
        return {"source_type": "external", "provider": "direct", "url": url}

    if kind == "page":
        return {"source_type": "external", "provider": "page", "url": url}

    raise InvalidVideoUrlError(
        "Unsupported link. Use a direct link to a video file (.mp4 or .webm) or a YouTube video link."
    )


def youtube_embed_url(video_id: str) -> str:
    return f"https://www.youtube-nocookie.com/embed/{video_id}?rel=0"
