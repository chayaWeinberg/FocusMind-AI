"""Curated external videos of the catalog library lessons
(app/seed/catalog_library.py: Harvard CS50 and Microsoft Learn).
FocusMind only links to them: nothing is downloaded or re-hosted.

Each lesson has up to three candidates, in order of integration:
1. ``direct``: an MP4 file of the lecture. It plays in FocusMind's own
   player: position, progress and ReplayAI work.
2. ``youtube``: the same lecture on YouTube. It is embedded,
   with no position tracking and no ReplayAI.
3. ``page``: the official lecture page (notes, slides, video). It is opened on
   the external site, with no tracking and no ReplayAI.

``python -m app.catalog_videos check`` tests which candidates the server's
network can reach, and ``apply`` attaches the best reachable one. A filter
such as NetFree may block some of them (measured results: docs/catalog-library.md).

``match``: "full" means the lecture covers the lesson's topic; "partial" means
it covers part of it (explained in ``note``). The relevance was checked
against the official lecture notes.
"""

from dataclasses import dataclass

LICENSE = "CC BY-NC-SA 4.0"


@dataclass(frozen=True)
class Lecture:
    key: str
    name: str
    page_url: str
    direct_url: str | None
    youtube_id: str | None
    license: str = LICENSE

    def candidates(self) -> list[tuple[str, str]]:
        found = []
        if self.direct_url:
            found.append(("direct", self.direct_url))
        if self.youtube_id:
            found.append(("youtube", f"https://www.youtube.com/watch?v={self.youtube_id}"))
        found.append(("page", self.page_url))
        return found


@dataclass(frozen=True)
class LessonVideo:
    course_slug: str
    seed_key: str
    lecture: Lecture
    match: str  # "full" | "partial"
    note: str = ""


def library_entries() -> list[LessonVideo]:
    """Lessons of the expanded catalog (app/seed/catalog_library.py)."""
    from app.seed.catalog_library import LIBRARY

    entries = []
    for course in LIBRARY:
        for lesson in course["lessons"]:
            video = lesson["video"]
            entries.append(LessonVideo(
                course["slug"], lesson["key"],
                Lecture(
                    key=f"{course['slug']}/{lesson['key']}",
                    name=video["source_title"],
                    page_url=video["page_url"],
                    direct_url=video.get("direct_url"),
                    youtube_id=video.get("youtube_id"),
                    license=video["license"],
                ),
                "full",
            ))
    return entries


def all_entries() -> list[LessonVideo]:
    return library_entries()
