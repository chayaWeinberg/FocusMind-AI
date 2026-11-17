"""Curated videos for the example catalog lessons.

Source: Harvard University's CS50 open courses (CS50P, CS50 SQL, CS50 AI),
licensed CC BY-NC-SA 4.0. Every URL below was copied from the course's
official week page (https://cs50.harvard.edu/...), not composed by hand.
FocusMind only links to them: nothing is downloaded or re-hosted.

Each lesson has up to three candidates, in order of integration:
1. ``direct``: the MP4 lecture on cdn.cs50.net. It plays in FocusMind's own
   player: position, progress and ReplayAI work.
2. ``youtube``: the same lecture on CS50's YouTube channel. It is embedded,
   with no position tracking and no ReplayAI.
3. ``page``: the official lecture page (notes, slides, video). It is opened on
   the external site, with no tracking and no ReplayAI.

``python -m app.catalog_videos check`` tests which candidates the server's
network can reach, and ``apply`` attaches the best reachable one. A filter
such as NetFree may block some of them (see ``NETFREE_RESULTS``).

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


def _lecture(key: str, name: str, page: str, cdn: str, youtube_id: str) -> Lecture:
    return Lecture(
        key=key,
        name=name,
        page_url=f"https://cs50.harvard.edu/{page}/",
        direct_url=f"https://cdn.cs50.net/{cdn}-720p.mp4",
        youtube_id=youtube_id,
    )


CS50P_0 = _lecture("cs50p-0", "CS50P, Lecture 0: Functions, Variables", "python/2022/weeks/0", "python/2022/x/lectures/0/lecture0", "JP7ITIXGpHk")
CS50P_1 = _lecture("cs50p-1", "CS50P, Lecture 1: Conditionals", "python/2022/weeks/1", "python/2022/x/lectures/1/lecture1", "_b6NgY_pMdw")
CS50P_2 = _lecture("cs50p-2", "CS50P, Lecture 2: Loops", "python/2022/weeks/2", "python/2022/x/lectures/2/lecture2", "-7xg8pGcP6w")
SQL_0 = _lecture("cs50sql-0", "CS50 SQL, Lecture 0: Querying", "sql/2024/weeks/0", "sql/2023/x/lectures/0/lecture0", "vHYeChEf2lA")
SQL_1 = _lecture("cs50sql-1", "CS50 SQL, Lecture 1: Relating", "sql/2024/weeks/1", "sql/2023/x/lectures/1/lecture1", "_2t18Hy9Z0Y")
SQL_3 = _lecture("cs50sql-3", "CS50 SQL, Lecture 3: Writing", "sql/2024/weeks/3", "sql/2023/x/lectures/3/lecture3", "BD08USRd2M8")
AI_0 = _lecture("cs50ai-0", "CS50 AI, Lecture 0: Search", "ai/2024/weeks/0", "ai/2020/spring/lectures/0/lecture0", "WbzNRTTrX0g")
AI_4 = _lecture("cs50ai-4", "CS50 AI, Lecture 4: Learning", "ai/2024/weeks/4", "ai/2020/spring/lectures/4/lecture4", "-g0iJjnO2_w")
AI_5 = _lecture("cs50ai-5", "CS50 AI, Lecture 5: Neural Networks", "ai/2024/weeks/5", "ai/2020/spring/lectures/5/lecture5", "J1QD9hLDEDY")
AI_6 = _lecture("cs50ai-6", "CS50 AI, Lecture 6: Language", "ai/2024/weeks/6", "ai/2023/x/lectures/6/lecture6", "QAZc9xsQNjQ")


@dataclass(frozen=True)
class LessonVideo:
    course_slug: str
    seed_key: str
    lecture: Lecture
    match: str  # "full" | "partial"
    note: str = ""


LESSON_VIDEOS: list[LessonVideo] = [
    LessonVideo("python-for-beginners", "intro", CS50P_0, "partial", "First programs and the interpreter; installing Python is not covered."),
    LessonVideo("python-for-beginners", "variables", CS50P_0, "full"),
    LessonVideo("python-for-beginners", "conditions", CS50P_1, "full"),
    LessonVideo("python-for-beginners", "loops", CS50P_2, "full"),
    LessonVideo("python-for-beginners", "functions", CS50P_0, "full", "Defining functions, parameters and return values."),
    LessonVideo("python-for-beginners", "collections", CS50P_2, "full", "Lists and dictionaries are taught together with loops."),
    LessonVideo("sql-fundamentals", "relational", SQL_1, "full", "Tables, primary and foreign keys, relationships."),
    LessonVideo("sql-fundamentals", "select", SQL_0, "full"),
    LessonVideo("sql-fundamentals", "aggregate", SQL_0, "partial", "COUNT, AVG and SUM; GROUP BY and HAVING appear in Lecture 1."),
    LessonVideo("sql-fundamentals", "joins", SQL_1, "full"),
    LessonVideo("sql-fundamentals", "modify", SQL_3, "full"),
    LessonVideo("intro-to-ai", "what-is-ai", AI_0, "partial", "A short introduction to AI, then search algorithms."),
    LessonVideo("intro-to-ai", "machine-learning", AI_4, "full"),
    LessonVideo("intro-to-ai", "neural-networks", AI_5, "full"),
    LessonVideo("intro-to-ai", "language-models", AI_6, "full", "Language models, attention and transformers."),
    # intro-to-ai / responsible-ai: no CS50 lecture covers bias, privacy and
    # transparency; no video is attached rather than an unrelated one.
]

# Measured on 2026-11-16 from the development machine behind NetFree, in
# Microsoft Edge (real <video> playback, a youtube-nocookie embed, opening the
# page) and with HTTP range requests. Identical for all ten lectures above:
NETFREE_RESULTS = {
    "direct": "blocked: HTTP 418 NetFree block page (rule: every *.mp4 URL)",
    "youtube": "blocked: HTTP 418 for the embed and for the video stream",
    "page": "accessible: HTTP 200, the page opens in Edge; its embedded videos are YouTube/MP4 and therefore blocked too",
}


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
    return LESSON_VIDEOS + library_entries()
