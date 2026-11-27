# Milestone 14 — Order lookup for the customer (plan)

**Source:** `spec/MILESTONES.md` (Milestone 14, the overview table, "How the document is built" — M10–M15 are improvements before real people use the site; wording, content and design are set in each one's planning with Asaf — and the dependencies: M14 builds on M11's fixed meeting point and on M13's "Order number"), PRD §2 (the customer: public site, no sign-in), §3 (screens, "Request received", statuses), FR-07, FR-10, FR-26 (what the field agent sees), FR-31, FR-40 (anti-bot field, rate limits), §4.8, §5 ("three tables", "customers do not sign in"), §7 ("customer sign-in" out of scope), DESIGN ("עיצוב 'אתרי'", Part 2, screen 2 "Request received", ADR-25 dark look), the three images (`sereno-wireframes.png`, `sereno-mockups.png`, `sereno-style-guide.png`: none shows a lookup page; frame 6 and the style guide's "Order SR-1042" data card and status tags are the nearest pieces), ARCHITECTURE §2 ("exactly three tables, the maximum the stack allows"; `orders`, `customers`; the database-function rule), §3 (the anonymous customer may only add an order), §5.1, §7, ADR-7 (limits enforced inside one database function), ADR-37, ADR-40 (a column added without breaking the live site), ADR-41 (meeting point in `data/lists.json`, "M13's lookup page will show it" = this milestone), ADR-42 (`servicesLabels`), ADR-44 (estimated price), ADR-45 ("Order number" is a label; the code keeps `reference`). The code is the source of truth for M1–M13: `public/order.html`, `public/js/order-form.js` (`boardingPass`, `planeIcon`, `passField`), `public/index.html`, `public/css/theme.css`, `landing.css`, `base.css`, `api/submit-order.js`, `lib/validate.js`, `lib/orders-view.js` (`referenceOf`, `flightChangePending`, `clarificationSent`, `wheelchairsOf`), `lib/http.js`, `public/js/order-details.js` (`STATUS_TAGS`), `public/js/time.js`, `data/lists.json`, `supabase/migrations/001`–`005`, `tests/` (184 tests). The mock-up Asaf saw on 27.11.2026: https://claude.ai/artifact/K3BVGQLQKwiMPkhiooikQ8 — **its line "Need to change something? Reply to your confirmation email." is dropped (it promises something the system does not do), and the "Too many attempts" message is replaced by one shared message (D6, Asaf's answer on the three tables).**

**Status:** written 27.11.2026. **Approved by Asaf (27.11.2026, "Approve the plan")**, with the recommendations of O1 (the PRD / ARCHITECTURE / DESIGN wording, applied at build step 0), O2 (the D3 status texts), O3 (details shown also after "Not approved") and O4 (a random pair is not counted). **Build (27.11.2026):** step 0 applied the O1 wording to PRD, ARCHITECTURE and DESIGN. The boarding pass moved to `boarding-pass.js`; `006_order_lookup.sql` written and run by Asaf in Supabase (Success); server, page, landing links and tests done. 195 unit tests pass. ADR-46 and ADR-47 added. Every DoD item passes (§8.1); MILESTONES M14 marked 🟡. The page layout follows the staff sign-in split (scene panel on desktop, form card beside it) instead of a plain centred column. Already answered by Asaf in planning (27.11.2026, after seeing the mock-up):
- **What is shown (option ב):** status, flight, meeting time (after approval), meeting point, **and** travellers, bags, services, escort and the estimated price. Never manager notes, the field agent, the phone, the customer's own notes, the AI text or anything about other customers.
- **Where the page is linked from:** the **landing page only** (not the "Request received" screen, not the emails).
- **Attempt limit:** **5 wrong tries, then 15 minutes.**
- **Order number:** **stays the 8-character code** (A1B2C3D4). Nothing changes in existing orders or emails.
- **Counting wrong tries without a fourth table:** the course stack allows three tables and there are three. Asaf chose to stay inside the stack: the count is kept on the order and on the customer that a wrong try touched, and every "not shown" case uses **one message** (so the page never tells a stranger that an email belongs to a Sereno customer).

**Goal:**
1. A public page, `/check-order.html`, where the customer types the **Order number** and the **email he booked with**. Only when both belong to the same order does he see it, as a boarding-pass card with the status, the flight, the meeting time (only after approval), the meeting point and his own choices.
2. A wrong number, a right number with another email, and a blocked try all show the same message. After 5 wrong tries on the same order number or the same email, that order / email is locked for 15 minutes.
3. Nothing internal leaves the server: the API reads only the columns the page needs and builds the answer from a fixed list of fields.
4. One small database change (a column on two tables and one function), run by Asaf before the push; the live site keeps working before and after it. No n8n change, no new key, no sign-in for customers.

---

## 0. Decisions this plan proposes

| # | Topic | Proposal | Why |
|---|---|---|---|
| D1 | The page | New public page **`public/check-order.html`** (title "Check your order · Sereno"), same dark "website" look and header as `order.html` (brand link to home), one centred column (`--content-narrow`, 560px). Eyebrow "Your booking", heading **"Check your order"**, text "Enter the order number from your confirmation and the email you booked with.", fields **"Order number"** (placeholder `A1B2C3D4`, `autocomplete="off"`, `autocapitalize="characters"`, `maxlength="8"`) and **"Email"** (`type="email"`, `autocomplete="email"`), the hidden anti-bot field `website` (like the form), and the button **"Check order"** with the arrow. `<meta name="robots" content="noindex">`. No sign-in, nothing remembered in the browser. | MILESTONES M14; the mock-up Asaf saw (part 1). |
| D2 | What a match shows (option ב) | The form is replaced by the result: eyebrow **"Order A1B2C3D4"**, a heading per status (D3), the **boarding-pass card** from M13 (`Tel Aviv → destination`, Flight, Date, Departs, Airline; typed flight not found: "To be confirmed", the typed number and date) with the stub showing **"Meeting time"** and the status tag; under it the **"Meeting point"** box (fixed text from `data/lists.json`, D3 says when); then four items: **Travellers · Bags** (`2 · 3`), **Escort** (`Full (to the gate)`), **Services** (`servicesLabels`, "None" when empty), **Estimated price** (`$375`; left out for orders saved before M13). Under it the buttons **"Check another order"** (secondary; clears both fields and shows the form again) and **"Back to home"**. | Asaf, 27.11.2026 (option ב). Reuses the card the customer already saw on "Request received". |
| D3 | Per status (customer wording) | **pending** — heading "Awaiting manager review", tag "Pending", stub "Meeting time · After approval" (no time, not even the system's suggestion), meeting point shown, line "We will email you the decision." **needs_clarification, before the clarification email** — exactly as pending (the customer is never told the flight was not found, as on "Request received" today). **needs_clarification, after the clarification email** (`ai_output.clarification.sent_at`) — heading "Please check your email", tag "Pending", line "We sent you an email asking you to confirm your flight details.", meeting point shown, no time. **approved** — heading "Your escort is confirmed", tag "Approved", the approved meeting time large in gold (`final_time`; with the date in front when it is not on the departure day, like the form), meeting point shown. **approved with a flight change waiting for the manager** (`flightChangePending`) — same, but the stub says "Meeting time · Being updated" and the line "Your flight time has changed. We will email you your updated meeting time." (the card shows the flight's current departure). **rejected** — heading "Not approved", tag "Not approved", line "We're sorry, we could not approve this booking. Please check your email for details.", no time, no meeting point. **completed** — heading "Completed", tag "Completed", line "Thank you for travelling with Sereno.", the meeting time that was used, no meeting point. | MILESTONES: "the meeting time (after approval)". Keeps the AI-transparency rule (PRD §3: never shown as approved before the manager decides) and the M5 flight-change flow (the customer gets the new time by email after the manager decides). |
| D4 | What never leaves the server | The API reads only: `id, status, flight_no_submitted, flight_date_submitted, travelers, bags, services, wheelchairs, escort_scope, estimated_price, final_time, approved_departure_at, ignored_departure_at, ai_output` and the flight's `flight_no, airline, destination, departure_at`. `ai_output` is used only on the server to know whether the clarification email was sent. The answer is built by a new `toCustomerView` from a fixed list of fields (D9) — **no** `manager_notes`, `ai_output`, `customer_notes`, `contact_name`, `contact_phone`, email, `assigned_agent_id`, `recommended_time`, history, internal ids or the order's full id. | MILESTONES DoD 3. Two fences: what is read, and what is sent. |
| D5 | How a match is decided | Server: the number is trimmed and upper-cased and must be exactly 8 characters `0-9 A-F` (the code is the first 8 characters of the order id, ADR-45); the email is checked with the same rule as the form and lower-cased. In the database: an order whose id starts with those 8 characters **and** whose customer's email equals the typed email. A number that matches two orders (very rare) is fine: only the one with that email can match. | Same number Asaf's customers already have (Asaf: keep 8 characters). The email is the "second key" MILESTONES asks for. |
| D6 | Blocking guessing, inside the three tables (Asaf: no new table) | One new column **`lookup_guard jsonb`** (may be empty) on **`orders`** and on **`customers`**: `{ "failures": n, "since": time, "locked_until": time }`. A wrong try adds one failure to **every order the typed number matches** and to **the customer the typed email belongs to** (if any). Failures older than 15 minutes start again from zero. The **5th** failure sets `locked_until = now + 15 minutes`. While the order or the customer is locked, every try with it answers "not found" — **even the right pair**. A right pair that is not locked clears both guards. A try whose number and email both belong to nobody changes nothing (there is nothing to protect and nothing to find). | Asaf, 27.11.2026: 5 tries, 15 minutes, no fourth table. The two real attacks are "I know the number, guess the email" (counted on the order) and "I know the email, guess the number" (counted on the customer); a random pair has 4 billion numbers per email to try. |
| D7 | One message for every "not shown" | Wrong number, right number with another email, right email with another number, and any locked try: HTTP `404 not_found`, message **"We couldn't find an order with these details. Please check the order number and the email you booked with. After 5 tries, please wait 15 minutes before trying again."** Shown in the error box under the fields. A malformed number or email (never reaches the database, not counted) gets the field message "Please enter the 8-character order number." / "Please enter a valid email address." | DoD 1 ("same message as a missing order"). A separate "blocked" message would tell a stranger that the number or the email exists; the message itself explains the wait. |
| D8 | One locked step in the database | New function **`public.lookup_order(p_reference text, p_email text)`** in `supabase/migrations/006_order_lookup.sql`, `plpgsql`, `security invoker`, empty `search_path`, takes `pg_advisory_xact_lock(727002)`, does D5 + D6 in one go and returns one row `(found boolean, order_id uuid)`. Grants like 002: only `service_role`. The server then reads the order by that id with the D4 columns. | ADR-7 pattern: five parallel wrong tries cannot slip past the count. |
| D9 | The API | **`POST /api/order-lookup`**, body `{ "order_number": "A1B2C3D4", "email": "name@example.com", "website": "" }` (POST so the email is never in an address or a log line). Order: (1) anti-bot field filled → the D7 `404`, nothing touched; (2) validation (D5) → `400 bad_request`; (3) `rpc lookup_order`; not found → `404 not_found` (D7); (4) read the order (D4); (5) reply `{ ok: true, data: { order: { reference, status, flight: { flight_no, destination, airline, departure_at } | { flight_no, date, destination: null }, meeting_time, flight_change_pending, meeting_point, travelers, bags, services, escort, estimated_price } } }` where `status` is the customer status `pending` / `check_email` / `approved` / `rejected` / `completed`, `services` and `escort` are the finished labels, `estimated_price` is `"$375"` or `null`, and `meeting_time` / `meeting_point` follow D3 (null when not shown). `Cache-Control: no-store` (already in `withHandler`). | One small function like the others in `api/`. |
| D10 | Link from the landing page (Asaf: landing page only) | `public/index.html`: **"Check your order"** as the last link of the top navigation (desktop, before "Book your escort"), and in the footer under "Sereno" (so phones, where the top navigation is hidden, have it too). Nothing on "Request received" and nothing in the emails. | Asaf, 27.11.2026. |
| D11 | The boarding-pass code is shared | `planeIcon`, `passField` and `boardingPass` move from `order-form.js` to a new **`public/js/boarding-pass.js`**, imported by `order-form.js` and the new `check-order.js`. `boardingPass` gets an optional `tag` (the status tag in the stub). The form looks and behaves exactly as before. | One card in one place (ADR-42 idea). |
| D12 | Migration safe on the live site | `006_order_lookup.sql`: `add column if not exists lookup_guard jsonb` on both tables (nothing else in them changes; decision 17 — customer details are never changed — is about name and phone, not this technical field), the function, its grants. The old site never reads the column. Safe to re-run (`create or replace`). Asaf runs it in the SQL Editor **before the push**. | ADR-40 pattern; one shared database used by the live site. |
| D13 | What stays | The order form and its submit, "Request received", the emails and n8n, the staff screens, the AI, the seed, `vercel.json`, `.env.example`, the 8-character number, the statuses. No customer accounts, passwords or remembered logins. | Keep M14 to what MILESTONES lists. |

---

## 1. Files

### New
- `public/check-order.html` (D1, D2).
- `public/js/check-order.js`: the form, validation, the call, the result per status (D2, D3, D7).
- `public/js/boarding-pass.js` (D11).
- `api/order-lookup.js` (D9).
- `supabase/migrations/006_order_lookup.sql` (D6, D8, D12).
- `tests/order-lookup.test.js` (§5).

### Changed
- `public/js/order-form.js`: imports the card from `boarding-pass.js` instead of defining it (no visible change).
- `public/index.html`: the two "Check your order" links (D10). `public/css/landing.css` only if the footer link needs a style.
- `public/css/theme.css`: the lookup page (form column, result heading, meeting-point box, the four items, the stub tag); dark look, no shadows, 2px card corners, 8px controls.
- `lib/validate.js`: `validateLookupBody` (D5).
- `lib/orders-view.js`: `LOOKUP_SELECT` and `toCustomerView` (D4, D3, D9).
- `spec/PRD.md`, `spec/ARCHITECTURE.md`, `spec/DESIGN.md`: **only** the wording of O1, and only after Asaf approves it.
- `spec/ARCHITECTURE.md`: new ADRs (end of build). `spec/MILESTONES.md`: 🟡 and checked DoD items (end of build). `CLAUDE.md`: no change expected.

### Not changed
- `api/submit-order.js`, `lib/notify.js`, `n8n/sereno-notifications.json`, `public/order.html`, the staff pages, `data/lists.json`, the seed, `vercel.json`, `.env.example`.

---

## 2. Server

### 2.1 `supabase/migrations/006_order_lookup.sql`
```
alter table public.orders    add column if not exists lookup_guard jsonb;
alter table public.customers add column if not exists lookup_guard jsonb;

create or replace function public.lookup_order(p_reference text, p_email text)
returns table (found boolean, order_id uuid)
language plpgsql security invoker set search_path = ''
-- 1. lock 727002
-- 2. v_customer: customers where lower(email) = p_email
--    v_orders:   orders where id::text like lower(p_reference) || '%'   (p_reference is checked by the server)
-- 3. locked(guard) = guard->>'locked_until' is later than clock_timestamp()
--    any locked (the customer, or any of v_orders) -> found = false, nothing counted
-- 4. the order in v_orders whose customer_id = v_customer.id -> clear both guards, found = true, its id
-- 5. otherwise: add one failure to v_customer and to each of v_orders
--    (start from 0 when guard->>'since' is older than 15 minutes; the 5th failure sets locked_until = now + 15 minutes
--     and resets failures), found = false
```
Revoke from `public, anon, authenticated`; grant to `service_role`. The limits (5, 15 minutes) are constants inside the function, written once with a comment.

### 2.2 `lib/validate.js`
`validateLookupBody(body)` → `{ value: { reference, email } }` or `{ error }`: object body; `order_number` string, trimmed, upper-cased, `/^[0-9A-F]{8}$/` else "Please enter the 8-character order number."; `email` with the existing `EMAIL_RE`, lower-cased, ≤ 254 else "Please enter a valid email address.".

### 2.3 `lib/orders-view.js`
- `LOOKUP_SELECT` (D4 columns only).
- `customerStatus(row)`: `pending` → `pending`; `needs_clarification` → `check_email` if `clarificationSent(row)` else `pending`; others unchanged.
- `toCustomerView(row, lists)`: builds exactly the D9 fields; `meeting_time` = `final_time` only for `approved` without `flightChangePending`, and for `completed`; `meeting_point` = `lists.meeting_point` for `pending`, `check_email`, `approved`; `services` via `servicesLabels(row.services, wheelchairsOf(row), SERVICE_LABELS)` (empty → `"None"`); `escort` from `lists.escort_scopes`; `estimated_price` via `formatPrice` or `null`.

### 2.4 `api/order-lookup.js`
`withHandler(['POST'])`; D9 order; the `404` message is one constant used for the anti-bot path and every not-found answer. The rpc error or the read error → the usual `500` (logged, no details to the page).

---

## 3. Browser / CSS

### 3.1 `check-order.html` + `check-order.js`
- Field checks in the page with the same rules and messages as the server (D7), shown under each field; focus moves to the first field with an error.
- The button shows "Checking…" and is disabled while waiting; the `404` message goes in the error box (`role="alert"`); other errors show "Something went wrong. Please try again.".
- The result is built with `el` / `textContent` (`dom.js`), never HTML strings. Heading gets focus when the result appears (`tabindex="-1"`).
- Times with `formatTimeIL` / `formatDateIL` / `isSameDayIL` (`time.js`), always Israel time.
- "Check another order" empties both fields, hides the result and focuses "Order number".

### 3.2 Look
- Card: the M13 `.pass`; the status tag at the right of the stub (`tag-pending` / `tag-approved` / `tag-rejected`, and a plain outline tag for "Completed"), using the dark-theme tag colours that exist.
- Meeting-point box: thin cream rule, label caps "Meeting point", value 15px.
- The four items in a two-column grid that becomes one column under 360px.

### 3.3 Fit (375px and 1280px)
Places to watch: the 8-letter number in the eyebrow and in the field, a long destination next to "Tel Aviv", the stub with "Being updated" and the tag side by side (wraps on phones), the long `Wheelchair × 2, Porter / luggage help` services line, the long 404 message, the footer link on the landing page.

---

## 4. Emails / n8n
None (Asaf chose the landing page only). The emails keep showing the Order number as today.

---

## 5. Tests (`node --test`)
New `tests/order-lookup.test.js`:
- `validateLookupBody`: `" a1b2c3d4 "` → `A1B2C3D4`; 7 or 9 characters, `G`, spaces inside, a number type, a missing field → the number message; a bad email → the email message; email lower-cased.
- `customerStatus`: the five statuses, and `needs_clarification` before / after the clarification email.
- `toCustomerView`: the keys are **exactly** the D9 list (a row full of `manager_notes`, `customer_notes`, `contact_phone`, `ai_output`, `assigned_agent_id`, `recommended_time` gives none of them back, and no value of the answer contains those texts); `meeting_time` only for approved (not with a flight change waiting) and completed; `meeting_point` only for pending / check_email / approved; typed flight shape; `"$375"` and `null` price; services "Wheelchair × 2" and "None".
- `LOOKUP_SELECT` does not mention `manager_notes`, `customer_notes`, `contact_`, `assigned_agent_id` or `email`.
- `006_order_lookup.sql`: adds `lookup_guard` to both tables with `if not exists`, defines `lookup_order` with `security invoker`, empty `search_path`, the advisory lock, the 5 / 15-minute constants, and grants execute only to `service_role`.
- `public/index.html` links to `/check-order.html`; `check-order.html` has the two labelled fields, the hidden `website` field and `noindex`.

Existing 184 tests stay green (the form's card only moved to another file).

---

## 6. How the build is verified (before marking 🟡)

### 6.1 Asaf's part
Before the push: run `006_order_lookup.sql` in the Supabase SQL Editor (plain-Hebrew steps at build step 2, the file opened in the side pane). After the push: one lookup on the live site with an order he made.

### 6.2 Checks (local run, port 3000, browser pane, Development database)
- **Right pair shows the order, per status:** from the seed and fresh orders — a pending order, a typed flight not found (DM999, `needs_clarification`), an approved order, Noa B.'s approved DM404 order (flight change waiting → "Being updated", no time), a rejected and a completed order; each shows the D3 heading, tag, time rule and meeting-point rule, and the four items; an order from before M13 shows no price item. Number typed in small letters and with spaces around it also works.
- **Same message:** a number that does not exist; a right number with another customer's email; a right number with an unknown email; a right email with a wrong number — all show exactly the D7 text and HTTP 404 with the same body (compared in the network panel).
- **Blocking:** on one order, 5 tries with wrong emails → the 6th try **with the right email** shows the D7 message; another order still works; after 15 minutes the right pair works again (or checked on a second order whose guard is not set). Same for 5 wrong numbers with one customer's email. Five wrong tries sent at the same moment (a short script) still lock after 5.
- **Nothing internal:** for an order that has manager notes, customer notes and an assigned agent, the network answer contains none of them, no phone, no email, no full id (`toCustomerView` test plus a look at the real answer).
- **Landing link:** "Check your order" in the top navigation at 1280px and in the footer at 375px; both open the page.
- **Fit:** the form, the error, and every result state at 375px and 1280px: no cut or overflowing text, no sideways scroll; keyboard only (Tab, Enter) works.
- **The order form unchanged:** step 1 card and "Request received" card look as before (the card code moved).
- **Screenshots** of the form, the error and the approved and pending results at both widths, in the build report.
- **Unit tests:** all green.

---

## 7. Open points

| # | Question | Options | Recommendation |
|---|---|---|---|
| O1 | The PRD / ARCHITECTURE / DESIGN wording below (MILESTONES M14: "before planning, PRD §7 and the 'customer does not sign in' line, and ARCHITECTURE §3, are updated per what Asaf approves"). | (a) approve as written; (b) approve with changes Asaf names. | **Decided (27.11.2026): (a).** Applied at build step 0, nothing else. |
| O2 | The heading and line per status (D3), e.g. "Your escort is confirmed", "Please check your email", "Not approved". | (a) as in D3; (b) Asaf's own words. | **Decided (27.11.2026): (a)**; easy to change in the build. |
| O3 | After "Not approved", show the details (travellers, services, price) at all? | (a) yes, the same four items as the other statuses (it is his own booking); (b) only the flight and the message. | **Decided (27.11.2026): (a)** — simpler and nothing private. |
| O4 | A random number with a random email touches no order and no customer, so nothing is counted (D6). | (a) accept it: such a try can find nothing, and with the email needed there are about 4 billion numbers to try per email; (b) a fourth table to count per device (Asaf chose no). | **Decided (27.11.2026): (a)** — decided with Asaf's answer on the three tables; recorded as an ADR consequence. |

### O1 — proposed wording changes (Hebrew, as the documents are written)

**`spec/PRD.md`**
- §2, the users table, the customer row, "מה הוא עושה": add at the end `, ובודק את מצב ההזמנה בדף ציבורי לפי מספר ההזמנה והמייל (Milestone 14)`.
- §2, customer stories, add: `- כלקוח, אני רוצה לבדוק את מצב ההזמנה שלי לפי מספר ההזמנה והמייל שאיתו הזמנתי, כדי לדעת מה קורה איתה בלי לפנות לאף אחד.`
- §3, the heading `### חמשת המסכים` → `### המסכים`, and a new row: `| 6 | בדיקת הזמנה | לקוח | דף ציבורי שבו הלקוח מקליד מספר הזמנה ומייל, ורואה את ההזמנה רק כששניהם שייכים לאותה הזמנה (Milestone 14) |`
- §3, row 1 (landing page): after `ומוביל לטופס בכפתור "Book your escort" (Milestone 10).` add ` יש בו קישור "Check your order" לבדיקת הזמנה (Milestone 14).`
- §3, new subsection after "סטטוסי הזמנה": `### בדיקת הזמנה (Milestone 14, החלטה של אסף, 27.11.2026)` / `הלקוח מקליד את מספר ההזמנה ("Order number", 8 התווים שבמסך הסיום ובמיילים) ואת המייל שאיתו הזמין. רק כששניהם שייכים לאותה הזמנה מוצגים: הסטטוס, הטיסה, שעת המפגש (רק אחרי אישור), מקום המפגש, הנוסעים והמזוודות, השירותים, היקף הליווי והמחיר המשוער. לא מוצגים הערות מנהל, הנציג, הטלפון, הערות הלקוח, טקסט ה-AI או פרטים של הזמנות אחרות. מספר שגוי, מספר נכון עם מייל אחר וניסיון חסום מקבלים אותה הודעה. אחרי 5 ניסיונות שגויים על אותו מספר הזמנה או אותו מייל, הם ננעלים ל-15 דקות. זו לא התחברות: אין חשבון, אין סיסמה ושום דבר לא נשמר בדפדפן. הקישור לדף נמצא בדף הנחיתה.`
- §4.1, new row: `| FR-47 | בדיקת הזמנה ציבורית לפי מספר הזמנה ומייל: ההזמנה מוצגת רק כששניהם מתאימים, עם הסטטוס, הטיסה, שעת המפגש אחרי אישור, מקום המפגש ופרטי ההזמנה שהלקוח בחר, בלי מידע פנימי. אותה הודעה לכל מקרה שבו לא מוצג כלום, ונעילה ל-15 דקות אחרי 5 ניסיונות שגויים (Milestone 14, החלטה של אסף, 27.11.2026) | – | Should |`
- FR-10: after `וסרטון.` add ` וקישור "Check your order" לבדיקת הזמנה (FR-47).`
- §4.8, new rows: `| בדיקת הזמנה: מספר נכון עם מייל אחר, או מספר שלא קיים | אותה הודעה, בלי לחשוף אם המספר או המייל קיימים |` and `| בדיקת הזמנה: 5 ניסיונות שגויים על אותו מספר או אותו מייל | נעילה ל-15 דקות, גם לזוג הנכון, עם אותה הודעה |`
- §4.8, the row `ניסיון של נציג או לקוח לגשת לפעולת מנהל` stays.
- §5, the "התחברות" row: `ללקוחות אין התחברות` → `ללקוחות אין התחברות (בדיקת ההזמנה לפי מספר ומייל, FR-47, אינה התחברות)`.
- §5, the "טבלאות" row stays (still three tables; the attempt count is a column, see ARCHITECTURE).
- §7: `- התחברות של הלקוח.` → `- התחברות של הלקוח: חשבון, סיסמה או כניסה שנשמרת. בדיקת הזמנה לפי מספר הזמנה ומייל (Milestone 14) אינה התחברות.`

**`spec/ARCHITECTURE.md`**
- §2 `customers` and `orders`, a new row in each: `| \`lookup_guard\` | jsonb, **יכול להיות ריק** | מונה ניסיונות שגויים בבדיקת הזמנה (\`failures\`, \`since\`, \`locked_until\`). נכתב רק ב-\`lookup_order\` (Milestone 14). לא מוצג בשום מסך |`
- §2, after the Milestone 11 line under "פונקציות במסד הנתונים": `Milestone 14: \`supabase/migrations/006_order_lookup.sql\` מוסיף את \`lookup_guard\` ל-\`orders\` ול-\`customers\`, ואת \`lookup_order(p_reference, p_email)\`: בנעילה אחת היא מוצאת הזמנה שהמזהה שלה מתחיל ב-8 התווים והמייל של הלקוח שלה שווה למייל שהוקלד, סופרת ניסיון שגוי על ההזמנות ועל הלקוח שהוא נגע בהם, ונועלת ל-15 דקות אחרי 5 שגיאות.`
- §3, the roles table, the customer row: `אנונימי, ללא טוקן` stays; under the table add: `הלקוח לא מתחבר. בדיקת הזמנה (Milestone 14) מזהה הזמנה אחת לפי מספר ההזמנה והמייל יחד, ולא יוצרת טוקן, חשבון או כניסה שנשמרת.`
- §3, the permissions matrix, new row: `| \`POST /api/order-lookup\` | כן: הזמנה אחת, רק כשהמספר והמייל שלה מתאימים, ורק השדות של סעיף 5.1 | כן (כמו לקוח) | כן (כמו לקוח) |`
- §3, "הגנה על הנתונים": `הלקוח האנונימי יכול רק להוסיף הזמנה דרך \`api/submit-order\`, ולא לקרוא הזמנות.` → `הלקוח האנונימי יכול להוסיף הזמנה דרך \`api/submit-order\`, ולקרוא הזמנה אחת דרך \`api/order-lookup\` רק כשמספר ההזמנה והמייל שלה מתאימים, ורק את השדות שבסעיף 5.1, בלי הערות מנהל, טקסט AI, טלפון, נציג או פרטים של הזמנות אחרות (Milestone 14). הוא לא יכול לרשום הזמנות.`
- §5.1, new section after `POST /api/submit-order`: `#### \`POST /api/order-lookup\`` with the D9 body, the order of steps, the reply shape and the D7 message (in English, as in D9), and: `כל מקרה שבו לא מוצג כלום (מספר לא קיים, מייל אחר, נעילה, שדה נסתר מלא) מחזיר \`404 not_found\` עם אותה הודעה. מספר או מייל לא תקינים מחזירים \`400\` ולא נספרים.`
- §7 folder tree: `order-lookup.js  POST /api/order-lookup` under `api/`; `check-order.html` under `public/`; `check-order.js` ("דף בדיקת ההזמנה") and `boarding-pass.js` ("כרטיס הטיסה, משותף לטופס ולבדיקת ההזמנה") under `public/js/`; `006_order_lookup.sql` under `migrations/`.
- (The ADRs are written at the end of the build.)

**`spec/DESIGN.md`**
- The screens table: new row `| 6 | בדיקת הזמנה | לקוח | (לא בתמונות; Milestone 14) |`.
- New section after screen 5: `## 6. בדיקת הזמנה (Milestone 14)` with: מטרה (הלקוח רואה את מצב ההזמנה שלו בלי לפנות לאף אחד); מה יש: עמודה אחת במראה הכהה, "Check your order", שדות "Order number" ו-"Email", כפתור "Check order"; התוצאה: כרטיס הטיסה מ-Milestone 13 עם "Meeting time" ותגית הסטטוס, תיבת "Meeting point", ו-Travellers · Bags, Escort, Services, Estimated price; כותרת ומשפט לכל סטטוס (D3); הודעת שגיאה אחת (D7); "Check another order" ו-"Back to home".
- Screen 1, the header bullet: add `קישור "Check your order" אחרי קישורי הניווט (דסקטופ), וגם בכותרת התחתונה (Milestone 14).`
- "מה לא מוצג בתמונות", add: `- **בדיקת הזמנה (Milestone 14, החלטה של אסף, 27.11.2026):** הדף לא מופיע בתמונות. הוא בנוי מרכיבים קיימים: כרטיס הטיסה, תגיות הסטטוס ותיבת נתונים בקו דק.`

No part of the spec M14 needs is a placeholder. Conflict notes: PRD §7 and ARCHITECTURE §3 say the customer cannot read orders — MILESTONES M14 says they are updated per Asaf's approval first (O1). ARCHITECTURE §2 "exactly three tables" is kept (Asaf, D6). The images show no lookup page; DESIGN's new text (after O1) is the source, built from the existing components.

---

## 8. Definition of Done mapping

| DoD item (MILESTONES M14) | How it is met | Checked in |
|---|---|---|
| A right order number and email show the order; a right number with another email shows nothing (the same message as a missing order) | D2, D3, D5, D7, D8, D9 | §5 tests, §6.2 Right pair, Same message |
| Repeated attempts are blocked after a fixed number | D6, D8 (5 tries, 15 minutes) | §5 migration test, §6.2 Blocking |
| No internal information, manager notes or other customers' details are shown | D4, D9, `toCustomerView` | §5 `toCustomerView` / `LOOKUP_SELECT` tests, §6.2 Nothing internal |

### 8.1 DoD result (27.11.2026, local run, Development database)

| DoD item | Result |
|---|---|
| A right order number and email show the order; a right number with another email shows nothing (the same message as a missing order) | Pass. Two new orders (DM202 from the list, 75, Wheelchair × 2; LY998 typed and not found, 45): the right pair shows the order, also with the number in small letters and spaces around it and the email in capitals; the typed one shows "To be confirmed" and the typed number and date. A missing number, the right number with another customer's email, and the right number with an unknown email all answer 404 with the same body; a short number answers 400 with the field message; the anti-bot field answers the same 404. In the page (1280 × 800 and 375 × 812) the pending result and the error look right, with no cut text and no sideways scroll. The approved, flight-change, rejected, completed and check-email results were checked in the page with sample answers (headings, stub, tag, meeting point, a meeting time on the day before departure shown with its date), and the status rules by the unit tests; a real approval is in Asaf's check. |
| Repeated attempts are blocked after a fixed number | Pass. 5 wrong emails on one order → the right pair then answers 404; 5 wrong numbers with one customer's email → that customer's right pair answers 404; 5 wrong tries sent at the same moment → locked as well; 4 wrong tries then the right pair → shown, and the count starts again. The lock lifts after 15 minutes (§6.2, checked on the same order). |
| No internal information, manager notes or other customers' details are shown | Pass. The test orders carry customer notes; the answer has only the 11 fixed fields (no notes, name, phone, email, agent, AI text, suggested time or full id). The `toCustomerView` and `LOOKUP_SELECT` tests check every status. |

---

## 9. Build steps (one at a time, each with Asaf's go-ahead)

0. **Documents (after O1):** the approved wording in PRD, ARCHITECTURE and DESIGN, nothing else.
1. **Shared card:** move the boarding pass to `boarding-pass.js`; the form still looks the same; unit tests green.
2. **Database (Development, the shared project):** write `006_order_lookup.sql`; Asaf runs it in the SQL Editor (plain-Hebrew steps, file opened in the side pane); check the columns and the function exist.
3. **Server:** `validateLookupBody`, `LOOKUP_SELECT`, `toCustomerView`, `api/order-lookup.js`, `tests/order-lookup.test.js`; run the unit tests.
4. **Page:** `check-order.html`, `check-order.js`, CSS.
5. **Landing link:** the two "Check your order" links.
6. **Verify:** §6.2 at 375px and 1280px, screenshots, every status, the same-message and blocking checks, on the local run.
7. **DoD pass:** results written under §8 as "DoD result".
8. **Close:** ADRs (lookup by number and email in one locked database function; the attempt count kept on `orders` and `customers` instead of a fourth table, with one message for every "not shown" case; the shared boarding-pass module), 🟡 and checked items in MILESTONES, shut down the local run. No commit.
