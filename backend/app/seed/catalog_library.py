"""The expanded course catalog: real educational videos, one per lesson.

Generated from the official sources (Microsoft Learn API and pages, Harvard
CS50 pages and transcripts) on 2026-11-16. Do not invent entries: every URL,
title and duration below was read from the source itself. Durations come from
the Microsoft Learn API or from the CS50 transcript; None = not verified.

FocusMind only links to these videos; nothing is downloaded or re-hosted.
"""

LIBRARY = [
    {
        "slug": "python-programming",
        "title": "תכנות ב-Python",
        "category": "תכנות",
        "difficulty": "beginner",
        "description": "מהפקודה הראשונה ועד פונקציות, מודולים ומחלקות: סדרת סרטונים קצרים של Microsoft שמלמדת Python צעד אחר צעד.",
        "lessons": [
            {
                "key": "introducing",
                "title": "הכרות עם Python",
                "description": "מה זו Python ולמה היא מתאימה למתחילים.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Python for Beginners [2 of 44] Introducing Python",
                    "page_url": "https://learn.microsoft.com/en-us/shows/intro-to-python-development/python-for-beginners-2-of-44-introducing-python/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-538eb8eb-f618-4d22-8bbe-15405582f5a6/introducingpython_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 189,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "getting-started",
                "title": "התקנה והתחלה",
                "description": "התקנת Python וסביבת עבודה, והרצת קוד ראשון.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Python for Beginners [3 of 44] Getting Started",
                    "page_url": "https://learn.microsoft.com/en-us/shows/intro-to-python-development/python-for-beginners-3-of-44-getting-started/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-2d9902dc-bce0-4929-a0c0-22ebfe8e31a3/gettingstarted_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 177,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "print",
                "title": "הדפסה למסך עם print",
                "description": "הצגת פלט, שורות ריקות ותווים מיוחדים.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Python for Beginners [5 of 44] Using Print",
                    "page_url": "https://learn.microsoft.com/en-us/shows/intro-to-python-development/python-for-beginners-5-of-44-using-print/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-92b65904-6516-42e7-aef4-2ffa1eb8cf86/pythonprint5_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 208,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "strings",
                "title": "מחרוזות",
                "description": "יצירת מחרוזות, חיבור ופונקציות שימושיות.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Python for Beginners [9 of 44] String Concepts",
                    "page_url": "https://learn.microsoft.com/en-us/shows/intro-to-python-development/python-for-beginners-9-of-44-string-concepts/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-59d40cfd-0ca4-450b-b5c2-4df12b9ecb5d/stringconcepts_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 280,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "formatting",
                "title": "עיצוב מחרוזות",
                "description": "שילוב משתנים בטקסט בעזרת format ו-f-strings.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Python for Beginners [11 of 44] Formatting Strings",
                    "page_url": "https://learn.microsoft.com/en-us/shows/intro-to-python-development/python-for-beginners-11-of-44-formatting-strings/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-9412cc06-4d8c-421c-bb6e-889b975725bb/formattingstrings_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 248,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "numbers",
                "title": "טיפוסי מספרים",
                "description": "מספרים שלמים ועשרוניים, פעולות חשבון והמרות.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Python for Beginners [13 of 44] Numeric Data Types",
                    "page_url": "https://learn.microsoft.com/en-us/shows/intro-to-python-development/python-for-beginners-13-of-44-numeric-data-types/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-3bbc2ac8-137d-460a-8c8d-79e0e7a179ad/numericdatatypes_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 350,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "errors",
                "title": "טיפול בשגיאות",
                "description": "סוגי שגיאות, try/except ואיך מוצאים באגים.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Python for Beginners [17 of 44] Error Handling",
                    "page_url": "https://learn.microsoft.com/en-us/shows/intro-to-python-development/python-for-beginners-17-of-44-error-handling/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-a22d9835-41ae-4aa0-aba3-132d6f90c3e0/errorhandling_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 773,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "conditions",
                "title": "תנאים",
                "description": "if, else והשוואות לקבלת החלטות בקוד.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Python for Beginners [19 of 44] Conditional Logic",
                    "page_url": "https://learn.microsoft.com/en-us/shows/intro-to-python-development/python-for-beginners-19-of-44-conditional-logic/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-e68325a9-00dc-4953-8c5c-15b5db0f08dd/conditionallogic_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 292,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "collections",
                "title": "אוספים: רשימות ומילונים",
                "description": "רשימות, מערכים ומילונים לשמירת כמה ערכים.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Python for Beginners [25 of 44] Collections",
                    "page_url": "https://learn.microsoft.com/en-us/shows/intro-to-python-development/python-for-beginners-25-of-44-collections/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-51c06203-bf6a-43b6-a130-6266cb600ffc/25_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 686,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "loops",
                "title": "לולאות",
                "description": "for ו-while למעבר על אוספים ולחזרה על פעולות.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Python for Beginners [27 of 44] Loops",
                    "page_url": "https://learn.microsoft.com/en-us/shows/intro-to-python-development/python-for-beginners-27-of-44-loops/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-31a0c5d8-c056-4d59-a700-1dd94a902cf8/loops_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 329,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "functions",
                "title": "פונקציות",
                "description": "הגדרת פונקציות, ערכי החזרה וקוד לשימוש חוזר.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Python for Beginners [29 of 44] Introducing Functions",
                    "page_url": "https://learn.microsoft.com/en-us/shows/intro-to-python-development/python-for-beginners-29-of-44-introducing-functions/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-75a9db35-0dcb-4df0-b6eb-eb19701afa17/introducingfunctions_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 608,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "modules",
                "title": "מודולים וחבילות",
                "description": "ייבוא מודולים, התקנת חבילות עם pip.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Python for Beginners [33 of 44] Modules and packages",
                    "page_url": "https://learn.microsoft.com/en-us/shows/intro-to-python-development/python-for-beginners-33-of-44-modules-and-packages/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-9891db6b-17be-47af-bed9-d6cee563a4f5/modulesandpackages_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 611,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "classes",
                "title": "מחלקות ואובייקטים",
                "description": "תכנות מונחה עצמים: מחלקות, מאפיינים ומתודות.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Classes | More Python for Beginners [6 of 20]",
                    "page_url": "https://learn.microsoft.com/en-us/shows/more-python-for-beginners/classes--more-python-for-beginners-6-of-20/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-cc283424-2d28-4042-ba6c-ca24f94b0b5e/s1video06-663classes_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 715,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            }
        ]
    },
    {
        "slug": "sql-databases",
        "title": "SQL ומסדי נתונים",
        "category": "נתונים",
        "difficulty": "beginner",
        "description": "מושגי יסוד של מסדי נתונים רלציוניים, ושאילתות SQL לשליפה, סינון, חיבור וסיכום נתונים.",
        "lessons": [
            {
                "key": "core-concepts",
                "title": "מושגי יסוד במסדי נתונים",
                "description": "מהו מסד נתונים, טבלאות ורשומות.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Database Fundamentals: (01) Introducing Core Database Concepts",
                    "page_url": "https://learn.microsoft.com/en-us/shows/dbfundamentals/01/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-1573ba5f-2e61-4511-858a-23866b99f998/dbfundamentalsm01_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 1795,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "relational",
                "title": "מודל רלציוני",
                "description": "מפתחות, קשרים בין טבלאות ונרמול.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Database Fundamentals: (02) Relational Concepts",
                    "page_url": "https://learn.microsoft.com/en-us/shows/dbfundamentals/02/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-a3770b91-4538-4d54-9ff0-225e87a82fdd/dbfundamentalsm02_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 2652,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "intro-tsql",
                "title": "מבוא לשאילתות SQL",
                "description": "SELECT ראשון והמבנה של שאילתה.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Introduction to Transact-SQL (Part 2 of 7) | Programming Databases with T-SQL for Beginners",
                    "page_url": "https://learn.microsoft.com/en-us/shows/programming-databases-with-t-sql-for-beginners/introduction-to-transact-sql-2-of-7-programming-databases-with-t-sql-for-beginners/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-12e3b812-5973-4931-9559-4022b9a4fb0e/02-77584-intro-a01_1677018105917_1280x720_AACAudio_736_2.mp4",
                    "youtube_id": None,
                    "duration_seconds": 685,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "sort-filter",
                "title": "מיון וסינון תוצאות",
                "description": "WHERE, ORDER BY והגבלת תוצאות.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Sort and Filter Results in Transact-SQL (Part 3 of 7) | Programming Databases with T-SQL for Beginners",
                    "page_url": "https://learn.microsoft.com/en-us/shows/programming-databases-with-t-sql-for-beginners/sort-and-filter-results-in-transact-sql-3-of-7-programming-databases-with-t-sql-for-beginners/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-06f55b9c-b063-4fe6-989d-faaf45c1967c/03-77585-sortFilter-a01_16770181_1280x720_AACAudio_633_2.mp4",
                    "youtube_id": None,
                    "duration_seconds": 819,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "joins",
                "title": "חיבור טבלאות עם JOIN",
                "description": "INNER JOIN ו-OUTER JOIN בין כמה טבלאות.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Combining multiple tables with JOINS in Transact-SQL (Part 4 of 7) | Programming Databases with T-SQL for Beginners",
                    "page_url": "https://learn.microsoft.com/en-us/shows/programming-databases-with-t-sql-for-beginners/combining-multiple-tables-with-joins-in-transact-sql-4-of-7-programming-databases-with-t-sql-for-beginners/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-fe849c76-05d3-4fa1-aa64-f4643b03b082/04-85126-combining-a02_167701843_1280x720_AACAudio_654_2.mp4",
                    "youtube_id": None,
                    "duration_seconds": 524,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "subqueries",
                "title": "שאילתות משנה",
                "description": "שאילתה בתוך שאילתה.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Write Subqueries in Transact-SQL (Part 5 of 7) | Programming Databases with T-SQL for Beginners",
                    "page_url": "https://learn.microsoft.com/en-us/shows/programming-databases-with-t-sql-for-beginners/write-subqueries-in-transact-sql-5-of-7-programming-databases-with-t-sql-for-beginners/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-7e8ecd76-b352-41bf-97a9-a1f97344883b/05-85127-subqueries-a01_16770189_1280x720_AACAudio_706_2.mp4",
                    "youtube_id": None,
                    "duration_seconds": 263,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "group-by",
                "title": "פונקציות ו-GROUP BY",
                "description": "פונקציות סיכום וקיבוץ תוצאות.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Use Functions and GROUP BY in Transact-SQL (Part 6 of 7) | Programming Databases with T-SQL for Beginners",
                    "page_url": "https://learn.microsoft.com/en-us/shows/programming-databases-with-t-sql-for-beginners/use-functions-and-group-by-in-transact-sql-6-of-7-programming-databases-with-t-sql-for-beginners/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-2415fb07-76bd-492b-890f-8d969adb7249/06-85128-functionsGroup-a01_1677_1280x720_AACAudio_664_2.mp4",
                    "youtube_id": None,
                    "duration_seconds": 624,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "modify",
                "title": "הוספה, עדכון ומחיקה",
                "description": "INSERT, UPDATE ו-DELETE.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Modify Data with Transact-SQL (Part 7 of 7) | Programming Databases with T-SQL for Beginners",
                    "page_url": "https://learn.microsoft.com/en-us/shows/programming-databases-with-t-sql-for-beginners/modify-data-with-transact-sql-7-of-7-programming-databases-with-t-sql-for-beginners/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-e3fedf64-6515-4141-93ca-92a6dc73c596/07-85129-modify-a01_167701957401_1280x720_AACAudio_677_2.mp4",
                    "youtube_id": None,
                    "duration_seconds": 789,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "designing",
                "title": "תכנון סכמה",
                "description": "תכנון טבלאות, טיפוסים ואילוצים (הרצאת CS50 SQL).",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50's Introduction to Databases with SQL - Week 2 Designing",
                    "page_url": "https://cs50.harvard.edu/sql/2024/weeks/2/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/sql/2023/x/lectures/2/lecture2-720p.mp4",
                    "youtube_id": "QzRW6bfv3Fo",
                    "duration_seconds": 4884,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            },
            {
                "key": "optimizing",
                "title": "אופטימיזציה ואינדקסים",
                "description": "אינדקסים, תוכניות ביצוע וטרנזקציות (הרצאת CS50 SQL).",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50's Introduction to Databases with SQL - Week 5 Optimizing",
                    "page_url": "https://cs50.harvard.edu/sql/2024/weeks/5/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/sql/2023/x/lectures/5/lecture5-720p.mp4",
                    "youtube_id": "qa5-mKVSQHQ",
                    "duration_seconds": 5332,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            }
        ]
    },
    {
        "slug": "javascript",
        "title": "JavaScript",
        "category": "פיתוח ווב",
        "difficulty": "beginner",
        "description": "יסודות JavaScript בסרטונים קצרים: משתנים, תנאים, מערכים, פונקציות, אובייקטים וקוד אסינכרוני.",
        "lessons": [
            {
                "key": "what-is-js",
                "title": "מהי JavaScript",
                "description": "איפה JavaScript רצה ולמה משתמשים בה.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "What is JavaScript [2 of 51]",
                    "page_url": "https://learn.microsoft.com/en-us/shows/beginners-series-to-javascript/what-is-javascript-2-of-51/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-1f7f2037-8869-44cd-b137-d5e846083d10/whatisjavascript_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 212,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "running",
                "title": "הרצת JavaScript: דפדפן או שרת",
                "description": "הרצה בדפדפן וב-Node.js.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Running JavaScript: browser or server [3 of 51]",
                    "page_url": "https://learn.microsoft.com/en-us/shows/beginners-series-to-javascript/running-javascript-browser-or-server-3-of-51/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-121402e8-0ab8-404c-b2e7-9e6f72efc112/runningjavascriptbrowserorserver_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 218,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "variables",
                "title": "הגדרת משתנים",
                "description": "let, const ושמות משתנים.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Declaring variables [9 of 51]",
                    "page_url": "https://learn.microsoft.com/en-us/shows/beginners-series-to-javascript/declaring-variables-9-of-51/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-94f08d21-1c80-4a65-82a4-1ff5f05cd62b/variables_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 232,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "strings",
                "title": "עבודה עם מחרוזות",
                "description": "מחרוזות, חיבור ושיטות שימושיות.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Working with strings [11 of 51]",
                    "page_url": "https://learn.microsoft.com/en-us/shows/beginners-series-to-javascript/working-with-strings-11-of-51/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-305ddaa2-68ed-42b5-8257-97b7c25f980e/workingwithstrings_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 198,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "data-types",
                "title": "טיפוסי נתונים",
                "description": "מספרים, מחרוזות, בוליאנים, null ו-undefined.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Data types in JavaScript [15 of 51]",
                    "page_url": "https://learn.microsoft.com/en-us/shows/beginners-series-to-javascript/data-types-in-javascript-15-of-51/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-14c3fad9-ad14-4a52-8238-b5d9414dd771/datatypesinjavascript_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 340,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "try-catch",
                "title": "טיפול בשגיאות",
                "description": "try, catch ו-finally.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Handling errors with try/catch/finally [21 of 51]",
                    "page_url": "https://learn.microsoft.com/en-us/shows/beginners-series-to-javascript/handling-errors-with-trycatchfinally-21-of-51/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-c0b4e62a-3e24-4fcb-9e33-309151fbc522/errors_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 197,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "if",
                "title": "תנאים עם if",
                "description": "לוגיקה בוליאנית והחלטות בקוד.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Boolean logic with if statements [25 of 51]",
                    "page_url": "https://learn.microsoft.com/en-us/shows/beginners-series-to-javascript/boolean-logic-with-if-statements-25-of-51/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-197c8ad4-5ab3-4e47-8bb6-7b4e92d4ef2a/booleanlogic_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 338,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "arrays",
                "title": "יצירת מערכים",
                "description": "מערכים ואינדקסים.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Creating arrays [29 of 51]",
                    "page_url": "https://learn.microsoft.com/en-us/shows/beginners-series-to-javascript/creating-arrays-29-of-51/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-a7f0b796-825a-462a-8b9d-cc092c9b8eaf/arrays_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 89,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "array-methods",
                "title": "שיטות של מערכים",
                "description": "push, sort ושיטות נוספות.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Array methods [33 of 51]",
                    "page_url": "https://learn.microsoft.com/en-us/shows/beginners-series-to-javascript/array-methods-33-of-51/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-c89478c8-8763-4a92-8fd9-bd9faa17dbb7/arraymethods_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 119,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "loops",
                "title": "לולאות",
                "description": "for, for...of ו-while.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Loops [35 of 51]",
                    "page_url": "https://learn.microsoft.com/en-us/shows/beginners-series-to-javascript/loops-35-of-51/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-8d399c0c-e951-42b3-b0e9-11dc0726efe4/loops_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 443,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "functions",
                "title": "פונקציות",
                "description": "הגדרה, פרמטרים וערכי החזרה.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Functions [37 of 51]",
                    "page_url": "https://learn.microsoft.com/en-us/shows/beginners-series-to-javascript/functions-37-of-51/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-f1a2df3f-b064-4795-9734-6109f1c8bd98/functions_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 573,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "arrow-functions",
                "title": "פונקציות חץ ופונקציות אנונימיות",
                "description": "תחביר מקוצר ושימוש בפונקציות כערכים.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Arrow and anonymous functions [39 of 51]",
                    "page_url": "https://learn.microsoft.com/en-us/shows/beginners-series-to-javascript/arrow-and-anonymous-functions-39-of-51/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-39482a95-aded-497d-88c4-f8cadc4e2ec5/arrowandanonoymousfunctions_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 315,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "objects",
                "title": "אובייקטים",
                "description": "אובייקטים, מאפיינים ומחלקות.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Objects in JavaScript [43 of 51]",
                    "page_url": "https://learn.microsoft.com/en-us/shows/beginners-series-to-javascript/objects-in-javascript-43-of-51/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-27f09290-b24a-44f7-9f4a-e4b7b74b5800/objectsinjavascript_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 642,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "promises",
                "title": "Promises",
                "description": "פעולות ארוכות ועבודה אסינכרונית.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Promises for long running operations [45 of 51]",
                    "page_url": "https://learn.microsoft.com/en-us/shows/beginners-series-to-javascript/promises-for-long-running-operations-45-of-51/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-0c54957d-53bf-49b2-8c4a-a86fc5e95d36/promisesforlongrunningoperations_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 391,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "async-await",
                "title": "async ו-await",
                "description": "ניהול Promises בקוד קריא.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Async/await for managing promises [47 of 51]",
                    "page_url": "https://learn.microsoft.com/en-us/shows/beginners-series-to-javascript/asyncawait-for-managing-promises-47-of-51/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-3d0eae0c-1751-496f-8550-e91318fb2919/asyncawait_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 306,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "dom",
                "title": "ה-DOM",
                "description": "גישה לאלמנטים בדף ושינוי שלהם (CS50).",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50x 2024 - DOM",
                    "page_url": "https://cs50.harvard.edu/x/2024/shorts/dom/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/2017/fall/shorts/dom/dom-720p.mp4",
                    "youtube_id": "LKWJpgvfH3U",
                    "duration_seconds": 1235,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            }
        ]
    },
    {
        "slug": "react",
        "title": "React",
        "category": "פיתוח ווב",
        "difficulty": "intermediate",
        "description": "React ו-React Native בהרצאות של CS50: קומפוננטות, props ו-state, רשימות, ניווט, נתונים, Redux ובדיקות.",
        "lessons": [
            {
                "key": "es6",
                "title": "JavaScript מודרני (ES6) לפני React",
                "description": "פונקציות, Promises ו-async שנחוצים ל-React.",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50's Mobile App Development with React Native - JavaScript, ES6",
                    "page_url": "https://cs50.harvard.edu/mobile/2018/weeks/1/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/mobile/2018/spring/lectures/1/lecture1-720p.mp4",
                    "youtube_id": "3Ay2lS6tm4M",
                    "duration_seconds": 6466,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            },
            {
                "key": "components",
                "title": "קומפוננטות, props ו-state",
                "description": "JSX, קומפוננטות ומצב.",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50's Mobile App Development with React Native - React, Props, State",
                    "page_url": "https://cs50.harvard.edu/mobile/2018/weeks/2/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/mobile/2018/spring/lectures/2/lecture2-720p.mp4",
                    "youtube_id": "7O43VDOlQ_o",
                    "duration_seconds": 5849,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            },
            {
                "key": "user-interfaces",
                "title": "React בדפדפן: ממשקי משתמש",
                "description": "אפליקציות עמוד יחיד ו-React בדף ווב (CS50 Web).",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50's Web Programming with Python and JavaScript - Week 6 User Interfaces",
                    "page_url": "https://cs50.harvard.edu/web/2020/weeks/6/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/web/2020/spring/lectures/6/lecture6-720p.mp4",
                    "youtube_id": "jrBhi8wbzPw",
                    "duration_seconds": 6015,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            },
            {
                "key": "react-native",
                "title": "React Native",
                "description": "React לאפליקציות מובייל, עיצוב ו-Expo.",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50's Mobile App Development with React Native - React Native",
                    "page_url": "https://cs50.harvard.edu/mobile/2018/weeks/3/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/mobile/2018/spring/lectures/3/lecture3-720p.mp4",
                    "youtube_id": "Gk6RF5k3C2M",
                    "duration_seconds": 5886,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            },
            {
                "key": "lists-input",
                "title": "רשימות וקלט משתמש",
                "description": "FlatList, ScrollView וטפסים.",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50's Mobile App Development with React Native - Lists, User Input",
                    "page_url": "https://cs50.harvard.edu/mobile/2018/weeks/4/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/mobile/2018/spring/lectures/4/lecture4-720p.mp4",
                    "youtube_id": "-E1tQPQSAxc",
                    "duration_seconds": 6294,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            },
            {
                "key": "debugging",
                "title": "קלט ודיבוג",
                "description": "טיפול בקלט וכלי דיבוג.",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50's Mobile App Development with React Native - User Input, Debugging",
                    "page_url": "https://cs50.harvard.edu/mobile/2018/weeks/5/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/mobile/2018/spring/lectures/5/lecture5-720p.mp4",
                    "youtube_id": "sv71JMZEpYY",
                    "duration_seconds": 5587,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            },
            {
                "key": "navigation",
                "title": "ניווט בין מסכים",
                "description": "Stack ו-Tab navigators.",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50's Mobile App Development with React Native - Navigation",
                    "page_url": "https://cs50.harvard.edu/mobile/2018/weeks/6/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/mobile/2018/spring/lectures/6/lecture6-720p.mp4",
                    "youtube_id": "QHorNUuEXc0",
                    "duration_seconds": 5144,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            },
            {
                "key": "data",
                "title": "עבודה עם נתונים ו-API",
                "description": "fetch, Promises והצגת נתונים.",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50's Mobile App Development with React Native - Data",
                    "page_url": "https://cs50.harvard.edu/mobile/2018/weeks/7/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/mobile/2018/spring/lectures/7/lecture7-720p.mp4",
                    "youtube_id": "jWwOTg35COs",
                    "duration_seconds": 5973,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            },
            {
                "key": "redux",
                "title": "ניהול מצב עם Redux",
                "description": "store, actions ו-reducers.",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50's Mobile App Development with React Native - Redux",
                    "page_url": "https://cs50.harvard.edu/mobile/2018/weeks/9/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/mobile/2018/spring/lectures/9/lecture9-720p.mp4",
                    "youtube_id": "_zT8K6R_P7I",
                    "duration_seconds": 6542,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            },
            {
                "key": "performance",
                "title": "ביצועים",
                "description": "רינדור יעיל ואופטימיזציה.",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50's Mobile App Development with React Native - Performance",
                    "page_url": "https://cs50.harvard.edu/mobile/2018/weeks/11/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/mobile/2018/spring/lectures/11/lecture11-720p.mp4",
                    "youtube_id": "39W5Llg2orM",
                    "duration_seconds": 6239,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            },
            {
                "key": "testing-deploying",
                "title": "בדיקות ופריסה",
                "description": "Jest, snapshot testing ופריסה.",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50's Mobile App Development with React Native - Deploying, Testing",
                    "page_url": "https://cs50.harvard.edu/mobile/2018/weeks/12/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/mobile/2018/spring/lectures/12/lecture12-720p.mp4",
                    "youtube_id": "VUV00jJ45nU",
                    "duration_seconds": 6017,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            }
        ]
    },
    {
        "slug": "html-css",
        "title": "HTML ו-CSS",
        "category": "פיתוח ווב",
        "difficulty": "beginner",
        "description": "בניית דפי אינטרנט מאפס: מבנה HTML, טקסט, תמונות, רשימות, טבלאות וטפסים, ועיצוב עם CSS.",
        "lessons": [
            {
                "key": "first-page",
                "title": "דף ה-HTML הראשון",
                "description": "יצירת דף HTML5 ראשון.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Creating Your First HTML5 Web Page - 02",
                    "page_url": "https://learn.microsoft.com/en-us/shows/html5-css3-fundamentals-development-for-absolute-beginners/creating-your-first-html5-web-page-02/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-6238887a-07cc-45b9-9a60-ec82c5602ad3/02creatingyourfirsthtml5webpagewithcss3_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 2114,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "first-css",
                "title": "עיצוב ראשון עם CSS",
                "description": "עיצוב הדף הראשון עם CSS3.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Styling Your First HTML5 Web Page with CSS3 - 03",
                    "page_url": "https://learn.microsoft.com/en-us/shows/html5-css3-fundamentals-development-for-absolute-beginners/styling-your-first-html5-web-page-css3-03/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-b910883a-1d99-4468-bffe-f0a7b18122a5/03stylingyourfirsthtml5webpagewithcss3_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 1761,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "text",
                "title": "פסקאות וטקסט",
                "description": "כותרות, פסקאות ותגיות טקסט.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Working with Paragraphs and Text - 05",
                    "page_url": "https://learn.microsoft.com/en-us/shows/html5-css3-fundamentals-development-for-absolute-beginners/working-paragraphs-text-05/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-7948e491-eaa6-412c-9170-3684d46ec6df/05workingwithparagraphsandtext_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 2938,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "structure",
                "title": "מבנה המסמך",
                "description": "תגיות מבנה: header, nav, section ועוד.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Defining the Structure of Your Document - 06",
                    "page_url": "https://learn.microsoft.com/en-us/shows/html5-css3-fundamentals-development-for-absolute-beginners/defining-structure-of-your-document-06/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-b928885a-7992-44b0-a472-17d690b3536a/06definingthestructureofyourdocument_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 1218,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "images",
                "title": "תמונות ואיורים",
                "description": "img ו-figure.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Working with Figures and Images - 07",
                    "page_url": "https://learn.microsoft.com/en-us/shows/html5-css3-fundamentals-development-for-absolute-beginners/working-figures-images-07/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-a10403da-b294-4ca6-ae05-83c21ddbe1e4/07workingwithfiguresandimages_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 419,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "lists",
                "title": "רשימות",
                "description": "רשימות ממוספרות ולא ממוספרות.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Working with Lists - 08",
                    "page_url": "https://learn.microsoft.com/en-us/shows/html5-css3-fundamentals-development-for-absolute-beginners/working-lists-08/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-61b676c8-1d38-494a-bd4d-ad979cb9e4d3/working-with-lists-08_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 930,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "tables",
                "title": "טבלאות",
                "description": "בניית טבלאות נתונים.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Creating Tables - 09",
                    "page_url": "https://learn.microsoft.com/en-us/shows/html5-css3-fundamentals-development-for-absolute-beginners/creating-tables-09/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-28ab621e-8949-49c2-9a7c-2ea5a246fd9e/09creatingtables_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 780,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "forms",
                "title": "טפסים",
                "description": "שדות קלט וכפתורים בטופס.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Creating Forms - 10",
                    "page_url": "https://learn.microsoft.com/en-us/shows/html5-css3-fundamentals-development-for-absolute-beginners/creating-forms-10/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-a4fcd470-7de2-479d-b4d2-4aca14dc0068/10creatingforms_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 1647,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "css-basics",
                "title": "הבנת CSS",
                "description": "סלקטורים, כללים ומפל (cascade).",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Understanding Cascading Style Sheets - 12",
                    "page_url": "https://learn.microsoft.com/en-us/shows/html5-css3-fundamentals-development-for-absolute-beginners/understanding-cascading-style-sheets-12/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-78423ef5-e940-413c-b80e-da76ad42c966/12understandingcascadingstylesheets_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 2606,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "box-model",
                "title": "מודל הקופסה ב-CSS",
                "description": "margin, padding, border וגדלים.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "CSS3 Box Properties - 16",
                    "page_url": "https://learn.microsoft.com/en-us/shows/html5-css3-fundamentals-development-for-absolute-beginners/css3-box-properties-16/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-cd1c8deb-d139-404b-a0e8-e5a928258e3f/16css3boxproperties_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 1118,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            }
        ]
    },
    {
        "slug": "ai-llms",
        "title": "בינה מלאכותית ומודלי שפה",
        "category": "בינה מלאכותית",
        "difficulty": "intermediate",
        "description": "מלמידת מכונה ורשתות נוירונים ועד מודלי שפה גדולים, הנדסת פרומפטים, RAG וסוכנים.",
        "lessons": [
            {
                "key": "machine-learning",
                "title": "למידת מכונה",
                "description": "למידה מפוקחת, סיווג ורגרסיה (CS50 AI).",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50's Introduction to Artificial Intelligence with Python - Week 4 Learning",
                    "page_url": "https://cs50.harvard.edu/ai/2024/weeks/4/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/ai/2020/spring/lectures/4/lecture4-720p.mp4",
                    "youtube_id": "-g0iJjnO2_w",
                    "duration_seconds": 6348,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            },
            {
                "key": "neural-networks",
                "title": "רשתות נוירונים",
                "description": "נוירונים, שכבות ואימון (CS50 AI).",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50's Introduction to Artificial Intelligence with Python - Week 5 Neural Networks",
                    "page_url": "https://cs50.harvard.edu/ai/2024/weeks/5/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/ai/2020/spring/lectures/5/lecture5-720p.mp4",
                    "youtube_id": "J1QD9hLDEDY",
                    "duration_seconds": 6079,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            },
            {
                "key": "language",
                "title": "שפה, attention ו-transformers",
                "description": "עיבוד שפה ובסיס מודלי השפה (CS50 AI).",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50's Introduction to Artificial Intelligence with Python - Week 6 Language",
                    "page_url": "https://cs50.harvard.edu/ai/2024/weeks/6/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/ai/2023/x/lectures/6/lecture6-720p.mp4",
                    "youtube_id": "QAZc9xsQNjQ",
                    "duration_seconds": 3921,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            },
            {
                "key": "intro-genai",
                "title": "מבוא לבינה יוצרת ולמודלי שפה",
                "description": "מה הם LLMs ואיך הם עובדים.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Introduction to Generative AI and LLMs (Part 1 of 18) | Generative AI for Beginners",
                    "page_url": "https://learn.microsoft.com/en-us/shows/generative-ai-for-beginners/introduction-to-generative-ai-and-llms-generative-ai-for-beginners/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-6a9289b9-37f0-41be-bf47-8eb793d7e144/BEG-GenAI-e01-119585-Learn_17188_1280x720_AACAudio_726_2.mp4",
                    "youtube_id": None,
                    "duration_seconds": 633,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "comparing-llms",
                "title": "השוואה בין מודלי שפה",
                "description": "סוגי מודלים ואיך בוחרים.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Exploring and comparing different LLMs (Part 2 of 18) | Generative AI for Beginners",
                    "page_url": "https://learn.microsoft.com/en-us/shows/generative-ai-for-beginners/exploring-and-comparing-different-llms-generative-ai-for-beginners/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-07ba028f-cef3-4515-8315-80139e007c0a/BEG-GenAI-e02-119586-Learn_17188_1280x720_AACAudio_839_2.mp4",
                    "youtube_id": None,
                    "duration_seconds": 1259,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "responsible",
                "title": "שימוש אחראי בבינה יוצרת",
                "description": "סיכונים, הטיות והגנה על משתמשים.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Using Generative AI Responsibly (Part 3 of 18) | Generative AI for Beginners",
                    "page_url": "https://learn.microsoft.com/en-us/shows/generative-ai-for-beginners/using-generative-ai-responsibly-generative-ai-for-beginners/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-06d724f6-b6fb-4a15-a994-a70f99ffbbae/BEG-GenAI-e03-119587-Learn_17188_1280x720_AACAudio_792_2.mp4",
                    "youtube_id": None,
                    "duration_seconds": 561,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "prompt-engineering",
                "title": "יסודות הנדסת פרומפטים",
                "description": "איך כותבים הנחיות טובות.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Understanding Prompt Engineering Fundamentals (Part 4 of 18) | Generative AI for Beginners",
                    "page_url": "https://learn.microsoft.com/en-us/shows/generative-ai-for-beginners/understanding-prompt-engineering-fundamentals-generative-ai-for-beginners/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-b3ab6dd9-ca72-4c55-9e5b-b47540b254da/BEG-GenAI-e04-133928-Learn_17188_1280x720_AACAudio_705_2.mp4",
                    "youtube_id": None,
                    "duration_seconds": 1395,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "advanced-prompts",
                "title": "פרומפטים מתקדמים",
                "description": "טכניקות מתקדמות לשיפור תשובות.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Creating Advanced Prompts (Part 5 of 18) | Generative AI for Beginners",
                    "page_url": "https://learn.microsoft.com/en-us/shows/generative-ai-for-beginners/creating-advanced-prompts-generative-ai-for-beginners/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-f26f8e1a-4b77-4775-aa86-4993d33ca41d/BEG-GenAI-e05-133929-Learn_17188_1280x720_AACAudio_754_2.mp4",
                    "youtube_id": None,
                    "duration_seconds": 1019,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "chat-apps",
                "title": "בניית אפליקציות צ'אט",
                "description": "אפליקציה שמשוחחת עם מודל שפה.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Building Chat Applications (Part 7 of 18) | Generative AI for Beginners",
                    "page_url": "https://learn.microsoft.com/en-us/shows/generative-ai-for-beginners/building-chat-applications-generative-ai-for-beginners/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-6b7c0347-32d2-4ccb-9d88-ea71416e206d/BEG-GenAI-e07-133931-Learn_17188_1280x720_AACAudio_670_2.mp4",
                    "youtube_id": None,
                    "duration_seconds": 814,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "rag",
                "title": "RAG ומסדי נתונים וקטוריים",
                "description": "חיבור מודל שפה למידע שלכם.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Retrieval Augmented Generation (RAG) and Vector Databases (Part 15 of 18) | Generative AI for Beginners",
                    "page_url": "https://learn.microsoft.com/en-us/shows/generative-ai-for-beginners/retrieval-augmented-generation-rag-and-vector-databases-generative-ai-for-beginners/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-3450ab93-e033-4f8d-8461-fa084fd8cf63/BEG-GenAI-e15-133939-Learn_17188_1280x720_AACAudio_775_2.mp4",
                    "youtube_id": None,
                    "duration_seconds": 652,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "agents",
                "title": "סוכני AI",
                "description": "מודלים שמבצעים פעולות.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "AI Agents (Part 17 of 18) | Generative AI for Beginners",
                    "page_url": "https://learn.microsoft.com/en-us/shows/generative-ai-for-beginners/ai-agents-generative-ai-for-beginners/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-34808a5b-cc09-4c20-9da2-987276dc9aca/BEG-GenAI-e17-133941-Learn_17188_1280x720_AACAudio_720_2.mp4",
                    "youtube_id": None,
                    "duration_seconds": 474,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "fine-tuning",
                "title": "כוונון עדין (Fine-tuning)",
                "description": "התאמת מודל קיים למשימה.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Fine-Tuning LLMs (Part 18 of 18) | Generative AI for Beginners",
                    "page_url": "https://learn.microsoft.com/en-us/shows/generative-ai-for-beginners/finetuning-llms-generative-ai-for-beginners/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-1c2a7a07-bdfe-4209-87ba-12659c42ef80/BEG-GenAI-e18-133942-Learn_17188_1280x720_AACAudio_835_2.mp4",
                    "youtube_id": None,
                    "duration_seconds": 1247,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            }
        ]
    },
    {
        "slug": "algorithms-data-structures",
        "title": "אלגוריתמים ומבני נתונים",
        "category": "מדעי המחשב",
        "difficulty": "intermediate",
        "description": "חיפוש, מיון ורקורסיה, ומבני הנתונים הבסיסיים: רשימות מקושרות, טבלאות גיבוב, מחסניות, תורים ועצים.",
        "lessons": [
            {
                "key": "linear-search",
                "title": "חיפוש לינארי",
                "description": "מעבר על איברים אחד אחרי השני.",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50x 2024 - Linear Search",
                    "page_url": "https://cs50.harvard.edu/x/2024/shorts/linear_search/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/2017/fall/shorts/linear_search/linear_search-720p.mp4",
                    "youtube_id": "TwsgCHYmbbA",
                    "duration_seconds": 170,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            },
            {
                "key": "binary-search",
                "title": "חיפוש בינארי",
                "description": "חיפוש מהיר במערך ממוין.",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50x 2024 - Binary Search",
                    "page_url": "https://cs50.harvard.edu/x/2024/shorts/binary_search/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/2017/fall/shorts/binary_search/binary_search-720p.mp4",
                    "youtube_id": "T98PIp4omUA",
                    "duration_seconds": 571,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            },
            {
                "key": "bubble-sort",
                "title": "מיון בועות",
                "description": "מיון בהחלפות של זוגות סמוכים.",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50x 2024 - Bubble Sort",
                    "page_url": "https://cs50.harvard.edu/x/2024/shorts/bubble_sort/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/2017/fall/shorts/bubble_sort/bubble_sort-720p.mp4",
                    "youtube_id": "RT-hUXUWQ2I",
                    "duration_seconds": 354,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            },
            {
                "key": "selection-sort",
                "title": "מיון בחירה",
                "description": "בחירת המינימום בכל מעבר.",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50x 2024 - Selection Sort",
                    "page_url": "https://cs50.harvard.edu/x/2024/shorts/selection_sort/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/2017/fall/shorts/selection_sort/selection_sort-720p.mp4",
                    "youtube_id": "3hH8kTHFw2A",
                    "duration_seconds": 240,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            },
            {
                "key": "recursion",
                "title": "רקורסיה",
                "description": "פונקציה שקוראת לעצמה ומקרה בסיס.",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50x 2024 - Recursion",
                    "page_url": "https://cs50.harvard.edu/x/2024/shorts/recursion/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/2017/fall/shorts/recursion/recursion-720p.mp4",
                    "youtube_id": "mz6tAJMVmfM",
                    "duration_seconds": None,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            },
            {
                "key": "merge-sort",
                "title": "מיון מיזוג",
                "description": "חלוקה ומיזוג: מיון יעיל.",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50x 2024 - Merge Sort",
                    "page_url": "https://cs50.harvard.edu/x/2024/shorts/merge_sort/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/2017/fall/shorts/merge_sort/merge_sort-720p.mp4",
                    "youtube_id": "Ns7tGNbtvV4",
                    "duration_seconds": 627,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            },
            {
                "key": "data-structures",
                "title": "מבוא למבני נתונים",
                "description": "השוואה בין מערכים, רשימות, טבלאות גיבוב ועצים.",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50x 2024 - Data Structures",
                    "page_url": "https://cs50.harvard.edu/x/2024/shorts/data_structures/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/2017/fall/shorts/data_structures/data_structures-720p.mp4",
                    "youtube_id": "3uGchQbk7g8",
                    "duration_seconds": 532,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            },
            {
                "key": "singly-linked-lists",
                "title": "רשימות מקושרות",
                "description": "צמתים ומצביעים.",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50x 2024 - Singly-Linked Lists",
                    "page_url": "https://cs50.harvard.edu/x/2024/shorts/singly_linked_lists/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/2017/fall/shorts/singly_linked_lists/singly_linked_lists-720p.mp4",
                    "youtube_id": "zQI3FyWm144",
                    "duration_seconds": 1402,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            },
            {
                "key": "doubly-linked-lists",
                "title": "רשימות מקושרות דו-כיווניות",
                "description": "מעבר קדימה ואחורה.",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50x 2024 - Doubly-Linked Lists",
                    "page_url": "https://cs50.harvard.edu/x/2024/shorts/doubly_linked_lists/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/2017/fall/shorts/doubly_linked_lists/doubly_linked_lists-720p.mp4",
                    "youtube_id": "FHMPswJDCvU",
                    "duration_seconds": 591,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            },
            {
                "key": "hash-tables",
                "title": "טבלאות גיבוב",
                "description": "פונקציות גיבוב והתנגשויות.",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50x 2024 - Hash Tables",
                    "page_url": "https://cs50.harvard.edu/x/2024/shorts/hash_tables/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/2017/fall/shorts/hash_tables/hash_tables-720p.mp4",
                    "youtube_id": "nvzVHwrrub0",
                    "duration_seconds": 1125,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            },
            {
                "key": "stacks",
                "title": "מחסניות",
                "description": "LIFO: push ו-pop.",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50x 2024 - Stacks",
                    "page_url": "https://cs50.harvard.edu/x/2024/shorts/stacks/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/2017/fall/shorts/stacks/stacks-720p.mp4",
                    "youtube_id": "hVsNqhEthOk",
                    "duration_seconds": 860,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            },
            {
                "key": "queues",
                "title": "תורים",
                "description": "FIFO: enqueue ו-dequeue.",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50x 2024 - Queues",
                    "page_url": "https://cs50.harvard.edu/x/2024/shorts/queues/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/2017/fall/shorts/queues/queues-720p.mp4",
                    "youtube_id": "3TmUv1uS92s",
                    "duration_seconds": 951,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            },
            {
                "key": "tries",
                "title": "עצי Trie",
                "description": "עץ לחיפוש מילים מהיר.",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50x 2024 - Tries",
                    "page_url": "https://cs50.harvard.edu/x/2024/shorts/tries/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/2017/fall/shorts/tries/tries-720p.mp4",
                    "youtube_id": "MC-iQHFdEDI",
                    "duration_seconds": 983,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            }
        ]
    },
    {
        "slug": "git-github",
        "title": "Git ו-GitHub",
        "category": "כלי פיתוח",
        "difficulty": "beginner",
        "description": "ניהול גרסאות עם Git: מאגרים, commits, ענפים, push ו-pull, ועבודה עם GitHub.",
        "lessons": [
            {
                "key": "intro-git",
                "title": "מבוא ל-Git",
                "description": "למה צריך ניהול גרסאות ואיך Git עובד.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Let's Learn .NET: GitHub - Fundamentals: Introduction to Git",
                    "page_url": "https://learn.microsoft.com/en-us/shows/lets-learn-net-github/fundamentals-intro-to-git/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-2934b10b-57fc-4c73-8c96-1e016f82635d/LetsLearnDotNet_GitandGitHub_Ses_1280x720_AACAudio_1371_2.mp4",
                    "youtube_id": None,
                    "duration_seconds": 896,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "git-lecture",
                "title": "Git לעומק",
                "description": "commits, ענפים, מיזוג ו-GitHub (הרצאת CS50 Web).",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50's Web Programming with Python and JavaScript - Week 1 Git",
                    "page_url": "https://cs50.harvard.edu/web/2020/weeks/1/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/web/2020/spring/lectures/1/lecture1-720p.mp4",
                    "youtube_id": "NcoBAfJ6l2Q",
                    "duration_seconds": 3195,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            },
            {
                "key": "create-repo",
                "title": "יצירת מאגר משורת הפקודה",
                "description": "git init והמאגר הראשון.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Git Tutorial: Create a repo from the command line",
                    "page_url": "https://learn.microsoft.com/en-us/shows/team-services-git-tutorial/git-tutorial-create-repo-from-command-line/",
                    "page_status": 200,
                    "direct_url": None,
                    "youtube_id": None,
                    "duration_seconds": 141,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "commits",
                "title": "Commits",
                "description": "שמירת שינויים בהיסטוריה.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Git Tutorial: Commits",
                    "page_url": "https://learn.microsoft.com/en-us/shows/team-services-git-tutorial/git-tutorial-commits/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-7d5460fd-6564-46f3-8e0e-d4ac6cea0372/tutorialgitcommits_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 80,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "branches",
                "title": "ענפים",
                "description": "עבודה במקביל בענפים.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Git Tutorial: Branches",
                    "page_url": "https://learn.microsoft.com/en-us/shows/team-services-git-tutorial/git-tutorial-branches/",
                    "page_status": 200,
                    "direct_url": None,
                    "youtube_id": None,
                    "duration_seconds": 86,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "push",
                "title": "Push",
                "description": "שליחת שינויים למאגר מרוחק.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Git Tutorial: Push",
                    "page_url": "https://learn.microsoft.com/en-us/shows/team-services-git-tutorial/git-tutorial-push/",
                    "page_status": 200,
                    "direct_url": None,
                    "youtube_id": None,
                    "duration_seconds": 82,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "pull",
                "title": "Pull",
                "description": "קבלת שינויים מהמאגר המרוחק.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Git Tutorial: Pull",
                    "page_url": "https://learn.microsoft.com/en-us/shows/team-services-git-tutorial/git-tutorial-pull/",
                    "page_status": 200,
                    "direct_url": None,
                    "youtube_id": None,
                    "duration_seconds": 107,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "rebase",
                "title": "Rebase",
                "description": "סידור היסטוריה מעל ענף אחר.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Git Tutorial: Rebase",
                    "page_url": "https://learn.microsoft.com/en-us/shows/team-services-git-tutorial/git-tutorial-rebase/",
                    "page_status": 200,
                    "direct_url": None,
                    "youtube_id": None,
                    "duration_seconds": 139,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "vscode",
                "title": "Git ב-Visual Studio Code",
                "description": "עבודה עם Git ו-GitHub מתוך העורך.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Let's Learn .NET: GitHub - Using Git in Visual Studio Code",
                    "page_url": "https://learn.microsoft.com/en-us/shows/lets-learn-net-github/git-and-visual-studio-code/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-fdd0036e-6034-441c-b3b5-e934e852372c/LetsLearnDotNet_GitandGitHub_Ses_1280x720_AACAudio_1360_2.mp4",
                    "youtube_id": None,
                    "duration_seconds": 3152,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            }
        ]
    },
    {
        "slug": "docker-apis-cloud",
        "title": "Docker, API וענן",
        "category": "תשתיות",
        "difficulty": "intermediate",
        "description": "קונטיינרים וסביבות פיתוח עם Docker, בניית API ובדיקתו, ויסודות של סקלביליות ואבטחה בענן.",
        "lessons": [
            {
                "key": "containers-intro",
                "title": "למה קונטיינרים?",
                "description": "מהם קונטיינרים ואיך הם עוזרים לפיתוח ולפריסה.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "What's the deal with .NET & Containers? (Part 1 of 3) | Containers with .NET for Beginners",
                    "page_url": "https://learn.microsoft.com/en-us/shows/containers-with-dotnet-and-docker-for-beginners/whats-the-deal-with-dotnet-containers-containers-with-dotnet-for-beginners/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-739984d9-6752-421a-8031-99731144023e/Containers%20Episode%201_17025892511_1280x720_AACAudio_2746_2.mp4",
                    "youtube_id": None,
                    "duration_seconds": 337,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "building-containers",
                "title": "בניית קונטיינרים",
                "description": "Dockerfile ובניית images.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Making great containers with .NET, Visual Studio, and Visual Studio Code (Part 2 of 3) | Containers with .NET for Beginners",
                    "page_url": "https://learn.microsoft.com/en-us/shows/containers-with-dotnet-and-docker-for-beginners/making-great-containers-with-dotnet-visual-studio-and-visual-studio-code-containers-with-dotnet-for-beginners/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-34371afd-c2e4-467e-9429-6b0a1843c2e0/Containers%20Episode%202_17025895377_1280x720_AACAudio_2464_2.mp4",
                    "youtube_id": None,
                    "duration_seconds": 678,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "publishing-containers",
                "title": "פרסום קונטיינרים",
                "description": "העלאת images והרצה בכל מקום.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Publishing your .NET containers everywhere! (Part 3 of 3) | Containers with .NET for Beginners",
                    "page_url": "https://learn.microsoft.com/en-us/shows/containers-with-dotnet-and-docker-for-beginners/publishing-your-dotnet-containerseverywhere-containers-with-dotnet-for-beginners/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-b37e7702-ba65-461c-bfd1-7152bcbc1c32/Containers%20Episode%203_17025896196_1280x720_AACAudio_2572_2.mp4",
                    "youtube_id": None,
                    "duration_seconds": 348,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "dev-containers",
                "title": "סביבת פיתוח בקונטיינר",
                "description": "Dev Containers: הכרות.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Introduction [1 of 8] | Beginner's Series to: Dev Containers",
                    "page_url": "https://learn.microsoft.com/en-us/shows/beginners-series-to-dev-containers/introduction-1-of-8--beginners-series-to-dev-containers/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-292d261e-b194-4beb-8de0-f7f6023be83c/01_intro_v2_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 209,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "add-dev-container",
                "title": "הוספת Dev Container לפרויקט",
                "description": "הגדרת קונטיינר לפרויקט קיים.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Adding a dev container to a project [3 of 8] | Beginner's Series to: Dev Containers",
                    "page_url": "https://learn.microsoft.com/en-us/shows/beginners-series-to-dev-containers/adding-a-dev-container-to-a-project-3-of-8--beginners-series-to-dev-containers/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-2a9a7d6a-5a7e-4966-acdf-37ba2c7fcfb2/03_addingdev_v2_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 179,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "ports",
                "title": "העברת פורטים",
                "description": "גישה לשרת שרץ בתוך הקונטיינר.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Forwarding ports [5 of 8] | Beginner's Series to: Dev Containers",
                    "page_url": "https://learn.microsoft.com/en-us/shows/beginners-series-to-dev-containers/forwarding-ports-5-of-8--beginners-series-to-dev-containers/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-819f3c61-bd77-4386-9ae8-bd24e894b052/05_forwarding_v2_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 281,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "apis-intro",
                "title": "מבוא ל-API",
                "description": "מה זה Web API ואיך הוא עובד.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Introduction to APIs with .NET (Part 1 of 8) | Backend Web Development with .NET for Beginners",
                    "page_url": "https://learn.microsoft.com/en-us/shows/back-end-web-development-with-dotnet-for-beginners/introduction-to-apis-with-dotnet-backend-web-development-with-dotnet-for-beginners/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-02ae7c71-8757-479c-969c-33ba4914474f/Beg-backend-01_1706067415900_1280x720_AACAudio_3276_2.mp4",
                    "youtube_id": None,
                    "duration_seconds": 150,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "implement-api",
                "title": "מימוש Web API",
                "description": "בניית endpoints ראשונים.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Implementing a Web API in .NET (Part 3 of 8) | Backend Web Development with .NET for Beginners",
                    "page_url": "https://learn.microsoft.com/en-us/shows/back-end-web-development-with-dotnet-for-beginners/implementing-a-web-api-in-dotnet-backend-web-development-with-dotnet-for-beginners/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-1393bb7b-0210-4aa9-8266-3d194c398127/Beg-backend-03_1706067608318_1280x720_AACAudio_1531_2.mp4",
                    "youtube_id": None,
                    "duration_seconds": 865,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "calling-api",
                "title": "קריאה ל-API מקוד",
                "description": "שליחת בקשות HTTP וקבלת JSON (Python).",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Python for Beginners [36 of 44] Calling an API",
                    "page_url": "https://learn.microsoft.com/en-us/shows/intro-to-python-development/python-for-beginners-36-of-44-calling-an-api/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-cba02677-f416-4a4d-82d4-d0ef8b7b5d49/callinganapi_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 612,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "scalability-security",
                "title": "סקלביליות ואבטחה",
                "description": "שרתים, איזון עומסים, ענן ואבטחה (CS50 Web).",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50's Web Programming with Python and JavaScript - Week 8 Scalability and Security",
                    "page_url": "https://cs50.harvard.edu/web/2020/weeks/8/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/web/2020/spring/lectures/8/lecture8-720p.mp4",
                    "youtube_id": "6PWTxRGh_dk",
                    "duration_seconds": 5265,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            }
        ]
    },
    {
        "slug": "software-testing",
        "title": "בדיקות תוכנה ואוטומציה",
        "category": "איכות תוכנה",
        "difficulty": "intermediate",
        "description": "יסודות בדיקות תוכנה, בדיקות יחידה, ניהול באגים ובדיקות קצה לקצה אוטומטיות עם Playwright ו-CI.",
        "lessons": [
            {
                "key": "fundamentals",
                "title": "יסודות בדיקות תוכנה",
                "description": "למה בודקים ומה סוגי הבדיקות.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Software Testing Fundamentals: (01) Testing Fundamentals",
                    "page_url": "https://learn.microsoft.com/en-us/shows/software-testing-fundamentals/01/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-ce1c2829-05c2-425c-9026-a2bab9813a43/softwaretestingfundamentalsm01_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 2045,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "methodologies",
                "title": "מתודולוגיות בדיקה",
                "description": "קופסה שחורה, קופסה לבנה ושיטות נוספות.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Software Testing Fundamentals: (02) Testing Methodologies",
                    "page_url": "https://learn.microsoft.com/en-us/shows/software-testing-fundamentals/02/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-fabf8af1-5620-47ba-924d-3bdd8f3c60fd/softwaretestingfundamentalsm02_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 2536,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "creating-tests",
                "title": "כתיבת בדיקות",
                "description": "תכנון מקרי בדיקה.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Software Testing Fundamentals: (03) Creating Software Tests",
                    "page_url": "https://learn.microsoft.com/en-us/shows/software-testing-fundamentals/03/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-0e2f4645-acc8-4604-b357-ba410b24855c/softwaretestingfundamentalsm03_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 2188,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "unit-tests",
                "title": "בדיקות יחידה",
                "description": "assert, pytest ובדיקת פונקציות (CS50P).",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50's Introduction to Programming with Python - Week 5 Unit Tests",
                    "page_url": "https://cs50.harvard.edu/python/2022/weeks/5/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/python/2022/x/lectures/5/lecture5-720p.mp4",
                    "youtube_id": "tIrcxwLqzjQ",
                    "duration_seconds": 3054,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            },
            {
                "key": "bugs",
                "title": "עבודה עם באגים",
                "description": "דיווח, תיעדוף ומעקב אחרי באגים.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Software Testing Fundamentals: (05) Working with Bugs",
                    "page_url": "https://learn.microsoft.com/en-us/shows/software-testing-fundamentals/05/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-ccde8671-7b86-49d0-b7b7-61e1be903b54/softwaretestingfundamentalsm05_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 2034,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "automating",
                "title": "אוטומציה של בדיקות",
                "description": "מתי ואיך להפוך בדיקות לאוטומטיות.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Software Testing Fundamentals: (06) Automating Software Tests",
                    "page_url": "https://learn.microsoft.com/en-us/shows/software-testing-fundamentals/06/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-f4bbe6f7-ef4e-4d8c-8bb7-98dc875dda41/softwaretestingfundamentalsm06_mid.mp4",
                    "youtube_id": None,
                    "duration_seconds": 1676,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "playwright-start",
                "title": "התחלה עם Playwright",
                "description": "התקנה ובדיקת קצה לקצה ראשונה.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Get started with end-to-end testing with Playwright",
                    "page_url": "https://learn.microsoft.com/en-us/shows/getting-started-with-end-to-end-testing-with-playwright/get-started-with-end-to-end-testing-with-playwright/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-02ee3f1d-baae-4b1c-a01f-a08b638cf579/Get%20started%20with%20end-to-end%20test_1280x720_AACAudio_655_1.mp4",
                    "youtube_id": None,
                    "duration_seconds": 350,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "playwright-write",
                "title": "כתיבת בדיקות קצה לקצה",
                "description": "locators, פעולות ובדיקות.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Writing end-to-end tests with Playwright",
                    "page_url": "https://learn.microsoft.com/en-us/shows/getting-started-with-end-to-end-testing-with-playwright/writing-end-to-end-tests-with-playwright/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-d25da4f2-591e-404f-ac67-aed317327719/Get%20started%20with%20end-to-end%20test_1280x720_AACAudio_593_1.mp4",
                    "youtube_id": None,
                    "duration_seconds": 275,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "playwright-run",
                "title": "הרצת בדיקות",
                "description": "הרצה בדפדפנים שונים ודוחות.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Running tests with Playwright",
                    "page_url": "https://learn.microsoft.com/en-us/shows/getting-started-with-end-to-end-testing-with-playwright/running-tests-with-playwright/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-3add539b-fb48-4056-bb7a-5765aa2ecd40/Get%20started%20with%20end-to-end%20test_1280x720_AACAudio_695_1.mp4",
                    "youtube_id": None,
                    "duration_seconds": 207,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "playwright-debug",
                "title": "דיבוג בדיקות",
                "description": "כלי הדיבוג של Playwright.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Debugging tests with Playwright",
                    "page_url": "https://learn.microsoft.com/en-us/shows/getting-started-with-end-to-end-testing-with-playwright/debugging-tests-with-playwright/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-ba498e8d-e4ad-47b2-96ed-8029253ed3e0/Get%20started%20with%20end-to-end%20test_1280x720_AACAudio_693_1.mp4",
                    "youtube_id": None,
                    "duration_seconds": 330,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "ci",
                "title": "בדיקות ב-CI",
                "description": "הרצת Playwright באינטגרציה רציפה.",
                "video": {
                    "provider": "Microsoft Learn",
                    "source_title": "Running Playwright tests in continuous integration",
                    "page_url": "https://learn.microsoft.com/en-us/shows/getting-started-with-end-to-end-testing-with-playwright/running-playwright-tests-in-continuous-integration/",
                    "page_status": 200,
                    "direct_url": "https://videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net/public-cb21bfd6-6419-491a-9fbb-8df048fd330a/Get%20started%20with%20end-to-end%20test_1280x720_AACAudio_722_1.mp4",
                    "youtube_id": None,
                    "duration_seconds": 158,
                    "license": "Microsoft Learn terms of use",
                    "language": "en"
                }
            },
            {
                "key": "testing-cicd",
                "title": "בדיקות, CI/CD ו-Docker",
                "description": "unittest, GitHub Actions ו-Docker (CS50 Web).",
                "video": {
                    "provider": "Harvard CS50",
                    "source_title": "CS50's Web Programming with Python and JavaScript - Week 7 Testing, CI/CD",
                    "page_url": "https://cs50.harvard.edu/web/2020/weeks/7/",
                    "page_status": 200,
                    "direct_url": "https://cdn.cs50.net/web/2020/spring/lectures/7/lecture7-720p.mp4",
                    "youtube_id": "WbRDkJ4lPdY",
                    "duration_seconds": 5638,
                    "license": "CC BY-NC-SA 4.0",
                    "language": "en"
                }
            }
        ]
    }
]
