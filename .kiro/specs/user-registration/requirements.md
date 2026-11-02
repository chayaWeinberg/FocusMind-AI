
# Requirements Document

## Introduction

פיצ'ר רישום משתמשים ב-FocusMind AI מאפשר למשתמשים חדשים ליצור חשבון באמצעות שם תצוגה, כתובת אימייל וסיסמה. הפיצ'ר כולל ולידציה מלאה בצד ה-Frontend ובצד ה-Backend, גיבוב סיסמה (password hashing) לפני שמירה ב-MongoDB, ומניעת רישום כפול. כל הודעות הממשק מוצגות בעברית.

## Glossary

- **Registration_Form**: טופס הרישום בצד ה-Frontend (React) המכיל את שדות שם התצוגה, אימייל, סיסמה ואישור סיסמה.
- **Registration_API**: נקודת הקצה `POST /api/auth/register` ב-Backend (FastAPI) המטפלת בבקשות רישום.
- **User_Store**: שכבת הגישה ל-MongoDB האחראית על שמירה ושאילתת מסמכי משתמשים.
- **Password_Hasher**: רכיב ה-Backend האחראי על גיבוב סיסמאות (password hashing) באמצעות bcrypt.
- **Input_Validator**: רכיב ה-Backend האחראי על בדיקת תקינות הנתונים הנשלחים לנקודת הקצה.
- **Display_Name**: שם המוצג של המשתמש — מחרוזת טקסט חופשית בין 1 ל-50 תווים לאחר trim.
- **Email**: כתובת דואר אלקטרוני ייחודית לכל משתמש, נשמרת מנורמלת (lowercase + trim).
- **Password**: סיסמת המשתמש — לפחות 8 תווים.
- **Hashed_Password**: ייצוג מגובב של הסיסמה כפי שנשמר ב-MongoDB.

---

## Requirements

### דרישה 1: הצגת טופס הרישום

**User Story:** As a משתמש חדש, I want לראות טופס רישום ברור ונגיש, so that אוכל ליצור חשבון חדש ב-FocusMind AI.

#### Acceptance Criteria

1. THE Registration_Form SHALL להציג שדות קלט עבור שם תצוגה, אימייל, סיסמה ואישור סיסמה.
2. THE Registration_Form SHALL להציג את כל התוויות והטקסטים בעברית.
3. THE Registration_Form SHALL לתמוך בפריסת RTL (ימין לשמאל) עבור כל אלמנטי הטופס.
4. THE Registration_Form SHALL לכלול כפתור שליחה עם הטקסט "הרשמה".
5. THE Registration_Form SHALL לכלול קישור לדף ההתחברות העתידי עם הטקסט "יש לך חשבון? התחבר".
6. WHILE בקשת הרישום נשלחת ל-Registration_API, THE Registration_Form SHALL להציג אינדיקטור טעינה ולהשבית את כפתור השליחה.

---

### דרישה 2: ולידציה בצד ה-Frontend

**User Story:** As a משתמש, I want לקבל משוב מיידי על שגיאות בטופס, so that אוכל לתקן אותן לפני שליחה לשרת.

#### Acceptance Criteria

1. WHEN המשתמש שולח את הטופס עם Display_Name ריק לאחר trim (לרבות מחרוזת של רווחים בלבד), THE Registration_Form SHALL להציג את הודעת השגיאה "שם תצוגה הוא שדה חובה".
2. WHEN המשתמש שולח את הטופס עם Display_Name ארוך מ-50 תווים לאחר trim, THE Registration_Form SHALL להציג את הודעת השגיאה "שם תצוגה לא יכול להכיל יותר מ-50 תווים".
3. WHEN המשתמש שולח את הטופס עם שדה אימייל ריק, THE Registration_Form SHALL להציג את הודעת השגיאה "אימייל הוא שדה חובה".
4. WHEN המשתמש שולח את הטופס עם כתובת אימייל שאינה תואמת פורמט תקין, THE Registration_Form SHALL להציג את הודעת השגיאה "כתובת האימייל אינה תקינה".
5. WHEN המשתמש שולח את הטופס עם שדה סיסמה ריק, THE Registration_Form SHALL להציג את הודעת השגיאה "סיסמה היא שדה חובה".
6. WHEN המשתמש שולח את הטופס עם סיסמה קצרה מ-8 תווים, THE Registration_Form SHALL להציג את הודעת השגיאה "הסיסמה חייבת להכיל לפחות 8 תווים".
7. WHEN המשתמש שולח את הטופס עם שדה "אישור סיסמה" ריק, THE Registration_Form SHALL להציג את הודעת השגיאה "אישור סיסמה הוא שדה חובה".
8. WHEN המשתמש שולח את הטופס עם אישור סיסמה שאינו זהה לסיסמה, THE Registration_Form SHALL להציג את הודעת השגיאה "הסיסמאות אינן תואמות".
9. THE Registration_Form SHALL להציג הודעות שגיאה בסמוך לשדה הרלוונטי ולא כהודעה כללית בלבד.
10. WHEN כל שדות הטופס תקינים, THE Registration_Form SHALL לאפשר שליחת הטופס ל-Registration_API.

---

### דרישה 3: עיבוד הרישום בצד ה-Backend

**User Story:** As a משתמש, I want שבקשת הרישום שלי תעובד בצורה בטוחה ומהימנה, so that החשבון שלי ייווצר כראוי.

#### Acceptance Criteria

1. WHEN Registration_API מקבלת בקשת רישום תקינה, THE Registration_API SHALL לנרמל את כתובת האימייל (המרה ל-lowercase וביצוע trim) לפני כל פעולה נוספת.
2. WHEN Registration_API מקבלת בקשת רישום תקינה לאחר נרמול האימייל, THE Registration_API SHALL לבדוק ב-User_Store האם קיים משתמש עם אותה כתובת אימייל מנורמלת.
3. WHEN האימייל המנורמל אינו קיים ב-User_Store, THE Password_Hasher SHALL לגבב את הסיסמה באמצעות bcrypt עם cost factor של לפחות 12.
4. WHEN הגיבוב הושלם בהצלחה, THE User_Store SHALL לשמור מסמך משתמש חדש הכולל את ה-Display_Name (לאחר trim), את האימייל המנורמל, את ה-Hashed_Password ואת חותמת הזמן created_at.
5. WHEN המשתמש נשמר בהצלחה, THE Registration_API SHALL להחזיר HTTP 201 עם גוף תגובה המכיל מזהה משתמש (user_id) בלבד — ללא password וללא hashed_password.
6. IF שמירת המשתמש ב-User_Store נכשלת בשל שגיאת כפילות מפתח ב-MongoDB (duplicate key error — לרבות בקשות מקבילות שמנסות לרשום את אותו האימייל), THEN THE Registration_API SHALL להחזיר HTTP 409 עם ההודעה "כתובת האימייל כבר קיימת במערכת".
7. IF שמירת המשתמש ב-User_Store נכשלת בשל שגיאת מסד נתונים שאינה שגיאת כפילות מפתח, THEN THE Registration_API SHALL להחזיר HTTP 500 עם הודעה גנרית בעברית בלבד — ללא חשיפת פרטי השגיאה הפנימית ללקוח.

---

### דרישה 4: ולידציה בצד ה-Backend

**User Story:** As a מערכת, I want לוודא תקינות נתונים בשרת, so that לא ייווצרו רשומות פגומות במסד הנתונים.

#### Acceptance Criteria

1. WHEN Registration_API מקבלת בקשה עם שדה Display_Name חסר, ריק, או המורכב מרווחים בלבד (לאחר trim), THE Input_Validator SHALL להחזיר HTTP 422 עם הודעת שגיאה בעברית.
2. WHEN Registration_API מקבלת בקשה עם Display_Name ארוך מ-50 תווים לאחר trim, THE Input_Validator SHALL להחזיר HTTP 422 עם הודעת שגיאה בעברית.
3. WHEN Registration_API מקבלת בקשה עם שדה אימייל חסר או ריק, THE Input_Validator SHALL להחזיר HTTP 422 עם הודעת שגיאה בעברית.
4. WHEN Registration_API מקבלת בקשה עם כתובת אימייל שאינה עומדת בפורמט RFC 5322, THE Input_Validator SHALL להחזיר HTTP 422 עם הודעת שגיאה בעברית.
5. WHEN Registration_API מקבלת בקשה עם סיסמה קצרה מ-8 תווים, THE Input_Validator SHALL להחזיר HTTP 422 עם הודעת שגיאה בעברית.
6. WHEN Registration_API מקבלת בקשה עם אימייל מנורמל הקיים כבר ב-User_Store, THE Registration_API SHALL להחזיר HTTP 409 עם ההודעה "כתובת האימייל כבר קיימת במערכת".

---

### דרישה 5: אבטחת נתונים

**User Story:** As a משתמש, I want שהמידע שלי יישמר בצורה מאובטחת, so that הסיסמה שלי לא תיחשף.

#### Acceptance Criteria

1. THE Password_Hasher SHALL לגבב את הסיסמה לפני שמירתה ב-User_Store — הסיסמה בטקסט גלוי לא תישמר לעולם.
2. THE Registration_API SHALL לא לכלול את שדות password או hashed_password בשום תגובת HTTP — לא בהצלחה ולא בשגיאה.
3. THE User_Store SHALL לשמור את האימייל המנורמל בלבד, ולהגדיר unique index על שדה email ב-MongoDB כדי למנוע רישום כפול גם בבקשות מקבילות (concurrent requests).
4. THE Registration_API SHALL לקבל בקשות דרך HTTPS בסביבת Production בלבד. בסביבת פיתוח מקומית (localhost), שימוש ב-HTTP הוא מקובל.

---

### דרישה 6: הצגת תוצאות הרישום ב-Frontend

**User Story:** As a משתמש, I want לדעת אם הרישום הצליח או נכשל, so that אוכל להמשיך להשתמש באפליקציה.

#### Acceptance Criteria

1. WHEN Registration_API מחזירה HTTP 201, THE Registration_Form SHALL להציג מסך הצלחה בעברית עם ההודעה "ההרשמה הושלמה בהצלחה!" וקישור לדף ההתחברות — ללא הפניה אוטומטית, מאחר שהרישום אינו מכניס את המשתמש למערכת באופן אוטומטי.
2. WHEN Registration_API מחזירה HTTP 409, THE Registration_Form SHALL להציג את ההודעה "כתובת האימייל כבר קיימת במערכת" בסמוך לשדה האימייל.
3. WHEN Registration_API מחזירה HTTP 422, THE Registration_Form SHALL להציג את הודעות השגיאה הרלוונטיות בסמוך לשדות המתאימים.
4. WHEN Registration_API מחזירה HTTP 500, THE Registration_Form SHALL להציג הודעת שגיאה גנרית בעברית ולא לחשוף פרטי שגיאה טכניים.
5. WHEN בקשת הרישום נכשלת בשל שגיאת רשת, THE Registration_Form SHALL להציג את ההודעה "שגיאת חיבור, נסה שוב מאוחר יותר".

---

### דרישה 7: בדיקות אוטומטיות ל-Backend

**User Story:** As a מפתח, I want שיהיו בדיקות אוטומטיות ל-Registration_API, so that שינויים עתידיים לא ישברו את הפונקציונליות.

#### Acceptance Criteria

1. THE Registration_API SHALL לעבור בדיקה שמאמתת שרישום תקין יוצר משתמש חדש ומחזיר HTTP 201.
2. THE Registration_API SHALL לעבור בדיקה שמאמתת שרישום עם אימייל קיים מחזיר HTTP 409.
3. THE Registration_API SHALL לעבור בדיקה שמאמתת שרישום עם שדות חסרים מחזיר HTTP 422.
4. THE Registration_API SHALL לעבור בדיקה שמאמתת שתגובת HTTP 201 אינה מכילה את שדות password או hashed_password.
5. THE Registration_API SHALL לעבור בדיקה שמאמתת שאימייל שנשלח באותיות גדולות נשמר ב-MongoDB כ-lowercase (נרמול אימייל).
6. THE Registration_API SHALL לעבור בדיקה שמאמתת ש-Display_Name המורכב מרווחים בלבד מחזיר HTTP 422.
7. THE Registration_API SHALL לעבור בדיקה שמאמתת שרישום עם שדה display_name ריק לחלוטין מחזיר HTTP 422.
8. THE Registration_API SHALL לעבור בדיקה שמאמתת שבמקרה של כשל מסד נתונים שאינו שגיאת כפילות, ה-API מחזיר HTTP 500 עם הודעה גנרית — ללא חשיפת פרטי שגיאה פנימיים.
9. THE Registration_API SHALL לעבור בדיקת concurrency שמאמתת שבקשות רישום מקבילות עם אותו אימייל מנורמל לא יוצרות שני משתמשים — רק אחת מהן תצלח (HTTP 201) והשנייה תחזיר HTTP 409.
