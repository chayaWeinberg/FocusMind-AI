"""Idempotent seed of the example catalog.

Courses are matched by ``slug`` and lessons by (course, ``seed_key``), so
running the seed again updates texts without duplicating anything. Courses a
content manager edited (``edited_by_manager``) are left exactly as they are. Lessons
are created without a video (no fabricated links); existing lesson videos,
user progress and enrollments are never touched.

Run manually:   python -m app.seed
Or on startup:  SEED_CATALOG=true (off by default, never implicit in production)
"""

from datetime import datetime, timezone

from pymongo.asynchronous.database import AsyncDatabase

from app.repositories.courses import CourseRepository, LessonRepository

CATALOG = [
    {
        "slug": "python-for-beginners",
        "title": "Python למתחילים",
        "category": "תכנות",
        "description": (
            "צעדים ראשונים בתכנות עם Python: משתנים, תנאים, לולאות, פונקציות ועבודה עם רשימות "
            "ומילונים. מתאים למי שלא תכנת מעולם."
        ),
        "lessons": [
            ("intro", "היכרות עם Python וסביבת העבודה", "התקנה, הרצת קוד ראשון והכרת המפרש האינטראקטיבי."),
            ("variables", "משתנים וטיפוסי נתונים", "מספרים, מחרוזות, ערכים בוליאניים והמרות בין טיפוסים."),
            ("conditions", "תנאים וקבלת החלטות", "if, elif ו-else, אופרטורים לוגיים והשוואות."),
            ("loops", "לולאות", "לולאות for ו-while, range, break ו-continue."),
            ("functions", "פונקציות", "הגדרת פונקציות, פרמטרים, ערכי החזרה ותחום משתנים."),
            ("collections", "רשימות ומילונים", "יצירה, גישה ועדכון של רשימות ומילונים, ומעבר עליהם בלולאה."),
        ],
    },
    {
        "slug": "sql-fundamentals",
        "title": "יסודות SQL",
        "category": "נתונים",
        "description": (
            "שליפה, סינון וסיכום נתונים במסדי נתונים רלציוניים. בסוף הקורס תכתבו שאילתות עם JOIN "
            "ו-GROUP BY בביטחון."
        ),
        "lessons": [
            ("relational", "מה זה מסד נתונים רלציוני", "טבלאות, שורות, עמודות ומפתחות ראשיים."),
            ("select", "שליפת נתונים עם SELECT", "בחירת עמודות, WHERE, ORDER BY ו-LIMIT."),
            ("aggregate", "פונקציות סיכום", "COUNT, SUM, AVG, GROUP BY ו-HAVING."),
            ("joins", "חיבור טבלאות", "INNER JOIN, LEFT JOIN ומפתחות זרים."),
            ("modify", "הוספה ועדכון נתונים", "INSERT, UPDATE ו-DELETE בזהירות."),
        ],
    },
    {
        "slug": "intro-to-ai",
        "title": "מבוא לבינה מלאכותית",
        "category": "בינה מלאכותית",
        "description": (
            "מושגי היסוד של בינה מלאכותית ולמידת מכונה: איך מודלים לומדים מנתונים, איפה הם טועים "
            "ואיך משתמשים בהם באחריות."
        ),
        "lessons": [
            ("what-is-ai", "מהי בינה מלאכותית", "היסטוריה קצרה, סוגי בינה מלאכותית ודוגמאות מהיומיום."),
            ("machine-learning", "למידת מכונה", "למידה מפוקחת ולא מפוקחת, נתוני אימון ובדיקה."),
            ("neural-networks", "רשתות נוירונים", "נוירון מלאכותי, שכבות ואימון בעזרת שגיאה."),
            ("language-models", "מודלי שפה", "איך מודלי שפה גדולים פועלים ומה המגבלות שלהם."),
            ("responsible-ai", "בינה מלאכותית אחראית", "הטיות, פרטיות ושקיפות בשימוש במודלים."),
        ],
    },
]


async def seed_catalog(database: AsyncDatabase) -> int:
    """Creates or updates the example catalog. Returns the number of courses."""
    courses = CourseRepository(database)
    lessons = LessonRepository(database)
    now = datetime.now(timezone.utc)
    for course in CATALOG:
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
                "difficulty": "beginner",
                # Lessons play the locally generated demonstration videos
                # (python -m app.demo_videos), for testing Smart Learning offline.
                "demo_lab": True,
            },
            now,
        )
        for order, (key, title, description) in enumerate(course["lessons"]):
            await lessons.upsert_seeded(
                course_id, key, {"title": title, "description": description, "order": order}, now
            )
    from app.seed.library import seed_library

    library_courses, _ = await seed_library(database)
    return len(CATALOG) + library_courses
