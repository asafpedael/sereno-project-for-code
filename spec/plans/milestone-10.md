# Milestone 10 — The landing page and the form (plan)

**Source:** `spec/MILESTONES.md` (Milestone 10, the overview table, "How the document is built" — M10–M14 were added on 26.11.2026 as improvements before real people use the site; their wording, content and design choices are set in each one's planning with Asaf — the dependencies: M10 depends on nothing new, and M11–M14 do not depend on it), PRD §3 (the five screens, the four-step form, UX requirements: English, LTR, accessibility), FR-01..FR-10, FR-40, FR-43, §7 (no prices, no customer login), DESIGN screen 1 (landing), screen 2 (the form: step 1 "Flight", step 4 "Details"), "What is not shown in the images" (desktop version of the customer screens), the dark "website" section (the sunset side panel: "In the form on phones the panel is not shown"), the Style Guide (checkboxes, panels, image style, accessibility), the three images (the landing and the form frames: the original button text is "Book escort"; no frame shows an "about us" part, a video, or a consent checkbox, so they are built in the same design line, DESIGN rule of 10.11.2026), ARCHITECTURE §5.1 (`POST /api/submit-order`: body, validation, order of steps), ADR-8 (self-hosted fonts, no third-party requests for fonts), ADR-25 (dark look, one shared `scene.svg`), ADR-37 (the "request received" email). The code is the source of truth for what M1–M9 and FR-43 built: `public/index.html`, `public/order.html`, `public/js/order-form.js`, `public/css/landing.css`, `theme.css`, `base.css`, `tokens.css`, `api/submit-order.js`, `lib/validate.js`, `tests/` (148 tests, all green on 26.11.2026).

**Status:** written 26.11.2026. **Approved by Asaf (26.11.2026, "let's go")**, with the "About Sereno" text of O2 (including his own paragraph) and the O1 wording. **Build step 0 done (26.11.2026):** the O1 wording applied to PRD (§3 screen 1, form step 4, FR-10, new FR-44), DESIGN (screen 1, screen 2 step 4, the side-panel bullet, "What is not shown") and ARCHITECTURE (§5.1 body and validation, the FR table). **Build steps 1–4, 26.11.2026:** landing (buttons "Book your escort", "About" link, "About Sereno" with the approved text and the video player pointing at `public/assets/sereno-video.mp4`), step 4 (rules panel and checkbox, side panel without the list), `approval_ack` in `lib/validate.js`, `tests/order-consent.test.js` (151 unit tests pass). ADR-38 and ADR-39 added. Checks in §8.1. **Video added (26.11.2026):** Asaf compressed it with HandBrake (2.9 MB, 1280 × 853, 37 s; HandBrake saved it as `public/assets sereno-video.mp4`, moved into `public/assets/sereno-video.mp4`); the player frame set to 3 / 2; plays at 1280px and 375px. Every DoD item passes; MILESTONES M10 marked 🟡. **Asaf checked the local run (the header "About" link stays desktop only, as DESIGN says) and approved with the push (26.11.2026, ✅).** Already answered by Asaf in planning (26.11.2026): the button text is **"Book your escort"**; the consent sentence is the short one, **"I understand my booking is subject to manager approval."**; the video is **a file on his computer** (where it is and how long / how big: still to come, O3); the "about us" and service facts **he will write in the chat** (O2). Nothing is built yet. **Second round (26.11.2026):** Asaf asked me to write the "about" text myself from what the specs already say (he edits it; the draft is shown in the chat first, see O2), and asked for the new part to come **after "How it works"** with a header link so the page scrolls to it (D3, D4). The video is about 42 MB: Asaf chose to **compress it to about 10 MB** with HandBrake (O3). It already has subtitles burned in, so no captions file (O4 closed). **Third round (26.11.2026):** after seeing mock-ups, Asaf chose to put the four rules **in the last step, right above the consent checkbox**, on every screen size, and to **remove the list from the desktop side panel** (it keeps the scene and the heading). He approved the matching MILESTONES M10 wording ("what to build" and the DoD item), already updated (O5 closed).

**Goal:**
1. **Booking wording:** the word "Registration" disappears from the public site; both landing buttons say "Book your escort".
2. **Landing page:** a new "About Sereno" part (who is behind the service) and a fuller description of the service, written in English in the site's tone **only from the facts Asaf gives**, and his video — on phone and desktop, with the page loading as fast as before.
3. **Booking rules in the form:** the four points of the side panel ("Departures only.", "Every booking is subject to manager approval.", "Suggestions shown are recommendations only.", "We email you the decision.") show in the last step, right above the consent checkbox, on every screen size (the desktop side panel no longer lists them); before "Submit request" the customer must tick "I understand my booking is subject to manager approval."; the server refuses an order without it.
4. **No database change, no email change, no n8n change, no new key.**

---

## 0. Decisions this plan proposes

| # | Topic | Proposal | Why |
|---|---|---|---|
| D1 | The button text | Both landing buttons (header bar and hero) say **"Book your escort"** (the hero one keeps its arrow). No other text on the site says "Registration" (checked by a search of `public/`, §6.2). The DESIGN screen name "הזמנה / רישום לקוח" is Hebrew documentation, not site text, and stays. | Asaf, 26.11.2026. It matches the form's "Book your escort in four short steps." The images' "Book escort" was the original intent. |
| D2 | The header button on small phones | "Book your escort" is shorter than "Start Your Registration", so the header bar keeps its current rules (`white-space: nowrap`, smaller padding under 480px). Checked at 320px and 375px for overlap with the "Sereno" name. | DoD: no broken or cut text. |
| D3 | Landing page order (top to bottom) | Hero (unchanged except D1) → "How it works" → **"About Sereno"** (new: the text of O2 and the video beside it on desktop, under it on phones) → "Escort options" → the approval note → footer. The headings' exact words come with the approved text (O2). | Asaf, 26.11.2026: the new part comes after "How it works", and the page scrolls to it from a header link. |
| D4 | Header links | The hero's desktop links grow from two to three, in page order: "How it works", **"About"** (to "About Sereno"), "Escort options". Same style and smooth scroll as today. On phones the links stay hidden (as today). | The new part should be reachable like the others. Small, same pattern. |
| D5 | Content rule | Asaf asked me to write the text (26.11.2026). It uses **only facts already in the specs** (PRD, `product-10-definitions.md`): departures only, a personal escort, full or partial escort, porter and wheelchair, the four-step online booking without an account, the flight chosen from the schedule, a suggested meeting time, every booking reviewed by a manager, the decision by email, the escort getting all the details. No company history, people, years, numbers, places or promises are added; Asaf adds those himself if he wants. The draft is shown in the chat first (O2) and goes into the page only as he approves it. Nothing about prices (PRD §7). | MILESTONES M10 (no invented facts), Asaf 26.11.2026. |
| D6 | The video file | A file in the project: `public/assets/sereno-video.mp4` (H.264 + AAC mp4, plays in every browser). Target: **10 MB or less** (a short clip, about 30–60 seconds, 720p). If Asaf's file is bigger, **he** compresses it with the free HandBrake app (I give him plain steps; there is no video tool on this computer and I do not install one without asking), or he chooses YouTube after all (O3). Hard limits: GitHub refuses files over 100 MB and warns from 50 MB; the file goes into the repo with the push. | Asaf chose "a file on my computer". The site is served from Vercel's CDN, so a small file is fine; a big one makes the repo heavy and the video slow on phones. |
| D7 | Loading speed | `<video controls playsinline preload="none" poster="/assets/scene.svg">`: **nothing of the video is downloaded until the visitor presses play**, so the first load of the page stays as it is today (the poster is the 8 KB sunset scene the page already loads — one file, ADR-25). No autoplay, no sound until the visitor chooses. `width`/`height` (or `aspect-ratio`) set so the page does not jump. Text under / beside it says what the video is (from Asaf). | DoD: "the page loads as fast as before". Autoplay with sound is blocked by browsers and is unpleasant; autoplay without sound would download the whole file on every visit. |
| D8 | Video accessibility | The `<video>` gets an `aria-label` with a short description. The video already has subtitles in the picture (Asaf, 26.11.2026), so no separate captions file. | PRD §3 basic accessibility, DESIGN "meaningful alt text". |
| D9 | The four rules above the checkbox | In step 4, after "Review" and right above the consent checkbox (D10): a compact panel (Style Guide panel, dark look of ADR-25) with the four rules and the same gold dash bullets the side panel uses today: "Departures only." · "Every booking is subject to manager approval." · "Suggestions shown are recommendations only." · "We email you the decision.". The panel and the checkbox sit together as one block, so the customer reads the rules and ticks right after. Shown on **every** screen size. Step 1 does not change. The desktop side panel **drops its list** and keeps "VIP departure escort" and "Book your escort in four short steps." over the scene. The wording of the rules is not changed. | Asaf, 26.11.2026 (MILESTONES M10 updated with his approval). Today on phones nobody sees these rules before sending; next to the checkbox they explain what he is agreeing to. |
| D10 | The consent checkbox | In step 4, right under the rules panel (D9) and before the buttons: one Style Guide checkbox (gold when ticked in the dark look), label **"I understand my booking is subject to manager approval."**, not ticked at start. "Submit request" with it unticked: the box gets the field error state and the message **"Please confirm to send your request."** under it, focus moves to the box, nothing is sent. Ticking it clears the error. "Back" / "Edit" keep its state (same page, ADR of M2: Back never loses data); after a successful send the form resets it. | MILESTONES M10. Same error pattern as the other fields (DESIGN "error messages in the form"). |
| D11 | Server rule | `validateOrderBody` requires a new field **`approval_ack`** that must be exactly `true` (the JSON value, not the text "true"); anything else → `400 bad_request` "Please confirm that your booking is subject to manager approval.". The check runs in the usual validation step (after the honeypot, before the rate limits), so the honeypot path is unchanged. The value is **not stored**: every saved order has passed it, so a column would always say "yes". | MILESTONES M10 DoD ("impossible to send without ticking — on the server too"). Not storing it means no migration on the one shared database (the live site uses it). |
| D12 | Live site during the change | Static files and functions deploy together on the push, so the new page and the new rule go live at the same moment. A visitor who opened the old form before the deploy and sends after it gets the 400 message shown above the buttons and his data stays; a reload shows the box. Friends testing now are told after the push. | One shared database and a live site with testers (background). |
| D13 | What stays | The hero text, "How it works", "Escort options", the note box, the step-2..4 fields, the review, the "Request received" screen, the emails (FR-43 and the decision emails), n8n, the staff screens. | Keep M10 to what MILESTONES lists. |

---

## 1. Files

### New
- `public/assets/sereno-video.mp4` (Asaf's file, after O3; ≤ 10 MB target).
- `tests/order-consent.test.js`: the `approval_ack` rule (§5).

### Changed
- `public/index.html`: the two button texts (D1), the "About" link (D4), the "About Sereno" part with the video (D3, D5–D8).
- `public/css/landing.css`: the new parts (text, video frame with a fixed ratio, two columns on desktop, one on phones), within the existing tokens.
- `public/order.html`: in step 4 the rules panel and the checkbox (D9, D10); the side panel without its list (D9).
- `public/js/order-form.js`: the checkbox in step-4 validation (D10), `approval_ack: true` in the payload, the reset after success.
- `public/css/theme.css` (and `base.css` only if needed): the rules panel and the checkbox in step 4 in the dark look; the checkbox error state.
- `lib/validate.js`: `approval_ack` in `validateOrderBody` (D11).
- `tests/manual-flight.test.js`: its valid sample body gets `approval_ack: true` (no other change).
- `spec/PRD.md`, `spec/DESIGN.md`, `spec/ARCHITECTURE.md`: **only** the wording of O1, and only after Asaf approves it.
- `spec/ARCHITECTURE.md`: new ADRs (end of build). `spec/MILESTONES.md`: 🟡 and checked DoD items (end of build). `CLAUDE.md`: no change expected.

### Not changed
- `api/submit-order.js` (it already returns the validation error as `400`; only `lib/validate.js` changes), `api/*` others, `lib/notify.js`, `lib/ai.js`, `lib/prompts.js`, `n8n/sereno-notifications.json`, `supabase/*` (no migration, no seed change), `public/staff/*`, `public/js/` other than `order-form.js`, `vercel.json`, `.env.example`.

---

## 2. Server

### 2.1 `lib/validate.js` — `validateOrderBody`
- Read `approval_ack` from the body. After the existing checks (so earlier messages keep their order), `if (approval_ack !== true) return { error: 'Please confirm that your booking is subject to manager approval.' };`.
- The returned `value` does not include it (it is not stored, D11).

### 2.2 `api/submit-order.js`
No code change: step 2 already sends any validation error as `400 bad_request` with its message, and the page shows it above the buttons. The honeypot (step 1) still answers success before validation.

### 2.3 Errors
One new message: "Please confirm that your booking is subject to manager approval." (`400`). Everything else keeps the M2–M9 answers.

---

## 3. Browser

### 3.1 Landing (`index.html`, `landing.css`)
- Buttons: `Start Your Registration` → `Book your escort` (both).
- Header nav: `<a href="#about-heading">About</a>` before "How it works".
- After "How it works": `<section class="landing__section landing__about" aria-labelledby="about-heading">` with `<h2 class="h3" id="about-heading">About Sereno</h2>`, the approved paragraphs and the "What's included" list (O2), and beside them (desktop) / under them (phone) `<video class="landing__video-player" controls playsinline preload="none" poster="/assets/scene.svg" aria-label="…">`, `<source src="/assets/sereno-video.mp4" type="video/mp4">`, and a fallback line inside the element ("Your browser cannot play this video.").
- CSS: the video full width of its column, `aspect-ratio` of the real file (16 / 9 or 9 / 16 for a phone-shot video — set from the file), 2px corners (Style Guide: photos 0–2px), a thin rule like the panels; same section spacing and `scroll-margin-top` as the others.

### 3.2 Side panel (`order.html`, `theme.css`)
- Remove `<ul class="split__points">` from the form's side panel only. The `.split__points` styles stay in `theme.css`: the staff sign-in page (`public/staff/login.html`) still uses them.

### 3.3 Form step 4 (`order.html`, `order-form.js`)
- After the review section, before the anti-bot field and `.form-shell__footer`: `<div class="consent stack">` with `<ul class="booking-rules panel" aria-label="Booking rules">` (the four `<li>`, styled like today's `.split__points`: gold dash, soft text, small size) and `<div class="field" id="field-ack"><label class="check"><input class="check__input" type="checkbox" id="approval-ack" aria-describedby="ack-error"> I understand my booking is subject to manager approval.</label><p class="field__error" id="ack-error" hidden></p></div></div>`. The checkbox gets `aria-describedby` pointing at the rules list too, so a screen reader reads them with it.
- `STEP_FIELDS[4]` gets `['field-ack', 'ack-error', () => [$('approval-ack')]]`; `validateStep(4)` adds: not checked → `showFieldError(…, 'Please confirm to send your request.')`, focus on the box (after the contact fields, so the first wrong field still gets focus first).
- A `change` listener clears the error when ticked.
- Payload: `approval_ack: $('approval-ack').checked` (the server decides; a page bug can never send an order without it).
- `form.reset()` after success already unticks it.

---

## 4. n8n
No change.

---

## 5. Tests (`node --test`)
- `validateOrderBody`: a full valid body with `approval_ack: true` → ok, and the value has no `approval_ack`; missing → the new error; `false`, `"true"`, `1`, `null` → the new error; a body that is wrong in another field and lacks the ack → the other field's error first (message order kept).
- `tests/manual-flight.test.js`: the sample body gets `approval_ack: true`; its tests stay as they are.
- The existing 148 tests stay green.

---

## 6. How the build is verified (before marking 🟡)

### 6.1 Asaf's part (plain-Hebrew instructions at the matching build step)
1. Send the "about us" and service facts in the chat (O2), and approve the English text I write from them.
2. Put the video file in a folder I can read (for example the project folder) and tell me its name; if it is over 10 MB, compress it with HandBrake first (steps given then), or choose YouTube (O3).

### 6.2 Checks (local run, port 3000, browser pane)
- **Baseline first (before any change):** load `/` with an empty cache and write down the number of requests and the bytes transferred (network view); the same after the build. The DoD passes when the first load is the same within a few KB (the video file must not appear in the requests until play is pressed).
- **"Registration":** a search of `public/` for "registration" (any case) finds nothing; both buttons read "Book your escort" and open `/order.html`.
- **Landing at 375px and 1280px:** "About Sereno" shows the approved text; the video shows the poster, plays with sound on press, has controls, no sideways scroll, no cut text; the "About" link scrolls to its part on desktop; dark hero unchanged.
- **Step 4 look at 375px and 1280px:** the four rules show right above the checkbox, the block fits without sideways scroll; step 1 is unchanged; the desktop side panel shows only the eyebrow and heading over the scene; the sign-in page panel is unchanged.
- **Step 4:** "Submit request" unticked → the error under the box, focus on it, no request in the network view; tick → error gone; Back to step 2 and forward again → still ticked; send → "Request received"; "Back to home" and a new order → unticked.
- **Server:** a hand-made request from the browser console to `/api/submit-order` with a valid body but no `approval_ack` (and with `"true"` as text) → `400` with the new message, no order saved (the manager's Approvals list does not grow); with `true` → `200`. The `400` requests stop before the rate limit; the `200` ones use a test email Asaf names that is allowlisted in n8n, at most 3 per hour.
- **Regression:** a full order with a list flight and one with a typed flight still work end to end (Approvals shows them, the "request received" email arrives at the allowlisted address).
- **Unit tests:** all green.

---

## 7. Open points (need Asaf's answer)

| # | Question | Options | Recommendation |
|---|---|---|---|
| O1 | The PRD, DESIGN and ARCHITECTURE wording below (MILESTONES M10: "PRD and DESIGN are updated per what Asaf approves in planning"). | (a) approve as written; (b) approve with changes Asaf names. | (a). |
| O2 | **The "About Sereno" text** (Asaf, 26.11.2026: "write it yourself, I'll change what's needed"). | (a) approve the draft below; (b) approve with his changes (for example facts about the people behind Sereno, which the specs do not have). | (a) or (b). Nothing goes into the page before his approval. |
| O3 | **The video file** (about 42 MB on Asaf's computer). | **Decided (26.11.2026): compress to about 10 MB with HandBrake** (I give the steps at build step 2), then Asaf puts the file in the project folder. Still needed: the file's name. | – |
| O4 | Captions. | **Closed (26.11.2026):** the video already has subtitles in the picture; no captions file. | – |
| O5 | Where the four rules sit. | **Closed (26.11.2026):** in the last step above the checkbox, on every screen size; removed from the desktop side panel (D9). | – |

### O2 — draft "About Sereno" text (facts from the specs, and the fourth paragraph from Asaf's own words, 26.11.2026; Asaf edits)

**About Sereno**

Sereno is a VIP escort service for departing passengers. A personal escort meets you at the airport at your meeting time and stays with you on the way to your flight: through security, or all the way to the gate. The choice is yours.

You book online in four short steps, with no account needed. You choose your flight from our schedule, so your details are right from the start, and we suggest a meeting time based on your departure, the number of travellers and your bags.

Every booking is reviewed by our manager before it is confirmed. Once it is approved, we email you the decision and your meeting time, and your escort receives everything needed to look after you: your flight, your party, your bags and any extra help you asked for.

We want your holiday to begin well before take-off. Our aim is a complete VIP experience and a calm, positive start to your trip, before you even leave the country. Knowing that someone is looking after you, and that you will reach your flight as quickly and comfortably as possible, gives you peace of mind. That is what everything we do is built around.

**What's included**
- A personal escort for your departure
- Full escort to the gate, or partial escort through security
- Porter and luggage help, on request
- A wheelchair, on request
- A meeting time set around your flight, confirmed by email

### O1 — proposed wording changes (Hebrew, as the documents are written; shown with the answers Asaf already gave)

**`spec/PRD.md`**
- §3, the five screens, row 1, "תיאור": From `נקודת הכניסה. מציג את הערך של Sereno (איכות, מהירות, נוחות), איך התהליך עובד ואת שתי אפשרויות הליווי, ומוביל לטופס.` To `נקודת הכניסה. מציג את הערך של Sereno (איכות, מהירות, נוחות), איך התהליך עובד, מי אנחנו ומה השירות כולל עם סרטון ואת שתי אפשרויות הליווי, ומוביל לטופס בכפתור "Book your escort" (Milestone 10).` (the rest of the cell unchanged)
- §3, the four-step form, step 4: at the end add `לפני השליחה מוצגים ארבעת כללי ההזמנה (יציאות בלבד, כל הזמנה כפופה לאישור מנהל, ההצעות הן המלצה בלבד, וההחלטה נשלחת במייל), ומתחתם הלקוח מסמן "I understand my booking is subject to manager approval." בלי הסימון ההזמנה לא נשלחת (FR-44).`
- FR-10: From `| FR-10 | דף נחיתה ציבורי עם הכפתור שמוביל לטופס. ללא מחירים | 1 | Should |` To `| FR-10 | דף נחיתה ציבורי עם הכפתור "Book your escort" שמוביל לטופס, חלק "About Sereno" על השירות ועל מי שעומד מאחוריו (התוכן מאסף), וסרטון. ללא מחירים | 1 | Should |`
- New row after FR-10: `| FR-44 | לפני שליחת ההזמנה הלקוח מסמן שהוא מבין שההזמנה כפופה לאישור מנהל. השרת דוחה הזמנה בלי הסימון (Milestone 10, החלטה של אסף, 26.11.2026) | 2 | Should |`

**`spec/DESIGN.md`**
- Screen 1, "מה יש במסך", the header bullet: `וכפתור זהב "Start Your Registration".` → `וכפתור זהב "Book your escort".`; and `קישורים "How it works" ו-"Escort options"` → `קישורים "How it works", "About" ו-"Escort options"`.
- Screen 1, the hero-text bullet: `כפתור זהב "Start Your Registration" עם חץ` → `כפתור זהב "Book your escort" עם חץ`.
- Screen 1, after the "How it works" bullet, add: `- "About Sereno" (Milestone 10): כמה פסקאות קצרות על השירות ועל מי שעומד מאחוריו, בניסוח לפי העובדות של אסף. - סרטון (Milestone 10): נגן עם כפתורי שליטה ותמונת פתיחה (סצנת השקיעה), שנטען רק כשלוחצים Play. בדסקטופ ליד הטקסט, בטלפון מתחתיו.`
- Screen 1, "מה קורה במסך": `לחיצה על "Start Your Registration"` → `לחיצה על "Book your escort"`; add `"About" יורד לחלק "About Sereno".`
- Screen 2, step 4, "מה יש": after the Review sentence add `אחרי הסקירה, פאנל קצר עם ארבעת כללי ההזמנה: "Departures only.", "Every booking is subject to manager approval.", "Suggestions shown are recommendations only.", "We email you the decision.", וממש מתחתיו תיבת סימון "I understand my booking is subject to manager approval." (לא מסומנת בהתחלה).`; "מה קורה": add `"Submit request" בלי הסימון מציג מתחת לתיבה "Please confirm to send your request." ולא שולח.`
- The dark "website" section, the sunset-panel bullet: From `וטקסט קצר: בטופס "Book your escort in four short steps." וארבע נקודות (יציאות בלבד, אישור מנהל, הצעות בלבד, ההחלטה במייל); בדף הכניסה "Welcome back to Sereno.". בטלפון הפאנל לא מוצג בטופס,` To `וטקסט קצר: בטופס "Book your escort in four short steps." (ארבע הנקודות עברו לשלב האחרון של הטופס, מעל תיבת הסימון, Milestone 10); בדף הכניסה "Welcome back to Sereno.". בטלפון הפאנל לא מוצג בטופס,`
- "What is not shown in the images", add a bullet: `- **דף הנחיתה והטופס (Milestone 10, החלטה של אסף, 26.11.2026):** החלקים "About Sereno" והסרטון, פאנל הכללים ותיבת הסימון בשלב 4 נבנים לפי ה-Style Guide באותו קו עיצובי (פאנל עם נקודות בקו זהב, תיבת סימון זהב במראה הכהה, נגן וידאו בפינות של 2px).`

**`spec/ARCHITECTURE.md`**
- §5.1 `POST /api/submit-order`, the body example: add `"approval_ack": true` after `"notes": ""`; under it add: `\`approval_ack\` חייב להיות \`true\` (Milestone 10, FR-44). הוא לא נשמר.`
- §5.1, "ולידציה": add at the end `, ו-\`approval_ack = true\``.
- The FR mapping table: the FR-01 to FR-10 row also lists FR-44.

**Not changed:** MILESTONES (already describes M10), the images, the emails and staff parts of DESIGN.

No part of the spec M10 needs is a placeholder. Conflicts settled by `CLAUDE.md` (no question needed): the images say "Book escort", DESIGN says "Start Your Registration" — the code and DESIGN follow Asaf's later decision recorded in MILESTONES M10, and the chosen text is Asaf's answer. DESIGN "the side panel lists the four points" vs MILESTONES M10 "the points show in the last step above the checkbox" — MILESTONES records Asaf's newer decision and asks for this DESIGN update (O1).

---

## 8. Definition of Done mapping

| DoD item (MILESTONES M10) | How it is met | Checked in |
|---|---|---|
| The word Registration no longer appears on the public site | D1 | §6.2 "Registration" |
| The landing page shows the new content and the video, on phone and desktop, and loads as fast as before | D3–D8, O2–O4 | §6.2 Baseline, Landing |
| The four rules appear in the last step above the checkbox, also on phones, and an order cannot be sent without ticking the consent (server too) | D9–D12 | §6.2 Step 4 look, Step 4, Server + unit tests |
| The existing tests pass | §5 | unit tests, §6.2 Regression |

### 8.1 DoD result (26.11.2026, local run)

| DoD item | Result |
|---|---|
| The word Registration no longer appears on the public site | Pass. A search of `public/` finds no "registration"; both buttons read "Book your escort" and open `/order.html`. |
| The landing page shows the new content and the video, on phone and desktop, and loads as fast as before | Text: pass at 375px and 1280px (no sideways scroll; desktop: How it works and Escort options side by side, "About Sereno" full width under them, text beside the player; phone: text, list, then the player). Load: before 6 files, about 95 KB; after the same 6 files plus no new one (`index.html` 3.9 → 6.5 KB, `landing.css` 6.7 → 8.1 KB), and no `.mp4` request before play. The video (2.9 MB) plays at 1280px and 375px, the frame matches its 3 / 2 shape, and it is still not requested before play. |
| The four rules appear in the last step above the checkbox, also on phones, and an order cannot be sent without ticking the consent (server too) | Pass. 375px and 1280px: the rules panel and the checkbox above the buttons; "Submit request" unticked → "Please confirm to send your request.", focus on the box, no request sent; ticking clears it; Back and Next keep the tick. Server: no `approval_ack` → `400`, `"true"` as text → `400`; ticked form → "Request received" (reference 29CC31BF, test order "M10 Check" with a non-allowlisted example.com email, so no email was sent); after sending the box is unticked. Desktop side panel shows only the eyebrow and heading; the staff sign-in panel still has its list. |
| The existing tests pass | Pass. 151 unit tests (148 before + 3 new; one sample body in `manual-flight.test.js` got `approval_ack: true`). No server errors in the local log. |

**Test data:** one pending order "M10 Check" (29CC31BF) was added to the shared database; reject it or leave it for the next `seed.sql`.

---

## 9. Build steps (one at a time, each with Asaf's go-ahead)

0. **Documents (after O1):** the approved wording in PRD, DESIGN and ARCHITECTURE, nothing else. Record the landing baseline (§6.2) before touching code.
1. **Content:** Asaf sends the facts (O2); I write the English text and he approves it word for word.
2. **Landing:** the button text, the "About" link, the new parts, the video (Asaf compresses the file with HandBrake first, O3); check at 375px and 1280px and the load size.
3. **Rules and consent in step 4:** the rules panel and the checkbox with its message, the side panel without its list, `approval_ack` in the payload, the server rule and the unit tests.
4. **End-to-end and DoD pass:** §6.2; results written under §8 as "DoD result".
5. **Close:** ADRs (the video as a self-hosted file loaded on press; the consent checked on the server and not stored; where the booking rules live), 🟡 and checked items in MILESTONES, shut down the local run. No commit.
