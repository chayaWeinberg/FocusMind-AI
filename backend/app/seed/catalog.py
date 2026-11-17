"""Idempotent seed of the example catalog.

Courses are matched by ``slug`` and lessons by (course, ``seed_key``), so
running the seed again updates texts without duplicating anything. Courses a
content manager edited (``edited_by_manager``) are left exactly as they are. Lessons
are created without a video (no fabricated links); existing lesson videos,
user progress and enrollments are never touched.

Run manually:   python -m app.seed
Or on startup:  SEED_CATALOG=true (off by default in development, on in the production image)
"""

from datetime import datetime, timezone

from pymongo.asynchronous.database import AsyncDatabase

from app.repositories.courses import CourseRepository, LessonRepository

# The three original demonstration courses (short sample videos), retired on
# 17.11.2026. They are identified by their stable seed slugs, never by title.
# The seed no longer creates them; existing copies are marked ``retired``
# (hidden everywhere, data kept, reversible by unsetting the flag).
RETIRED_COURSE_SLUGS = ("python-for-beginners", "sql-fundamentals", "intro-to-ai")


# FocusMind Academy: original full lessons (about 3 minutes each) that play
# inside FocusMind with progress, attention tracking and ReplayAI. Videos come
# from backend/demo_assets (frontend/scripts/academy-videos), installed on startup.
ACADEMY = [
    {
        "slug": "python-academy",
        "title": "Python בפועל",
        "category": "תכנות",
        "difficulty": "beginner",
        "description": "שיעורים מלאים עם הסברים ודוגמאות קוד: רשימות ומילונים, פונקציות, טיפול בשגיאות וקבצים.",
        "lessons": [
            ("lists-dicts", "רשימות ומילונים בעבודה אמיתית", "אינדקסים, append ו-sort, מילונים, get, ורשימה של מילונים."),
            ("functions", "פונקציות: פרמטרים, ערכי החזרה וברירות מחדל", "def ו-return, ברירות מחדל, החזרת כמה ערכים ותחום משתנים."),
            ("errors-files", "טיפול בשגיאות וקריאת קבצים", "קריאת הודעות שגיאה, try ו-except, with open, וקבצים חסרים."),
        ],
    },
    {
        "slug": "javascript-academy",
        "title": "JavaScript לדפדפן",
        "category": "פיתוח ווב",
        "difficulty": "beginner",
        "description": "היסודות של JavaScript מודרנית: משתנים וטיפוסים, מערכים עם map, filter ו-reduce, ועבודה עם DOM ואירועים.",
        "lessons": [
            ("basics", "let, const וטיפוסים", "הצהרת משתנים, typeof, תבניות מחרוזת, המרות אוטומטיות ו-===."),
            ("arrays", "מערכים: map, filter ו-reduce", "פונקציות חץ ושלוש המתודות שמחליפות רוב הלולאות."),
            ("dom", "DOM ואירועים: כפתור שמגיב ללחיצה", "querySelector, addEventListener, מחלקות CSS, ולמה textContent בטוח יותר."),
        ],
    },
    {
        "slug": "sql-academy",
        "title": "SQL לניתוח נתונים",
        "category": "נתונים",
        "difficulty": "intermediate",
        "description": "שאילתות לשאלות עסקיות אמיתיות על טבלת הזמנות: סינון, מיון, קיבוץ וחיבור טבלאות.",
        "lessons": [
            ("filtering", "סינון ומיון: WHERE ו-ORDER BY", "AND, OR, IN, BETWEEN, ORDER BY, LIMIT ו-IS NULL."),
            ("grouping", "GROUP BY ו-HAVING", "COUNT, SUM ו-AVG לפי קבוצות, וההבדל בין WHERE ל-HAVING."),
            ("joins", "JOIN: לחבר הזמנות ללקוחות", "מפתחות זרים, INNER JOIN, LEFT JOIN ומציאת לקוחות בלי הזמנות."),
        ],
    },
    {
        "slug": "algorithms-academy",
        "title": "אלגוריתמים בפועל",
        "category": "מדעי המחשב",
        "difficulty": "intermediate",
        "description": "איך מודדים יעילות של קוד, ושני אלגוריתמים קלאסיים עם מעקב צעד אחר צעד: חיפוש בינארי ומיון.",
        "lessons": [
            ("big-o", "סיבוכיות זמן ו-Big-O", "O(1), O(n), O(n²) ו-O(log n), וזיהוי סיבוכיות מתוך קוד."),
            ("binary-search", "חיפוש בינארי", "מעקב על מערך ממוין, מימוש ב-Python ומקרי קצה."),
            ("sorting", "מיון: בועות מול מיזוג", "מיון בועות, חלק ומשול, מיזוג ו-O(n log n)."),
        ],
    },
    {
        "slug": "docker-academy",
        "title": "Docker למפתחים",
        "category": "DevOps",
        "difficulty": "intermediate",
        "description": "מקונטיינר ראשון ועד סביבה שלמה: אימג'ים וקונטיינרים, Dockerfile יעיל ובטוח, ו-Docker Compose עם volumes.",
        "lessons": [
            ("containers", "אימג'ים וקונטיינרים", "docker run, פורטים, לוגים וגרסאות מפורשות."),
            ("dockerfile", "כתיבת Dockerfile", "שכבות ו-cache, סדר הוראות נכון, .dockerignore ומשתמש שאינו root."),
            ("compose", "Docker Compose ו-volumes", "כמה שירותים בקובץ אחד, רשת פנימית, volumes וסודות."),
        ],
    },
]


async def retire_demo_courses(database: AsyncDatabase, now: datetime | None = None) -> int:
    """Hide the retired demonstration courses (by slug). Nothing is deleted:
    lessons, enrollments, progress and video assets stay in the database.
    Returns how many courses were newly retired."""
    result = await database.courses.update_many(
        {"type": "catalog", "slug": {"$in": list(RETIRED_COURSE_SLUGS)}, "retired": {"$ne": True}},
        {"$set": {"retired": True, "retired_at": now or datetime.now(timezone.utc)}},
    )
    return result.modified_count


async def seed_catalog(database: AsyncDatabase) -> int:
    """Creates or updates the example catalog. Returns the number of courses."""
    courses = CourseRepository(database)
    lessons = LessonRepository(database)
    now = datetime.now(timezone.utc)
    await retire_demo_courses(database, now)
    for course in ACADEMY:
        existing = await database.courses.find_one({"slug": course["slug"]}, {"edited_by_manager": 1})
        if existing and existing.get("edited_by_manager"):
            continue  # a content manager owns this course now: never overwrite their edits
        course_id = await courses.upsert_seeded(
            course["slug"],
            {
                "title": course["title"],
                "description": course["description"],
                "category": course["category"],
                "type": "catalog",
                "owner_id": None,
                "status": "published",
                "difficulty": course.get("difficulty", "beginner"),
                # Full original lessons that play inside FocusMind.
                "academy": True,
            },
            now,
        )
        for order, (key, title, description) in enumerate(course["lessons"]):
            await lessons.upsert_seeded(
                course_id, key, {"title": title, "description": description, "order": order}, now
            )
    from app.seed.library import seed_library

    library_courses, _ = await seed_library(database)
    return len(ACADEMY) + library_courses
