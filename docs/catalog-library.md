# Video library catalog

10 courses, 116 lessons. Each lesson links to one specific, real educational
video. Sources:

- **Microsoft Learn**: 82 lessons
- **Harvard CS50**: 34 lessons

## How the data was collected and verified

Every URL, title and duration below was read from the source itself, never composed by hand:

- **Microsoft Learn:**
  - episodes came from the public API (`/api/contentbrowser/search/shows/<show>/episodes`);
  - the video files came from `/api/video/public/v1/entries/<id>`;
  - the duration comes from the API.
- **Harvard CS50:**
  - lecture and Short pages on cs50.harvard.edu, with the official YouTube id and MP4 link listed on each page;
  - the duration comes from the official English transcript (`.srt`) on cdn.cs50.net;
  - the topic was checked against the transcript (keyword counts).
- Each lesson's video page was requested at build time (HTTP 200 for all).
- YouTube itself cannot be reached from this network (HTTP 418, NetFree), so the CS50 YouTube ids are
  as published on the official CS50 pages, not checked on YouTube.
- Lessons whose topic had no suitable video in these sources were not created (see *Gaps*).

## Accessibility behind NetFree

Measured 2026-11-17 with: Microsoft Edge (Playwright) on the NetFree connection: the lesson's source page was opened, every <video> on it and the direct video file were asked to play; playable = media time advanced. Measured individually for 75 of 116 lessons (both providers); the remaining lessons were not played individually after every measured lesson of the same providers was blocked.

| Result | Lessons |
|---|---|
| plays on this network | 0 |
| page opens, video blocked | 75 |
| blocked | 0 |
| not verified | 41 |

"Page opens" is not counted as a playable video. Lessons link to the page by default.
`python -m app.catalog_videos apply` switches every lesson to the most integrated candidate
that the server's network can reach:

- **direct file:** FocusMind's own player, progress, attention monitoring and ReplayAI;
- **YouTube:** embedded, no tracking;
- **page:** opened externally.

## Playing these videos inside FocusMind

FocusMind's own player plays any direct external file. On those lessons the position, progress,
attention segments and ReplayAI work like with an uploaded video. This was verified in Edge
(`frontend/e2e/external-player.e2e.js`) with a **simulated** CDN that answers
`https://cdn.cs50.net/...` with a local test file:

1. a catalog lesson is switched to its direct file with the real tool;
2. it plays in FocusMind's player and the position is saved and restored;
3. ReplayAI seeks inside it and stops at the end of the interval.

**No real external video played on this NetFree connection.**

To get integrated playback for these lessons:

1. Ask NetFree to allow the video hosts:
   - `cdn.cs50.net` (MP4; today blocked by the general `*.mp4` rule);
   - `videoencodingpublic-hgeaeyeba8gycee3.b01.azurefd.net` (Microsoft Learn).
2. Run:

   ```powershell
   docker compose exec backend python -m app.catalog_videos check   # see what is reachable now
   docker compose exec backend python -m app.catalog_videos apply   # switches reachable lessons to direct playback
   ```

111 of the 116 lessons have a direct file. The 5 short Git clips (create repo, branches, push,
pull, rebase) are offered as pages only.

## Courses

### תכנות ב-Python (מתחילים, תכנות, 13 lessons)

מהפקודה הראשונה ועד פונקציות, מודולים ומחלקות: סדרת סרטונים קצרים של Microsoft שמלמדת Python צעד אחר צעד.

| # | Lesson | Source video | Duration | Behind NetFree |
|---|---|---|---|---|
| 1 | הכרות עם Python | [Microsoft Learn: Python for Beginners [2 of 44] Introducing Python](https://learn.microsoft.com/en-us/shows/intro-to-python-development/python-for-beginners-2-of-44-introducing-python/) | 3:09 | page opens, video blocked |
| 2 | התקנה והתחלה | [Microsoft Learn: Python for Beginners [3 of 44] Getting Started](https://learn.microsoft.com/en-us/shows/intro-to-python-development/python-for-beginners-3-of-44-getting-started/) | 2:57 | page opens, video blocked |
| 3 | הדפסה למסך עם print | [Microsoft Learn: Python for Beginners [5 of 44] Using Print](https://learn.microsoft.com/en-us/shows/intro-to-python-development/python-for-beginners-5-of-44-using-print/) | 3:28 | page opens, video blocked |
| 4 | מחרוזות | [Microsoft Learn: Python for Beginners [9 of 44] String Concepts](https://learn.microsoft.com/en-us/shows/intro-to-python-development/python-for-beginners-9-of-44-string-concepts/) | 4:40 | page opens, video blocked |
| 5 | עיצוב מחרוזות | [Microsoft Learn: Python for Beginners [11 of 44] Formatting Strings](https://learn.microsoft.com/en-us/shows/intro-to-python-development/python-for-beginners-11-of-44-formatting-strings/) | 4:08 | page opens, video blocked |
| 6 | טיפוסי מספרים | [Microsoft Learn: Python for Beginners [13 of 44] Numeric Data Types](https://learn.microsoft.com/en-us/shows/intro-to-python-development/python-for-beginners-13-of-44-numeric-data-types/) | 5:50 | page opens, video blocked |
| 7 | טיפול בשגיאות | [Microsoft Learn: Python for Beginners [17 of 44] Error Handling](https://learn.microsoft.com/en-us/shows/intro-to-python-development/python-for-beginners-17-of-44-error-handling/) | 12:53 | page opens, video blocked |
| 8 | תנאים | [Microsoft Learn: Python for Beginners [19 of 44] Conditional Logic](https://learn.microsoft.com/en-us/shows/intro-to-python-development/python-for-beginners-19-of-44-conditional-logic/) | 4:52 | page opens, video blocked |
| 9 | אוספים: רשימות ומילונים | [Microsoft Learn: Python for Beginners [25 of 44] Collections](https://learn.microsoft.com/en-us/shows/intro-to-python-development/python-for-beginners-25-of-44-collections/) | 11:26 | page opens, video blocked |
| 10 | לולאות | [Microsoft Learn: Python for Beginners [27 of 44] Loops](https://learn.microsoft.com/en-us/shows/intro-to-python-development/python-for-beginners-27-of-44-loops/) | 5:29 | page opens, video blocked |
| 11 | פונקציות | [Microsoft Learn: Python for Beginners [29 of 44] Introducing Functions](https://learn.microsoft.com/en-us/shows/intro-to-python-development/python-for-beginners-29-of-44-introducing-functions/) | 10:08 | page opens, video blocked |
| 12 | מודולים וחבילות | [Microsoft Learn: Python for Beginners [33 of 44] Modules and packages](https://learn.microsoft.com/en-us/shows/intro-to-python-development/python-for-beginners-33-of-44-modules-and-packages/) | 10:11 | page opens, video blocked |
| 13 | מחלקות ואובייקטים | [Microsoft Learn: Classes / More Python for Beginners [6 of 20]](https://learn.microsoft.com/en-us/shows/more-python-for-beginners/classes--more-python-for-beginners-6-of-20/) | 11:55 | page opens, video blocked |

### SQL ומסדי נתונים (מתחילים, נתונים, 10 lessons)

מושגי יסוד של מסדי נתונים רלציוניים, ושאילתות SQL לשליפה, סינון, חיבור וסיכום נתונים.

| # | Lesson | Source video | Duration | Behind NetFree |
|---|---|---|---|---|
| 1 | מושגי יסוד במסדי נתונים | [Microsoft Learn: Database Fundamentals: (01) Introducing Core Database Concepts](https://learn.microsoft.com/en-us/shows/dbfundamentals/01/) | 29:55 | page opens, video blocked |
| 2 | מודל רלציוני | [Microsoft Learn: Database Fundamentals: (02) Relational Concepts](https://learn.microsoft.com/en-us/shows/dbfundamentals/02/) | 44:12 | page opens, video blocked |
| 3 | מבוא לשאילתות SQL | [Microsoft Learn: Introduction to Transact-SQL (Part 2 of 7) / Programming Databases with T-SQL for Beginners](https://learn.microsoft.com/en-us/shows/programming-databases-with-t-sql-for-beginners/introduction-to-transact-sql-2-of-7-programming-databases-with-t-sql-for-beginners/) | 11:25 | page opens, video blocked |
| 4 | מיון וסינון תוצאות | [Microsoft Learn: Sort and Filter Results in Transact-SQL (Part 3 of 7) / Programming Databases with T-SQL for Beginners](https://learn.microsoft.com/en-us/shows/programming-databases-with-t-sql-for-beginners/sort-and-filter-results-in-transact-sql-3-of-7-programming-databases-with-t-sql-for-beginners/) | 13:39 | page opens, video blocked |
| 5 | חיבור טבלאות עם JOIN | [Microsoft Learn: Combining multiple tables with JOINS in Transact-SQL (Part 4 of 7) / Programming Databases with T-SQL for Beginners](https://learn.microsoft.com/en-us/shows/programming-databases-with-t-sql-for-beginners/combining-multiple-tables-with-joins-in-transact-sql-4-of-7-programming-databases-with-t-sql-for-beginners/) | 8:44 | page opens, video blocked |
| 6 | שאילתות משנה | [Microsoft Learn: Write Subqueries in Transact-SQL (Part 5 of 7) / Programming Databases with T-SQL for Beginners](https://learn.microsoft.com/en-us/shows/programming-databases-with-t-sql-for-beginners/write-subqueries-in-transact-sql-5-of-7-programming-databases-with-t-sql-for-beginners/) | 4:23 | page opens, video blocked |
| 7 | פונקציות ו-GROUP BY | [Microsoft Learn: Use Functions and GROUP BY in Transact-SQL (Part 6 of 7) / Programming Databases with T-SQL for Beginners](https://learn.microsoft.com/en-us/shows/programming-databases-with-t-sql-for-beginners/use-functions-and-group-by-in-transact-sql-6-of-7-programming-databases-with-t-sql-for-beginners/) | 10:24 | page opens, video blocked |
| 8 | הוספה, עדכון ומחיקה | [Microsoft Learn: Modify Data with Transact-SQL (Part 7 of 7) / Programming Databases with T-SQL for Beginners](https://learn.microsoft.com/en-us/shows/programming-databases-with-t-sql-for-beginners/modify-data-with-transact-sql-7-of-7-programming-databases-with-t-sql-for-beginners/) | 13:09 | page opens, video blocked |
| 9 | תכנון סכמה | [Harvard CS50: CS50's Introduction to Databases with SQL - Week 2 Designing](https://cs50.harvard.edu/sql/2024/weeks/2/) ([YouTube](https://www.youtube.com/watch?v=QzRW6bfv3Fo)) | 1:21:24 | page opens, video blocked |
| 10 | אופטימיזציה ואינדקסים | [Harvard CS50: CS50's Introduction to Databases with SQL - Week 5 Optimizing](https://cs50.harvard.edu/sql/2024/weeks/5/) ([YouTube](https://www.youtube.com/watch?v=qa5-mKVSQHQ)) | 1:28:52 | page opens, video blocked |

### JavaScript (מתחילים, פיתוח ווב, 16 lessons)

יסודות JavaScript בסרטונים קצרים: משתנים, תנאים, מערכים, פונקציות, אובייקטים וקוד אסינכרוני.

| # | Lesson | Source video | Duration | Behind NetFree |
|---|---|---|---|---|
| 1 | מהי JavaScript | [Microsoft Learn: What is JavaScript [2 of 51]](https://learn.microsoft.com/en-us/shows/beginners-series-to-javascript/what-is-javascript-2-of-51/) | 3:32 | page opens, video blocked |
| 2 | הרצת JavaScript: דפדפן או שרת | [Microsoft Learn: Running JavaScript: browser or server [3 of 51]](https://learn.microsoft.com/en-us/shows/beginners-series-to-javascript/running-javascript-browser-or-server-3-of-51/) | 3:38 | page opens, video blocked |
| 3 | הגדרת משתנים | [Microsoft Learn: Declaring variables [9 of 51]](https://learn.microsoft.com/en-us/shows/beginners-series-to-javascript/declaring-variables-9-of-51/) | 3:52 | page opens, video blocked |
| 4 | עבודה עם מחרוזות | [Microsoft Learn: Working with strings [11 of 51]](https://learn.microsoft.com/en-us/shows/beginners-series-to-javascript/working-with-strings-11-of-51/) | 3:18 | page opens, video blocked |
| 5 | טיפוסי נתונים | [Microsoft Learn: Data types in JavaScript [15 of 51]](https://learn.microsoft.com/en-us/shows/beginners-series-to-javascript/data-types-in-javascript-15-of-51/) | 5:40 | page opens, video blocked |
| 6 | טיפול בשגיאות | [Microsoft Learn: Handling errors with try/catch/finally [21 of 51]](https://learn.microsoft.com/en-us/shows/beginners-series-to-javascript/handling-errors-with-trycatchfinally-21-of-51/) | 3:17 | page opens, video blocked |
| 7 | תנאים עם if | [Microsoft Learn: Boolean logic with if statements [25 of 51]](https://learn.microsoft.com/en-us/shows/beginners-series-to-javascript/boolean-logic-with-if-statements-25-of-51/) | 5:38 | page opens, video blocked |
| 8 | יצירת מערכים | [Microsoft Learn: Creating arrays [29 of 51]](https://learn.microsoft.com/en-us/shows/beginners-series-to-javascript/creating-arrays-29-of-51/) | 1:29 | page opens, video blocked |
| 9 | שיטות של מערכים | [Microsoft Learn: Array methods [33 of 51]](https://learn.microsoft.com/en-us/shows/beginners-series-to-javascript/array-methods-33-of-51/) | 1:59 | page opens, video blocked |
| 10 | לולאות | [Microsoft Learn: Loops [35 of 51]](https://learn.microsoft.com/en-us/shows/beginners-series-to-javascript/loops-35-of-51/) | 7:23 | page opens, video blocked |
| 11 | פונקציות | [Microsoft Learn: Functions [37 of 51]](https://learn.microsoft.com/en-us/shows/beginners-series-to-javascript/functions-37-of-51/) | 9:33 | page opens, video blocked |
| 12 | פונקציות חץ ופונקציות אנונימיות | [Microsoft Learn: Arrow and anonymous functions [39 of 51]](https://learn.microsoft.com/en-us/shows/beginners-series-to-javascript/arrow-and-anonymous-functions-39-of-51/) | 5:15 | page opens, video blocked |
| 13 | אובייקטים | [Microsoft Learn: Objects in JavaScript [43 of 51]](https://learn.microsoft.com/en-us/shows/beginners-series-to-javascript/objects-in-javascript-43-of-51/) | 10:42 | page opens, video blocked |
| 14 | Promises | [Microsoft Learn: Promises for long running operations [45 of 51]](https://learn.microsoft.com/en-us/shows/beginners-series-to-javascript/promises-for-long-running-operations-45-of-51/) | 6:31 | page opens, video blocked |
| 15 | async ו-await | [Microsoft Learn: Async/await for managing promises [47 of 51]](https://learn.microsoft.com/en-us/shows/beginners-series-to-javascript/asyncawait-for-managing-promises-47-of-51/) | 5:06 | page opens, video blocked |
| 16 | ה-DOM | [Harvard CS50: CS50x 2024 - DOM](https://cs50.harvard.edu/x/2024/shorts/dom/) ([YouTube](https://www.youtube.com/watch?v=LKWJpgvfH3U)) | 20:35 | page opens, video blocked |

### React (בינוני, פיתוח ווב, 11 lessons)

React ו-React Native בהרצאות של CS50: קומפוננטות, props ו-state, רשימות, ניווט, נתונים, Redux ובדיקות.

| # | Lesson | Source video | Duration | Behind NetFree |
|---|---|---|---|---|
| 1 | JavaScript מודרני (ES6) לפני React | [Harvard CS50: CS50's Mobile App Development with React Native - JavaScript, ES6](https://cs50.harvard.edu/mobile/2018/weeks/1/) ([YouTube](https://www.youtube.com/watch?v=3Ay2lS6tm4M)) | 1:47:46 | page opens, video blocked |
| 2 | קומפוננטות, props ו-state | [Harvard CS50: CS50's Mobile App Development with React Native - React, Props, State](https://cs50.harvard.edu/mobile/2018/weeks/2/) ([YouTube](https://www.youtube.com/watch?v=7O43VDOlQ_o)) | 1:37:29 | page opens, video blocked |
| 3 | React בדפדפן: ממשקי משתמש | [Harvard CS50: CS50's Web Programming with Python and JavaScript - Week 6 User Interfaces](https://cs50.harvard.edu/web/2020/weeks/6/) ([YouTube](https://www.youtube.com/watch?v=jrBhi8wbzPw)) | 1:40:15 | page opens, video blocked |
| 4 | React Native | [Harvard CS50: CS50's Mobile App Development with React Native - React Native](https://cs50.harvard.edu/mobile/2018/weeks/3/) ([YouTube](https://www.youtube.com/watch?v=Gk6RF5k3C2M)) | 1:38:06 | page opens, video blocked |
| 5 | רשימות וקלט משתמש | [Harvard CS50: CS50's Mobile App Development with React Native - Lists, User Input](https://cs50.harvard.edu/mobile/2018/weeks/4/) ([YouTube](https://www.youtube.com/watch?v=-E1tQPQSAxc)) | 1:44:54 | page opens, video blocked |
| 6 | קלט ודיבוג | [Harvard CS50: CS50's Mobile App Development with React Native - User Input, Debugging](https://cs50.harvard.edu/mobile/2018/weeks/5/) ([YouTube](https://www.youtube.com/watch?v=sv71JMZEpYY)) | 1:33:07 | page opens, video blocked |
| 7 | ניווט בין מסכים | [Harvard CS50: CS50's Mobile App Development with React Native - Navigation](https://cs50.harvard.edu/mobile/2018/weeks/6/) ([YouTube](https://www.youtube.com/watch?v=QHorNUuEXc0)) | 1:25:44 | page opens, video blocked |
| 8 | עבודה עם נתונים ו-API | [Harvard CS50: CS50's Mobile App Development with React Native - Data](https://cs50.harvard.edu/mobile/2018/weeks/7/) ([YouTube](https://www.youtube.com/watch?v=jWwOTg35COs)) | 1:39:33 | page opens, video blocked |
| 9 | ניהול מצב עם Redux | [Harvard CS50: CS50's Mobile App Development with React Native - Redux](https://cs50.harvard.edu/mobile/2018/weeks/9/) ([YouTube](https://www.youtube.com/watch?v=_zT8K6R_P7I)) | 1:49:02 | page opens, video blocked |
| 10 | ביצועים | [Harvard CS50: CS50's Mobile App Development with React Native - Performance](https://cs50.harvard.edu/mobile/2018/weeks/11/) ([YouTube](https://www.youtube.com/watch?v=39W5Llg2orM)) | 1:43:59 | page opens, video blocked |
| 11 | בדיקות ופריסה | [Harvard CS50: CS50's Mobile App Development with React Native - Deploying, Testing](https://cs50.harvard.edu/mobile/2018/weeks/12/) ([YouTube](https://www.youtube.com/watch?v=VUV00jJ45nU)) | 1:40:17 | page opens, video blocked |

### HTML ו-CSS (מתחילים, פיתוח ווב, 10 lessons)

בניית דפי אינטרנט מאפס: מבנה HTML, טקסט, תמונות, רשימות, טבלאות וטפסים, ועיצוב עם CSS.

| # | Lesson | Source video | Duration | Behind NetFree |
|---|---|---|---|---|
| 1 | דף ה-HTML הראשון | [Microsoft Learn: Creating Your First HTML5 Web Page - 02](https://learn.microsoft.com/en-us/shows/html5-css3-fundamentals-development-for-absolute-beginners/creating-your-first-html5-web-page-02/) | 35:14 | page opens, video blocked |
| 2 | עיצוב ראשון עם CSS | [Microsoft Learn: Styling Your First HTML5 Web Page with CSS3 - 03](https://learn.microsoft.com/en-us/shows/html5-css3-fundamentals-development-for-absolute-beginners/styling-your-first-html5-web-page-css3-03/) | 29:21 | page opens, video blocked |
| 3 | פסקאות וטקסט | [Microsoft Learn: Working with Paragraphs and Text - 05](https://learn.microsoft.com/en-us/shows/html5-css3-fundamentals-development-for-absolute-beginners/working-paragraphs-text-05/) | 48:58 | page opens, video blocked |
| 4 | מבנה המסמך | [Microsoft Learn: Defining the Structure of Your Document - 06](https://learn.microsoft.com/en-us/shows/html5-css3-fundamentals-development-for-absolute-beginners/defining-structure-of-your-document-06/) | 20:18 | page opens, video blocked |
| 5 | תמונות ואיורים | [Microsoft Learn: Working with Figures and Images - 07](https://learn.microsoft.com/en-us/shows/html5-css3-fundamentals-development-for-absolute-beginners/working-figures-images-07/) | 6:59 | page opens, video blocked |
| 6 | רשימות | [Microsoft Learn: Working with Lists - 08](https://learn.microsoft.com/en-us/shows/html5-css3-fundamentals-development-for-absolute-beginners/working-lists-08/) | 15:30 | page opens, video blocked |
| 7 | טבלאות | [Microsoft Learn: Creating Tables - 09](https://learn.microsoft.com/en-us/shows/html5-css3-fundamentals-development-for-absolute-beginners/creating-tables-09/) | 13:00 | page opens, video blocked |
| 8 | טפסים | [Microsoft Learn: Creating Forms - 10](https://learn.microsoft.com/en-us/shows/html5-css3-fundamentals-development-for-absolute-beginners/creating-forms-10/) | 27:27 | page opens, video blocked |
| 9 | הבנת CSS | [Microsoft Learn: Understanding Cascading Style Sheets - 12](https://learn.microsoft.com/en-us/shows/html5-css3-fundamentals-development-for-absolute-beginners/understanding-cascading-style-sheets-12/) | 43:26 | page opens, video blocked |
| 10 | מודל הקופסה ב-CSS | [Microsoft Learn: CSS3 Box Properties - 16](https://learn.microsoft.com/en-us/shows/html5-css3-fundamentals-development-for-absolute-beginners/css3-box-properties-16/) | 18:38 | page opens, video blocked |

### בינה מלאכותית ומודלי שפה (בינוני, בינה מלאכותית, 12 lessons)

מלמידת מכונה ורשתות נוירונים ועד מודלי שפה גדולים, הנדסת פרומפטים, RAG וסוכנים.

| # | Lesson | Source video | Duration | Behind NetFree |
|---|---|---|---|---|
| 1 | למידת מכונה | [Harvard CS50: CS50's Introduction to Artificial Intelligence with Python - Week 4 Learning](https://cs50.harvard.edu/ai/2024/weeks/4/) ([YouTube](https://www.youtube.com/watch?v=-g0iJjnO2_w)) | 1:45:48 | page opens, video blocked |
| 2 | רשתות נוירונים | [Harvard CS50: CS50's Introduction to Artificial Intelligence with Python - Week 5 Neural Networks](https://cs50.harvard.edu/ai/2024/weeks/5/) ([YouTube](https://www.youtube.com/watch?v=J1QD9hLDEDY)) | 1:41:19 | page opens, video blocked |
| 3 | שפה, attention ו-transformers | [Harvard CS50: CS50's Introduction to Artificial Intelligence with Python - Week 6 Language](https://cs50.harvard.edu/ai/2024/weeks/6/) ([YouTube](https://www.youtube.com/watch?v=QAZc9xsQNjQ)) | 1:05:21 | page opens, video blocked |
| 4 | מבוא לבינה יוצרת ולמודלי שפה | [Microsoft Learn: Introduction to Generative AI and LLMs (Part 1 of 18) / Generative AI for Beginners](https://learn.microsoft.com/en-us/shows/generative-ai-for-beginners/introduction-to-generative-ai-and-llms-generative-ai-for-beginners/) | 10:33 | page opens, video blocked |
| 5 | השוואה בין מודלי שפה | [Microsoft Learn: Exploring and comparing different LLMs (Part 2 of 18) / Generative AI for Beginners](https://learn.microsoft.com/en-us/shows/generative-ai-for-beginners/exploring-and-comparing-different-llms-generative-ai-for-beginners/) | 20:59 | page opens, video blocked |
| 6 | שימוש אחראי בבינה יוצרת | [Microsoft Learn: Using Generative AI Responsibly (Part 3 of 18) / Generative AI for Beginners](https://learn.microsoft.com/en-us/shows/generative-ai-for-beginners/using-generative-ai-responsibly-generative-ai-for-beginners/) | 9:21 | page opens, video blocked |
| 7 | יסודות הנדסת פרומפטים | [Microsoft Learn: Understanding Prompt Engineering Fundamentals (Part 4 of 18) / Generative AI for Beginners](https://learn.microsoft.com/en-us/shows/generative-ai-for-beginners/understanding-prompt-engineering-fundamentals-generative-ai-for-beginners/) | 23:15 | page opens, video blocked |
| 8 | פרומפטים מתקדמים | [Microsoft Learn: Creating Advanced Prompts (Part 5 of 18) / Generative AI for Beginners](https://learn.microsoft.com/en-us/shows/generative-ai-for-beginners/creating-advanced-prompts-generative-ai-for-beginners/) | 16:59 | page opens, video blocked |
| 9 | בניית אפליקציות צ'אט | [Microsoft Learn: Building Chat Applications (Part 7 of 18) / Generative AI for Beginners](https://learn.microsoft.com/en-us/shows/generative-ai-for-beginners/building-chat-applications-generative-ai-for-beginners/) | 13:34 | page opens, video blocked |
| 10 | RAG ומסדי נתונים וקטוריים | [Microsoft Learn: Retrieval Augmented Generation (RAG) and Vector Databases (Part 15 of 18) / Generative AI for Beginners](https://learn.microsoft.com/en-us/shows/generative-ai-for-beginners/retrieval-augmented-generation-rag-and-vector-databases-generative-ai-for-beginners/) | 10:52 | page opens, video blocked |
| 11 | סוכני AI | [Microsoft Learn: AI Agents (Part 17 of 18) / Generative AI for Beginners](https://learn.microsoft.com/en-us/shows/generative-ai-for-beginners/ai-agents-generative-ai-for-beginners/) | 7:54 | page opens, video blocked |
| 12 | כוונון עדין (Fine-tuning) | [Microsoft Learn: Fine-Tuning LLMs (Part 18 of 18) / Generative AI for Beginners](https://learn.microsoft.com/en-us/shows/generative-ai-for-beginners/finetuning-llms-generative-ai-for-beginners/) | 20:47 | page opens, video blocked |

### אלגוריתמים ומבני נתונים (בינוני, מדעי המחשב, 13 lessons)

חיפוש, מיון ורקורסיה, ומבני הנתונים הבסיסיים: רשימות מקושרות, טבלאות גיבוב, מחסניות, תורים ועצים.

| # | Lesson | Source video | Duration | Behind NetFree |
|---|---|---|---|---|
| 1 | חיפוש לינארי | [Harvard CS50: CS50x 2024 - Linear Search](https://cs50.harvard.edu/x/2024/shorts/linear_search/) ([YouTube](https://www.youtube.com/watch?v=TwsgCHYmbbA)) | 2:50 | page opens, video blocked |
| 2 | חיפוש בינארי | [Harvard CS50: CS50x 2024 - Binary Search](https://cs50.harvard.edu/x/2024/shorts/binary_search/) ([YouTube](https://www.youtube.com/watch?v=T98PIp4omUA)) | 9:31 | page opens, video blocked |
| 3 | מיון בועות | [Harvard CS50: CS50x 2024 - Bubble Sort](https://cs50.harvard.edu/x/2024/shorts/bubble_sort/) ([YouTube](https://www.youtube.com/watch?v=RT-hUXUWQ2I)) | 5:54 | page opens, video blocked |
| 4 | מיון בחירה | [Harvard CS50: CS50x 2024 - Selection Sort](https://cs50.harvard.edu/x/2024/shorts/selection_sort/) ([YouTube](https://www.youtube.com/watch?v=3hH8kTHFw2A)) | 4:00 | not verified |
| 5 | רקורסיה | [Harvard CS50: CS50x 2024 - Recursion](https://cs50.harvard.edu/x/2024/shorts/recursion/) ([YouTube](https://www.youtube.com/watch?v=mz6tAJMVmfM)) | not verified | not verified |
| 6 | מיון מיזוג | [Harvard CS50: CS50x 2024 - Merge Sort](https://cs50.harvard.edu/x/2024/shorts/merge_sort/) ([YouTube](https://www.youtube.com/watch?v=Ns7tGNbtvV4)) | 10:27 | not verified |
| 7 | מבוא למבני נתונים | [Harvard CS50: CS50x 2024 - Data Structures](https://cs50.harvard.edu/x/2024/shorts/data_structures/) ([YouTube](https://www.youtube.com/watch?v=3uGchQbk7g8)) | 8:52 | not verified |
| 8 | רשימות מקושרות | [Harvard CS50: CS50x 2024 - Singly-Linked Lists](https://cs50.harvard.edu/x/2024/shorts/singly_linked_lists/) ([YouTube](https://www.youtube.com/watch?v=zQI3FyWm144)) | 23:22 | not verified |
| 9 | רשימות מקושרות דו-כיווניות | [Harvard CS50: CS50x 2024 - Doubly-Linked Lists](https://cs50.harvard.edu/x/2024/shorts/doubly_linked_lists/) ([YouTube](https://www.youtube.com/watch?v=FHMPswJDCvU)) | 9:51 | not verified |
| 10 | טבלאות גיבוב | [Harvard CS50: CS50x 2024 - Hash Tables](https://cs50.harvard.edu/x/2024/shorts/hash_tables/) ([YouTube](https://www.youtube.com/watch?v=nvzVHwrrub0)) | 18:45 | not verified |
| 11 | מחסניות | [Harvard CS50: CS50x 2024 - Stacks](https://cs50.harvard.edu/x/2024/shorts/stacks/) ([YouTube](https://www.youtube.com/watch?v=hVsNqhEthOk)) | 14:20 | not verified |
| 12 | תורים | [Harvard CS50: CS50x 2024 - Queues](https://cs50.harvard.edu/x/2024/shorts/queues/) ([YouTube](https://www.youtube.com/watch?v=3TmUv1uS92s)) | 15:51 | not verified |
| 13 | עצי Trie | [Harvard CS50: CS50x 2024 - Tries](https://cs50.harvard.edu/x/2024/shorts/tries/) ([YouTube](https://www.youtube.com/watch?v=MC-iQHFdEDI)) | 16:23 | not verified |

### Git ו-GitHub (מתחילים, כלי פיתוח, 9 lessons)

ניהול גרסאות עם Git: מאגרים, commits, ענפים, push ו-pull, ועבודה עם GitHub.

| # | Lesson | Source video | Duration | Behind NetFree |
|---|---|---|---|---|
| 1 | מבוא ל-Git | [Microsoft Learn: Let's Learn .NET: GitHub - Fundamentals: Introduction to Git](https://learn.microsoft.com/en-us/shows/lets-learn-net-github/fundamentals-intro-to-git/) | 14:56 | not verified |
| 2 | Git לעומק | [Harvard CS50: CS50's Web Programming with Python and JavaScript - Week 1 Git](https://cs50.harvard.edu/web/2020/weeks/1/) ([YouTube](https://www.youtube.com/watch?v=NcoBAfJ6l2Q)) | 53:15 | not verified |
| 3 | יצירת מאגר משורת הפקודה | [Microsoft Learn: Git Tutorial: Create a repo from the command line](https://learn.microsoft.com/en-us/shows/team-services-git-tutorial/git-tutorial-create-repo-from-command-line/) | 2:21 | not verified |
| 4 | Commits | [Microsoft Learn: Git Tutorial: Commits](https://learn.microsoft.com/en-us/shows/team-services-git-tutorial/git-tutorial-commits/) | 1:20 | not verified |
| 5 | ענפים | [Microsoft Learn: Git Tutorial: Branches](https://learn.microsoft.com/en-us/shows/team-services-git-tutorial/git-tutorial-branches/) | 1:26 | not verified |
| 6 | Push | [Microsoft Learn: Git Tutorial: Push](https://learn.microsoft.com/en-us/shows/team-services-git-tutorial/git-tutorial-push/) | 1:22 | not verified |
| 7 | Pull | [Microsoft Learn: Git Tutorial: Pull](https://learn.microsoft.com/en-us/shows/team-services-git-tutorial/git-tutorial-pull/) | 1:47 | not verified |
| 8 | Rebase | [Microsoft Learn: Git Tutorial: Rebase](https://learn.microsoft.com/en-us/shows/team-services-git-tutorial/git-tutorial-rebase/) | 2:19 | not verified |
| 9 | Git ב-Visual Studio Code | [Microsoft Learn: Let's Learn .NET: GitHub - Using Git in Visual Studio Code](https://learn.microsoft.com/en-us/shows/lets-learn-net-github/git-and-visual-studio-code/) | 52:32 | not verified |

### Docker, API וענן (בינוני, תשתיות, 10 lessons)

קונטיינרים וסביבות פיתוח עם Docker, בניית API ובדיקתו, ויסודות של סקלביליות ואבטחה בענן.

| # | Lesson | Source video | Duration | Behind NetFree |
|---|---|---|---|---|
| 1 | למה קונטיינרים? | [Microsoft Learn: What's the deal with .NET & Containers? (Part 1 of 3) / Containers with .NET for Beginners](https://learn.microsoft.com/en-us/shows/containers-with-dotnet-and-docker-for-beginners/whats-the-deal-with-dotnet-containers-containers-with-dotnet-for-beginners/) | 5:37 | not verified |
| 2 | בניית קונטיינרים | [Microsoft Learn: Making great containers with .NET, Visual Studio, and Visual Studio Code (Part 2 of 3) / Containers with .NET for Beginners](https://learn.microsoft.com/en-us/shows/containers-with-dotnet-and-docker-for-beginners/making-great-containers-with-dotnet-visual-studio-and-visual-studio-code-containers-with-dotnet-for-beginners/) | 11:18 | not verified |
| 3 | פרסום קונטיינרים | [Microsoft Learn: Publishing your .NET containers everywhere! (Part 3 of 3) / Containers with .NET for Beginners](https://learn.microsoft.com/en-us/shows/containers-with-dotnet-and-docker-for-beginners/publishing-your-dotnet-containerseverywhere-containers-with-dotnet-for-beginners/) | 5:48 | not verified |
| 4 | סביבת פיתוח בקונטיינר | [Microsoft Learn: Introduction [1 of 8] / Beginner's Series to: Dev Containers](https://learn.microsoft.com/en-us/shows/beginners-series-to-dev-containers/introduction-1-of-8--beginners-series-to-dev-containers/) | 3:29 | not verified |
| 5 | הוספת Dev Container לפרויקט | [Microsoft Learn: Adding a dev container to a project [3 of 8] / Beginner's Series to: Dev Containers](https://learn.microsoft.com/en-us/shows/beginners-series-to-dev-containers/adding-a-dev-container-to-a-project-3-of-8--beginners-series-to-dev-containers/) | 2:59 | not verified |
| 6 | העברת פורטים | [Microsoft Learn: Forwarding ports [5 of 8] / Beginner's Series to: Dev Containers](https://learn.microsoft.com/en-us/shows/beginners-series-to-dev-containers/forwarding-ports-5-of-8--beginners-series-to-dev-containers/) | 4:41 | not verified |
| 7 | מבוא ל-API | [Microsoft Learn: Introduction to APIs with .NET (Part 1 of 8) / Backend Web Development with .NET for Beginners](https://learn.microsoft.com/en-us/shows/back-end-web-development-with-dotnet-for-beginners/introduction-to-apis-with-dotnet-backend-web-development-with-dotnet-for-beginners/) | 2:30 | not verified |
| 8 | מימוש Web API | [Microsoft Learn: Implementing a Web API in .NET (Part 3 of 8) / Backend Web Development with .NET for Beginners](https://learn.microsoft.com/en-us/shows/back-end-web-development-with-dotnet-for-beginners/implementing-a-web-api-in-dotnet-backend-web-development-with-dotnet-for-beginners/) | 14:25 | not verified |
| 9 | קריאה ל-API מקוד | [Microsoft Learn: Python for Beginners [36 of 44] Calling an API](https://learn.microsoft.com/en-us/shows/intro-to-python-development/python-for-beginners-36-of-44-calling-an-api/) | 10:12 | not verified |
| 10 | סקלביליות ואבטחה | [Harvard CS50: CS50's Web Programming with Python and JavaScript - Week 8 Scalability and Security](https://cs50.harvard.edu/web/2020/weeks/8/) ([YouTube](https://www.youtube.com/watch?v=6PWTxRGh_dk)) | 1:27:45 | not verified |

### בדיקות תוכנה ואוטומציה (בינוני, איכות תוכנה, 12 lessons)

יסודות בדיקות תוכנה, בדיקות יחידה, ניהול באגים ובדיקות קצה לקצה אוטומטיות עם Playwright ו-CI.

| # | Lesson | Source video | Duration | Behind NetFree |
|---|---|---|---|---|
| 1 | יסודות בדיקות תוכנה | [Microsoft Learn: Software Testing Fundamentals: (01) Testing Fundamentals](https://learn.microsoft.com/en-us/shows/software-testing-fundamentals/01/) | 34:05 | not verified |
| 2 | מתודולוגיות בדיקה | [Microsoft Learn: Software Testing Fundamentals: (02) Testing Methodologies](https://learn.microsoft.com/en-us/shows/software-testing-fundamentals/02/) | 42:16 | not verified |
| 3 | כתיבת בדיקות | [Microsoft Learn: Software Testing Fundamentals: (03) Creating Software Tests](https://learn.microsoft.com/en-us/shows/software-testing-fundamentals/03/) | 36:28 | not verified |
| 4 | בדיקות יחידה | [Harvard CS50: CS50's Introduction to Programming with Python - Week 5 Unit Tests](https://cs50.harvard.edu/python/2022/weeks/5/) ([YouTube](https://www.youtube.com/watch?v=tIrcxwLqzjQ)) | 50:54 | not verified |
| 5 | עבודה עם באגים | [Microsoft Learn: Software Testing Fundamentals: (05) Working with Bugs](https://learn.microsoft.com/en-us/shows/software-testing-fundamentals/05/) | 33:54 | not verified |
| 6 | אוטומציה של בדיקות | [Microsoft Learn: Software Testing Fundamentals: (06) Automating Software Tests](https://learn.microsoft.com/en-us/shows/software-testing-fundamentals/06/) | 27:56 | not verified |
| 7 | התחלה עם Playwright | [Microsoft Learn: Get started with end-to-end testing with Playwright](https://learn.microsoft.com/en-us/shows/getting-started-with-end-to-end-testing-with-playwright/get-started-with-end-to-end-testing-with-playwright/) | 5:50 | not verified |
| 8 | כתיבת בדיקות קצה לקצה | [Microsoft Learn: Writing end-to-end tests with Playwright](https://learn.microsoft.com/en-us/shows/getting-started-with-end-to-end-testing-with-playwright/writing-end-to-end-tests-with-playwright/) | 4:35 | not verified |
| 9 | הרצת בדיקות | [Microsoft Learn: Running tests with Playwright](https://learn.microsoft.com/en-us/shows/getting-started-with-end-to-end-testing-with-playwright/running-tests-with-playwright/) | 3:27 | not verified |
| 10 | דיבוג בדיקות | [Microsoft Learn: Debugging tests with Playwright](https://learn.microsoft.com/en-us/shows/getting-started-with-end-to-end-testing-with-playwright/debugging-tests-with-playwright/) | 5:30 | not verified |
| 11 | בדיקות ב-CI | [Microsoft Learn: Running Playwright tests in continuous integration](https://learn.microsoft.com/en-us/shows/getting-started-with-end-to-end-testing-with-playwright/running-playwright-tests-in-continuous-integration/) | 2:38 | not verified |
| 12 | בדיקות, CI/CD ו-Docker | [Harvard CS50: CS50's Web Programming with Python and JavaScript - Week 7 Testing, CI/CD](https://cs50.harvard.edu/web/2020/weeks/7/) ([YouTube](https://www.youtube.com/watch?v=WbRDkJ4lPdY)) | 1:33:58 | not verified |

## Gaps (not created, no suitable verified video)

- **No Hebrew-language videos.** The reachable official sources (Microsoft Learn, CS50) are in English.
  Hebrew educational sites that host their videos on YouTube are blocked on this network.
- **React in the browser.** CS50 Web "User Interfaces" is the only browser-React lecture found.
  The rest of the course uses CS50's React Native lectures, which teach React itself (components,
  props, state, Redux, testing).
- **Docker.** There is no dedicated, vendor-neutral Docker series in these sources. The lessons use
  Microsoft's container series (examples in .NET) and the Docker part of CS50 Web "Testing, CI/CD".
- **Git.** Lessons 3-8 are short Microsoft clips from an Azure DevOps Git tutorial (plain Git
  commands). Their MP4 files are not offered by the API (page only).
- **Recursion (CS50 Short).** Its transcript is blocked on this network, so the duration is not
  verified.

## Licenses

- CS50: CC BY-NC-SA 4.0 (attribution shown in the player).
- Microsoft Learn: Microsoft's terms of use.

FocusMind links to these videos and never downloads or re-hosts them.
