# Milestone 2 — The customer sends a request (plan)

**Source:** `MILESTONES.md` → Milestone 2. Features 2, 3, 4, 6, 7, 9, 10, 12, 13 · FR-01–FR-07, FR-11, FR-12, FR-13, FR-40.
**Goal:** a customer, without signing in, fills in the four-step order form on a phone or desktop and submits it. The order is saved in `orders` with `status = pending` and a server-computed `recommended_time`, and the customer sees "Request received".
**Moved forward from M6 (Asaf's decision D3):** the optional services checkboxes in step 2.
**Out of scope (later milestones):** the Review block with "Edit" (M6), landing page (M6, the M1 temporary `index.html` stays), manual flight entry / "Can't find your flight?" (M5), `manager_alert` to n8n (M3), AI `order_draft` (M4), staff screens and auth (M3+). The form is opened at its direct URL, `/order.html`.

---

## 0. Decisions this plan takes (all reviewed with Asaf on 17.11.2026)

| # | Topic | Proposed decision | Why |
|---|---|---|---|
| D1 | Web fonts (Frank Ruhl Libre, Assistant) | **Approved: self-hosted.** The font files (latin subset, woff2, only the weights in use: Frank Ruhl 500/700, Assistant 400/600/700) are downloaded once into `public/assets/fonts/` and declared with `@font-face` in `tokens.css` (`font-display: swap`, serif / sans-serif fallbacks). The download is done in build step 1, after Asaf approves the exact files and source | No request to Google from the visitor's browser |
| D2 | Manual flight entry in M2 | **Approved.** Not shown in the form. `submit-order` accepts only `flight_id` in M2. The `flight_no` + `flight_date` path (and `needs_clarification`) is added in M5 | `MILESTONES.md` puts it in M5 ("not included here") |
| D3 | Services in M2 | **Approved by Asaf: built now (moved forward from M6).** Step 2 shows the two optional checkboxes "Porter / luggage help" and "Wheelchair" (labels written in `order.html`, same text as `lists.json`), and the form sends the selected codes. The server accepts only a subset of `lists.services`, no duplicates. Showing services on the manager and agent screens stays with those screens (M3/M4) | Asaf's choice; a small addition |
| D4 | Step 4 content | **Approved.** Contact fields only (Full name, Phone, Email, Notes). No Review block | Review with "Edit" is M6 |
| D5 | Empty flight search | **Approved.** An empty `q` returns the next 20 future flights, so the list is never blank on first load | Simple; matches the wireframe list under the search field |
| D6 | Draft in `localStorage` | **Approved.** Not used. Form state lives in page memory only (enough for "Back" without data loss) | ARCHITECTURE allows a draft but does not require it; simplest |
| D7 | Phone validation | **Approved.** 7–20 characters, digits plus `+`, `-`, spaces and `( )`, at least 7 digits | ARCHITECTURE says "valid phone" without a format |
| D8 | Email validation | **Approved.** Trimmed, lower-cased, max 254 characters, simple `name@domain.tld` pattern | Same |
| D9 | Israel-time formatting in the browser | **Approved.** A small helper module `public/js/time.js` (format date/time in `Asia/Jerusalem`). Reused by staff screens later | Avoids copying formatting code into every page; the browser twin of `lib/time.js` |
| D10 | `meeting-time.js` bundling (ADR-4) | **Approved.** Import it from `api/submit-order.js` with a relative path (`../public/js/meeting-time.js`). Verified locally in `vercel dev`; the production check happens on the first deploy after the M2 push. If it is not bundled there, fall back exactly as ADR-4 says | Keeps a single source of truth now |

---

## 1. Files

### New
| File | Purpose |
|---|---|
| `public/css/tokens.css` | Colors, fonts, font sizes, spacing, radius, focus ring (custom properties from DESIGN Part 2) |
| `public/css/base.css` | Reset, body, typography, header bar, buttons (primary / secondary / small), fields (normal, focus, error, read-only), stepper (− n +), radio cards, progress indicator, panels, status tag "Pending", error box (Error Tint), layout (375px first; centered column up to 560px on desktop) |
| `public/order.html` | The four steps and the "Request received" screen in one page (sections shown/hidden), plus the hidden `website` field |
| `public/js/order-form.js` | Form state, step navigation, validation, flight search, meeting-time preview, submit, error display |
| `public/js/api.js` | `getJson(path)` / `postJson(path, body)`: relative `/api/...` calls, parse `{ ok, data, error }`, throw an error carrying `status`, `code`, `message` |
| `public/js/dom.js` | Small helpers to build elements with `textContent` only (`el(tag, attrs, text)`, `clear(node)`) |
| `public/js/time.js` | `formatTimeIL`, `formatDateIL`, `formatDateTimeIL`, `isSameDayIL` (all with `timeZone: 'Asia/Jerusalem'`, 24h, `en-GB`) |
| `api/submit-order.js` | `POST /api/submit-order` |
| `lib/validate.js` | Validation of the submit body (uses `data/lists.json`) and of the `q` query parameter |
| `tests/meeting-time.test.js` | `node --test` tests of the formula, including all seed cases |

### Changed
| File | Change |
|---|---|
| `api/flights.js` | Add search `q` (flight number or destination, case-insensitive, max 40 chars), future flights only (`departure_at > now()`), limit 20, ordered by departure |
| `package.json` | Add `"scripts": { "test": "node --test" }` |
| `CLAUDE.md` | Fill in the **Test** run command (`node --test`) |
| `spec/MILESTONES.md` | 🟡 next to the Milestone 2 title at the end of the build |
| `spec/ARCHITECTURE.md` | ADRs for decisions taken during the build (at least D1, D9, D10 result; D2/D3 if Asaf wants them recorded) |

No database migration is needed: the M1 schema already has every column M2 writes. No new secret key (no `.env.example` change).

---

## 2. Server

### 2.1 `GET /api/flights?q=` (change)
- `q` optional. Trim; longer than 40 chars → `400 bad_request`. Keep only letters, digits, spaces and `-` (so the text is safe inside a PostgREST `or` filter); empty after cleaning = no filter (D5).
- Query: `flights` select `id, flight_no, airline, destination, departure_at`, `.gt('departure_at', new Date().toISOString())`, when `q` is set `.or('flight_no.ilike.%q%,destination.ilike.%q%')`, `.order('departure_at')`, `.limit(20)`.
- Response unchanged in shape: `{ flights: [...] }`.
- The M1 temporary `index.html` keeps working (it will now show only future flights).

### 2.2 `POST /api/submit-order` (new)
Body (ARCHITECTURE §5.1): `flight_id, flight_no, flight_date, travelers, bags, services, escort_scope, full_name, phone, email, notes, website`. Body must be a JSON object; anything else → `400`.

Order of operations:
1. **Honeypot:** `website` is a non-empty string → reply `200 { reference: <8 random uppercase hex>, status: "pending" }`, save nothing, call nothing.
2. **Validation** (`lib/validate.js`, first error → `400 bad_request` with a plain English message):
   - `flight_id`: required UUID in M2 (D2). `flight_no`: string up to 20 chars (stored as `flight_no_submitted`; the server replaces it with the flight's own `flight_no` after lookup, so the saved value is always correct).
   - `travelers` integer 1–10, `bags` integer 0–10 (no strings, no decimals).
   - `services`: array (may be empty), every item in `lists.services`, no duplicates.
   - `escort_scope`: `full` or `partial` (from `lists.escort_scopes`).
   - `full_name` 2–80 chars after trim; `phone` (D7); `email` (D8); `notes` optional, up to 500 chars.
   - Unknown extra fields are ignored. A `recommended_time` sent by the page is ignored (never read).
3. **Rate limits** (decision 12), counted on `orders.created_at` over the last hour:
   - System-wide: `count >= 30` → `429 too_many_requests`, message "Too many requests, please try again later".
   - Same email: look up the customer by email; if found, count that customer's orders in the last hour; `count >= 3` → same `429`. (A new email has 0.)
   - Counting uses `select('id', { count: 'exact', head: true })`.
4. **Flight lookup** by `flight_id`: not found → `400` "Please select a flight from the list."; `departure_at <= now` → `400` "This flight has already departed." (decision 15).
5. **Customer:** find by lower-cased email. If missing, insert (`full_name`, `phone`, `email`). If the insert hits the unique email constraint (two submissions at once), select again. An existing customer row is **never updated** (decision 17).
6. **Meeting time:** `meetingTime(new Date(flight.departure_at), travelers, bags)` from `public/js/meeting-time.js`.
7. **Insert order** (changed during the build, ADR-7: through `rpc('insert_order_with_limits')` in `supabase/migrations/002_functions.sql`, which re-checks both hourly limits under a lock and returns zero rows → `429`): `customer_id`, `flight_id`, `flight_no_submitted`, `flight_date_submitted: null`, `contact_name`, `contact_phone`, `travelers`, `bags`, `services`, `escort_scope`, `customer_notes` (null when empty), `status: 'pending'`, `recommended_time`. `final_time`, `ai_output`, `decided_at` stay null. Return `id`.
8. (M3: `manager_alert`; M4: `order_draft` — not in M2.)
9. **Reply** `200 { reference: id.slice(0, 8).toUpperCase(), status: "pending" }`. Nothing else (no order or customer data).

All errors go through `withHandler` (JSON always, details only in `console.error`).

### 2.3 `lib/validate.js`
- Imports `data/lists.json` with `with { type: 'json' }` (ADR-2).
- Exports `validateOrderBody(body)` → `{ value }` or `{ error: message }`, and `cleanSearchQuery(q)`.
- Pure functions, so they can get a few `node --test` cases too (cheap to add; not required by the DoD).

---

## 3. Browser

### 3.1 `order.html` structure
- `<html lang="en" dir="ltr">`, viewport meta, fonts (D1), `tokens.css`, `base.css`, `<script type="module" src="/js/order-form.js">`.
- Header (Deep Navy): "Sereno" (Frank Ruhl 700) and "Step X of 4" (hidden on the received screen).
- Progress indicator: four segments with labels Flight / Travellers / Escort / Details; done = Navy, current = Gold, remaining = Rule Light. Exposed as text for screen readers ("Step 2 of 4: Travellers").
- One `<form novalidate>` with four `<section>`s; only the current one is visible. Footer buttons: "Back" (secondary, hidden on step 1) and "Next" → (primary; on step 4 its label is "Submit request").
- Server error box (Error Tint, `role="alert"`) above the buttons, hidden by default.
- Honeypot: `<input name="website">` inside a visually hidden wrapper, `tabindex="-1"`, `autocomplete="off"`, `aria-hidden="true"`; the page always sends it empty.
- "Request received" section (see 3.6).

### 3.2 Step 1 — Flight
- Label "Search by flight number or destination", search input (debounced ~300 ms, calls `/api/flights?q=`). Results list as buttons/radio rows: "DM101 · London", airline below, and on the right date + time in Israel time ("Thu 10 Dec · 14:30"). Selected row: gold left bar (as in the mockup), `aria-pressed`/checked state.
- Read-only field "Departure time" (Cream background, Rule Light border): placeholder "Auto-filled from flight", after selection shows date and time (Israel). Not editable.
- States: loading, "No flights found", load error ("Could not load flights. Please try again.").
- Next without a selected flight → field error "Please select your flight from the list."
- The "Can't find your flight?" link is **not** shown in M2 (D2).

### 3.3 Step 2 — Travellers and bags
- Two steppers: "Travellers (1–10)" (default 1) and "Checked bags (0–10)" (default 0). Each: "−" button, a number input (Frank Ruhl), "+" button. Buttons disable at the limits; typing is allowed, so out-of-range or non-integer values (0, 11, empty) block Next with an error under the field ("Enter a number from 1 to 10." / "from 0 to 10").
- "Suggested meeting time" panel (Navy, time in Gold, Frank Ruhl): computed with `meetingTime()` from the selected flight's `departure_at`, updated on every change; shown in Israel time; when the meeting day differs from the departure day (Israel), the date is shown under the time (e.g. "Wed 11 Dec"). Text: "Suggestion only. Subject to manager approval." Hidden while values are invalid.
- "Optional services" (D3): a `fieldset` with a visible legend and two checkboxes, "Porter / luggage help" and "Wheelchair" (square, 2px corners, Navy with a cream tick when checked, full-width rows as in the mockup). Both optional; the choice is kept in the form state.

### 3.4 Step 3 — Escort scope
- Two radio cards in a `fieldset` with legend "Escort scope": "Full — Escort to the gate" and "Partial — Escort through security". Selected card: thick Navy border. No default; Next without a choice → error "Please choose an escort scope."

### 3.5 Step 4 — Your details
- Fields with visible labels above: "Full name", "Phone", "Email", "Notes (optional)" (textarea, `maxlength=500`). Placeholders as in the mockup. Same rules as the server (D7, D8, 2–80 name).
- "Submit request": validates, disables the button and shows "Sending…", posts to `/api/submit-order`.
  - Success → "Request received" screen.
  - `429` → error box "Too many requests, please try again later"; all fields keep their values; button enabled again.
  - `400` → error box with the server message (e.g. flight departed: user can go Back to step 1 and pick another).
  - Network / `500` → "Something went wrong. Please try again."

### 3.6 Request received
- Header with "Sereno" only (step counter and progress hidden). Square check icon (thin line, 1.6px), H2 "Request received", text "Your request is awaiting manager review. We will email you the decision."
- Panel "Reference" with the 8-character code (large, letter-spaced).
- Panel with rows "Flight" (e.g. "DM101 · London · 14:30", from the page state) and "Status": "Awaiting review" with a "Pending" tag (Ink Soft border). Nothing says "approved".
- Button "Back to home" → `/`.
- Focus moves to the heading; browser Back does not resubmit (state is cleared after success).

### 3.7 Shared behaviour
- State object in memory: `{ flight, travelers, bags, services, escort_scope, full_name, phone, email, notes }`. Inputs are re-filled from it when a step is shown, so Back/Next never lose data.
- Field errors: Error border (2px) + message below with an "×" icon, linked with `aria-describedby`, `aria-invalid="true"`; cleared when the value becomes valid.
- On step change: scroll to top and move focus to the step heading (keyboard / screen reader users).
- Keyboard: every control is a native button/input; visible focus ring (Gold Dark, 2px, offset 3px); Enter in a field = Next.
- All text from data is set with `textContent` (never `innerHTML`).
- Layout: phone first (375px): full-width primary button, one column; desktop: centered column max 560px. Touch targets ≥ 46px, primary button 54px.

---

## 4. Tests — `tests/meeting-time.test.js` (`node --test`)
- Formula examples: 2 travellers, 3 bags, departure 14:30 → 12:45; 1 traveller, 0 bags → 90 minutes before; 10 and 10 → 165 minutes before; rounding is always down to a multiple of 5.
- Midnight crossing: departure 01:10 (Israel), 1 traveller, 0 bags → 23:40 on the previous day.
- Escort scope has no input, so it cannot affect the result (the function takes only departure, travelers, bags).
- **Seed match:** a table of the 14 seed orders that have a flight (travellers, bags, departure local time/day offset, expected `recommended_time` local time/day offset from `supabase/seed/seed.sql`), checked on a fixed reference day in Israel time (both a winter and a summer date, to cover DST).

---

## 5. How the build is verified (before marking 🟡)
Preconditions: `seed.sql` re-run the same morning (before 14:30 Israel time) so today's flights are still in the future; local run with the command in `CLAUDE.md`.

1. `node --test` passes.
2. API checks with `curl` against `http://localhost:3000`:
   - `/api/flights?q=dm1`, `?q=london`, empty `q`: only future flights, ≤ 20, sorted; 41-char `q` → `400`.
   - Submit a valid order → `200` with an 8-char reference and `pending`; then in Supabase (read through a one-off server-side query, not the browser): one new `orders` row, `status = pending`, `recommended_time` from the formula (a fake `recommended_time` in the body is ignored), `final_time` null.
   - Departed flight id (the seed's past DM101 / DM202) → `400`.
   - `website` filled → `200`, no new row.
   - Same email four times within an hour → fourth is `429`.
   - Existing customer email with a different name/phone → no new customer, customer row unchanged, new order has the typed name/phone, older orders unchanged.
   - Bad inputs (travelers 0/11, bags 11, bad email, missing name, unknown service, bad escort) → `400`.
   - Direct table read with the publishable key still returns nothing (unchanged from M1).
3. Browser checks in the built-in browser at 375px and desktop: full flow; Back keeps data; validation messages; DM606 (01:10) with 1/0 shows 23:40 with the previous day's date; 2/3 on DM101 shows 12:45; keyboard-only run; the 429 message shows in the form without losing data.
4. Test orders created during the check stay in the single Supabase project (demo data only); re-running `seed.sql` clears them.
5. After the M2 push (only when Asaf asks): check the live site once — submit one order — to confirm `meeting-time.js` is bundled with `submit-order` (ADR-4), and record the result in the ADR.

---

## 6. Definition of Done mapping
| DoD item (MILESTONES.md) | Covered by |
|---|---|
| Fill and send without sign-in, 375px and desktop | 3.1–3.7, check 5.3 |
| Form filled within 5 minutes | Timed manual run in 5.3 (Asaf also times it) |
| Flight only from the list, departure auto-filled and read-only | 3.2 |
| No departed flights in search; date + time per flight; API rejects departed flight with `400` | 2.1, 2.2 step 4, 3.2 |
| Meeting time in Israel time; 01:10 → 23:40 previous day | 3.3, tests |
| Honeypot saves nothing; 4th order from same email → `429`, form shows message without losing data | 2.2 steps 1 and 3, 3.5 |
| Back keeps all data | 3.7 |
| (added, D3) Selected services are saved in `orders.services`; an unknown service returns `400` | 2.2 step 2, 3.3 |
| 0/11 travellers, 11 bags, empty required field → message, no next step | 3.3, 3.5 |
| Formula cases (12:45, 90, 165 min, escort has no effect) | 4 |
| `meeting-time.js` tests pass and match the seed | 4 |
| One `pending` row, server-computed `recommended_time`, empty `final_time` | 2.2 steps 6–7 |
| Existing email: no duplicate customer, row unchanged, typed name/phone on the new order | 2.2 step 5 |
| "Request received": 8-char reference and "Pending", not shown as approved | 3.6 |
| Browser cannot read orders; reply has only reference and status | 2.2 step 9, M1 RLS |
| Contrast, a label for every field, keyboard navigation | 3.7, tokens from the style guide |

## 7. Build steps (one at a time, each approved by Asaf)
1. Design base: `tokens.css`, `base.css` (+ font decision D1).
2. Flight search API: `api/flights.js` change.
3. Meeting-time tests: `tests/meeting-time.test.js`, `npm test` script, CLAUDE.md test command.
4. Submit API: `lib/validate.js`, `api/submit-order.js` (validation, honeypot, rate limits, flight check, customer, insert).
5. Form page: `order.html`, `api.js`, `dom.js`, `time.js`, `order-form.js` (four steps + received screen).
6. Full verification against the DoD (section 5), fixes, ADRs, 🟡 in MILESTONES.md.
