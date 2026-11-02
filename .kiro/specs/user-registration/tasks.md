# Implementation Plan: רישום משתמשים (User Registration)

## Overview

מימוש פיצ'ר רישום המשתמשים ב-FocusMind AI בארכיטקטורת Full-Stack: React + Vite בצד ה-Frontend ו-FastAPI + MongoDB בצד ה-Backend. המימוש כולל ולידציה כפולה, גיבוב סיסמאות עם bcrypt, מניעת רישום כפול (כולל race conditions), ממשק RTL בעברית, ובדיקות אוטומטיות מקיפות.

## Tasks

- [ ] 1. הגדרת מבנה הפרויקט ותשתית
  - [x] 1.1 יצירת מבנה תיקיות הפרויקט המלא
    - צור את עץ התיקיות הבא:
      ```
      FocusMind-AI/
      ├── frontend/src/features/auth/
      ├── backend/app/core/
      ├── backend/app/db/
      ├── backend/app/api/routes/
      ├── backend/app/services/
      ├── backend/app/repositories/
      ├── backend/app/models/
      ├── backend/app/schemas/
      └── tests/
      ```
    - _דרישות: 1.1_

  - [x] 1.2 הגדרת קבצי תצורת הפרויקט (docker-compose, .env.example, .gitignore)
    - צור `docker-compose.yml` עם שלושה שירותים: `frontend`, `backend`, `mongo` (MongoDB 7)
    - צור `.env.example` עם המשתנים: `MONGO_URI`, `MONGO_DB_NAME`, `MONGO_ROOT_USER`, `MONGO_ROOT_PASSWORD`, `SECRET_KEY`, `BCRYPT_ROUNDS`, `CORS_ORIGINS`, `ENV`, `VITE_API_URL`
    - צור `.gitignore` שמוציא: `.env`, `*.pyc`, `__pycache__/`, `node_modules/`, `dist/`
    - _דרישות: 5.4_

  - [x] 1.3 הגדרת תלויות Backend (requirements.txt + Dockerfile)
    - צור `backend/requirements.txt` עם:
      ```
      # Production
      fastapi
      uvicorn[standard]
      pymongo==4.13.2
      bcrypt
      pydantic[email]       # נדרש ל-EmailStr
      pydantic-settings     # נדרש ל-Settings שטוען מ-.env

      # Testing
      pytest
      pytest-asyncio
      httpx
      asgi-lifespan
      hypothesis            # לבדיקות property-based (אופציונלי, נדרש למשימות 10.x)
      ```
    - צור `backend/Dockerfile` עם Python base image, העתקת `requirements.txt` והרצת `uvicorn`
    - _דרישות: 3.1–3.7, 5.1–5.3_

  - [x] 1.4 הגדרת תלויות Frontend (package.json + vite.config.js + Dockerfile)
    - צור `frontend/package.json` עם תלויות: `react`, `react-dom`, `vite`, `@vitejs/plugin-react`
    - הוסף dev dependencies: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`
    - צור `frontend/vite.config.js` עם הגדרות Vite ו-Vitest (כולל `environment: 'jsdom'`, `globals: true`, `setupFiles`)
    - צור `frontend/Dockerfile`
    - _דרישות: 1.1–1.6, 2.1–2.10_

- [ ] 2. Backend — שכבת DB וקונפיגורציה
  - [x] 2.1 מימוש קונפיגורציה וחיבור MongoDB (config.py + database.py)
    - צור `backend/app/core/config.py` עם מחלקת `Settings` (pydantic-settings / BaseSettings) שטוענת מ-.env את: `mongo_uri`, `mongo_db_name`, `secret_key`, `cors_origins`
    - צור `backend/app/db/database.py` עם: `connect_to_db()`, `close_db()`, `get_db()` (FastAPI Dependency), `create_indexes()` (unique index על שדה `email`)
    - _דרישות: 3.2, 5.3_

  - [x] 2.2 מימוש אפליקציית FastAPI הראשית עם Lifespan (main.py)
    - צור `backend/app/main.py` עם:
      - `lifespan` context manager שקורא `connect_to_db()`, `create_indexes()` ב-startup ו-`close_db()` ב-shutdown
      - הגדרת CORS middleware עם `origins` מה-Settings
      - רישום ה-router מ-`app/api/routes/auth.py`
    - _דרישות: 3.1, 5.4_

- [ ] 3. Backend — שכבת מודלים, סכמות ואבטחה
  - [ ] 3.1 מימוש גיבוב סיסמאות (security.py)
    - צור `backend/app/models/security.py` עם:
      - `hash_password(plain_password: str) -> str` — bcrypt עם `rounds=12`
      - `verify_password(plain_password: str, hashed_password: str) -> bool`
    - _דרישות: 3.3, 5.1_

  - [ ] 3.2 מימוש Pydantic v2 Schemas + RequestValidationError Handler עם מיפוי display_name→displayName
    - צור `backend/app/schemas/auth.py` עם:
      - `RegisterRequest`: `model_validator(mode='before')` לנרמול email (strip + lowercase) ו-display_name (strip), ולידטורי שדות עם הודעות שגיאה בעברית
      - `RegisterResponse`: שדה `user_id: str` בלבד (ללא password/hashed_password)
    - הוסף ב-`main.py` exception handler עבור `RequestValidationError` שממפה שגיאות Pydantic לשדות בעברית (כולל מיפוי `display_name` → `displayName` לצרכי ה-Frontend)
    - _דרישות: 4.1–4.5, 3.1, 3.5_

  - [ ] 3.3 כתיבת בדיקות יחידה לסכמות ו-handler
    - צור `tests/test_schemas.py` עם בדיקות:
      - T6: display_name מרווחים בלבד → HTTP 422
      - T7: display_name ריק לחלוטין → HTTP 422
      - T10: אימייל עם רווחים מסביב מנורמל לפני ולידציה
      - בדיקת תגובות 422 מכילות הודעות שגיאה בעברית
    - _דרישות: 4.1, 4.2, 4.3, 4.4, 4.5, 7.6, 7.7_

- [ ] 4. Backend — שכבת Repository ו-Service
  - [ ] 4.1 מימוש UserRepository
    - צור `backend/app/repositories/user_repository.py` עם:
      - `find_by_email(email: str)` — שאילתת `find_one` ב-users collection
      - `create_user(display_name, email, hashed_password) -> str` — `insert_one` עם `created_at` (UTC), מחזיר `str(inserted_id)`
    - _דרישות: 3.2, 3.4, 5.3_

  - [ ] 4.2 מימוש AuthService עם DuplicateKeyError + HTTP 500 גנרי
    - צור `backend/app/services/auth_service.py` עם מתודת `register(payload)`:
      - בדיקת כפילות דרך `find_by_email` → HTTP 409 עם הודעה בעברית
      - גיבוב סיסמה דרך `hash_password`
      - שמירה דרך `create_user`
      - תפיסת `DuplicateKeyError` (race condition) → HTTP 409
      - תפיסת כל שגיאה אחרת → HTTP 500 עם הודעה גנרית בעברית (ללא חשיפת פרטים)
    - _דרישות: 3.2, 3.3, 3.5, 3.6, 3.7, 4.6_

  - [ ] 4.3 מימוש API Router (POST /register)
    - צור `backend/app/api/routes/auth.py` עם:
      - `router = APIRouter(prefix="/api/auth", tags=["auth"])`
      - `POST /register` endpoint: `response_model=RegisterResponse`, `status_code=201`
      - חיבור ל-`AuthService` דרך `Depends()`
    - _דרישות: 3.1–3.7_

  - [ ] 4.4 כתיבת בדיקות יחידה ל-AuthService
    - צור `tests/test_auth_service.py` עם בדיקות יחידה על `AuthService` תוך שימוש ב-`unittest.mock` / `monkeypatch`:
      - T8: כשל DB שאינו DuplicateKeyError → HTTP 500 עם הודעה גנרית
      - T12: תגובת 500 לא חושפת פרטי שגיאה פנימיים (stack trace, שם קובץ וכו')
      - בדיקת מסלול "אימייל קיים" → HTTP 409
    - _דרישות: 3.6, 3.7, 7.8_

- [ ] 5. נקודת ביקורת ראשונה
  - ודא שהפקודה `pytest tests/test_schemas.py tests/test_auth_service.py -v` עוברת ללא שגיאות
  - ודא שה-FastAPI app מגיב בכתובת `http://localhost:8000/docs` לאחר `docker-compose up`
  - שאל את המשתמש אם יש שאלות לפני המשך

- [ ] 6. Frontend — ולידציה ושירות API
  - [ ] 6.1 מימוש פונקציות ולידציה (validation.js)
    - צור `frontend/src/features/auth/validation.js` עם פונקציה `validateForm({ displayName, email, password, confirmPassword })`:
      - בדיקת displayName: trim + empty check → "שם תצוגה הוא שדה חובה"; אורך > 50 → "שם תצוגה לא יכול להכיל יותר מ-50 תווים"
      - בדיקת email: empty → "אימייל הוא שדה חובה"; regex לא תקין → "כתובת האימייל אינה תקינה"
      - בדיקת password: empty → "סיסמה היא שדה חובה"; < 8 תווים → "הסיסמה חייבת להכיל לפחות 8 תווים"
      - בדיקת confirmPassword: empty → "אישור סיסמה הוא שדה חובה"; לא תואם → "הסיסמאות אינן תואמות"
    - _דרישות: 2.1–2.9_

  - [ ] 6.2 כתיבת בדיקות יחידה ל-validation.js
    - צור `frontend/src/features/auth/validation.test.js` עם בדיקות Vitest:
      - כל שגיאת ולידציה לפי דרישות 2.1–2.8 (כולל displayName מרווחים, displayName > 50 תווים, אימייל לא תקין, סיסמה קצרה, סיסמאות לא תואמות)
      - וידוא שטופס תקין מחזיר אובייקט ריק ללא שגיאות
    - הרץ: `npx vitest run src/features/auth/validation.test.js`
    - _דרישות: 2.1–2.10, 7.x (Frontend)_

  - [ ] 6.3 מימוש authService
    - צור `frontend/src/features/auth/authService.js` עם פונקציה `registerUser(payload)`:
      - `fetch` ל-`${VITE_API_URL}/api/auth/register` עם method POST, header `Content-Type: application/json`
      - בתגובה לא-ok: זרוק Error עם `error.status` ו-`error.data` (פרסינג JSON)
      - בתגובה תקינה: החזר JSON
    - _דרישות: 3.1, 6.1–6.5_

- [ ] 7. Frontend — קומפוננטת RegisterForm
  - [ ] 7.1 בניית קומפוננטת RegisterForm
    - צור `frontend/src/features/auth/RegisterForm.jsx` עם:
      - `dir="rtl"` על ה-form
      - ארבעה שדות קלט: שם תצוגה, אימייל, סיסמה, אישור סיסמה — עם תוויות בעברית
      - כפתור "הרשמה"
      - קישור "יש לך חשבון? התחבר"
      - state: `formData`, `errors`, `isLoading`, `successMessage`, `apiError`
    - _דרישות: 1.1–1.6_

  - [ ] 7.2 חיבור ולידציה ו-API ב-RegisterForm
    - חבר את `validateForm` מ-`validation.js` ל-`handleSubmit`
    - חבר את `registerUser` מ-`authService.js`
    - טפל בתגובות:
      - HTTP 201: הצג "ההרשמה הושלמה בהצלחה!" וקישור לדף ההתחברות (ללא redirect אוטומטי)
      - HTTP 409: הצג "כתובת האימייל כבר קיימת במערכת" ליד שדה האימייל
      - HTTP 422: מפה שגיאות Pydantic לשדות הרלוונטיים
      - HTTP 500: הצג הודעה גנרית ללא פרטים טכניים
      - שגיאת רשת (fetch נכשל): הצג "שגיאת חיבור, נסה שוב מאוחר יותר"
    - הצג אינדיקטור טעינה והשבת כפתור בזמן isLoading
    - _דרישות: 1.6, 2.9, 6.1–6.5_

  - [ ] 7.3 כתיבת בדיקות קומפוננטה ל-RegisterForm
    - צור `frontend/src/features/auth/RegisterForm.test.jsx` עם בדיקות React Testing Library:
      - הצגת כל שדות הטופס והתוויות בעברית
      - הצגת שגיאות ולידציה בסמוך לשדות בעת שליחת טופס ריק
      - הצגת הודעת הצלחה "ההרשמה הושלמה בהצלחה!" עם mock של `registerUser` שמחזיר 201
      - הצגת שגיאה "כתובת האימייל כבר קיימת במערכת" עם mock שמחזיר 409
      - השבתת כפתור "הרשמה" בזמן isLoading
    - הרץ: `npx vitest run src/features/auth/RegisterForm.test.jsx`
    - _דרישות: 1.1–1.6, 2.1–2.10, 6.1–6.5_

  - [ ] 7.4 חיבור RegisterForm ל-App.jsx
    - עדכן `frontend/src/App.jsx` לייבא ולהציג את `RegisterForm`
    - ודא ש-`frontend/src/main.jsx` מרנדר את `App` בצורה תקינה
    - _דרישות: 1.1–1.6_

- [ ] 8. נקודת ביקורת שנייה
  - ודא שהפקודה `npx vitest run` עוברת ללא שגיאות
  - ודא שממשק הטופס מוצג כראוי בכתובת `http://localhost:3000` עם RTL
  - שאל את המשתמש אם יש שאלות לפני המשך

- [ ] 9. בדיקות אינטגרציה (Backend)
  - [ ] 9.1 הגדרת סביבת בדיקות Backend (conftest.py + pytest.ini)
    - צור `tests/conftest.py` עם:
      - fixture `test_db_client` (scope="session"): חיבור PyMongo (AsyncMongoClient) ל-MongoDB
      - fixture `test_db` (scope="function"): drop + create_index("email", unique=True) לפני ואחרי כל בדיקה (DB: `focusmind_test`)
      - fixture `client`: `app.dependency_overrides[get_db] = get_test_db` + `LifespanManager` + `httpx.AsyncClient`
      - fixture `valid_payload`: dict עם `display_name`, `email`, `password`
      - assertion שמוודאת `TEST_DB_NAME != settings.mongo_db_name`
    - צור `pytest.ini` (או הוסף ל-`pyproject.toml`) עם `asyncio_mode = auto`
    - _דרישות: 7.1–7.9_

  - [ ] 9.2 כתיבת בדיקות אינטגרציה T1–T7 ו-T9–T11
    - צור `tests/test_auth.py` עם הבדיקות הבאות (כולן מול `focusmind_test`):
      - T1: רישום תקין → HTTP 201 + `user_id` בתגובה
      - T2: רישום עם אימייל קיים → HTTP 409
      - T3: שדות חסרים → HTTP 422
      - T4: תגובת 201 לא מכילה `password` או `hashed_password`
      - T5: אימייל uppercase נשמר כ-lowercase ב-MongoDB
      - T6: display_name מרווחים בלבד → HTTP 422
      - T7: display_name ריק לחלוטין → HTTP 422
      - T9: סיסמה מגובבת ב-DB — `hashed_password` מתחיל ב-`$2b$` ואינו שווה ל-plaintext
      - T10: אימייל עם רווחים נשמר ללא רווחים
      - T11: concurrency — שתי בקשות מקבילות עם אותו אימייל: רק אחת מחזירה 201, השנייה 409
    - הרץ: `pytest tests/test_auth.py -v`
    - _דרישות: 7.1–7.7, 7.9_

  - [ ] 9.3 כתיבת בדיקות יחידה T8 ו-T12 (monkeypatch)
    - הוסף ל-`tests/test_auth.py` (או ל-`tests/test_auth_service.py`):
      - T8: monkeypatch על `user_repository.create_user` לזרוק `Exception("DB error")` → HTTP 500 עם הודעה גנרית
      - T12: וידוא שתגובת HTTP 500 אינה מכילה את מחרוזת "DB error" או כל מידע פנימי אחר
    - הרץ: `pytest tests/ -v`
    - _דרישות: 3.7, 7.8_

- [ ] 10. Property-Based Tests
  - [ ]* 10.1 Property 1: נרמול אימייל
    - כתוב בדיקת Hypothesis ב-`tests/test_properties.py`
    - **Property 1: Email Normalization Round-Trip**
    - לכל email המכיל אותיות גדולות או רווחים — נרמול (strip + lowercase) + שמירה → הערך ב-DB שווה לגרסה המנורמלת
    - **Validates: Requirements 3.1**

  - [ ]* 10.2 Property 2: סיסמה לא נחשפת בתגובה
    - כתוב בדיקת Hypothesis ב-`tests/test_properties.py`
    - **Property 2: Password Never Exposed in Response**
    - לכל בקשת רישום (תקינה או לא) — גוף התגובה לא מכיל `password` או `hashed_password`
    - **Validates: Requirements 3.5, 5.2**

  - [ ]* 10.3 Property 3: סיסמה plaintext לא נשמרת
    - כתוב בדיקת Hypothesis ב-`tests/test_properties.py`
    - **Property 3: Plaintext Password Never Stored**
    - לכל רישום תקין — `hashed_password` ב-MongoDB אינו שווה ל-plaintext password
    - **Validates: Requirements 5.1**

  - [ ]* 10.4 Property 4: display_name לא תקין נדחה
    - כתוב בדיקת Hypothesis ב-`tests/test_properties.py`
    - **Property 4: Invalid Display Name Rejected**
    - לכל display_name ריק / רווחים בלבד / ארוך מ-50 תווים לאחר trim → HTTP 422
    - **Validates: Requirements 2.1, 2.2, 4.1, 4.2**

  - [ ]* 10.5 Property 5: email לא תקין נדחה
    - כתוב בדיקת Hypothesis ב-`tests/test_properties.py`
    - **Property 5: Invalid Email Format Rejected**
    - לכל email שאינו תואם פורמט תקין → Frontend מציג שגיאה inline, Backend מחזיר HTTP 422
    - **Validates: Requirements 2.4, 4.4**

- [ ] 11. בדיקת E2E ידנית
  - [ ] 11.1 וידוא עלית שירותים ב-Docker Compose
    - הרץ: `docker-compose up --build`
    - ודא ששלושת השירותים (`frontend`, `backend`, `mongo`) עולים ללא שגיאות
    - ודא שה-backend מגיב בכתובת `http://localhost:8000/docs`
    - ודא שה-frontend נגיש בכתובת `http://localhost:3000`
    - _דרישות: 1.1–1.6_

  - [ ] 11.2 רישום משתמש חדש דרך הדפדפן
    - פתח `http://localhost:3000` בדפדפן
    - מלא את הטופס: שם תצוגה, כתובת אימייל תקינה, סיסמה באורך לפחות 8 תווים, אישור סיסמה
    - לחץ על כפתור "הרשמה"
    - ודא שמוצגת הודעת הצלחה: "ההרשמה הושלמה בהצלחה!"
    - ודא שמוצג קישור לדף ההתחברות
    - _דרישות: 1.4, 1.5, 6.1_

  - [ ] 11.3 וידוא שמירת המשתמש ב-MongoDB
    - התחבר ל-MongoDB עם:
      ```bash
      docker exec -it focusmind-mongo mongosh -u $MONGO_ROOT_USER -p $MONGO_ROOT_PASSWORD --authenticationDatabase admin
      ```
    - הרץ: `use focusmind_db` ואז `db.users.findOne()`
    - ודא שמסמך המשתמש מכיל: `display_name`, `email` (lowercase), `hashed_password` (מתחיל ב-`$2b$`), `created_at`
    - **ודא שהשדה `password` (plaintext) לא קיים במסמך**
    - _דרישות: 3.4, 5.1, 5.3_

  - [ ] 11.4 בדיקת מניעת רישום כפול
    - נסה לרשום שוב עם אותה כתובת אימייל
    - ודא שמוצגת שגיאה: "כתובת האימייל כבר קיימת במערכת" ליד שדה האימייל
    - _דרישות: 3.6, 4.6, 6.2_

  - [ ] 11.5 בדיקת ולידציה ב-Frontend
    - שלח טופס ריק וודא שמוצגות הודעות שגיאה בסמוך לכל שדה
    - בדוק סיסמה קצרה מ-8 תווים, אימייל לא תקין, וסיסמאות שאינן תואמות
    - _דרישות: 1.1–1.6, 2.1–2.10, 3.1–3.7, 5.1–5.4, 6.1–6.5_

- [ ] 12. נקודת ביקורת סופית
  - ודא שכל הבדיקות עוברות: `pytest tests/ -v` ו-`npx vitest run`
  - ודא שבדיקת ה-E2E (משימה 11) הושלמה בהצלחה
  - שאל את המשתמש אם יש שאלות לפני סיום

## Notes

## הנחיות זרימת עבודה

> **חשוב לביצוע:** פועלים **תת-משימה אחת בכל פעם** לפי הסדר הרצוף הבא:

1. **בצע** תת-משימה אחת בלבד (לדוגמה: 1.1, לאחר מכן 1.2, לאחר מכן 1.3 וכן הלאה)
2. **הסבר** — לאחר כל תת-משימה, ציין:
   - אילו קבצים נוצרו או שונו
   - אם יש פקודות להרצה (כגון `pip install`, `npm install`, `pytest tests/test_file.py -v`) — ציין אותן בדיוק
3. **המתן לאישור מפורש** לפני המעבר לתת-משימה הבאה
4. **אל תמדוד קדימה** — אין לבצע מספר תת-משימות ברצף ללא אישור בין כל אחת

> **עיקרון:** הגישה הזו מאפשרת לך לבדוק כל שלב, להבין את הקוד, ולתפוס בעיות מוקדם.

---

- משימות המסומנות ב-`*` הן אופציונליות (Property-Based Tests בלבד) וניתן לדלג עליהן ל-MVP מהיר
- כל שאר משימות הבדיקה (יחידה, אינטגרציה, E2E) הן **חובה**
- כל משימה מפנה לדרישות ספציפיות לצורך traceability
- נקודות הביקורת מאפשרות ולידציה הדרגתית — לא לדלג עליהן

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2"] },
    { "id": 4, "tasks": ["3.1", "3.2", "4.1"] },
    { "id": 5, "tasks": ["3.3", "4.2", "6.1"] },
    { "id": 6, "tasks": ["4.3", "4.4", "6.2", "6.3"] },
    { "id": 7, "tasks": ["7.1", "9.1"] },
    { "id": 8, "tasks": ["7.2", "9.2"] },
    { "id": 9, "tasks": ["7.3", "9.3"] },
    { "id": 10, "tasks": ["7.4"] },
    { "id": 11, "tasks": ["10.1", "10.2", "10.3", "10.4", "10.5"] },
    { "id": 12, "tasks": ["11.1"] },
    { "id": 13, "tasks": ["11.2"] },
    { "id": 14, "tasks": ["11.3", "11.4", "11.5"] }
  ]
}
```
