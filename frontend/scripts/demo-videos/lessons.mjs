// Content of the original demonstration videos, one per catalog lesson.
// Written for FocusMind (not copied from any course). Each slide is shown
// for SLIDE_SECONDS; bullets appear one after another.

export const DEMO_VERSION = 1;
export const SLIDE_SECONDS = 15;

const python = 'python-for-beginners';
const sql = 'sql-fundamentals';
const ai = 'intro-to-ai';

export const LESSONS = [
  {
    course: python, key: 'intro', courseTitle: 'Python למתחילים', title: 'היכרות עם Python וסביבת העבודה',
    slides: [
      { type: 'bullets', title: 'מהי Python?', lines: ['שפת תכנות קריאה ונוחה למתחילים', 'משמשת לאתרים, לנתונים ולבינה מלאכותית', 'הקוד רץ שורה אחר שורה'] },
      { type: 'flow', title: 'מה צריך כדי להתחיל', boxes: ['התקנת Python', 'עורך קוד', 'הרצת קובץ ‎.py'] },
      { type: 'code', title: 'התוכנית הראשונה', code: ['print("Hello, world!")', '', '# output:', '# Hello, world!'] },
      { type: 'code', title: 'המפרש האינטראקטיבי', code: ['>>> 2 + 3', '5', '>>> "Py" + "thon"', "'Python'"] },
      { type: 'bullets', title: 'שגיאות הן חלק מהלמידה', lines: ['Python מציינת באיזו שורה הבעיה', 'קוראים את הודעת השגיאה עד הסוף', 'מתקנים ומריצים שוב'] },
      { type: 'summary', title: 'סיכום', lines: ['Python מריצה קוד שורה אחר שורה', 'print מציגה פלט', 'המפרש מאפשר לנסות רעיונות מהר'] },
    ],
  },
  {
    course: python, key: 'variables', courseTitle: 'Python למתחילים', title: 'משתנים וטיפוסי נתונים',
    slides: [
      { type: 'bullets', title: 'מהו משתנה?', lines: ['שם שמצביע על ערך בזיכרון', 'נותנים ערך בעזרת =', 'אפשר לשנות את הערך בהמשך'] },
      { type: 'code', title: 'יצירת משתנים', code: ['name = "Noa"', 'age = 16', 'height = 1.62', 'is_student = True'] },
      { type: 'table', title: 'טיפוסי נתונים בסיסיים', columns: ['Type', 'Example'], rows: [['int', '16'], ['float', '1.62'], ['str', '"Noa"'], ['bool', 'True']] },
      { type: 'code', title: 'המרה בין טיפוסים', code: ['text = "42"', 'number = int(text)', 'print(number + 1)   # 43', 'print(str(7) + "!")  # 7!'] },
      { type: 'code', title: 'בדיקת טיפוס', code: ['print(type(3.5))', "# <class 'float'>"] },
      { type: 'summary', title: 'סיכום', lines: ['משתנה הוא שם לערך', 'לכל ערך יש טיפוס', 'int(), str() ו-float() ממירים בין טיפוסים'] },
    ],
  },
  {
    course: python, key: 'conditions', courseTitle: 'Python למתחילים', title: 'תנאים וקבלת החלטות',
    slides: [
      { type: 'bullets', title: 'למה צריך תנאים?', lines: ['התוכנית מחליטה מה לעשות לפי מצב', 'תנאי הוא ביטוי שהתוצאה שלו True או False'] },
      { type: 'table', title: 'אופרטורים להשוואה', columns: ['Operator', 'Meaning'], rows: [['==', 'equal'], ['!=', 'not equal'], ['< >', 'less / greater'], ['<= >=', 'or equal']] },
      { type: 'code', title: 'if, elif, else', code: ['grade = 87', 'if grade >= 90:', '    print("excellent")', 'elif grade >= 60:', '    print("passed")', 'else:', '    print("try again")'] },
      { type: 'flow', title: 'זרימת ההחלטה', boxes: ['grade >= 90?', 'grade >= 60?', 'else'] },
      { type: 'code', title: 'and, or, not', code: ['age = 15', 'has_ticket = True', 'if age >= 12 and has_ticket:', '    print("welcome")'] },
      { type: 'summary', title: 'סיכום', lines: ['if בודק תנאי', 'elif ו-else מכסים מקרים נוספים', 'and / or / not מחברים תנאים'] },
    ],
  },
  {
    course: python, key: 'loops', courseTitle: 'Python למתחילים', title: 'לולאות',
    slides: [
      { type: 'bullets', title: 'למה לולאות?', lines: ['חוזרים על פעולה בלי להעתיק קוד', 'for עובר על רצף ערכים', 'while חוזר כל עוד תנאי נכון'] },
      { type: 'code', title: 'for עם range', code: ['for i in range(1, 4):', '    print(i)', '# 1', '# 2', '# 3'] },
      { type: 'code', title: 'while', code: ['count = 3', 'while count > 0:', '    print(count)', '    count -= 1', 'print("go!")'] },
      { type: 'code', title: 'break ו-continue', code: ['for n in range(10):', '    if n == 2:', '        continue', '    if n == 5:', '        break', '    print(n)   # 0 1 3 4'] },
      { type: 'bullets', title: 'טעויות נפוצות', lines: ['לולאה אינסופית: התנאי לא משתנה', 'range(5) נעצר לפני 5', 'הזחה (indent) קובעת מה בתוך הלולאה'] },
      { type: 'summary', title: 'סיכום', lines: ['for לרצפים, while לתנאים', 'break עוצר, continue מדלג', 'שומרים על הזחה נכונה'] },
    ],
  },
  {
    course: python, key: 'functions', courseTitle: 'Python למתחילים', title: 'פונקציות',
    slides: [
      { type: 'bullets', title: 'מהי פונקציה?', lines: ['קטע קוד עם שם שאפשר להפעיל שוב', 'מקבלת פרמטרים', 'יכולה להחזיר ערך'] },
      { type: 'code', title: 'הגדרה וקריאה', code: ['def greet(name):', '    print("Hello", name)', '', 'greet("Dana")'] },
      { type: 'code', title: 'ערך החזרה', code: ['def area(width, height):', '    return width * height', '', 'print(area(3, 4))   # 12'] },
      { type: 'code', title: 'ערך ברירת מחדל', code: ['def power(base, exp=2):', '    return base ** exp', '', 'power(5)      # 25', 'power(2, 3)   # 8'] },
      { type: 'bullets', title: 'תחום משתנים', lines: ['משתנה שנוצר בתוך פונקציה קיים רק בתוכה', 'מעבירים ערכים בפרמטרים', 'ומחזירים תוצאות עם return'] },
      { type: 'summary', title: 'סיכום', lines: ['def מגדירה פונקציה', 'פרמטרים נכנסים, return יוצא', 'פונקציות קטנות קלות לבדיקה'] },
    ],
  },
  {
    course: python, key: 'collections', courseTitle: 'Python למתחילים', title: 'רשימות ומילונים',
    slides: [
      { type: 'code', title: 'רשימה (list)', code: ['fruits = ["apple", "banana"]', 'fruits.append("cherry")', 'print(fruits[0])     # apple', 'print(len(fruits))   # 3'] },
      { type: 'code', title: 'מעבר על רשימה', code: ['for fruit in fruits:', '    print(fruit.upper())'] },
      { type: 'code', title: 'מילון (dict)', code: ['ages = {"Noa": 16, "Ido": 17}', 'ages["Maya"] = 15', 'print(ages["Ido"])   # 17'] },
      { type: 'code', title: 'מעבר על מילון', code: ['for name, age in ages.items():', '    print(name, age)'] },
      { type: 'table', title: 'מתי להשתמש במה?', columns: ['list', 'dict'], rows: [['ordered items', 'key -> value'], ['index 0, 1, 2', 'lookup by key'], ['[ ]', '{ }']] },
      { type: 'summary', title: 'סיכום', lines: ['רשימה שומרת סדר', 'מילון ממפה מפתח לערך', 'שתיהן עובדות עם לולאות'] },
    ],
  },
  {
    course: sql, key: 'relational', courseTitle: 'יסודות SQL', title: 'מה זה מסד נתונים רלציוני',
    slides: [
      { type: 'bullets', title: 'מסד נתונים רלציוני', lines: ['הנתונים נשמרים בטבלאות', 'כל שורה היא רשומה, כל עמודה היא שדה', 'טבלאות מתקשרות בעזרת מפתחות'] },
      { type: 'table', title: 'טבלת students', columns: ['id', 'name', 'grade'], rows: [['1', 'Noa', '10'], ['2', 'Ido', '11'], ['3', 'Maya', '10']] },
      { type: 'bullets', title: 'מפתח ראשי (Primary Key)', lines: ['מזהה ייחודי לכל שורה', 'לא חוזר ולא ריק', 'בדוגמה: העמודה id'] },
      { type: 'flow', title: 'קשר בין טבלאות', boxes: ['students.id', 'enrollments.student_id', 'courses.id'] },
      { type: 'bullets', title: 'למה לפצל לטבלאות?', lines: ['כל מידע נשמר פעם אחת', 'פחות כפילויות וטעויות', 'קל לעדכן ולשלוף'] },
      { type: 'summary', title: 'סיכום', lines: ['טבלאות, שורות ועמודות', 'מפתח ראשי מזהה שורה', 'מפתחות מחברים בין טבלאות'] },
    ],
  },
  {
    course: sql, key: 'select', courseTitle: 'יסודות SQL', title: 'שליפת נתונים עם SELECT',
    slides: [
      { type: 'code', title: 'SELECT בסיסי', code: ['SELECT name, grade', 'FROM students;'] },
      { type: 'code', title: 'סינון עם WHERE', code: ['SELECT name', 'FROM students', "WHERE grade = 10;"] },
      { type: 'table', title: 'התוצאה', columns: ['name'], rows: [['Noa'], ['Maya']] },
      { type: 'code', title: 'מיון עם ORDER BY', code: ['SELECT name, grade', 'FROM students', 'ORDER BY grade DESC, name;'] },
      { type: 'code', title: 'הגבלה עם LIMIT', code: ['SELECT name', 'FROM students', 'ORDER BY name', 'LIMIT 2;'] },
      { type: 'summary', title: 'סיכום', lines: ['SELECT בוחר עמודות', 'WHERE מסנן שורות', 'ORDER BY ממיין, LIMIT מגביל'] },
    ],
  },
  {
    course: sql, key: 'aggregate', courseTitle: 'יסודות SQL', title: 'פונקציות סיכום',
    slides: [
      { type: 'table', title: 'טבלת scores', columns: ['student', 'subject', 'score'], rows: [['Noa', 'math', '90'], ['Noa', 'art', '80'], ['Ido', 'math', '70']] },
      { type: 'code', title: 'COUNT, SUM, AVG', code: ['SELECT COUNT(*), SUM(score), AVG(score)', 'FROM scores;', '-- 3 | 240 | 80'] },
      { type: 'code', title: 'GROUP BY', code: ['SELECT student, AVG(score)', 'FROM scores', 'GROUP BY student;', '-- Noa 85 | Ido 70'] },
      { type: 'code', title: 'HAVING', code: ['SELECT student, AVG(score) AS avg_score', 'FROM scores', 'GROUP BY student', 'HAVING AVG(score) > 75;'] },
      { type: 'bullets', title: 'WHERE או HAVING?', lines: ['WHERE מסנן שורות לפני הקיבוץ', 'HAVING מסנן קבוצות אחרי הקיבוץ'] },
      { type: 'summary', title: 'סיכום', lines: ['פונקציות סיכום מחזירות ערך אחד', 'GROUP BY מחשב לכל קבוצה', 'HAVING מסנן קבוצות'] },
    ],
  },
  {
    course: sql, key: 'joins', courseTitle: 'יסודות SQL', title: 'חיבור טבלאות',
    slides: [
      { type: 'flow', title: 'שתי טבלאות, מפתח משותף', boxes: ['students (id)', 'student_id', 'enrollments'] },
      { type: 'code', title: 'INNER JOIN', code: ['SELECT s.name, e.course', 'FROM students AS s', 'JOIN enrollments AS e', '  ON e.student_id = s.id;'] },
      { type: 'bullets', title: 'INNER JOIN מחזיר', lines: ['רק שורות שיש להן התאמה בשתי הטבלאות', 'תלמיד בלי הרשמה לא יופיע'] },
      { type: 'code', title: 'LEFT JOIN', code: ['SELECT s.name, e.course', 'FROM students AS s', 'LEFT JOIN enrollments AS e', '  ON e.student_id = s.id;', '-- Maya | NULL'] },
      { type: 'bullets', title: 'מפתח זר (Foreign Key)', lines: ['עמודה שמצביעה על מפתח ראשי בטבלה אחרת', 'שומרת על קשר תקין בין הנתונים'] },
      { type: 'summary', title: 'סיכום', lines: ['JOIN מחבר לפי עמודה משותפת', 'INNER: רק התאמות', 'LEFT: כל השורות מהטבלה השמאלית'] },
    ],
  },
  {
    course: sql, key: 'modify', courseTitle: 'יסודות SQL', title: 'הוספה ועדכון נתונים',
    slides: [
      { type: 'code', title: 'INSERT', code: ['INSERT INTO students (name, grade)', "VALUES ('Lior', 11);"] },
      { type: 'code', title: 'UPDATE', code: ['UPDATE students', 'SET grade = 12', "WHERE name = 'Lior';"] },
      { type: 'code', title: 'DELETE', code: ['DELETE FROM students', 'WHERE id = 4;'] },
      { type: 'bullets', title: 'זהירות!', lines: ['UPDATE או DELETE בלי WHERE משנים את כל הטבלה', 'קודם מריצים SELECT עם אותו WHERE', 'ורק אז משנים'] },
      { type: 'flow', title: 'הרגל טוב', boxes: ['SELECT ... WHERE', 'בדיקת התוצאה', 'UPDATE/DELETE'] },
      { type: 'summary', title: 'סיכום', lines: ['INSERT מוסיף שורות', 'UPDATE משנה ערכים', 'DELETE מוחק, תמיד עם WHERE'] },
    ],
  },
  {
    course: ai, key: 'what-is-ai', courseTitle: 'מבוא לבינה מלאכותית', title: 'מהי בינה מלאכותית',
    slides: [
      { type: 'bullets', title: 'בינה מלאכותית', lines: ['מערכות שמבצעות משימות שדורשות "חשיבה"', 'למשל זיהוי תמונה, תרגום והמלצות'] },
      { type: 'flow', title: 'ציר זמן קצר', boxes: ['1950: מבחן טיורינג', '1997: ניצחון בשחמט', '2012+: למידה עמוקה'] },
      { type: 'table', title: 'סוגים', columns: ['Type', 'Example'], rows: [['rules', 'spam filter rules'], ['search', 'route planning'], ['learning', 'image recognition']] },
      { type: 'bullets', title: 'דוגמאות מהיומיום', lines: ['ניווט שמחשב מסלול מהיר', 'השלמה אוטומטית במקלדת', 'זיהוי פנים במצלמה'] },
      { type: 'bullets', title: 'מה AI לא עושה', lines: ['אינה "מבינה" כמו אדם', 'יכולה לטעות בביטחון', 'תלויה בנתונים שעליהם נבנתה'] },
      { type: 'summary', title: 'סיכום', lines: ['AI פותרת משימות מוגדרות', 'יש כללים, חיפוש ולמידה', 'תמיד בודקים את התוצאות'] },
    ],
  },
  {
    course: ai, key: 'machine-learning', courseTitle: 'מבוא לבינה מלאכותית', title: 'למידת מכונה',
    slides: [
      { type: 'bullets', title: 'למידת מכונה', lines: ['המחשב לומד דפוסים מדוגמאות', 'במקום לכתוב כל כלל ביד'] },
      { type: 'table', title: 'למידה מפוקחת', columns: ['size (m2)', 'price'], rows: [['50', '1.2M'], ['80', '1.9M'], ['100', '?']] },
      { type: 'bullets', title: 'למידה לא מפוקחת', lines: ['אין תשובות נכונות מראש', 'המודל מחפש קבוצות דומות', 'למשל קיבוץ לקוחות לפי הרגלים'] },
      { type: 'flow', title: 'נתוני אימון ובדיקה', boxes: ['80% אימון', 'מודל', '20% בדיקה'] },
      { type: 'bullets', title: 'למה מפרידים?', lines: ['בודקים על נתונים שהמודל לא ראה', 'כך מגלים התאמת יתר (overfitting)'] },
      { type: 'summary', title: 'סיכום', lines: ['מפוקחת: דוגמאות עם תשובות', 'לא מפוקחת: חיפוש מבנה', 'תמיד בודקים על נתונים חדשים'] },
    ],
  },
  {
    course: ai, key: 'neural-networks', courseTitle: 'מבוא לבינה מלאכותית', title: 'רשתות נוירונים',
    slides: [
      { type: 'neuron', title: 'נוירון מלאכותי' },
      { type: 'bullets', title: 'מה הנוירון מחשב?', lines: ['כל קלט מוכפל במשקל', 'מחברים ומוסיפים הטיה (bias)', 'פונקציית הפעלה קובעת את הפלט'] },
      { type: 'layers', title: 'שכבות' },
      { type: 'flow', title: 'אימון בעזרת שגיאה', boxes: ['ניבוי', 'חישוב שגיאה', 'עדכון משקלים'] },
      { type: 'bullets', title: 'מושגים', lines: ['backpropagation מחשבת איך כל משקל השפיע', 'gradient descent מקטינה את השגיאה צעד אחר צעד'] },
      { type: 'summary', title: 'סיכום', lines: ['נוירון: משקלים, סכום והפעלה', 'רשת: שכבות של נוירונים', 'אימון: מקטינים שגיאה'] },
    ],
  },
  {
    course: ai, key: 'language-models', courseTitle: 'מבוא לבינה מלאכותית', title: 'מודלי שפה',
    slides: [
      { type: 'bullets', title: 'מודל שפה', lines: ['מנבא את המילה (token) הבאה', 'לומד מכמויות גדולות של טקסט'] },
      { type: 'flow', title: 'טקסט לטוקנים', boxes: ['"I love Python"', 'I | love | Python', 'מספרים'] },
      { type: 'bullets', title: 'Attention', lines: ['כל מילה "מסתכלת" על מילים אחרות במשפט', 'כך המודל מבין הקשר', 'זה הבסיס של מודל transformer'] },
      { type: 'flow', title: 'יצירת תשובה', boxes: ['הקשר', 'ניבוי טוקן', 'הוספה וחזרה'] },
      { type: 'bullets', title: 'מגבלות', lines: ['יכול להמציא עובדות בביטחון', 'אינו יודע מה קרה אחרי האימון', 'חשוב לבדוק מקורות'] },
      { type: 'summary', title: 'סיכום', lines: ['מנבא טוקן אחר טוקן', 'attention מחברת הקשר', 'בודקים את התשובות'] },
    ],
  },
  {
    course: ai, key: 'responsible-ai', courseTitle: 'מבוא לבינה מלאכותית', title: 'בינה מלאכותית אחראית',
    slides: [
      { type: 'bullets', title: 'למה אחריות?', lines: ['החלטות של מודלים משפיעות על אנשים', 'טעויות יכולות לפגוע בקבוצות שלמות'] },
      { type: 'bullets', title: 'הטיות (Bias)', lines: ['נתונים חלקיים יוצרים מודל מוטה', 'למשל זיהוי פנים שטועה יותר לקבוצה מסוימת', 'בודקים ביצועים לכל קבוצה'] },
      { type: 'bullets', title: 'פרטיות', lines: ['אוספים רק מידע שצריך', 'מסבירים מה נשמר ולמה', 'מאפשרים למחוק'] },
      { type: 'bullets', title: 'שקיפות', lines: ['מסבירים איך התקבלה ההחלטה', 'מציינים מגבלות ורמת ודאות'] },
      { type: 'flow', title: 'דוגמה מ-FocusMind', boxes: ['עיבוד מצלמה בדפדפן', 'שמירת מצבים בלבד', 'מחיקה בעמוד הפרטיות'] },
      { type: 'summary', title: 'סיכום', lines: ['בודקים הטיות', 'שומרים על פרטיות', 'מסבירים ומאפשרים שליטה'] },
    ],
  },
];
