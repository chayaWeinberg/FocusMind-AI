# פריסה ל-Google Cloud – FocusMind AI

המדריך מסביר איך מעלים את FocusMind AI לאינטרנט עם Google Cloud Run.

> **מצב נוכחי:**
> - ההכנה המקומית **הושלמה ונבדקה**.
> - הפריסה לענן **עוד לא בוצעה**:
>   - לא נוצרו משאבים ב-Google Cloud;
>   - לא הופעל חיוב;
>   - לא נעשה שום שינוי בחשבון.
>
> כל הפקודות בחלק ב' מיועדות להרצה **בעתיד**, על ידי בעלת החשבון.

---

## חלק א' – מה כבר הושלם ונבדק מקומית

| נושא | מצב | איך נבדק |
|---|---|---|
| אימג' Docker אחד ללינוקס: גם האתר (React) וגם ה-API (FastAPI) | ✅ | `docker build` הצליח, והקונטיינר רץ במצב healthy |
| פורט מהמשתנה `PORT` (ברירת מחדל 8080) | ✅ | כך Cloud Run מעביר את הפורט |
| בדיקת תקינות `GET /api/health`, כולל בדיקה מול מסד הנתונים | ✅ | `{"status":"ok","database":true}` |
| משתמש לא-root (uid 10001) | ✅ | נבדק בקונטיינר |
| כל ההגדרות ממשתני סביבה. אין קובץ `.env` באימג' | ✅ | `.dockerignore` |
| אין תלות ב-Windows או בתיקייה מקומית | ✅ | הסרטונים נשמרים ב-`/data/videos`, שאפשר לחבר אליה volume |
| הקטלוג (13 קורסים) ו-16 סרטוני ההדגמה מותקנים אוטומטית בהפעלה ראשונה | ✅ | מסד ריק התמלא; הפעלה חוזרת לא שכפלה כלום |
| אבטחה בסיסית | ✅ | פרטים בהמשך |
| נתונים נשמרים אחרי הפעלה מחדש | ✅ | אחרי restart: התחברות, מיקום הצפייה, הקורסים והסרטונים עדיין שם |
| בדיקת דפדפן מלאה מול גרסת הייצור | ✅ | 6/6 ב-`frontend/e2e-production/journey.e2e.js` (Edge) |
| סקריפט בדיקה אחרי פריסה | ✅ | `scripts/verify-deployment.sh`: ‏12/12 מול החזרה המקומית |

פרטי האבטחה שנבדקו:
- עוגיית `Secure` בייצור;
- `/docs` כבוי;
- הגבלת קצב בהתחברות ובהרשמה;
- חסימה של path traversal.

**החזרה המקומית (rehearsal):**
- היא הריצה את אותו אימג' עם `docker-compose.prod.yml`.
- היא רצה בפרויקט Docker נפרד (`focusmind-rehearsal`), עם מסד ונפחים משלה.
- נתוני הפיתוח האמיתיים לא נגעו בה.

---

## חלק ב' – שלבים בענן (טרם בוצעו)

### הארכיטקטורה המתוכננת
```
דפדפן ──HTTPS──▶ Cloud Run (שירות focusmind, האימג' מ-Artifact Registry)
                    ├── MongoDB Atlas (mongodb+srv, ‏TLS)
                    ├── Cloud Storage bucket, מחובר כ-volume ל-/data/videos
                    └── Secret Manager: SECRET_KEY, MONGO_URI
```
- הכול בכתובת אחת. אין צורך ב-CORS.
- Cloud Run מספק HTTPS ותעודה בעצמו.

### 0. מה צריך לפני שמתחילים
- חשבון Google Cloud ופרויקט עם חיוב פעיל. בעלת החשבון מפעילה אותו בעצמה.
- [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) מותקן, והתחברות עם `gcloud auth login`.
- חשבון ב-[MongoDB Atlas](https://www.mongodb.com/atlas).

בכל הפקודות מחליפים את `PROJECT_ID`.
אזור מומלץ: `me-west1` (תל אביב), או `europe-west1`.

```sh
gcloud config set project PROJECT_ID
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
    cloudbuild.googleapis.com secretmanager.googleapis.com storage.googleapis.com
```

### 1. מסד נתונים: MongoDB Atlas
1. יוצרים Cluster, למשל M0 החינמי.
   - ספק: Google Cloud.
   - אזור: הקרוב ביותר לאזור של Cloud Run.
2. **Database Access:** יוצרים משתמש עם סיסמה חזקה והרשאת readWrite רק למסד `focusmind`.
3. **Network Access:** ל-Cloud Run אין כתובת IP קבועה. יש שתי אפשרויות:
   - **פשוטה:** מאשרים `0.0.0.0/0`. המסד עדיין מוגן בסיסמה וב-TLS, אבל פתוח לניסיונות התחברות מכל מקום.
   - **מומלצת לייצור:**
     - מגדירים ל-Cloud Run יציאה דרך VPC עם Cloud NAT וכתובת IP סטטית.
     - מאשרים ב-Atlas רק את הכתובת הזאת.
4. מעתיקים את מחרוזת החיבור, שנראית כך:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`

### 2. סודות: Secret Manager
```sh
python -c "import secrets; print(secrets.token_urlsafe(48), end='')" | \
  gcloud secrets create focusmind-secret-key --data-file=-
printf '%s' 'mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority' | \
  gcloud secrets create focusmind-mongo-uri --data-file=-
```
- לא שומרים את הסודות בקבצים בפרויקט.
- לא מכניסים אותם ל-Git.

### 3. אחסון הסרטונים: Cloud Storage
```sh
gcloud storage buckets create gs://PROJECT_ID-focusmind-videos \
    --location=me-west1 --uniform-bucket-level-access --public-access-prevention
```
- ה-bucket **פרטי**.
- הסרטונים מוגשים רק דרך האפליקציה, שבודקת הרשאות.

### 4. בניית האימג' ושמירתו ב-Artifact Registry
```sh
gcloud artifacts repositories create focusmind --repository-format=docker --location=me-west1
gcloud builds submit --tag me-west1-docker.pkg.dev/PROJECT_ID/focusmind/focusmind-ai:v1 .
```
- הבנייה רצה ב-Cloud Build, על לינוקס.
- `.gcloudignore` מונע העלאה של סודות, תעודות ו-node_modules.

אפשרות אחרת, בנייה מקומית:
```sh
docker build -t me-west1-docker.pkg.dev/PROJECT_ID/focusmind/focusmind-ai:v1 .
docker push me-west1-docker.pkg.dev/PROJECT_ID/focusmind/focusmind-ai:v1
```
לפני `docker push` צריך להריץ `gcloud auth configure-docker me-west1-docker.pkg.dev`.

### 5. חשבון שירות והרשאות
```sh
gcloud iam service-accounts create focusmind-run
SA=focusmind-run@PROJECT_ID.iam.gserviceaccount.com
gcloud secrets add-iam-policy-binding focusmind-secret-key --member=serviceAccount:$SA --role=roles/secretmanager.secretAccessor
gcloud secrets add-iam-policy-binding focusmind-mongo-uri  --member=serviceAccount:$SA --role=roles/secretmanager.secretAccessor
gcloud storage buckets add-iam-policy-binding gs://PROJECT_ID-focusmind-videos --member=serviceAccount:$SA --role=roles/storage.objectAdmin
```

### 6. פריסה ל-Cloud Run
```sh
gcloud run deploy focusmind \
  --image=me-west1-docker.pkg.dev/PROJECT_ID/focusmind/focusmind-ai:v1 \
  --region=me-west1 --service-account=$SA --allow-unauthenticated \
  --port=8080 --memory=1Gi --cpu=1 --timeout=3600 \
  --min-instances=0 --max-instances=3 \
  --execution-environment=gen2 \
  --set-secrets=SECRET_KEY=focusmind-secret-key:latest,MONGO_URI=focusmind-mongo-uri:latest \
  --set-env-vars=MONGO_DB_NAME=focusmind,ENV=production,SEED_CATALOG=true,MAX_VIDEO_UPLOAD_BYTES=31457280,USER_VIDEO_QUOTA_BYTES=1073741824,ACCESS_TOKEN_TTL_MINUTES=120 \
  --add-volume=name=videos,type=cloud-storage,bucket=PROJECT_ID-focusmind-videos,mount-options="uid=10001;gid=10001" \
  --add-volume-mount=volume=videos,mount-path=/data/videos \
  --startup-probe=httpGet.path=/api/health,initialDelaySeconds=5,periodSeconds=10,failureThreshold=12
```

הסבר על ההגדרות:
- **`--allow-unauthenticated`:** האתר ציבורי. ההרשאות נבדקות בתוך האפליקציה.
- **`mount-options` עם uid ו-gid 10001:** האפליקציה רצה כמשתמש 10001, ולכן היא צריכה הרשאת כתיבה לתיקייה המחוברת.
  - אם הפריסה נכשלת על האפשרות הזאת, בודקים בתיעוד העדכני של Cloud Run את התחביר של אפשרויות mount ל-Cloud Storage.
- **מגבלת העלאה 30MB:**
  - Cloud Run מגביל גוף בקשה ל-32MiB.
  - קבצים גדולים יותר ייכשלו.
  - כדי לתמוך בהם, צריך להעלות ישירות ל-bucket עם signed URL. זה עוד לא ממומש.
- **`--timeout=3600`:** מאפשר להזרים סרטון ארוך בבקשה אחת.
- **`--max-instances=3`:** הגבלת הקצב בהתחברות נספרת בכל instance בנפרד. מספר קטן של instances שומר על ההגנה אפקטיבית.
- **`--min-instances=0`:** הכי זול, אבל הבקשה הראשונה אחרי זמן ללא שימוש איטית (cold start). להדגמה חיה אפשר לקבוע 1, וזה עולה כסף.
- **בהפעלה הראשונה:**
  - האפליקציה יוצרת אינדקסים, את הקטלוג ואת סרטוני ההדגמה. סרטוני ההדגמה מועתקים ל-bucket, בערך 13MB.
  - הפעולה הזאת idempotent: בהפעלה חוזרת שום דבר לא משוכפל.

### 7. בדיקה אחרי הפריסה
```sh
URL=$(gcloud run services describe focusmind --region=me-west1 --format='value(status.url)')
sh scripts/verify-deployment.sh "$URL"             # בדיקות קריאה בלבד
sh scripts/verify-deployment.sh "$URL" --journey   # גם הרשמה של משתמש בדיקה זמני
```

ואחר כך בדפדפן:
1. נרשמים.
2. נרשמים לקורס "יסודות SQL".
3. מנגנים סרטון הדגמה ובודקים שהמיקום נשמר.
4. מפעילים מצלמה. ב-HTTPS הדפדפן יבקש אישור.
5. מעלים סרטון קטן לקורס אישי.

נותנים הרשאת מנהל תוכן:
```sh
gcloud run jobs create focusmind-admin --image=me-west1-docker.pkg.dev/PROJECT_ID/focusmind/focusmind-ai:v1 \
  --region=me-west1 --service-account=$SA \
  --set-secrets=SECRET_KEY=focusmind-secret-key:latest,MONGO_URI=focusmind-mongo-uri:latest \
  --set-env-vars=MONGO_DB_NAME=focusmind,SEED_CATALOG=false \
  --command=python --args=-m,app.admin,grant,EDITOR_EMAIL
gcloud run jobs execute focusmind-admin --region=me-west1 --wait
```

### 8. עדכון גרסה
```sh
gcloud builds submit --tag me-west1-docker.pkg.dev/PROJECT_ID/focusmind/focusmind-ai:v2 .
gcloud run deploy focusmind --region=me-west1 --image=me-west1-docker.pkg.dev/PROJECT_ID/focusmind/focusmind-ai:v2
```
- שאר ההגדרות (סודות, volume, משתנים) נשמרות מהגרסה הקודמת.
- לכל גרסה מומלץ להשתמש בתגית חדשה, ולא ב-`latest`.

### 9. חזרה לגרסה קודמת (rollback) ושחזור
**מעבר מיידי לגרסה הקודמת:**
```sh
gcloud run revisions list --service=focusmind --region=me-west1
gcloud run services update-traffic focusmind --region=me-west1 --to-revisions=REVISION_NAME=100
```
- הקוד חוזר לגרסה הקודמת.
- המסד והסרטונים לא משתנים.
- ההגדרה הזאת לא משנה את מבנה הנתונים, ולכן החזרה בטוחה.

**גיבויים:**
- **Atlas:**
  - ב-M10 ומעלה יש גיבוי רציף.
  - ב-M0 עושים גיבוי ידני עם `mongodump --uri "<MONGO_URI>"`.
- **Cloud Storage:** כדי להגן מפני מחיקה בטעות, מפעילים Object Versioning:
  `gcloud storage buckets update gs://PROJECT_ID-focusmind-videos --versioning`

**סוד שדלף:**
1. יוצרים גרסה חדשה של הסוד:
   `gcloud secrets versions add focusmind-secret-key --data-file=-`
2. פורסים מחדש.
3. כל המשתמשים יצטרכו להתחבר מחדש.

### 10. פתרון תקלות
| תסמין | בדיקה |
|---|---|
| הפריסה נכשלת: "container failed to start" | `gcloud run services logs read focusmind --region=me-west1`. בדרך כלל `MONGO_URI` שגוי, או ש-Atlas חוסם את הכתובת (Network Access) |
| `/api/health` מחזיר `database:false` | ב-Atlas: הכתובת מאושרת? המשתמש והסיסמה נכונים? בסיסמה עם תווים מיוחדים צריך URL-encoding |
| העלאת סרטון נכשלת ב-413 | הקובץ גדול מ-30MB. זו המגבלה של Cloud Run |
| העלאה נכשלת ב-500 או permission denied | חסרים `mount-options` עם uid ו-gid 10001, או שלחשבון השירות אין `storage.objectAdmin` |
| מתנתקים מיד אחרי התחברות | ודאו שגולשים ב-https. העוגייה מוגדרת `Secure` |
| המצלמה לא נפתחת | מצלמה עובדת רק ב-HTTPS. בכתובת של Cloud Run זה תקין |

### 11. עלויות (הערכה בלבד)
- ל-Cloud Run, Cloud Storage ו-Secret Manager יש מכסה חינמית חודשית. בשימוש של הדגמה העלות צפויה להיות נמוכה מאוד.
- Atlas M0 חינמי.
- `--min-instances=1` ו-Cloud NAT עולים כסף.
- כדאי להגדיר התראת תקציב (Budget alert) בחשבון.
