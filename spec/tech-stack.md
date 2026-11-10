# Tech Stack — Sereno

**מוצר:** Sereno, אוטומציה לשירות VIP בשדה התעופה (יציאות בלבד)
**תאריך:** 25.10.2026
**מקורות פנימיים:** `PRD.md`, `product-10-definitions.md`, `course-stack.md` (נקודת המוצא)
**היקף:** בחירת טכנולוגיות בלבד. בלי מבנה מערכת, Milestones או תוכנית פיתוח.

---

## תקציר

- **סטאק הקורס מכסה את כל דרישות ה-Must וה-Should של ה-PRD.** אין דרישת Must שלא ניתנת למימוש, ולכן אין צורך בחריגה מהסטאק.
- **רמת הרשאות 2.** ה-PRD אינו דורש הרשמה עצמית, שחזור סיסמה, כניסה עם Google או מייל למשתמשים אמיתיים. לכן לא נוספה רמה 3 ולא נוסף Resend.
- **התוספת היחידה למוצר:** הגדרות ספציפיות בתוך הכלים של הסטאק (שם מודל ה-Gemini, ואופן החיבור של n8n ושל Gmail). לא נוסף שום כלי או ספק.
- **נקודה פתוחה אחת:** סטאק הקורס לא קובע איפה n8n רץ, ו-Sereno צריך n8n שנגיש מהאינטרנט. ברירת המחדל המומלצת מופיעה בסעיף "החלטות ונקודה פתוחה אחת".

---

## שלב 1 — התאמה בין דרישות ה-PRD לסטאק הקורס

הסימון: **מכסה** = סטאק הקורס מספק את הדרישה כמו שהיא. **חלקית** = הסטאק מספק אותה בתנאי או בהגבלה, שמפורטים בעמודת ההערה. **לא מכסה** = אין כיסוי בסטאק.

| דרישות (FR) | עדיפות | מה נדרש | רכיב בסטאק | התאמה | הערה |
|---|---|---|---|---|---|
| FR-01–07 | Must | טופס הזמנה ציבורי בארבעה שלבים, ללא התחברות | אתר סטטי (HTML, CSS, JS) + `api/submit-order` ב-Vercel | מכסה | |
| FR-08–10 | Should | שירותים נוספים, סקירה לפני שליחה, דף נחיתה | אתר סטטי | מכסה | |
| FR-03 | Must | חיפוש טיסה מתוך טבלת הטיסות | `api/flights` + Supabase, חיפוש בדף | מכסה | |
| FR-11, FR-32 | Must, Should | בדיקת קיום טיסה, ניתוב חריג למנהל | פונקציה + Supabase | מכסה | |
| FR-12 | Must | חישוב שעת מפגש | קוד בפונקציה | מכסה | הסטאק קובע שחישוב נעשה בקוד ולא במודל |
| FR-13 | Must | חמשת הסטטוסים | רשימה קבועה בקובץ JSON בריפו | מכסה | |
| FR-14 | Must | העברה למנהל + התראה | Supabase + n8n (מייל) | **חלקית** | ההתראה דורשת n8n שנגיש מ-Vercel. הסטאק לא קובע איפה n8n רץ |
| FR-15, FR-16 | Must | שלוש טבלאות ונתוני דמה | Supabase | מכסה | מקסימום שלוש טבלאות, ו-PRD משתמש בשלוש |
| FR-17, FR-18 | Must | טיוטת מייל ב-AI ומגבלות פרומפט | Gemini Flash מתוך פונקציה, `ai-tests.md` | מכסה | שם המודל המדויק נקבע בשלב 2 |
| FR-19, FR-20, FR-21 | Should | המלצת שירותים, לקוח חוזר, מייל בירור | Gemini Flash + שאילתה על `orders` | מכסה | |
| FR-22 | Must | התחברות והרשאות לפי תפקיד | Supabase Auth, רמה 2 | מכסה | משתמשים נוצרים ידנית, הרשמה עצמית כבויה |
| FR-23–27, FR-29, FR-30 | Must, Should | מסכי מנהל ונציג, אישור, דחייה, הערות | אתר סטטי + `api/orders`, `api/order-decision` | מכסה | |
| FR-28 | Must | עדכון מסך הנציג | רענון בדף | מכסה | הסטאק אוסר realtime. ה-PRD כבר מגדיר רענון |
| FR-31 | Must | מייל אישור או דחייה ללקוח | n8n + Gmail של הסטודנט | **חלקית** | הסטאק מתיר רק כתובות בדיקה. ה-PRD עצמו מגדיר "בהדגמה, לכתובת בדיקה" |
| FR-33–35 | Should | ארכיון, חיפוש, הרשאות לפי תפקיד | שאילתות על `orders` + `api/orders` | מכסה | |
| FR-36–39 | Should | שינוי טיסה אחרי אישור, אישור מנהל | Supabase + n8n (מייל עדכון) | **חלקית** | הסימון למנהל הוא רענון (אין Push). מייל העדכון תלוי באותו n8n כמו FR-14 |
| דרישות לא-פונקציונליות | | אנגלית, רספונסיבי, נגישות בסיסית | עקרונות "עברית, מובייל ונגישות" בסטאק | מכסה | הסטאק מניח עברית ו-RTL. ה-PRD קובע אנגלית ו-LTR, והמשמעות היא רק כיוון הדף, לא בחירת כלי |

**לא מכסה: אין.** לכן לא עצרתי ולא הצגתי דרישה שלא ניתנת למימוש.

### צרכים שנבדקו ואינם נדרשים ב-PRD

| צורך | האם ה-PRD דורש | החלטה |
|---|---|---|
| תשלומים | לא. אין אשראי ואין מחירים באתר | לא נוסף |
| מפות | לא | לא נוסף |
| אחסון קבצים | לא. אין העלאת קבצים | לא נוסף (Supabase Storage זמין אם יידרש) |
| SMS, WhatsApp, Push | לא. התקשורת במייל בלבד | לא נוסף |
| API חיצוני לטיסות | לא. הבדיקה מול טבלה פנימית | לא נוסף |
| עדכון בזמן אמת | לא. ה-PRD קובע רענון | לא נוסף |
| הרשמה עצמית, שחזור סיסמה, כניסה עם Google, מייל למשתמשים אמיתיים (רמה 3) | לא. ללקוחות אין התחברות | רמה 3 לא נבחרה, ולכן Resend אינו נדרש |

---

## שלב 2 — מחקר: מה שהסטאק לא קובע

הצרכים שהסטאק משאיר פתוחים: **א.** איזה מודל Gemini בדיוק, **ב.** איפה n8n רץ, **ג.** איך מחברים Gmail ל-n8n.

### א. מודל ה-AI

| קריטריון | Gemini 3.8 Flash | Gemini 3.5 Flash-Lite | OpenAI GPT-5.6 Terra |
|---|---|---|---|
| מעמד | יציב ("New Stable"), הדגם העדכני של Flash | יציב, הדגם העדכני של Flash-Lite | הדגם שמתאים לשכבת "mini" של OpenAI |
| התאמה לדרישה (פלט במבנה קבוע, ניסוח מייל) | טוב. תומך ב-JSON schema | מתאים למשימות פשוטות, פחות חזק | טוב. תומך ב-Structured Outputs |
| שילוב עם הסטאק | ברירת המחדל של הקורס (`GEMINI_API_KEY`, `GEMINI_MODEL`) | אותו דבר | חלופה בתשלום בקורס (`OPENAI_API_KEY`, `OPENAI_MODEL`) |
| שכבה חינמית | יש | יש | אין |
| עלות בתשלום (ל-1M טוקנים, קלט/פלט) | $0.75 / $3.75. מ-1.1.2027 $1.50 / $7.50 | $0.30 / $2.50 | $2.00 / $12.00 |
| הערת נתונים | בשכבה החינמית התוכן משמש את גוגל לשיפור מוצרים, ולכן נתוני דמה בלבד | אותו דבר | לא רלוונטי לשכבה חינמית |
| בשלות ותיעוד | תיעוד רשמי מלא | אותו דבר | תיעוד רשמי מלא |

פרטים שנבדקו בתיעוד:
- פלט במבנה קבוע ב-REST נעשה דרך `generationConfig` עם `responseMimeType` ו-`responseSchema` (נקודת הקצה `generateContent`).
- ה-API לא אוכף `minLength` ו-`maxLength`, ולכן את אורך הטיוטה בודק הקוד. זה תואם לכלל הסטאק שהקוד בודק את המבנה.
- Google מציגה היום שני ממשקים: `generateContent` ו-Interactions API. דפי "מה חדש" ומדריך Gemini 3 משתמשים בדוגמאות ב-Interactions API, ואחד מדפי `generateContent` מסומן בתיעוד כ-Legacy (ובדף נוסף נכתב שהוא "deprecated and will be removed"). הדף של Interactions מציין שהוא ב-beta ושקיימת גם גרסת v1 יציבה. בתיעוד לא נמצאה הודעה שמוציאה את `generateContent` משימוש, ואין לו תאריך הסרה. לכן ההמלצה היא `generateContent` כנקודת התחלה, והחלטה סופית בעת הכתיבה, אחרי קריאת התיעוד העדכני (כפי שהסטאק דורש).
- מגבלות הקצב של השכבה החינמית (RPM, TPM, RPD) לא מופיעות בתיעוד, ומוצגות בפרויקט ב-Google AI Studio. הן נקבעות לפי פרויקט ולא לפי מפתח.
- נקודה שלא אומתה: בדוגמאות התיעוד המפתח עובר כפרמטר בכתובת. לפני כתיבת הקוד יש לבדוק אם התיעוד מאפשר לשלוח אותו בכותרת, כדי שלא יירשם בלוגים.

### ב. איפה n8n רץ

הבעיה: הפונקציה ב-Vercel צריכה לקרוא ל-n8n דרך Webhook (התראה למנהל, מייל ללקוח, מייל עדכון). לכן n8n חייב להיות נגיש מהאינטרנט. סטאק הקורס אומר רק ש-n8n "נכנס במודול האוטומציות", בלי לקבוע אירוח.

| קריטריון | n8n Cloud | n8n מקומי (npm או Docker) | n8n על שרת בענן (Docker) |
|---|---|---|---|
| נגישות מ-Vercel | כתובת Webhook ציבורית מוכנה | רק עם מנהרה, והתיעוד קובע שהיא לפיתוח ובדיקות בלבד | כתובת ציבורית, דורש הגדרה ואחזקה |
| קלות שילוב עם Gmail | Managed OAuth: לחיצה על "Sign in with Google" | דורש OAuth מותאם ב-Google Cloud, או SMTP | כמו מקומי |
| עלות | אין תוכנית חינמית קבועה. Starter 20€ לחודש בחיוב שנתי (2,500 הרצות). יש ניסיון חינם | חינם (Community Edition) | חינם לתוכנה, עלות לשרת |
| בשלות | המוצר הרשמי | נפוץ | נפוץ |
| אבטחת Webhook | Header auth, Basic auth או JWT | זהה | זהה |

הערות:
- בניסיון חינם של Cloud המגבלה היא 1,000 הרצות (נקרא בדף המחירים). אורך הניסיון לא מופיע בדף המחירים; תיעוד n8n מציין 14 יום.
- Webhook מקבל כתובת Production רק אחרי פרסום ה-workflow. כתובת הבדיקה פעילה רק בזמן האזנה.

### ג. חיבור Gmail ל-n8n

| קריטריון | צומת Gmail עם OAuth | צומת Send Email עם SMTP של Gmail | Resend |
|---|---|---|---|
| התאמה לכלל הסטאק ("n8n, מחשבון Gmail, בלי שירות דיוור נוסף") | מתאים | מתאים | לא מתאים לרמה 2 (שמור לרמה 3) |
| הגדרה ב-Cloud | פשוטה (Managed OAuth) | סיסמת אפליקציה + אימות דו-שלבי | חשבון ודומיין |
| הגדרה בהרצה עצמית | OAuth מותאם בפרויקט ב-Google Cloud | אותה הגדרה כמו ב-Cloud | חשבון ודומיין |
| סיכון בהדגמה | באפליקציית OAuth חיצונית במצב Testing, האסימון פג אחרי 7 ימים וצריך לחבר מחדש | אין פקיעה כזו | אין |
| מגבלת שליחה | חשבון Gmail אישי: עד 500 מיילים ביום | (התיעוד לא מציין מגבלה נפרדת ל-SMTP) | שכבה חינמית: 100 ביום, 3,000 בחודש |

---

## שלב 3 — המלצה: Technology Stack אחד

**סטאק הקורס, ללא החלפת רכיב, עם התוספת הקטנה שלהלן.** לכל שורה: הנימוק והמקור.

| שכבה | בחירה | נימוק | מקור |
|---|---|---|---|
| צד לקוח | אתר סטטי: HTML, CSS, JavaScript | הסטאק מכסה את כל המסכים, והעיצוב כבר קיים כמסכים סטטיים | `course-stack.md` |
| אירוח ופונקציות | Vercel Hobby, פרויקט אחד עם `api/` | משך ריצה של עד 300 שניות מספיק לקריאה ל-AI. גוף בקשה עד 4.5MB מספיק, כי אין קבצים. Hobby מיועד לשימוש לא מסחרי, וזה פרויקט קורס | [Vercel Functions Limits](https://vercel.com/docs/functions/limitations), [Vercel Hobby](https://vercel.com/docs/plans/hobby) |
| נתונים והתחברות | Supabase, רמה 2, רק דרך הפונקציות | שלוש טבלאות, משתמשים שנוצרים ידנית. בשכבה החינמית: 2 פרויקטים פעילים, 500MB, השהיה אחרי שבוע ללא פעילות, בלי גיבויים אוטומטיים | [Supabase Pricing](https://supabase.com/pricing) |
| מודל AI | **Gemini 3.8 Flash** (`GEMINI_MODEL=gemini-3.8-flash`), בשכבה החינמית, קריאת REST (נקודת הקצה `generateContent`, עם בדיקה בעת הכתיבה מול Interactions API) עם סכמת פלט, בלי ספריית SDK | המודל היציב העדכני, ברירת המחדל של הקורס. נתוני דמה בלבד. הספרייה אינה נדרשת, והסטאק אוסר ספרייה שאפשר לוותר עליה | [Gemini models](https://ai.google.dev/gemini-api/docs/models), [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [generateContent](https://ai.google.dev/api/generate-content) |
| מודל גיבוי | Gemini 3.5 Flash-Lite, מוחלף דרך `GEMINI_MODEL` בלי לגעת בקוד | זול יותר ויציב. מתאים אם מגבלת הקצב החינמית לא מספיקה | [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| אוטומציות ומיילים | n8n, עם Webhook מאובטח ב-Header auth, והסוד נשמר ב-Vercel כ-Secret | הסטאק קובע n8n. ה-Webhook מקבל קריאות מהפונקציות | [n8n Webhook node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook) |
| חיבור Gmail | **Send Email עם SMTP של Gmail וסיסמת אפליקציה** | נשאר בתוך כלל הסטאק (Gmail של הסטודנט, בלי ספק נוסף), ונמנע פקיעת האסימון אחרי 7 ימים שקורית ב-OAuth חיצוני במצב Testing | [n8n Gmail SMTP](https://docs.n8n.io/integrations/builtin/credentials/send-email/gmail), [n8n Google OAuth](https://docs.n8n.io/integrations/builtin/credentials/google/oauth-single-service) |
| גרסאות | Git ו-GitHub, ענף main | הסטאק | `course-stack.md` |

**אינו נוסף:** Resend (רמה 3 בלבד), סליקה, מפות, אחסון קבצים, SMS, Push, API טיסות, React.

### משתני הסביבה שהמוצר צריך (שמות בלבד)

| משתנה | סוג | הערה |
|---|---|---|
| `GEMINI_API_KEY` | Secret | |
| `GEMINI_MODEL` | Config | `gemini-3.8-flash` |
| `SUPABASE_URL` | Config | |
| `SUPABASE_SECRET_KEY` | Secret | |
| `N8N_WEBHOOK_URL` | Config | כתובת ה-Webhook של Production |
| `N8N_WEBHOOK_SECRET` | Secret | ערך ה-Header auth |

אין מפתח בקוד ובריפו. נשמרים כל כללי "חוק הברזל" בסטאק.

---

## החלטות ונקודה פתוחה אחת

1. **חיבור Gmail: אושר.** SMTP עם סיסמת אפליקציה (דורש אימות דו-שלבי בחשבון Google).
2. **מודל: אושר.** Gemini 3.8 Flash כברירת מחדל, ו-Gemini 3.5 Flash-Lite כגיבוי דרך `GEMINI_MODEL`.
3. **איפה n8n רץ: פתוח, ללא העדפה.** סטאק הקורס לא קובע זאת. ברירת המחדל המומלצת היא **n8n Cloud בתקופת הניסיון**, כי הוא נותן כתובת Webhook ציבורית בלי הקמה, ו-n8n מקומי עם מנהרה מוגדר בתיעוד כמתאים לפיתוח בלבד. מחיר ההמשך אחרי הניסיון: Starter ב-20€ לחודש. כדאי להתחיל את הניסיון קרוב להדגמה. לפני שמתחילים, יש לבדוק אם לקורס יש מופע n8n משותף או הנחיה, ואם כן, להשתמש בו.

---

## פערים שלא נסגרו במחקר

- מגבלות הקצב המדויקות בשכבה החינמית של Gemini נראות רק ב-AI Studio.
- אורך הניסיון החינמי של n8n Cloud אינו מופיע בדף המחירים (התיעוד מזכיר 14 יום).
- לא נבדק אם Resend דורש דומיין מאומת לשליחה לכל כתובת. זה לא נדרש ב-Sereno, כי Resend שייך לרמה 3.
- ב-`stack-recommendations.md` יש נוסחים שנכתבו לפני ה-PRD (ממשק עברית, שינוי טיסה מחוץ ל-MVP, שלוש מגבלות פרומפט) והם כבר לא תואמים. המסמך הזה גובר עליהם.

---

## מקורות

- [Gemini API: Models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini API: Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini API: Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Gemini API: Structured output](https://ai.google.dev/gemini-api/docs/json-mode?lang=node)
- [Gemini API: generateContent](https://ai.google.dev/api/generate-content)
- [Gemini API: Interactions API (beta)](https://ai.google.dev/api/interactions-api)
- [OpenAI: GPT-5.6 Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra)
- [OpenAI: GPT-5 Mini (deprecated)](https://developers.openai.com/api/docs/models/gpt-5-mini)
- [n8n: Choose your n8n](https://docs.n8n.io/choose-n8n/)
- [n8n: Pricing](https://n8n.io/pricing/)
- [n8n: Webhook node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook)
- [n8n: Run with npm](https://docs.n8n.io/hosting/installation/npm/)
- [n8n: Gmail via SMTP](https://docs.n8n.io/integrations/builtin/credentials/send-email/gmail)
- [n8n: Google OAuth2](https://docs.n8n.io/integrations/builtin/credentials/google/oauth-single-service)
- [Gmail: Sending limits](https://support.google.com/mail/answer/22839?hl=en)
- [Resend: Account quotas and limits](https://resend.com/docs/knowledge-base/account-quotas-and-limits)
- [Vercel: Functions limits](https://vercel.com/docs/functions/limitations)
- [Vercel: Hobby plan](https://vercel.com/docs/plans/hobby)
- [Supabase: Pricing](https://supabase.com/pricing)
- [אינדקס השירותים של הקורס](https://eyalg1980.github.io/simpla-lab/jb53500-backend/#apis)
