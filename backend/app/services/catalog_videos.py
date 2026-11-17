"""Attach curated videos to the example catalog lessons (see
app/seed/catalog_videos.py), choosing per lesson the best candidate that the
server's network can actually reach.

Safety rules (idempotent, never destructive):
- only catalog courses from the seed (by slug) and their seeded lessons;
- a lesson is changed only if it has no video, or its video was set by this
  tool earlier (``catalog_video_key``). Uploaded videos, links chosen by a
  person, and videos a content manager removed (``cleared_by_manager``) are
  never touched;
- users, enrollments, progress and uploads are not modified;
- the course is not marked as edited by a manager.

Reachability (``probe``) is an HTTP check from the server, not a playback
test: a direct file counts as playable only when the first bytes are a real
video container; a filter's block page (e.g. NetFree, HTTP 418) counts as
blocked. Real browser playback still needs a manual or Playwright check.
"""

import ssl
import urllib.error
import urllib.request
from dataclasses import dataclass

from pymongo.asynchronous.database import AsyncDatabase

from app.seed.catalog_videos import LessonVideo, all_entries
from app.services.courses import utcnow
from app.services.external_video import InvalidVideoUrlError, parse_external_video

PLAYABLE = "playable"
REACHABLE = "reachable"
BLOCKED = "blocked"
UNAVAILABLE = "unavailable"
MODES = ("auto", "direct", "youtube", "page")
USER_AGENT = "FocusMind-catalog-video-check/1.0"


def _looks_like_video(head: bytes) -> bool:
    return head[4:8] == b"ftyp" or head.startswith(b"\x1a\x45\xdf\xa3") or head.startswith(b"OggS")


def _blocked(status: int, body: bytes) -> bool:
    return status == 418 or b"netfree" in body.lower()


def probe(kind: str, url: str, timeout: float = 15.0) -> str:
    """HTTP-level reachability of one candidate from this server."""
    target = url
    if kind == "youtube":
        target = "https://www.youtube-nocookie.com/embed/" + url.rsplit("=", 1)[-1]
    request = urllib.request.Request(target, headers={"User-Agent": USER_AGENT, "Range": "bytes=0-511"})
    try:
        with urllib.request.urlopen(request, timeout=timeout, context=ssl.create_default_context()) as response:
            body = response.read(4096)
            content_type = response.headers.get_content_type()
            status = response.status
    except urllib.error.HTTPError as error:
        return BLOCKED if _blocked(error.code, error.read(4096)) else UNAVAILABLE
    except (urllib.error.URLError, TimeoutError, OSError, ssl.SSLError):
        return UNAVAILABLE
    if _blocked(status, body):
        return BLOCKED
    if kind == "direct":
        return PLAYABLE if status in (200, 206) and (content_type.startswith("video/") or _looks_like_video(body)) else UNAVAILABLE
    return REACHABLE if status in (200, 206) and content_type == "text/html" else UNAVAILABLE


def choose(results: dict[str, str], mode: str) -> str | None:
    """The candidate to attach: the requested one, or (auto) the most integrated reachable one."""
    if mode != "auto":
        return mode
    if results.get("direct") == PLAYABLE:
        return "direct"
    if results.get("youtube") == REACHABLE:
        return "youtube"
    if results.get("page") == REACHABLE:
        return "page"
    return None


def video_document(entry: LessonVideo, kind: str) -> dict:
    url = dict(entry.lecture.candidates())[kind]
    video = parse_external_video(url, "page" if kind == "page" else "video")
    video["source"] = {"name": entry.lecture.name, "page_url": entry.lecture.page_url, "license": entry.lecture.license}
    video["catalog_video_key"] = f"{entry.lecture.key}:{kind}"
    return video


@dataclass
class Outcome:
    course_slug: str
    seed_key: str
    action: str  # attached | unchanged | skipped
    detail: str


async def apply_choices(database: AsyncDatabase, choices: dict[tuple[str, str], str | None], dry_run: bool = False) -> list[Outcome]:
    outcomes: list[Outcome] = []
    entries = all_entries()
    courses = {
        row["slug"]: row
        async for row in database.courses.find({"type": "catalog", "retired": {"$ne": True}, "slug": {"$in": list({e.course_slug for e in entries})}})
    }
    for entry in entries:
        key = (entry.course_slug, entry.seed_key)
        course = courses.get(entry.course_slug)
        lesson = await database.lessons.find_one({"course_id": course["_id"], "seed_key": entry.seed_key}) if course else None
        if lesson is None:
            outcomes.append(Outcome(*key, "skipped", "lesson not found"))
            continue
        current = lesson.get("video") or {"source_type": "none"}
        ours = bool(current.get("catalog_video_key"))
        if current.get("source_type") != "none" and not ours:
            outcomes.append(Outcome(*key, "skipped", f"keeps its own video ({current.get('source_type')})"))
            continue
        if current.get("cleared_by_manager"):
            outcomes.append(Outcome(*key, "skipped", "a content manager removed the video"))
            continue
        kind = choices.get(key)
        if kind is not None and kind not in dict(entry.lecture.candidates()):
            outcomes.append(Outcome(*key, "skipped", f"no {kind} candidate"))
            continue
        if kind is None:
            outcomes.append(Outcome(*key, "skipped", "no reachable candidate"))
            continue
        try:
            video = video_document(entry, kind)
        except InvalidVideoUrlError as error:
            outcomes.append(Outcome(*key, "skipped", f"invalid {kind} link: {error}"))
            continue
        if ours and current.get("catalog_video_key") == video["catalog_video_key"] and current.get("url") == video["url"]:
            outcomes.append(Outcome(*key, "unchanged", video["catalog_video_key"]))
            continue
        if not dry_run:
            changes: dict = {"video": video, "updated_at": utcnow()}
            if ours and current.get("provider") != video.get("provider"):
                changes["duration_seconds"] = None  # read again from the new source
            await database.lessons.update_one({"_id": lesson["_id"]}, {"$set": changes})
        outcomes.append(Outcome(*key, "attached" if not dry_run else "would attach", video["catalog_video_key"]))
    return outcomes
