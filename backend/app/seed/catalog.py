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


async def seed_catalog(database: AsyncDatabase) -> int:
    """Creates or updates the example catalog. Returns the number of courses."""
    courses = CourseRepository(database)
    lessons = LessonRepository(database)
    now = datetime.now(timezone.utc)
    for course in [*ACADEMY, *CATALOG]:
        academy = course in ACADEMY
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
                # Academy courses have full original lessons; the others have
                # short demonstration videos (python -m app.demo_videos).
                "academy": academy,
                "demo_lab": not academy,
            },
            now,
        )
        for order, (key, title, description) in enumerate(course["lessons"]):
            await lessons.upsert_seeded(
                course_id, key, {"title": title, "description": description, "order": order}, now
            )
    from app.seed.library import seed_library

    library_courses, _ = await seed_library(database)
    return len(ACADEMY) + len(CATALOG) + library_courses
