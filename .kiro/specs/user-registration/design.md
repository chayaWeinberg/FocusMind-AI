# מסמך עיצוב טכני: רישום משתמשים (User Registration)

## Overview

פיצ'ר רישום המשתמשים ב-FocusMind AI מאפשר למשתמשים חדשים ליצור חשבון מאובטח. הפיצ'ר בנוי בארכיטקטורת Full-Stack עם React בצד ה-Frontend ו-FastAPI בצד ה-Backend, תוך הקפדה על אבטחת סיסמאות, ולידציה כפולה ומניעת רישום כפול.

**יעדי עיצוב עיקריים:**

- ממשק בעברית עם תמיכה מלאה ב-RTL
- ולידציה בצד ה-Frontend לחוויית משתמש טובה, וולידציה כפולה בצד ה-Backend לאבטחה
- גיבוב סיסמאות עם bcrypt (cost factor ≥ 12)
- מניעת רישום כפול גם בתנאי concurrency באמצעות unique index ב-MongoDB
- הגנה על מידע רגיש — אין חשיפת סיסמה בשום תגובת API

---

## Architecture

### עיקרון ה-Layered Architecture

המערכת מחולקת לשכבות ברורות עם הפרדת אחריות מלאה:

| שכבה | תיאור | טכנולוגיה |
|------|--------|-----------|
| Presentation | טופס רישום, ולידציה ב-Frontend, הצגת תוצאות | React + Vite |
| API Gateway | נקודת קצה REST, ולידציה ב-Backend, ניהול שגיאות | FastAPI |
| Service | לוגיקה עסקית — נרמול, גיבוב, בדיקת כפילות | Python |
| Repository | גישה למסד הנתונים | PyMongo async (AsyncMongoClient) |
| Data Store | אחסון מסמכי משתמשים עם unique index | MongoDB |

### תרשים ארכיטקטורה

```mermaid
graph TD
    A[משתמש - Browser] -->|HTTPS POST /api/auth/register| B[React RegisterForm]
    B -->|validateForm| C[validation.js]
    C -->|Valid| D[authService.js]
    D -->|fetch POST| E[FastAPI - POST /api/auth/register]
    E -->|Pydantic v2 Schema| F[Input_Validator]
    F -->|Valid 422 on fail| G[auth_service.py]
    G -->|normalize email| G
    G -->|find_by_email| H[user_repository.py]
    H -->|PyMongo AsyncMongoClient| I[(MongoDB - users collection)]
    G -->|bcrypt hash| J[security.py]
    G -->|create_user| H
    H -->|insert_one| I
    I -->|duplicate key| H
    H -->|DuplicateKeyError| G
    G -->|201 / 409 / 500| E
    E -->|HTTP Response| D
    D -->|success/error| B
    B -->|הצגת תוצאה| A
```

### מבנה תיקיות מלא

```
FocusMind-AI/
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       └── features/
│           └── auth/
│               ├── RegisterForm.jsx
│               ├── validation.js
│               └── authService.js
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       ├── core/
│       │   └── config.py
│       ├── db/
│       │   └── database.py
│       ├── api/
│       │   └── routes/
│       │       └── auth.py
│       ├── services/
│       │   └── auth_service.py
│       ├── repositories/
│       │   └── user_repository.py
│       └── models/
│           └── security.py
├── tests/
│   ├── conftest.py
│   └── test_auth.py
├── docker-compose.yml
├── .env.example
└── .gitignore
```

---

## Components and Interfaces

### Frontend Components

#### `RegisterForm.jsx`

קומפוננטת React ראשית המנהלת את מצב הטופס, הולידציה ואת קריאות ה-API.

```jsx
// src/features/auth/RegisterForm.jsx
import { useState } from 'react';
import { validateForm } from './validation';
import { registerUser } from './authService';

export default function RegisterForm() {
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [apiError, setApiError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setIsLoading(true);
    setApiError('');
    try {
      await registerUser({
        display_name: formData.displayName,
        email: formData.email,
        password: formData.password,
      });
      setSuccessMessage('ההרשמה הושלמה בהצלחה!');
    } catch (err) {
      // טיפול בשגיאות API לפי status code
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form dir="rtl" onSubmit={handleSubmit}>
      {/* שדות הטופס עם הצגת שגיאות בסמוך לכל שדה */}
    </form>
  );
}
```

**מצבי הקומפוננטה:**

| מצב | תיאור |
|-----|--------|
| `isLoading` | מושבית כפתור השליחה, מוצג אינדיקטור טעינה |
| `errors` | שגיאות ולידציה לפי שדה (`displayName`, `email`, `password`, `confirmPassword`) |
| `successMessage` | הודעת הצלחה לאחר HTTP 201 |
| `apiError` | שגיאת API גנרית (500, שגיאת רשת) |

---

#### `validation.js`

פונקציות ולידציה בצד ה-Frontend — ריצה לפני שליחה לשרת.

```javascript
// src/features/auth/validation.js

export function validateForm({ displayName, email, password, confirmPassword }) {
  const errors = {};
  const trimmedName = displayName.trim();

  if (!trimmedName) {
    errors.displayName = 'שם תצוגה הוא שדה חובה';
  } else if (trimmedName.length > 50) {
    errors.displayName = 'שם תצוגה לא יכול להכיל יותר מ-50 תווים';
  }

  if (!email) {
    errors.email = 'אימייל הוא שדה חובה';
  } else if (!isValidEmail(email)) {
    errors.email = 'כתובת האימייל אינה תקינה';
  }

  if (!password) {
    errors.password = 'סיסמה היא שדה חובה';
  } else if (password.length < 8) {
    errors.password = 'הסיסמה חייבת להכיל לפחות 8 תווים';
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'אישור סיסמה הוא שדה חובה';
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'הסיסמאות אינן תואמות';
  }

  return errors;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

---

#### `authService.js`

שכבת שירות לתקשורת עם ה-API.

```javascript
// src/features/auth/authService.js

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function registerUser(payload) {
  const response = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error('Registration failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return response.json();
}
```

---

### Backend Components

#### `auth.py` — API Router

```python
# app/api/routes/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from app.services.auth_service import AuthService
from app.schemas.auth import RegisterRequest, RegisterResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(
    payload: RegisterRequest,
    service: AuthService = Depends(),
):
    return await service.register(payload)
```

**Pydantic v2 Schema עם נרמול `mode='before'`:**

```python
# app/schemas/auth.py
from pydantic import BaseModel, field_validator, model_validator
import re

class RegisterRequest(BaseModel):
    display_name: str
    email: str
    password: str

    @model_validator(mode='before')
    @classmethod
    def normalize_fields(cls, values):
        if isinstance(values.get('email'), str):
            values['email'] = values['email'].strip().lower()
        if isinstance(values.get('display_name'), str):
            values['display_name'] = values['display_name'].strip()
        return values

    @field_validator('display_name')
    @classmethod
    def validate_display_name(cls, v):
        if not v:
            raise ValueError('שם תצוגה הוא שדה חובה')
        if len(v) > 50:
            raise ValueError('שם תצוגה לא יכול להכיל יותר מ-50 תווים')
        return v

    @field_validator('email')
    @classmethod
    def validate_email(cls, v):
        if not v:
            raise ValueError('אימייל הוא שדה חובה')
        pattern = r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$'
        if not re.match(pattern, v):
            raise ValueError('כתובת האימייל אינה תקינה')
        return v

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if not v:
            raise ValueError('סיסמה היא שדה חובה')
        if len(v) < 8:
            raise ValueError('הסיסמה חייבת להכיל לפחות 8 תווים')
        return v

class RegisterResponse(BaseModel):
    user_id: str
```

---

#### `auth_service.py` — Business Logic

```python
# app/services/auth_service.py
from fastapi import Depends, HTTPException, status
from pymongo.errors import DuplicateKeyError
from app.repositories.user_repository import UserRepository
from app.models.security import hash_password
from app.schemas.auth import RegisterRequest, RegisterResponse

class AuthService:
    def __init__(self, repo: UserRepository = Depends()):
        self.repo = repo

    async def register(self, payload: RegisterRequest) -> RegisterResponse:
        # email כבר מנורמל ב-Pydantic validator (mode='before')
        existing = await self.repo.find_by_email(payload.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="כתובת האימייל כבר קיימת במערכת",
            )

        hashed = hash_password(payload.password)

        try:
            user_id = await self.repo.create_user(
                display_name=payload.display_name,
                email=payload.email,
                hashed_password=hashed,
            )
        except DuplicateKeyError:
            # race condition: בקשות מקבילות עם אותו אימייל
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="כתובת האימייל כבר קיימת במערכת",
            )
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="אירעה שגיאה בשרת, נסה שוב מאוחר יותר",
            )

        return RegisterResponse(user_id=user_id)
```

---

#### `user_repository.py` — Data Access

```python
# app/repositories/user_repository.py
from fastapi import Depends
from pymongo.asynchronous.database import AsyncDatabase
from app.db.database import get_db

class UserRepository:
    def __init__(self, db: AsyncDatabase = Depends(get_db)):
        self.db = db

    async def find_by_email(self, email: str):
        return await self.db.users.find_one({"email": email})

    async def create_user(
        self, display_name: str, email: str, hashed_password: str
    ) -> str:
        from datetime import datetime, timezone
        doc = {
            "display_name": display_name,
            "email": email,
            "hashed_password": hashed_password,
            "created_at": datetime.now(timezone.utc),
        }
        result = await self.db.users.insert_one(doc)
        return str(result.inserted_id)
```

---

#### `security.py` — Password Hashing

```python
# app/models/security.py
import bcrypt

def hash_password(plain_password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)  # cost factor ≥ 12
    hashed = bcrypt.hashpw(plain_password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode('utf-8'),
        hashed_password.encode('utf-8'),
    )
```

---

#### `database.py` — DB Connection & Dependency

```python
# app/db/database.py
from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase

_client: AsyncMongoClient = None
_db: AsyncDatabase = None

async def connect_to_db(mongo_uri: str, db_name: str):
    global _client, _db
    _client = AsyncMongoClient(mongo_uri)
    _db = _client[db_name]

async def get_db() -> AsyncDatabase:
    """FastAPI Dependency — מחזיר את ה-database המחובר"""
    return _db

async def create_indexes():
    await _db.users.create_index("email", unique=True)

async def close_db():
    if _client:
        await _client.aclose()
```

---

## Data Models

### מסמך MongoDB — `users` collection

```json
{
  "_id": "ObjectId('...')",
  "display_name": "ישראל ישראלי",
  "email": "israel@example.com",
  "hashed_password": "$2b$12$...",
  "created_at": "2024-01-15T10:30:00.000Z"
}
```

**אינדקסים:**

```javascript
// unique index — מניעת כפילות גם ב-concurrent requests
db.users.createIndex({ "email": 1 }, { unique: true })
```

**חוזה API:**

| שדה | קלט (`RegisterRequest`) | פלט (`RegisterResponse`) |
|-----|--------------------------|--------------------------|
| `display_name` | ✅ (required) | ❌ |
| `email` | ✅ (required) | ❌ |
| `password` | ✅ (required) | ❌ — לעולם לא מוחזר |
| `hashed_password` | ❌ | ❌ — לעולם לא מוחזר |
| `user_id` | ❌ | ✅ |

---

## Flow Diagram

```mermaid
sequenceDiagram
    participant U as משתמש
    participant RF as RegisterForm.jsx
    participant V as validation.js
    participant AS as authService.js
    participant API as FastAPI /register
    participant SVC as auth_service.py
    participant REPO as user_repository.py
    participant SEC as security.py
    participant DB as MongoDB

    U->>RF: מילוי טופס + לחיצת "הרשמה"
    RF->>V: validateForm(formData)
    alt ולידציה נכשלה
        V-->>RF: errors object
        RF-->>U: הצגת שגיאות ליד שדות
    else ולידציה עברה
        V-->>RF: {} (ריק)
        RF->>AS: registerUser(payload)
        AS->>API: POST /api/auth/register (JSON)
        API->>API: Pydantic normalize (mode='before')
        API->>API: Pydantic validate → HTTP 422 on fail
        API->>SVC: register(payload)
        SVC->>REPO: find_by_email(email)
        REPO->>DB: find_one({ email })
        DB-->>REPO: null / document
        alt אימייל קיים
            SVC-->>API: HTTP 409
            API-->>AS: 409 Response
            AS-->>RF: error 409
            RF-->>U: "כתובת האימייל כבר קיימת במערכת"
        else אימייל חדש
            SVC->>SEC: hash_password(password)
            SEC-->>SVC: hashed_password
            SVC->>REPO: create_user(display_name, email, hashed)
            REPO->>DB: insert_one(doc)
            alt כשל כפילות (race condition)
                DB-->>REPO: DuplicateKeyError
                REPO-->>SVC: raise DuplicateKeyError
                SVC-->>API: HTTP 409
            else שמירה הצליחה
                DB-->>REPO: inserted_id
                REPO-->>SVC: user_id
                SVC-->>API: HTTP 201 { user_id }
                API-->>AS: 201 Response
                AS-->>RF: success
                RF-->>U: "ההרשמה הושלמה בהצלחה!"
            end
        end
    end
```

---

## Docker Compose

```yaml
# docker-compose.yml
version: '3.9'

services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://localhost:8000
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - MONGO_URI=mongodb://${MONGO_ROOT_USER}:${MONGO_ROOT_PASSWORD}@mongo:27017/${MONGO_DB_NAME}?authSource=admin
      - MONGO_DB_NAME=${MONGO_DB_NAME}
      - SECRET_KEY=${SECRET_KEY}
      - BCRYPT_ROUNDS=${BCRYPT_ROUNDS:-12}
      - CORS_ORIGINS=${CORS_ORIGINS}
      - ENV=${ENV:-development}
    depends_on:
      - mongo

  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    environment:
      - MONGO_INITDB_ROOT_USERNAME=${MONGO_ROOT_USER}
      - MONGO_INITDB_ROOT_PASSWORD=${MONGO_ROOT_PASSWORD}
      - MONGO_INITDB_DATABASE=${MONGO_DB_NAME}

volumes:
  mongo_data:
```

> **שים לב:** `authSource=admin` נדרש כאשר MongoDB מוגדר עם root credentials.

---

## משתני סביבה

### `.env.example`

```dotenv
# MongoDB — use placeholder values locally and replace them before deployment
MONGO_URI=mongodb://focusmind_user:CHANGE_ME_IN_PRODUCTION@localhost:27017/focusmind_db?authSource=admin
MONGO_DB_NAME=focusmind_db
MONGO_ROOT_USER=focusmind_user
MONGO_ROOT_PASSWORD=CHANGE_ME_IN_PRODUCTION

# FastAPI
SECRET_KEY=your-secret-key-here
CORS_ORIGINS=["http://localhost:3000"]
BCRYPT_ROUNDS=12
ENV=development

# Frontend
VITE_API_URL=http://localhost:8000
```

`docker-compose.yml` builds the backend's `MONGO_URI` with the internal hostname `mongo`; the local URI above is for running the backend outside Docker.

### `.gitignore`

```
.env
*.pyc
__pycache__/
node_modules/
dist/
```

> **אזהרה:** לעולם אל תוסיף `.env` ל-git. `.env.example` עם ערכי placeholder בלבד ייכלל בריפוזיטורי.

---

## אסטרטגיית ולידציה

הולידציה מתבצעת בשתי שכבות עצמאיות — Defense in Depth:

| כלל ולידציה | Frontend (validation.js) | Backend (Pydantic v2) |
|-------------|--------------------------|----------------------|
| Display_Name חובה | ✅ (trim + empty check) | ✅ (field_validator) |
| Display_Name ≤ 50 תווים | ✅ (לאחר trim) | ✅ (לאחר trim ב-mode='before') |
| Email חובה | ✅ | ✅ |
| פורמט Email תקין | ✅ (regex בסיסי) | ✅ (regex RFC 5322) |
| Password חובה | ✅ | ✅ |
| Password ≥ 8 תווים | ✅ | ✅ |
| אישור סיסמה תואם | ✅ (בלבד ב-Frontend) | ❌ (לא נשלח ל-Backend) |
| נרמול Email | ❌ | ✅ (mode='before') |
| ייחודיות Email | ❌ | ✅ (MongoDB unique index) |

**עקרון:** הולידציה ב-Frontend היא לחוויית משתמש בלבד. ה-Backend מוגן תמיד ב-Pydantic ובשכבת ה-Repository — גם אם הבקשה מגיעה ישירות לא דרך ה-Frontend.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Email Normalization Round-Trip

*For any* email string containing uppercase letters or surrounding whitespace, normalizing the email (strip + lowercase) then storing it shall produce an email that matches the normalized version when retrieved from the database.

**Validates: Requirements 3.1**

---

### Property 2: Password Never Exposed in Response

*For any* registration request (valid or invalid), the HTTP response body SHALL never contain the fields `password` or `hashed_password`.

**Validates: Requirements 3.5, 5.2**

---

### Property 3: Plaintext Password Never Stored

*For any* valid registration, the value stored in the `hashed_password` field in MongoDB SHALL never equal the original plaintext password string.

**Validates: Requirements 5.1**

---

### Property 4: Invalid Display Name Rejected

*For any* display_name string that is empty, composed entirely of whitespace, or longer than 50 characters after trim, the Input_Validator SHALL return HTTP 422.

**Validates: Requirements 2.1, 2.2, 4.1, 4.2**

---

### Property 5: Invalid Email Format Rejected

*For any* email string that does not match a valid email format, both the Frontend validator and the Backend Input_Validator SHALL reject the input — the Frontend displaying an inline error, the Backend returning HTTP 422.

**Validates: Requirements 2.4, 4.4**

---

## Error Handling

### טבלת שגיאות ותגובות

| תרחיש | HTTP Status | גוף התגובה | הצגה ב-Frontend |
|--------|------------|------------|-----------------|
| רישום תקין | 201 | `{ "user_id": "..." }` | "ההרשמה הושלמה בהצלחה!" |
| אימייל כפול | 409 | `{ "detail": "כתובת האימייל כבר קיימת במערכת" }` | שגיאה ליד שדה האימייל |
| ולידציה נכשלה | 422 | `{ "detail": [...] }` (שגיאות Pydantic) | שגיאות ליד שדות רלוונטיים |
| כשל DB (לא כפילות) | 500 | `{ "detail": "אירעה שגיאה בשרת, נסה שוב מאוחר יותר" }` | הודעה גנרית — ללא פרטים |
| שגיאת רשת | — | — | "שגיאת חיבור, נסה שוב מאוחר יותר" |

### עקרונות טיפול בשגיאות

1. **אי-חשיפת מידע פנימי:** תגובות HTTP 500 מכילות הודעה גנרית בלבד. Stack traces, שמות קבצים ופרטי מסד נתונים לא נחשפים ללקוח.
2. **שגיאות Pydantic:** FastAPI ממיר אוטומטית `ValidationError` ל-HTTP 422. ניתן להוסיף `exception_handler` מותאם אם נדרשות הודעות בעברית.
3. **Race Condition:** `DuplicateKeyError` של PyMongo נתפס ב-`auth_service.py` ומומר ל-HTTP 409 — מבטיח שבקשות מקבילות לא יצרו שני משתמשים.
4. **Frontend Error Mapping:** `authService.js` מפנה לפי `response.status` — 409 מוצג ליד שדה האימייל, 500 מוצג כהודעה גנרית, שגיאת `fetch` (network error) מוצגת כשגיאת חיבור.

---

## Testing Strategy

### גישת הבדיקות הכוללת

הבדיקות מחולקות לשלוש שכבות משלימות:

- **Unit tests (Backend):** ולידציה, לוגיקת service, טיפול בשגיאות — באמצעות mocks על ה-repository
- **Integration tests (Backend):** תהליך רישום מלא מקצה לקצה מול test database בודד
- **Frontend tests:** ולידציה ב-validation.js וקומפוננטת RegisterForm — באמצעות Vitest + React Testing Library

---

### ניהול Lifespan נכון בבדיקות — `asgi-lifespan`

**הבעיה:** `httpx.ASGITransport` **לא** מפעיל אוטומטית את ASGI lifespan events של FastAPI (startup/shutdown). כלומר, `create_indexes()` ו-`connect_to_db()` לא יירוצו בבדיקות — מה שיגרום לשגיאות connection.

**הפתרון:** שימוש ב-`LifespanManager` מהחבילה `asgi-lifespan`, שמפעיל את ה-lifespan events במפורש:

```python
# tests/conftest.py
import pytest
import pytest_asyncio
import asyncio
import httpx
from asgi_lifespan import LifespanManager
from pymongo import AsyncMongoClient
from app.main import app

@pytest_asyncio.fixture(scope="session")
async def app_with_lifespan():
    """
    מפעיל את FastAPI lifespan (startup/shutdown) במפורש.
    httpx.ASGITransport לא מפעיל lifespan אוטומטית — LifespanManager נדרש.
    scope="session" כדי לא להפעיל DB startup בכל test.
    """
    async with LifespanManager(app) as manager:
        yield manager.app

@pytest_asyncio.fixture
async def client(app_with_lifespan):
    """AsyncClient עם ASGITransport — משתמש ב-app לאחר הפעלת lifespan"""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app_with_lifespan),
        base_url="http://test"
    ) as c:
        yield c
```

> הוספת `asgi-lifespan` ל-`requirements.txt` (dev dependencies) נדרשת. `LifespanManager` מבטיח שה-startup events (כולל `create_indexes()`) יירוצו לפני כל בדיקה.

---

### Dependency Injection לבידוד Test Database

**הבעיה:** גם עם `LifespanManager`, ה-FastAPI app מתחבר ל-MongoDB לפי `MONGO_DB_NAME` מ-.env — כלומר ל-production/dev database, לא ל-`focusmind_test`. כל קריאות ה-repository בבדיקות ישתמשו בדאטאבייס הלא נכון.

**הפתרון — אסטרטגיית Dependency Override:**

FastAPI מאפשר `app.dependency_overrides` — מנגנון מובנה להחלפת dependencies בזמן בדיקות.

**שלב 1 — הגדרת Dependency ב-`app/db/database.py`** (מוצג בסעיף Components לעיל).

**שלב 2 — שימוש ב-Dependency ב-`user_repository.py`** (מוצג בסעיף Components לעיל).

**שלב 3 — Override ב-`conftest.py`:**

```python
# tests/conftest.py
import pytest
import pytest_asyncio
import asyncio
import httpx
from asgi_lifespan import LifespanManager
from pymongo import AsyncMongoClient
from app.main import app
from app.db.database import get_db
from app.core.config import settings

# ─── שם ה-test database ────────────────────────────────────────────────────────
TEST_DB_NAME = "focusmind_test"
# הגנה מפני דריסה של ה-production/dev database בטעות
assert TEST_DB_NAME != settings.mongo_db_name, (
    f"TEST_DB_NAME '{TEST_DB_NAME}' must not equal MONGO_DB_NAME "
    f"'{settings.mongo_db_name}'. "
    "Set a different MONGO_DB_NAME in .env to prevent accidental data loss."
)

# ─── Test DB connection ────────────────────────────────────────────────────────
@pytest_asyncio.fixture(scope="session")
async def test_db_client():
    """חיבור MongoDB session-scoped לבדיקות בלבד"""
    client = AsyncMongoClient(settings.mongo_uri)
    yield client
    await client.aclose()

@pytest_asyncio.fixture(scope="function")
async def test_db(test_db_client):
    """
    מחזיר instance של test database מנוקה.
    scope="function" = ניקוי לפני ואחרי כל test.
    """
    db = test_db_client[TEST_DB_NAME]
    await db.users.drop()
    await db.users.create_index("email", unique=True)
    yield db
    await db.users.drop()

# ─── Dependency Override ────────────────────────────────────────────────────────
@pytest_asyncio.fixture
async def client(test_db):
    """
    FastAPI client עם override של get_db → test database.
    כל קריאות ה-repository בבדיקות ישתמשו ב-focusmind_test.
    """
    async def get_test_db():
        return test_db

    app.dependency_overrides[get_db] = get_test_db

    async with LifespanManager(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://test"
        ) as c:
            yield c

    # ניקוי ה-override אחרי הבדיקה
    app.dependency_overrides.clear()

@pytest.fixture
def valid_payload():
    return {
        "display_name": "משתמש בדיקה",
        "email": "test@example.com",
        "password": "password123"
    }
```

**הסברים לעיצוב:**

1. **למה assert?** — ה-assertion ב-module level נועדה לתפוס תצורה שגויה לפני כל הרצת בדיקות. אם מישהו בטעות מגדיר את `MONGO_DB_NAME=focusmind_test` ב-.env, הבדיקות ייכשלו בבהירות לפני שיגרמו נזק.
2. **למה dependency override?** — מנגנון `app.dependency_overrides` של FastAPI מאפשר להחליף כל dependency מבלי לשנות את קוד האפליקציה. זה מבטיח שכל קריאות ה-repository בבדיקות — כולל אלה שמגיעות דרך ה-API — ישתמשו ב-`focusmind_test`.
3. **ניקוי ה-override** — `app.dependency_overrides.clear()` חייב להיקרא אחרי כל test כדי שלא להשפיע על בדיקות אחרות.

---

### טבלת בדיקות T1–T12

| ID | תיאור | סוג | אסטרטגיית DB |
|----|--------|-----|--------------|
| T1 | רישום תקין — HTTP 201 + user_id | Integration | dependency override → focusmind_test |
| T2 | רישום עם אימייל קיים — HTTP 409 | Integration | dependency override → focusmind_test |
| T3 | שדות חסרים — HTTP 422 | Unit | dependency override (אין פניה ל-DB) |
| T4 | תגובת 201 לא מכילה password/hashed_password | Integration | dependency override → focusmind_test |
| T5 | אימייל uppercase נשמר כ-lowercase | Integration | dependency override → focusmind_test |
| T6 | display_name מרווחים בלבד — HTTP 422 | Unit | dependency override (אין פניה ל-DB) |
| T7 | display_name ריק לחלוטין — HTTP 422 | Unit | dependency override (אין פניה ל-DB) |
| T8 | כשל DB שאינו כפילות — HTTP 500 גנרי | Unit | monkeypatch על repository |
| T9 | סיסמה מגובבת ב-DB (לא plaintext) | Integration | dependency override → focusmind_test |
| T10 | אימייל עם רווחים מסביב מנורמל לפני ולידציה | Unit | dependency override (Pydantic בלבד) |
| T11 | concurrency — רק אחת מבקשות מקבילות מצליחה | Integration | dependency override → focusmind_test (unique index אמיתי) |
| T12 | תגובת 500 לא חושפת פרטי שגיאה פנימיים | Unit | monkeypatch על repository |

---

### הגדרות נוספות לסביבת הבדיקות

**`requirements.txt` (backend dev dependencies):**

```
pytest==8.3.4
pytest-asyncio==0.24.0
httpx==0.28.0
asgi-lifespan==2.1.0
pymongo==4.13.2
```

**`pytest.ini` / `pyproject.toml`:**

```ini
[pytest]
asyncio_mode = auto
```

**הרצת הבדיקות:**

```bash
# הרצה מלאה
pytest tests/ -v

# הרצה ספציפית
pytest tests/test_auth.py::test_successful_registration -v
```
