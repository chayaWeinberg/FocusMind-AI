# פריסה ל-Google Cloud – FocusMind AI (מטלה 4)

המדריך מסביר איך מעלים את FocusMind AI לענן:
- **שני קונטיינרים** ב-Cloud Run: לקוח (פורט 3000) ושרת (פורט 8000).
- **Load Balancer** של Google לפניהם, עם **דומיין משלנו** ותעודת **HTTPS** מנוהלת.
- **MongoDB Atlas** כמסד נתונים, **Secret Manager** לסודות, ו-**Cloud Storage** לסרטונים.

> **מצב נוכחי:** ההכנה המקומית מוכנה. הפריסה לענן עוד לא בוצעה.

---

## הארכיטקטורה

```
Browser ──▶ https://YOUR-DOMAIN
              │
        Load Balancer (HTTPS 443, תעודה מנוהלת, IP סטטי)
              │  URL map
              ├── /api/*  ו-/health ──▶ Cloud Run: focusmind-server (8000) ──▶ MongoDB Atlas
              │                                     │                     └─▶ Cloud Storage (סרטונים)
              │                                     └─ סודות מ-Secret Manager
              └── כל השאר ───────────▶ Cloud Run: focusmind-client (3000, nginx)
```

- **כתובת אחת לכל המערכת.** הלקוח פונה ל-`/api` באותו דומיין, ולכן אין צורך ב-CORS.
- **העוגייה של ההתחברות** היא first-party, `Secure` ו-`HttpOnly`.

### למה כך? (שאלות ההגנה)
| החלטה | נימוק |
|---|---|
| **Cloud Run ולא VM** | Google מנהלת את המכונות ואת העדכונים. הוא מוסיף מופעים לפי העומס, ובלי בקשות הוא לא עולה כסף. אין צורך ב-Instance group, ב-Health check או בחוק Firewall. |
| **קונטיינר נפרד ללקוח ולשרת** | כל אחד גדל לפי העומס שלו. תקלה בשרת לא מפילה את הדף. את הלקוח מגיש nginx, שקל ומהיר בהרבה מ-Python. |
| **MongoDB Atlas** | הקוד כבר עובד עם MongoDB. השכבה M0 חינמית ומנוהלת, כולל גיבוי ועדכונים. מסד נתונים אסור להריץ ב-Cloud Run, כי מערכת הקבצים שם נמחקת. |
| **כמה מופעים** | `max-instances=3` לכל שירות. השרת stateless: הטוקנים המבוטלים, ההתקדמות וההיסטוריה נשמרים במסד, והסרטונים ב-Cloud Storage. לכן כל מופע רואה את אותם נתונים. |
| **מה נשאר בזיכרון** | רק מונה ההגבלה על ניסיונות התחברות שנכשלו. הוא נספר בכל מופע בנפרד. זה מקובל, כי המטרה היא רק להאט ניסיונות ניחוש. |
| **סודות** | `SECRET_KEY` ו-`MONGO_URI` נמצאים רק ב-Secret Manager, ו-Cloud Run מזריק אותם כמשתני סביבה. הם לא נמצאים בקוד, בתמונה או ב-Git. |
| **נתיבים** | כל נתיבי השרת כבר מתחילים ב-`/api`. נוספה גם הנקודה `/health`, וה-URL map שולח את שתיהן לשרת. |

---

## חלק א' – הרצה מקומית שמדמה את הענן

`docker-compose.prod.yml` מריץ את **אותן שתי תמונות** שעולות לענן, יחד עם MongoDB.
nginx קטן משחק את התפקיד של ה-Load Balancer, עם אותם חוקי נתיבים ([deploy/local-load-balancer.conf](../deploy/local-load-balancer.conf)).

```sh
cp .env.production.example .env.production   # ממלאים ערכים
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
sh scripts/verify-deployment.sh http://localhost:8080 --journey
```

הקבצים:
| קובץ | תפקיד |
|---|---|
| `backend/Dockerfile` | שרת FastAPI על פורט 8000. רץ כמשתמש שאינו root, וכולל את סרטוני ההדגמה. |
| `frontend/Dockerfile` | בונה את React עם `npm run build` ומגיש עם nginx על פורט 3000. כל נתיב לא מוכר מחזיר `index.html`. |
| `frontend/Dockerfile.dev` | שרת הפיתוח של Vite, משמש את `docker-compose.yml` בפיתוח. |
| `frontend/nginx/` | הגדרות nginx: cache, gzip, CSP וכותרות אבטחה. |

---

## חלק ב' – הפריסה לענן

### הדרך הקצרה: סקריפט אחד
[deploy/deploy-gcp.sh](../deploy/deploy-gcp.sh) מריץ את כל השלבים 1–7 שבהמשך לפי הסדר.

**לפני ההרצה צריך:**
- פרויקט שמחובר ל-**Free Trial פעיל**. הסקריפט בודק את זה, ועוצר אם החיוב לא מופעל.
- `gcloud auth login`.
- MongoDB Atlas מוכן (שלב 1).

```sh
bash deploy/deploy-gcp.sh PROJECT_ID YOUR-DOMAIN
```

- **מחרוזת החיבור ל-Atlas:** הסקריפט מבקש אותה פעם אחת, בשדה מוסתר, ושומר אותה ישר ב-Secret Manager. היא לא נשמרת בשום קובץ.
- **`SECRET_KEY`:** הסקריפט מייצר אותו אקראית.
- **הרצה חוזרת:** מותר להריץ שוב. מה שכבר קיים מדולג, ושתי התמונות נבנות ונפרסות מחדש עם תגית חדשה.
- **בסוף:** הסקריפט מדפיס את כתובת ה-IP של ה-Load Balancer. רושמים אותה ברשומת ה-A של הדומיין (שלב 8).
- **רשת שמיירטת HTTPS** (Avast, NetFree): מוסיפים `GCLOUD_CA_BUNDLE=<קובץ PEM עם תעודות השורש>` לפני הפקודה.

השלבים הבאים מסבירים מה הסקריפט עושה, ומאפשרים להריץ כל שלב ידנית.

בכל הפקודות מחליפים את `PROJECT_ID` ואת `YOUR-DOMAIN`. האזור הוא `me-west1` (תל אביב).

### 0. הכנה
- עובדים ב-**Free Trial** (קרדיט של 300$). **לא** לוחצים Upgrade.
- מגדירים **Budget עם התראות**: Billing ← Budgets & alerts.
- מתקינים את [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) ומריצים `gcloud auth login`.

```sh
gcloud config set project PROJECT_ID
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com \
    secretmanager.googleapis.com storage.googleapis.com compute.googleapis.com
REGION=me-west1
REPO=$REGION-docker.pkg.dev/PROJECT_ID/focusmind
```

### 1. מסד נתונים: MongoDB Atlas
1. יוצרים Cluster מסוג **M0**, בספק Google Cloud ובאזור קרוב.
2. ב-**Database Access** יוצרים משתמש עם סיסמה חזקה, והרשאת readWrite למסד `focusmind`.
3. ב-**Network Access**: ל-Cloud Run אין כתובת IP קבועה, ולכן מאשרים `0.0.0.0/0`. המסד עדיין מוגן בסיסמה ובהצפנת TLS.
4. מעתיקים את מחרוזת החיבור (`mongodb+srv://...`).

### 2. סודות: Secret Manager
```sh
python -c "import secrets; print(secrets.token_urlsafe(48), end='')" | \
  gcloud secrets create focusmind-secret-key --data-file=-
printf '%s' 'mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority' | \
  gcloud secrets create focusmind-mongo-uri --data-file=-
```

### 3. אחסון סרטונים: Cloud Storage
```sh
gcloud storage buckets create gs://PROJECT_ID-focusmind-videos \
    --location=$REGION --uniform-bucket-level-access --public-access-prevention
```
ה-bucket פרטי. הסרטונים מוגשים רק דרך השרת, שבודק הרשאות.

### 4. בניית שתי התמונות
```sh
gcloud artifacts repositories create focusmind --repository-format=docker --location=$REGION
gcloud builds submit backend  --tag $REPO/server:v1
gcloud builds submit frontend --tag $REPO/client:v1
```

### 5. חשבון שירות והרשאות לשרת
```sh
gcloud iam service-accounts create focusmind-run
SA=focusmind-run@PROJECT_ID.iam.gserviceaccount.com
gcloud secrets add-iam-policy-binding focusmind-secret-key --member=serviceAccount:$SA --role=roles/secretmanager.secretAccessor
gcloud secrets add-iam-policy-binding focusmind-mongo-uri  --member=serviceAccount:$SA --role=roles/secretmanager.secretAccessor
gcloud storage buckets add-iam-policy-binding gs://PROJECT_ID-focusmind-videos --member=serviceAccount:$SA --role=roles/storage.objectAdmin
```
בלי התפקיד **Secret Manager Secret Accessor** הפריסה של השרת תיכשל.

### 6. פריסה ל-Cloud Run (שני שירותים)
```sh
# השרת
gcloud run deploy focusmind-server --image=$REPO/server:v1 --region=$REGION \
  --service-account=$SA --allow-unauthenticated \
  --ingress=internal-and-cloud-load-balancing \
  --port=8000 --memory=1Gi --cpu=1 --timeout=3600 \
  --min-instances=0 --max-instances=3 --execution-environment=gen2 \
  --set-secrets=SECRET_KEY=focusmind-secret-key:latest,MONGO_URI=focusmind-mongo-uri:latest \
  --set-env-vars=MONGO_DB_NAME=focusmind,SEED_CATALOG=true,MAX_VIDEO_UPLOAD_BYTES=31457280,USER_VIDEO_QUOTA_BYTES=1073741824,ACCESS_TOKEN_TTL_MINUTES=120 \
  --add-volume=name=videos,type=cloud-storage,bucket=PROJECT_ID-focusmind-videos,mount-options="uid=10001;gid=10001" \
  --add-volume-mount=volume=videos,mount-path=/data/videos \
  --startup-probe=httpGet.path=/health,initialDelaySeconds=5,periodSeconds=10,failureThreshold=12

# הלקוח
gcloud run deploy focusmind-client --image=$REPO/client:v1 --region=$REGION \
  --allow-unauthenticated --ingress=internal-and-cloud-load-balancing \
  --port=3000 --memory=256Mi --cpu=1 --min-instances=0 --max-instances=3
```
- **`--ingress=internal-and-cloud-load-balancing`:** אפשר להגיע לשירותים רק דרך ה-Load Balancer, לא דרך כתובת `run.app` ישירה.
- **`--allow-unauthenticated`:** האתר ציבורי. ההרשאות נבדקות בתוך האפליקציה.
- **`ENV=production` ו-`CORS_ORIGINS=[]`** כבר מוגדרים בתמונה של השרת. לכן העוגייה מוגדרת `Secure`, ו-`/docs` כבוי.
- **מגבלת העלאה 30MB:** זו המגבלה של Cloud Run לגוף של בקשה.
- **בחלון הבדיקה:** אפשר לקבוע לשרת `--min-instances=1` כדי למנוע cold start. זה עולה מעט מהקרדיט.

### 7. Load Balancer
```sh
# 7.1 כתובת IP סטטית גלובלית
gcloud compute addresses create focusmind-ip --global
gcloud compute addresses describe focusmind-ip --global --format='value(address)'   # רושמים את הכתובת

# 7.2 Serverless NEG לכל שירות
gcloud compute network-endpoint-groups create focusmind-server-neg --region=$REGION \
  --network-endpoint-type=serverless --cloud-run-service=focusmind-server
gcloud compute network-endpoint-groups create focusmind-client-neg --region=$REGION \
  --network-endpoint-type=serverless --cloud-run-service=focusmind-client

# 7.3 Backend service לכל NEG (בלי Health check: Serverless NEG לא תומך בו)
for svc in server client; do
  gcloud compute backend-services create focusmind-$svc-backend --global --load-balancing-scheme=EXTERNAL_MANAGED
  gcloud compute backend-services add-backend focusmind-$svc-backend --global \
    --network-endpoint-group=focusmind-$svc-neg --network-endpoint-group-region=$REGION
done

# 7.4 URL map: ברירת המחדל ללקוח, ‏/api/* ו-/health לשרת
gcloud compute url-maps create focusmind-lb --default-service=focusmind-client-backend
gcloud compute url-maps add-path-matcher focusmind-lb --path-matcher-name=routes \
  --default-service=focusmind-client-backend \
  --path-rules="/api/*=focusmind-server-backend,/health=focusmind-server-backend" \
  --new-hosts="*"

# 7.5 תעודת SSL מנוהלת
gcloud compute ssl-certificates create focusmind-cert --domains=YOUR-DOMAIN --global

# 7.6 HTTPS proxy ו-Forwarding rule על פורט 443
gcloud compute target-https-proxies create focusmind-https-proxy --url-map=focusmind-lb --ssl-certificates=focusmind-cert
gcloud compute forwarding-rules create focusmind-https-rule --global --load-balancing-scheme=EXTERNAL_MANAGED \
  --address=focusmind-ip --target-https-proxy=focusmind-https-proxy --ports=443
```

**הפניה מ-http ל-https (מומלץ):** כך מי שמקליד את הדומיין בלי `https://` עדיין מגיע לאתר, והמצלמה עובדת.
```sh
gcloud compute url-maps import focusmind-http-redirect --global --source=/dev/stdin <<'EOF'
name: focusmind-http-redirect
defaultUrlRedirect:
  redirectResponseCode: MOVED_PERMANENTLY_DEFAULT
  httpsRedirect: true
EOF
gcloud compute target-http-proxies create focusmind-http-proxy --url-map=focusmind-http-redirect
gcloud compute forwarding-rules create focusmind-http-rule --global --load-balancing-scheme=EXTERNAL_MANAGED \
  --address=focusmind-ip --target-http-proxy=focusmind-http-proxy --ports=80
```

### 8. דומיין
1. אצל ספק הדומיין (למשל No-IP) מגדירים רשומת **A** שמצביעה **רק** על הכתובת הסטטית מסעיף 7.1.
2. בודקים את מצב התעודה:
   ```sh
   gcloud compute ssl-certificates describe focusmind-cert --global --format='value(managed.status, managed.domainStatus)'
   ```
   - הסטטוס `PROVISIONING` תקין בהתחלה. הנפקת התעודה יכולה לקחת עד 60 דקות.
   - הסטטוס `ACTIVE` אומר שהכול מוכן.
3. ב-No-IP החינמי צריך **לאשר את ה-hostname כל 30 יום**. האישור מגיע במייל.

### 9. בדיקה
```sh
sh scripts/verify-deployment.sh https://YOUR-DOMAIN             # בדיקות קריאה בלבד
sh scripts/verify-deployment.sh https://YOUR-DOMAIN --journey   # גם הרשמה של משתמש בדיקה
```
ואחר כך בדפדפן, כמו משתמש חדש: נרשמים, מתחברים, מוסיפים תוכן ומפעילים סשן עם מצלמה. אחר כך מרעננים, מתנתקים ומתחברים שוב, ובודקים שהכול נשאר.

### 10. עדכון גרסה וחזרה לגרסה קודמת
```sh
gcloud builds submit backend --tag $REPO/server:v2
gcloud run deploy focusmind-server --region=$REGION --image=$REPO/server:v2   # שאר ההגדרות נשמרות

gcloud run revisions list --service=focusmind-server --region=$REGION
gcloud run services update-traffic focusmind-server --region=$REGION --to-revisions=REVISION_NAME=100
```
עדכון של הלקוח עובד באותה צורה, עם `frontend` ו-`focusmind-client`. ה-Load Balancer לא משתנה.

**סוד שדלף:** מוסיפים גרסה חדשה עם `gcloud secrets versions add focusmind-secret-key --data-file=-` ופורסים את השרת מחדש. כל המשתמשים יצטרכו להתחבר מחדש.

**מנהל תוכן:**
```sh
gcloud run jobs create focusmind-admin --image=$REPO/server:v1 --region=$REGION --service-account=$SA \
  --set-secrets=SECRET_KEY=focusmind-secret-key:latest,MONGO_URI=focusmind-mongo-uri:latest \
  --set-env-vars=MONGO_DB_NAME=focusmind,SEED_CATALOG=false \
  --command=python --args=-m,app.admin,grant,EDITOR_EMAIL
gcloud run jobs execute focusmind-admin --region=$REGION --wait
```

### 11. פתרון תקלות
| תסמין | סיבה סבירה |
|---|---|
| התעודה תקועה ב-`PROVISIONING` או `FAILED_NOT_VISIBLE` | רשומת ה-A לא מצביעה על ה-IP של ה-Load Balancer, או שה-DNS עוד לא התעדכן |
| המצלמה לא נדלקת | האתר נפתח ב-`http://`. צריך `https://`, או את ההפניה מסעיף 7 |
| האתר נטען, אבל ההרשמה נכשלת ב-404 | חסר path rule ל-`/api/*` ב-URL map |
| ההרשמה נכשלת ב-503 | השרת לא מגיע ל-Atlas. בודקים את Network Access ואת `MONGO_URI`. סיסמה עם תווים מיוחדים צריכה URL-encoding |
| השרת לא עולה ("container failed to start") | `gcloud run services logs read focusmind-server --region=$REGION`. בדרך כלל זה סוד חסר, או שחסרה הרשאת Secret Accessor |
| העלאת סרטון נכשלת ב-413 | הקובץ גדול מ-30MB. זו המגבלה של Cloud Run |
| מתנתקים מיד אחרי התחברות | גולשים ב-http. העוגייה מוגדרת `Secure` |

### 12. עלויות
- ה-**Load Balancer** (ה-forwarding rule) עולה כסף כל שעה שהוא קיים, בערך 18$ לחודש. הסכום יורד מהקרדיט.
- **Cloud Run** עם `min-instances=0` לא עולה כסף כשאין בקשות. `min-instances=1` כן.
- **Atlas M0** חינמי. ל-**Cloud Storage** ול-**Secret Manager** יש מכסה חינמית.
- אחרי חלון הבדיקה אפשר למחוק את ה-forwarding rules ולשמור את כל השאר. זכרו שתצטרכו את האתר שוב בפרויקט הסופי.
