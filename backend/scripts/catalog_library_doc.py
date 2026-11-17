"""Writes docs/catalog-library.md from app/seed/catalog_library.py and the
measured accessibility (app/seed/catalog_netfree.json).

    cd backend; .venv\\Scripts\\python scripts/catalog_library_doc.py
"""

import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.seed.catalog_library import LIBRARY  # noqa: E402
from app.seed.library import netfree_results  # noqa: E402

LEVELS = {"beginner": "מתחילים", "intermediate": "בינוני", "advanced": "מתקדמים"}
STATUS = {
    "playable": "plays on this network",
    "page_only": "page opens, video blocked",
    "blocked": "blocked",
    "unverified": "not verified",
}


def clock(seconds):
    if not seconds:
        return "not verified"
    seconds = int(seconds)
    return f"{seconds // 3600}:{seconds % 3600 // 60:02d}:{seconds % 60:02d}" if seconds >= 3600 else f"{seconds // 60}:{seconds % 60:02d}"


netfree = netfree_results()
lessons = [(course, lesson) for course in LIBRARY for lesson in course["lessons"]]
status = Counter(netfree["lessons"].get(f"{c['slug']}/{l['key']}", {}).get("status", "unverified") for c, l in lessons)
providers = Counter(lesson["video"]["provider"] for _, lesson in lessons)

out = [
    "# Video library catalog",
    "",
    f"{len(LIBRARY)} courses, {len(lessons)} lessons. Each lesson links to one specific, real educational",
    "video. Sources:",
    "",
]
out += [f"- **{name}**: {count} lessons" for name, count in providers.items()]
out += [
    "",
    "## How the data was collected and verified",
    "",
    "Every URL, title and duration below was read from the source itself, never composed by hand:",
    "",
    "- **Microsoft Learn:**",
    "  - episodes came from the public API (`/api/contentbrowser/search/shows/<show>/episodes`);",
    "  - the video files came from `/api/video/public/v1/entries/<id>`;",
    "  - the duration comes from the API.",
    "- **Harvard CS50:**",
    "  - lecture and Short pages on cs50.harvard.edu, with the official YouTube id and MP4 link listed on each page;",
    "  - the duration comes from the official English transcript (`.srt`) on cdn.cs50.net;",
    "  - the topic was checked against the transcript (keyword counts).",
    "- Each lesson's video page was requested at build time (HTTP 200 for all).",
    "- YouTube itself cannot be reached from this network (HTTP 418, NetFree), so the CS50 YouTube ids are",
    "  as published on the official CS50 pages, not checked on YouTube.",
    "- Lessons whose topic had no suitable video in these sources were not created (see *Gaps*).",
    "",
    "## Accessibility behind NetFree",
    "",
    f"Measured {netfree.get('checked_at') or '(not yet measured)'} with: {netfree.get('method', '-').rstrip('.')}.",
    "",
    "| Result | Lessons |",
    "|---|---|",
]
out += [f"| {STATUS[key]} | {status.get(key, 0)} |" for key in ("playable", "page_only", "blocked", "unverified")]
out += [
    "",
    "\"Page opens\" is not counted as a playable video. Lessons link to the page by default.",
    "`python -m app.catalog_videos apply` switches every lesson to the most integrated candidate",
    "that the server's network can reach:",
    "",
    "- **direct file:** FocusMind's own player, progress, attention monitoring and ReplayAI;",
    "- **YouTube:** embedded, no tracking;",
    "- **page:** opened externally.",
    "",
    "## Playing these videos inside FocusMind",
    "",
    "FocusMind's own player plays any direct external file. On those lessons the position, progress,",
    "attention segments and ReplayAI work like with an uploaded video. This was verified in Edge",
    "(`frontend/e2e/external-player.e2e.js`) with a **simulated** CDN that answers",
    "`https://cdn.cs50.net/...` with a local test file:",
    "",
    "1. a catalog lesson is switched to its direct file with the real tool;",
    "2. it plays in FocusMind's player and the position is saved and restored;",
    "3. ReplayAI seeks inside it and stops at the end of the interval.",
    "",
    "**No real external video played on this NetFree connection.**",
    "",
    "To get integrated playback for these lessons:",
    "",
    "1. Ask NetFree to allow the video hosts:",
    "   - `cdn.cs50.net` (MP4; today blocked by the general `*.mp4` rule);",
    "   - `videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net` (Microsoft Learn).",
    "2. Run:",
    "",
    "   ```powershell",
    "   docker compose exec backend python -m app.catalog_videos check   # see what is reachable now",
    "   docker compose exec backend python -m app.catalog_videos apply   # switches reachable lessons to direct playback",
    "   ```",
    "",
    "111 of the 116 lessons have a direct file. The 5 short Git clips (create repo, branches, push,",
    "pull, rebase) are offered as pages only.",
    "",
    "## Courses",
    "",
]
for course in LIBRARY:
    out += [
        f"### {course['title']} ({LEVELS[course['difficulty']]}, {course['category']}, {len(course['lessons'])} lessons)",
        "",
        course["description"],
        "",
        "| # | Lesson | Source video | Duration | Behind NetFree |",
        "|---|---|---|---|---|",
    ]
    for index, lesson in enumerate(course["lessons"], start=1):
        video = lesson["video"]
        measured = netfree["lessons"].get(f"{course['slug']}/{lesson['key']}", {})
        title = video["source_title"].replace("|", "/")
        youtube = f" ([YouTube](https://www.youtube.com/watch?v={video['youtube_id']}))" if video.get("youtube_id") else ""
        out.append(
            f"| {index} | {lesson['title']} | [{video['provider']}: {title}]({video['page_url']}){youtube} "
            f"| {clock(video.get('duration_seconds'))} | {STATUS[measured.get('status', 'unverified')]} |"
        )
    out.append("")

out += [
    "## Gaps (not created, no suitable verified video)",
    "",
    "- **No Hebrew-language videos.** The reachable official sources (Microsoft Learn, CS50) are in English.",
    "  Hebrew educational sites that host their videos on YouTube are blocked on this network.",
    "- **React in the browser.** CS50 Web \"User Interfaces\" is the only browser-React lecture found.",
    "  The rest of the course uses CS50's React Native lectures, which teach React itself (components,",
    "  props, state, Redux, testing).",
    "- **Docker.** There is no dedicated, vendor-neutral Docker series in these sources. The lessons use",
    "  Microsoft's container series (examples in .NET) and the Docker part of CS50 Web \"Testing, CI/CD\".",
    "- **Git.** Lessons 3-8 are short Microsoft clips from an Azure DevOps Git tutorial (plain Git",
    "  commands). Their MP4 files are not offered by the API (page only).",
    "- **Recursion (CS50 Short).** Its transcript is blocked on this network, so the duration is not",
    "  verified.",
    "",
    "## Licenses",
    "",
    "- CS50: CC BY-NC-SA 4.0 (attribution shown in the player).",
    "- Microsoft Learn: Microsoft's terms of use.",
    "",
    "FocusMind links to these videos and never downloads or re-hosts them.",
    "",
]
(ROOT.parent / "docs" / "catalog-library.md").write_text("\n".join(out), encoding="utf-8")
print(f"docs/catalog-library.md: {len(LIBRARY)} courses, {len(lessons)} lessons, status {dict(status)}")
