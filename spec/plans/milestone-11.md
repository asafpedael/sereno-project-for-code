# Milestone 11 — Meeting point and wheelchairs (plan)

**Source:** `spec/MILESTONES.md` (Milestone 11, the overview table, "How the document is built" — M10–M14 were added on 26.11.2026 as improvements before real people use the site; their wording, content and design choices are set in each one's planning with Asaf — and the dependencies: M13 depends on M11, because the order lookup page will show the meeting point), PRD §3 (form step 2), FR-08, FR-19, FR-26, FR-31, FR-33/34 (archive), §7 (AI may only suggest porter / wheelchair), DESIGN screen 2 step 2 ("Optional services"), step 4 (Review), screen 3 (manager order details: "Services · Escort"), screen 4 (field agent card: "Services"), screen 5 (archive panel), "Emails" (rows of label and value), "What is not shown in the images", the dark "website" look (ADR-25), the three images (the form's step 2 frame shows two checkboxes; the agent card frame shows "Services: Porter"; the Style Guide's data card shows "Meet at 18:35, Terminal 3"; no frame shows a wheelchair quantity or a meeting point, so they are built in the same design line), ARCHITECTURE §2 (`orders.services`, the `insert_order_with_limits` function, the seed rules), §5.1 (`GET /api/config` lists, `POST /api/submit-order` body and validation, `GET /api/orders` views), §5.2 (the email payload), §5.3 (n8n), ADR-4 (shared code in `public/js/`), ADR-5 (n8n export holds placeholders), ADR-16 (one email template in n8n), ADR-34 (what the agent sees). The code is the source of truth for what M1–M10 built: `public/order.html`, `public/js/order-form.js`, `agent.js`, `order-details.js`, `manager.js`, `archive.js`, `api/submit-order.js`, `api/order-decision.js`, `api/orders.js`, `api/config.js`, `lib/validate.js`, `lib/notify.js`, `lib/orders-view.js`, `lib/prompts.js`, `data/lists.json`, `n8n/sereno-notifications.json`, `supabase/migrations/001–003`, `tests/` (151 tests, all green on 26.11.2026).

**Status:** written 26.11.2026. **Approved by Asaf (26.11.2026, "Approve the plan")**, including the O4 wording changes (applied at build step 0). Already answered by Asaf in planning (26.11.2026, after seeing a mock-up): the meeting point is **"Departures hall, Terminal 3, before security."** (O1); the quantity is chosen with **a − / + stepper that appears under the "Wheelchair" checkbox once it is ticked** (O3, option A of the mock-up); the meeting point is shown **also in the flight-change email** (D4); the quantity is stored in **a new database column**, with a short SQL file Asaf runs in Supabase before the push (O2). **Build (26.11.2026):** step 0 applied the O4 wording to PRD (§3 step 2, FR-08, FR-26, FR-31), DESIGN (step 2, step 4 review, agent card, "What is not shown") and ARCHITECTURE (orders table, functions note, §4, §5.1, §5.2, FR table). Asaf ran `004_wheelchairs.sql` in the Supabase SQL Editor ("Success") and added the "Meeting point" row to the two n8n Set nodes. Server, form, staff screens, n8n export and `tests/wheelchairs.test.js` done (165 unit tests pass). ADR-40, ADR-41, ADR-42 added. Every DoD item passes (§8.1); MILESTONES M11 marked 🟡. **Asaf checked the local run and approved with the push (26.11.2026, ✅).**

**Goal:**
1. **Meeting point:** one fixed sentence, "Departures hall, Terminal 3, before security.", shown in the customer's approval email, in the flight-change email and on every field agent card. Fixed text from one place in the code, never written by the AI.
2. **Wheelchair quantity:** the customer ticks "Wheelchair" and chooses how many, from 1 up to the number of travellers. Porter stays a plain yes / no. The quantity shows on the manager's screen, the agent card, the archive panel, every email that lists services, and the form's Review. A quantity above the number of travellers is refused (in the page and on the server). Orders saved before M11 show exactly as before.
3. **One database change** (a new optional column and an updated insert function), run by Asaf in the Supabase SQL Editor before the push; the live site keeps working before and after it. **One n8n change** (one email row), made by Asaf by hand in the live workflow. No new key.

---

## 0. Decisions this plan proposes

| # | Topic | Proposal | Why |
|---|---|---|---|
| D1 | Meeting point text | **"Departures hall, Terminal 3, before security."** (English, like the whole site). Stored once, in `data/lists.json` as `"meeting_point"`. The server reads it for the emails; the agent page already receives `lists` from `GET /api/config` and reads it from there. Nothing else in the code holds the sentence. | Asaf, 26.11.2026 (O1). One place to change it later, and M13's lookup page can read the same value. Not from the AI: MILESTONES M11 says fixed text. |
| D2 | Meeting point on the agent card | A new box at the bottom of the card (above "Manager notes" when there are notes), same style as the notes box: label "Meeting point", value the sentence. On every card, also unassigned ones. | MILESTONES M11 ("on the agent's card"). The agent opens one card on the phone; the sentence must be on it. |
| D3 | Meeting point in the approval email | The event gets a new field `meeting_point`. In n8n's "Set customer_approved" a new first row in `rows`: `{ label: "Meeting point", value: $json.body.meeting_point }`, right under the gold meeting-time highlight. The plain-text version follows automatically (the template builds it from the same rows). The template already skips an empty row, so an event without the field still renders as today. | MILESTONES M11. One row, no template change (ADR-16). |
| D4 | Meeting point in the flight-change email | The flight-change event already reuses the approval event (`flightChangeEmailPayload` spreads `approvedEmailPayload`), so it carries `meeting_point` too. In "Set customer_flight_change" the same row is added as the first row. | Asaf, 26.11.2026: the customer sees again where to meet together with the new time. |
| D5 | Where the meeting point does **not** go (M11) | Not in the "request received" email (nothing is confirmed yet), the rejection or clarification emails, the manager alert, the manager screen, the archive or the public form. | Keep M11 to what MILESTONES lists. M13 adds it to the lookup page. |
| D6 | How the quantity is chosen (form step 2) | "Optional services" keeps its two checkboxes. When "Wheelchair" is ticked **and there are 2 or more travellers**, a stepper appears right under it: label **"How many wheelchairs? (1–N)"** (N = the current number of travellers), the same − / + stepper as "Travellers" and "Checked bags", starting at **1**. With 1 traveller no stepper is shown (the quantity is 1). Unticking hides the stepper; ticking again starts at 1. If the customer lowers "Travellers" below the chosen quantity, the quantity drops with it (and the label's N changes); with 1 traveller the stepper hides. A typed value above N or below 1 shows the field error "Choose 1 to N wheelchairs." and "Next" does not move on. | Asaf, 26.11.2026 (O3, option A of the mock-up). Same control the customer already used two lines above; nothing new to learn. |
| D7 | How the quantity is written everywhere | One rule for every screen and email: **1 wheelchair (or an old order with none recorded) → "Wheelchair"**, as today; **2 or more → "Wheelchair × 2"**. With porter: "Porter / luggage help, Wheelchair × 2" (the agent card keeps the full labels, as today). The form's Review uses the same rule. | DoD: "existing orders show as before" — and a single wheelchair also reads as before, so nothing changes for anyone who needs one. "×" is short enough for the agent card on a phone. |
| D8 | One shared formatting helper | New `public/js/services-text.js` with `servicesLabels(codes, wheelchairs, labelMap)` → an array of labels (D7). Used by the server (`lib/notify.js`, `api/submit-order.js` for the manager alert) and the browser (`order-details.js` — manager and archive —, `agent.js`, `order-form.js` Review). Same pattern as `meeting-time.js` (ADR-4). | One rule in one place, so screens and emails never disagree. |
| D9 | Storage | A new column **`orders.wheelchairs`** (integer, may be empty): the quantity when "Wheelchair" was chosen (1–10, never more than `travelers`), empty otherwise. `services` keeps its exact structure (`["porter", "wheelchair"]`), so the AI, the history, the lists and the seed keep working. Old orders keep an empty value and read as "Wheelchair" (D7). | Asaf, 26.11.2026 (O2). The smallest change that keeps every existing reader of `services` as it is. |
| D10 | The migration (one shared database, the live site uses it) | New `supabase/migrations/004_wheelchairs.sql`, written so it can run while the old site is live: (1) `alter table public.orders add column if not exists wheelchairs integer`, with a check `wheelchairs is null or (wheelchairs between 1 and 10 and wheelchairs <= travelers)`; (2) the insert function `insert_order_with_limits` gets one more parameter at the end, `p_wheelchairs integer default null` (the old 15-parameter version is dropped and the new one created in the same script, then the same revoke / grant). The old site calls the function without `p_wheelchairs`, so it keeps saving orders (the column stays empty); the new site sends it. No data is changed or deleted. `002_functions.sql` gets a one-line comment that 004 replaces its insert function. **Order: Asaf runs 004 first (plain steps given at build step 1), then the build is tested locally, then the push.** | Background: one Supabase project, the live site and the friends testing it use it. A new code version calling a function that does not exist yet would break sending; the other order is safe. |
| D11 | Server rule (`lib/validate.js`) | A new body field `wheelchairs`. If "wheelchair" is in `services`: missing or `null` → **1** (a page opened before the deploy sends no quantity); otherwise it must be a whole number from 1 to `travelers` — above `travelers` → `400` **"Wheelchairs cannot be more than the number of travellers."**; below 1 or not a whole number → `400` **"Wheelchairs must be a whole number from 1 to the number of travellers."** If "wheelchair" is **not** in `services`: a quantity sent anyway → `400` **"Wheelchairs need the wheelchair service."** (missing / `null` is fine). The returned value has `wheelchairs` (number or `null`). The check runs right after `services`, so earlier messages keep their order. | MILESTONES M11 DoD: "a quantity above the number of travellers is refused". The page can never send an order the server would save wrongly. |
| D12 | The views and the APIs | `toManagerView` and `toAgentView` (`lib/orders-view.js`) add `wheelchairs` (number or `null`); `ORDER_SELECT` is already `*`, so the column comes with it. `GET /api/config` adds nothing new except that `lists` now carries `meeting_point`. No new endpoint. | ADR-34: the agent gets only what the job needs; a quantity is part of the job. |
| D13 | The emails that list services | `approvedEmailPayload` (and through it the flight-change event) and the manager alert send `services` as labels built with D8, so "Wheelchair × 2" reaches n8n inside the same list — **no n8n change is needed for the quantity**, only for the meeting point (D3, D4). The "request received" email has no services row and stays as it is. | Smallest change: n8n already joins the labels with ", ". |
| D14 | The AI | `buildOrderDraftInput` adds `wheelchairs` (number or `null`) next to `selected_services`, so the approval paragraph never says "a wheelchair" when two were asked for. The prompt's rules do not change (recommend only `porter` / `wheelchair`; the AI never writes the meeting point). The AI does not recommend a quantity. | PRD §7 limits stay; the paragraph must not contradict the order. |
| D15 | Live site during the change | After the migration and before the push: the live site works as today. After the push: static files and functions deploy together. A visitor who opened the old form before the deploy sends no quantity → saved as 1 (D11). Friends testing now are told after the push. | One shared database and a live site with testers. |
| D16 | What stays | Porter (yes / no), the travellers and bags steppers, the meeting-time formula (wheelchairs do not change it), the AI recommendation panel (it still says "Wheelchair"), the archive table columns, the archive statistics, the seed and demo data (no quantity, they read as before), the staff sign-in. | Keep M11 to what MILESTONES lists. |

---

## 1. Files

### New
- `supabase/migrations/004_wheelchairs.sql` (D10).
- `public/js/services-text.js` (D8).
- `tests/wheelchairs.test.js`: the validation rule (D11), the label rule (D7), the views (D12), the email payloads (D3, D13).

### Changed
- `data/lists.json`: `"meeting_point": "Departures hall, Terminal 3, before security."` (D1).
- `supabase/migrations/002_functions.sql`: one comment line only (D10).
- `lib/validate.js`: `wheelchairs` in `validateOrderBody` (D11).
- `api/submit-order.js`: `p_wheelchairs` in the insert call; the manager alert's services labels with D8; `wheelchairs` in the AI input (D14).
- `lib/notify.js`: `meeting_point` in `approvedEmailPayload`; services labels with D8.
- `lib/orders-view.js`: `wheelchairs` in the manager and agent views (D12).
- `lib/prompts.js`: `wheelchairs` in `buildOrderDraftInput` (D14).
- `public/order.html`: the wheelchair stepper under the checkbox (D6).
- `public/js/order-form.js`: show / hide / limit the stepper, step-2 validation, `wheelchairs` in the payload, the Review text (D6, D7).
- `public/css/theme.css` (only if needed): spacing of the stepper under the checkbox in the dark look.
- `public/js/order-details.js` (manager and archive), `public/js/agent.js`, `public/js/archive.js` (its agent-style panel): services text with D8; the agent card's "Meeting point" box (D2).
- `public/css/staff.css` (or the file that holds `.agent-card__notes`): the meeting-point box, reusing the notes box style.
- `n8n/sereno-notifications.json`: the "Meeting point" row in the two Set nodes (placeholders untouched, ADR-5).
- `tests/notify-payload.test.js`, `tests/orders-view.test.js`, `tests/ai.test.js`, `tests/manual-flight.test.js`, `tests/order-consent.test.js`: only where their expected objects gain `meeting_point` / `wheelchairs`.
- `spec/PRD.md`, `spec/DESIGN.md`, `spec/ARCHITECTURE.md`: **only** the wording of O4, and only after Asaf approves it.
- `spec/ARCHITECTURE.md`: new ADRs (end of build). `spec/MILESTONES.md`: 🟡 and checked DoD items (end of build). `CLAUDE.md`: no change expected.

### Not changed
- `api/orders.js`, `api/order-decision.js` (they use the views and payload builders), `api/config.js` (it already returns `lists`), `api/flights.js`, `api/agents.js`, `lib/ai.js`, `public/js/meeting-time.js`, `public/index.html`, `supabase/seed/*`, `vercel.json`, `.env.example`.

---

## 2. Server

### 2.1 `supabase/migrations/004_wheelchairs.sql`
```
alter table public.orders add column if not exists wheelchairs integer;
alter table public.orders add constraint orders_wheelchairs_check
  check (wheelchairs is null or (wheelchairs between 1 and 10 and wheelchairs <= travelers));
drop function if exists public.insert_order_with_limits(<the 15 types of 002>);
create or replace function public.insert_order_with_limits(<same 15 parameters>, p_wheelchairs integer default null) ...
  -- same body as 002, with wheelchairs / p_wheelchairs added to the insert
revoke ... from public, anon, authenticated;  grant ... to service_role;   -- the 16 types
```
Safe to re-run (`if not exists`, the constraint added only if missing, `create or replace`). Runs in one go in the SQL Editor (one transaction), so there is no moment without an insert function.

### 2.2 `lib/validate.js`
After the `services` check: the D11 rule; `value.wheelchairs` is the number or `null`.

### 2.3 `api/submit-order.js`
- Insert: `p_wheelchairs: order.wheelchairs`.
- Manager alert: `services: servicesLabels(order.services, order.wheelchairs, SERVICE_LABELS)`.
- AI: `buildOrderDraftInput` gets `order.wheelchairs` through `order`.

### 2.4 `lib/notify.js`
- `approvedEmailPayload`: `services` with D8; new `meeting_point: lists.meeting_point`. `flightChangeEmailPayload` inherits both.
- The rejection, clarification and "received" payloads do not change.

### 2.5 `lib/orders-view.js`
`wheelchairs: Number.isInteger(row.wheelchairs) ? row.wheelchairs : null` in `toManagerView` and `toAgentView`.

### 2.6 Errors
Three new `400` messages (D11). Everything else keeps the M2–M10 answers.

---

## 3. Browser

### 3.1 Form step 2 (`order.html`, `order-form.js`)
- Under the "Wheelchair" label, inside the "Optional services" fieldset: `<div class="field" id="field-wheelchairs" hidden>` with `<label class="field__label" for="wheelchairs" id="label-wheelchairs">How many wheelchairs? (1–<span id="wheelchairs-max">2</span>)</label>`, a `.stepper` with "Fewer wheelchairs" / "More wheelchairs" buttons and `<input class="stepper__input" id="wheelchairs" type="number" inputmode="numeric" min="1" step="1" value="1">`, and `<p class="field__error" id="wheelchairs-error" hidden>`.
- `LIMITS.wheelchairs` becomes dynamic: `{ min: 1, max: current travellers }`; one function `syncWheelchairs()` runs on the checkbox `change` and on every travellers `input`: shows the field only when ticked and travellers ≥ 2, sets the label's max and the input's `max`, lowers the value when above the max, and updates the − / + buttons (the existing stepper code, generalised for the dynamic max).
- `validateStep(2)`: when the field is shown and the value is not a whole number from 1 to max → `"Choose 1 to N wheelchairs."`, focus on it.
- Payload: `wheelchairs`: the stepper value when "Wheelchair" is ticked (1 when the stepper is hidden because there is one traveller), else `null`.
- Review: the services line uses D8 ("Porter / luggage help, Wheelchair × 2"); "None" stays.
- `form.reset()` after success: unticked, field hidden, value 1.

### 3.2 Manager and archive (`order-details.js`, `archive.js`)
`servicesText(order)` builds from `servicesLabels(order.services, order.wheelchairs, labels.services)`: "Services · Escort" in the order details and the archive panel show "Wheelchair × 2". "No extra services" and the archive panel's "–" stay. The AI recommendation line is unchanged.

### 3.3 Field agent (`agent.js`, staff CSS)
- "Services": D8.
- The "Meeting point" box (D2) from `config.lists.meeting_point`; if the value is missing (an old cached config), the box is not shown.

---

## 4. n8n (Asaf, by hand, in the live workflow; the repo export gets the same change)
1. "Set customer_approved" → field `rows` → add as the **first** line inside the list: `{ label: "Meeting point", value: $json.body.meeting_point },`
2. "Set customer_flight_change" → field `rows` → the same first line.
3. Save. Nothing else changes: the quantity arrives inside the existing "Services" text.

Plain-Hebrew steps with screenshots-level detail are given at build step 5. Until Asaf saves it, the emails simply have no meeting-point row (the field is ignored), so the order of push and n8n edit does not matter.

---

## 5. Tests (`node --test`)
- `validateOrderBody`: wheelchair with no quantity → 1; with 2 of 3 travellers → 2; 4 of 3 → the "cannot be more" error; 0, 1.5, `"2"` → the "whole number" error; a quantity without the wheelchair service → its error; no wheelchair and no quantity → `null`; porter only → `null`.
- `servicesLabels`: `[]` → `[]`; `["wheelchair"]` with `null` and with 1 → `["Wheelchair"]`; with 2 → `["Wheelchair × 2"]`; `["porter","wheelchair"]` with 3 → `["Porter / luggage help", "Wheelchair × 3"]`; an unknown code keeps its code (as today).
- Views: `wheelchairs` passes through, `null` for an old row.
- Payloads: the approval and flight-change events carry `meeting_point` and the "× 2" label; rejection / clarification / received do not carry `meeting_point`; still no manager notes.
- AI input carries `wheelchairs`.
- The existing 151 tests stay green (only expected objects that now include the new fields are updated).

---

## 6. How the build is verified (before marking 🟡)

### 6.1 Asaf's part (plain-Hebrew instructions at the matching build step)
1. Run `004_wheelchairs.sql` in the Supabase SQL Editor and tell me it said "Success" (build step 1).
2. Add the "Meeting point" row in the two n8n Set nodes (build step 5).
3. Name a test email that is allowlisted in n8n for the end-to-end check.

### 6.2 Checks (local run, port 3000, browser pane)
- **After the migration, before any code change:** the live site still accepts an order (one test order through `https://sereno-olive-mu.vercel.app` with the allowlisted email, or skipped if Asaf prefers) — proves D10.
- **Form at 375px and 1280px:** 1 traveller + Wheelchair → no stepper; 3 travellers + Wheelchair → stepper 1–3, + stops at 3; lower travellers to 2 with 3 chosen → quantity becomes 2; untick → hidden; typed 5 → the error, "Next" blocked; Review shows "Porter / luggage help, Wheelchair × 2"; no sideways scroll, no cut text.
- **Server:** hand-made requests from the browser console: quantity above travellers → `400`; quantity without the service → `400`; wheelchair without quantity → saved as 1.
- **End to end with 2 wheelchairs:** send an order (3 travellers, porter + 2 wheelchairs) → the manager alert email and the order details show "Wheelchair × 2"; approve it → the approval email shows the meeting-point row and "Wheelchair × 2"; the agent card shows "Wheelchair × 2" and the meeting-point box; the archive panel shows "Wheelchair × 2".
- **Flight change:** on a test order, change the flight time (as in M5's checks) and approve the change → the email shows the meeting-point row.
- **Old orders:** a seed order with a wheelchair (for example order 8) shows "Wheelchair" on the manager screen, the archive and (if approved) the agent card, exactly as before.
- **Unit tests:** all green.

---

## 7. Open points

| # | Question | Options | Answer / recommendation |
|---|---|---|---|
| O1 | The meeting-point wording. | (a) "Departures hall, Terminal 3, before security."; (b) without a terminal; (c) Asaf's own sentence. | **Decided (26.11.2026): (a).** |
| O2 | How the quantity is stored on the one shared database. | (a) a new column + a short SQL file Asaf runs before the push; (b) no database change, the quantity written inside the existing services list. | **Decided (26.11.2026): (a)** (D9, D10). |
| O3 | What the quantity control looks like. | (A) a stepper under the checkbox once ticked; (B) a stepper instead of the checkbox, from 0; (C) a checkbox with a small drop-down. | **Decided (26.11.2026): (A)** (D6). |
| O4 | The PRD, DESIGN and ARCHITECTURE wording below (MILESTONES M11: "PRD (FR-08, FR-31) and ARCHITECTURE (the `services` structure) are updated per what Asaf approves"). | (a) approve as written; (b) approve with changes Asaf names. | **Decided (26.11.2026): (a).** |

### O4 — proposed wording changes (Hebrew, as the documents are written)

**`spec/PRD.md`**
- §3, the four-step form, step 2: From `ושירותים נוספים אופציונליים: סבל / עזרה במזוודות וכיסא גלגלים בלבד.` To `ושירותים נוספים אופציונליים: סבל / עזרה במזוודות (כן או לא) וכיסאות גלגלים, בכמות מ-1 ועד מספר הנוסעים (Milestone 11).`
- FR-08: From `| FR-08 | שירותים נוספים אופציונליים: סבל / עזרה במזוודות וכיסא גלגלים בלבד | 5 | Should |` To `| FR-08 | שירותים נוספים אופציונליים: סבל / עזרה במזוודות (כן או לא) וכיסאות גלגלים בלבד. בכיסאות גלגלים הלקוח בוחר כמות, מ-1 ועד מספר הנוסעים, והשרת דוחה כמות גדולה יותר (Milestone 11, החלטה של אסף, 26.11.2026) | 5 | Should |`
- FR-26: in the list of details, `שירותים` → `שירותים (כולל כמות כיסאות גלגלים), נקודת המפגש`.
- FR-31: From `באישור: פרטי ההזמנה ושעת המפגש.` To `באישור: פרטי ההזמנה, שעת המפגש ונקודת המפגש הקבועה ("Departures hall, Terminal 3, before security.", טקסט קבוע ולא של ה-AI, Milestone 11).`

**`spec/DESIGN.md`**
- Screen 2, step 2, "מה יש": after `תיבות סימון "Porter / luggage help" ו-"Wheelchair".` add `כשמסמנים "Wheelchair" ויש 2 נוסעים או יותר, מתחתיה מופיע בוחר מספר "How many wheelchairs? (1–N)" (N הוא מספר הנוסעים), מתחיל ב-1 (Milestone 11).`; "מה קורה": add `הורדת מספר הנוסעים מתחת לכמות הכיסאות מורידה גם אותה.`
- Screen 2, step 4: Review, the Services row: add `כמה כיסאות: "Wheelchair × 2" (כיסא אחד: "Wheelchair").`
- Screen 4 (field agent), "מה יש במסך": after `ובתיבה נפרדת "Manager notes" כשיש הערות.` add `תיבה "Meeting point" עם נקודת המפגש הקבועה, בכל כרטיס (Milestone 11).`
- "What is not shown in the images", add a bullet: `- **כמות כיסאות גלגלים ונקודת מפגש (Milestone 11, החלטה של אסף, 26.11.2026):** בכל המסכים ובמיילים, 2 כיסאות ומעלה מוצגים "Wheelchair × 2", וכיסא אחד או הזמנה ישנה "Wheelchair". נקודת המפגש מופיעה כשורה ראשונה מתחת לשעת המפגש במייל האישור ובמייל שינוי הטיסה, ובכרטיס הנציג בתיבה בסגנון "Manager notes".`

**`spec/ARCHITECTURE.md`**
- §2, the `orders` table: a new row after `services`: `| \`wheelchairs\` | integer, **יכול להיות ריק**, בין 1 ל-10 ולא יותר מ-\`travelers\` | כמות כיסאות הגלגלים כש-\`wheelchair\` נמצא ב-\`services\`. ריק אחרת, ובהזמנות שלפני Milestone 11 (מוצג כ-"Wheelchair") |`
- §2, the functions: after the Milestone 9 line add `Milestone 11: \`supabase/migrations/004_wheelchairs.sql\` מוסיף את העמודה \`wheelchairs\`, ול-\`insert_order_with_limits\` את \`p_wheelchairs\` (ברירת מחדל ריקה, כך שגרסה קודמת של האתר ממשיכה לעבוד).`
- §5.1 `GET /api/config`: in `lists` add `"meeting_point": "Departures hall, Terminal 3, before security."`.
- §5.1 `POST /api/submit-order`: the body example gets `"wheelchairs": null` after `"services"`; validation adds `, \`wheelchairs\` מספר שלם מ-1 ועד \`travelers\` רק כש-\`wheelchair\` נבחר (חסר = 1)`.
- §5.1 `GET /api/orders`: the list example gets `"wheelchairs": null` after `"services"`.
- §5.2 the webhook body: add `"meeting_point": "Departures hall, Terminal 3, before security."` and change the example to `"services": ["Porter / luggage help", "Wheelchair × 2"]`; under it: `\`meeting_point\` נשלח רק ב-\`customer_approved\` וב-\`customer_flight_change\`. ב-\`services\` כמות של 2 ומעלה נכתבת "Wheelchair × N".`
- §4 (AI input example): `"wheelchairs": null` after `"selected_services"`.
- §8 the FR table: FR-31 also lists `data/lists.json` (`meeting_point`).

**Not changed:** MILESTONES (already describes M11), the images, the landing page parts of PRD / DESIGN.

No part of the spec M11 needs is a placeholder. No conflict between documents: the images show one "Wheelchair" checkbox and no meeting point, and MILESTONES M11 records Asaf's newer decision and asks for the PRD / ARCHITECTURE update (O4).

---

## 8. Definition of Done mapping

| DoD item (MILESTONES M11) | How it is met | Checked in |
|---|---|---|
| The approval email and the agent card show the meeting point | D1–D4, §4 | §6.2 End to end, Flight change + unit tests |
| An order with 2 wheelchairs is saved and shown correctly on every screen and in the emails; a quantity above the number of travellers is refused | D6–D13 | §6.2 Form, Server, End to end + unit tests |
| Existing orders (without a quantity) show as before | D7, D9, D12 | §6.2 Old orders + unit tests |
| The existing tests pass | §5 | unit tests |

### 8.1 DoD result (26.11.2026, local run)

| DoD item | Result |
|---|---|
| The approval email and the agent card show the meeting point | Pass. Order 08533047 (Asaf's allowlisted address) approved; Asaf confirmed the email shows "Meeting point: Departures hall, Terminal 3, before security." under the meeting time. Agent screen at 375px: all 9 cards show the "Meeting point" box above "Manager notes", no sideways scroll. The flight-change email carries the same field (unit test; not sent live, no flight time was changed). |
| An order with 2 wheelchairs is saved and shown correctly on every screen and in the emails; a quantity above the number of travellers is refused | Pass. Form (1280px and 375px): no stepper with 1 traveller; with 3 the stepper stops at 3; fewer travellers lower the quantity; 5 typed shows "Choose 1 to 2 wheelchairs." and blocks Next; Review "Porter / luggage help, Wheelchair × 2"; reset after sending. Orders 52EA7D52 and 08533047: manager details, archive panel, agent card and the approval email show "Porter / luggage help, Wheelchair × 2". Server: 4 wheelchairs for 3 travellers → 400; a quantity without the service → 400; a wheelchair without a quantity → saved (49A66ED4, as 1). |
| Existing orders (without a quantity) show as before | Pass. Seed orders 00000008 and 00000012 show "Wheelchair" / "Porter / luggage help, Wheelchair" in the archive, and 00000012 shows the same on the agent card. |
| The existing tests pass | Pass. 165 unit tests (151 before + 14 new; expected objects in `ai.test.js`, `notify-payload.test.js`, `orders-view.test.js` gained the new fields). No server errors in the local log. |

**Test data:** pending orders "M11 Check" (49A66ED4); approved orders "M11 Two Chairs" (52EA7D52) and "M11 Email Check" (08533047). Reject / complete them, or leave them for the next `seed.sql`.

---

## 9. Build steps (one at a time, each with Asaf's go-ahead)

0. **Documents (after O4):** the approved wording in PRD, DESIGN and ARCHITECTURE, nothing else.
1. **Database:** write `004_wheelchairs.sql`; Asaf runs it in the Supabase SQL Editor (plain steps); check the live site still accepts an order.
2. **Server:** `data/lists.json`, `services-text.js`, validation, insert, views, payloads, AI input, unit tests.
3. **Form:** the stepper under the checkbox, its limits and messages, the payload and the Review; check at 375px and 1280px.
4. **Staff screens:** manager details, archive panel, agent card with "Wheelchair × N" and the meeting-point box.
5. **n8n:** the repo export, and plain steps for Asaf to add the same row in the live workflow.
6. **End-to-end and DoD pass:** §6.2; results written under §8 as "DoD result".
7. **Close:** ADRs (the wheelchair quantity as its own column with a backward-compatible insert function; the meeting point as fixed text in `data/lists.json`; one shared services-label helper), 🟡 and checked items in MILESTONES, shut down the local run. No commit.
