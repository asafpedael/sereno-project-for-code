# Milestone 16 — More details in the booking form (plan)

**Source:** `spec/MILESTONES.md` (Milestone 16, added 27.11.2026 at Asaf's request after M15 was approved; the overview table; "How the document is built" — M10–M16 are improvements whose wording, content and design are set in each one's planning with Asaf; the dependencies: M16 builds on M13's four-step form and "Your escort" summary, and on M14's lookup), PRD §3 (the four form steps, the order lookup paragraph), FR-02, FR-04, FR-05, FR-06, FR-09, FR-26, FR-31, FR-46, FR-47, §4.3 (the AI input and its three prompt limits), §6 (metric 3: the form in under 5 minutes), DESIGN screen 2 (steps 3 and 4, the "Your escort" summary), screen 3 (order details), screen 4 (agent card), screen 6 (order lookup), "מה לא מוצג בתמונות" and "עיצוב 'אתרי'" (the dark look, ADR-25), Part 2 (Gilda Display + Montserrat, 8px controls, 2px cards, no shadows), the three images (`sereno-wireframes.png`, `sereno-mockups.png` frames 4, 5, 7, 8; `sereno-style-guide.png` "03 UI Style" fields, radio and icons — none shows the new details), ARCHITECTURE §2 (`orders`, three tables only), §5.1 (`POST /api/submit-order`, `POST /api/order-lookup`, `GET /api/orders`), §5.2–5.3 (n8n payloads and workflow), ADR-5 (n8n export holds placeholders), ADR-37, ADR-39 (an old page open during a deploy), ADR-40 (a column added without breaking the live site), ADR-41 (fixed lists in `data/lists.json`), ADR-42, ADR-44 (insert function with a defaulted last parameter), ADR-45, ADR-46, ADR-47. The code is the source of truth for what M1–M15 built: `public/order.html`, `public/js/order-form.js`, `public/js/boarding-pass.js`, `api/submit-order.js`, `lib/validate.js`, `lib/orders-view.js`, `lib/notify.js`, `lib/prompts.js` (`buildOrderDraftInput`), `public/js/order-details.js` (`detailsGrid`, shared by the Approvals screen and the manager's archive panel), `public/js/agent.js` (`card`), `public/js/archive.js` (`agentPanel`), `public/js/check-order.js`, `data/lists.json`, `supabase/migrations/005_estimated_price.sql` (the insert function has 17 parameters; 006 does not touch it), `n8n/sereno-notifications.json` ("Set customer_approved" rows), `public/css/theme.css`, `tests/` (211 tests, all green after M15). The mock-up Asaf saw on 27.11.2026: https://claude.ai/artifact/3kqSzVhHQRDBbo7nZ8NfkJ — **its names, times and price are sample values only.**

**Status:** written 27.11.2026. **Approved by Asaf (27.11.2026, "Approve the plan")**, with the recommendations of O1 (the PRD / ARCHITECTURE / DESIGN / MILESTONES wording, applied at build step 0), O2 ("Drop-off"), O3 (an order from a page opened before the deploy is saved with the language and way to the airport empty), O4 (the hint "So your escort knows how you are arriving.") and O5 (the proposed DoD). **Build (27.11.2026):** step 0 applied the O1 wording to PRD, DESIGN, ARCHITECTURE and the M16 DoD in MILESTONES. Lists, validation, `007_order_details.sql` (run by Asaf in Supabase: Success), server, form, staff screens, lookup and the n8n export done; 226 unit tests pass (211 + 15 new). ADR-51, ADR-52 and ADR-53 added. DoD items 1, 2, 3 and 5 pass; item 4 passes for the AI, and the 5-minute time is an estimate that Asaf confirms by timing one booking (§8.1). MILESTONES M16 marked 🟡. Differences from the plan: the desktop "Your escort" summary lists its rows in two columns from 900px, so with the two new rows it still fits beside the form at 1280 × 800 (one column ran 150px past the screen); the arrival radio is hidden inside its card, and the card shows the choice and the focus ring. Asaf's n8n edit (§4) comes after the push. **Approved by Asaf with the push (27.11.2026, "push changes to github"); MILESTONES M16 marked ✅** (DoD item 4 checked with that approval; the form time was not measured separately). **Asaf asked on 27.11.2026 to add this milestone and plan it**, right after M15 (he wanted "more substance" in the booking form and chose three ideas). Already answered by Asaf in planning (27.11.2026, after seeing the mock-up):
- **Other travellers' names:** **one text box**, in **step 4** (after the contact details), **optional**, with "(optional)" in its label like "Notes (optional)". Shown only when there are 2 or more travellers.
- **Escort language and how the customer gets to the airport:** both in **step 3**, under the escort cards: the language as a **drop-down list** (starts on English), the way to the airport as **four buttons with an icon**; both **required** (one tap each).
- **Languages:** **English, Hebrew, Russian** — only languages he has escorts for.
- **Ways to the airport:** **Taxi or shuttle, Driving and parking, Drop-off, Train.** (He asked whether it should be "Drop off" rather than "Dropped off": the plan uses **"Drop-off"**, a noun like "Train"; O2.)
- **Staff:** all three details on **every staff screen** — the manager's order details, the field agent's card, and both archive panels.
- **Customer:** the **language and the way to the airport** in the **approval email** and on the **order lookup** page; **not the names** (the lookup already shows no names or phone). The other emails do not change.
- **AI:** gets **none** of the new details (as MILESTONES says).

**Goal:**
1. The form collects three short details that help the escort give a personal service and plan the day: the other travellers' names, the language the customer prefers for the escort, and how the customer gets to the airport — and the form still takes under 5 minutes.
2. The details are saved on the `orders` table (three new optional columns; no fourth table), shown in the "Your escort" summary and the review, on every staff screen, and (language and arrival only) in the approval email and the order lookup.
3. The order still sends and saves as before. One small database change, run by Asaf before the push; the live site keeps working before and after it. One n8n edit by Asaf, by hand. No new key, no AI change.

---

## 0. Decisions this plan proposes

| # | Topic | Proposal | Why |
|---|---|---|---|
| D1 | The two fixed lists | `data/lists.json` gets `"escort_languages": [{ "code": "en", "label": "English" }, { "code": "he", "label": "Hebrew" }, { "code": "ru", "label": "Russian" }]` and `"arrival_methods": [{ "code": "taxi", "label": "Taxi or shuttle" }, { "code": "car", "label": "Driving and parking" }, { "code": "drop_off", "label": "Drop-off" }, { "code": "train", "label": "Train" }]`. The server, the staff pages (through `GET /api/config`) and the lookup take the labels from here; the form writes the same options in its HTML, checked by a test (§3.1). The order of the lists is the order on screen. Adding a language later is this line, the form's HTML and a push (no database change: the database checks length only, D7). | Asaf's lists, 27.11.2026. One place for codes and labels, like services and escort scopes (ADR-41). |
| D2 | Step 3 — language | Under the two escort cards, after a thin divider: label **"Preferred language for your escort"**, a `<select>` with English, Hebrew, Russian, **English selected at the start**. Always has a value, so no error state. Styled like the other fields (8px corners, the dark field colour, the soft border, gold on focus) with the down-arrow icon of the Style Guide. | Asaf: drop-down, required; starting on English keeps it to zero taps for most customers (the site is in English). |
| D3 | Step 3 — way to the airport | Label **"How will you get to the airport?"**, then four buttons in a 2 × 2 grid (one column under 340px), each a real radio input inside a small card with a thin line icon (1.6px, gold, Style Guide icons): **Taxi or shuttle** (car), **Driving and parking** ("P"), **Drop-off** (arrow to a kerb line), **Train** (train). Nothing chosen at the start; the chosen card gets the gold border (as the escort cards). Under it the hint **"So your escort knows how you are arriving."** "Next" without a choice shows under the group **"Please choose how you will get to the airport."** (field error style, focus to the first button). | Asaf: buttons, required. Radio inputs keep keyboard use and screen-reader names (FR basic accessibility). |
| D4 | Step 4 — other travellers' names | Between "Email" and "Notes (optional)": label **"Other travellers (optional)"**, a `<textarea>` (3 rows, `maxlength="300"`), placeholder **"e.g. Maya Avraham, Noam Avraham"**, hint **"Their full names, so your escort can greet everyone."** Shown only when Travellers is 2 or more (step 2); with 1 traveller it is hidden and nothing is sent. Changing travellers back to 1 keeps the typed text in the box (Back never loses data) but does not send it. Over 300 characters: **"Names must be 300 characters or fewer."** No check that the number of names matches the number of travellers. | Asaf: one box, optional, "(optional)" in the label. 300 characters is about 10 full names. A free box cannot be counted reliably, so no count check. |
| D5 | "Your escort" summary | Two more rows after "Escort": **"Language"** (`English`) and **"Getting there"** (`Taxi or shuttle`; before a choice: "Choose how you arrive", in the soft empty style like "Choose your escort"). The names are not in the summary (it stays short). The phone bar does not change. | MILESTONES dependency: the new details go into the summary. Mock-up section 3. |
| D6 | Review (step 4) | One more row after "Escort": **"Language · Getting there"** with the value `English · Taxi or shuttle` and an "Edit" link to step 3. The names are not repeated in the review (the box is on the same step, just above). | Asaf saw this row in the mock-up. |
| D7 | Storage | Three new optional columns on `orders`: **`traveller_names`** (text, up to 300 characters, empty when none), **`escort_language`** (text, a code from D1, up to 20 characters), **`arrival_method`** (text, a code from D1, up to 20 characters). Checks in the database are on length only; the server checks the codes against `data/lists.json`. Orders saved before M16 keep all three empty and show nothing new anywhere. | MILESTONES: on `orders`, no fourth table (ARCHITECTURE §2, ADR-47). Length-only checks keep a new language a one-line change. |
| D8 | The migration (one shared database; the live site uses it) | New `supabase/migrations/007_order_details.sql`, safe to run while the old site is live and safe to re-run: (1) `add column if not exists` for the three columns, with checks `char_length(traveller_names) <= 300`, `char_length(escort_language) <= 20`, `char_length(arrival_method) <= 20` (each also allows null); (2) `insert_order_with_limits` gets three more parameters at the end, `p_traveller_names text default null`, `p_escort_language text default null`, `p_arrival_method text default null` (the 17-parameter version from 005 is dropped first, so only one version exists; same `revoke` / `grant` lines). Asaf runs it in the Supabase SQL Editor **before the push** (plain-Hebrew steps at build step 2). A comment line in 005 notes that 007 replaces the function. | ADR-40 / ADR-44 pattern: the old code keeps calling without the new parameters and still saves orders. |
| D9 | Server validation (`validateOrderBody`) | **`escort_language`**: a code from D1. **`arrival_method`**: a code from D1. **Missing** (`undefined` or `null`) → stored empty, so a page opened before the deploy still sends its order; **any other value that is not a code** → `400` "Please choose a language for your escort." / "Please choose how you will get to the airport.". **`traveller_names`**: optional; a string, no control characters except new lines, trimmed, spaces collapsed inside lines, up to 300 characters ("Names must be 300 characters or fewer."), empty → `null`; sent with `travelers = 1` → `400` "Other travellers' names need 2 or more travellers.". The checks come after the escort scope and before the contact details, and the consent check stays last (ADR-39). | The page always sends both codes (D2, D3), so "required" holds for every new order; accepting a missing value avoids a stuck customer during the deploy (unlike ADR-39, where a refusal was the point). |
| D10 | Server save | `api/submit-order.js` passes `p_traveller_names`, `p_escort_language`, `p_arrival_method` to `insert_order_with_limits`. The reply (`reference`, `status`), the honeypot path, the rate limits, the price and the meeting time do not change (none of the new details affects them). | Keep the save path as it is. |
| D11 | The AI | `buildOrderDraftInput` (`lib/prompts.js`) is **not** changed: the model never gets the names, the language or the way to the airport; prompt limit 1 stays as it is. A test checks that the draft input has none of the three. | Asaf, 27.11.2026 (MILESTONES default). No new AI round is needed. |
| D12 | Manager screen and manager archive panel | `toManagerView` adds `traveller_names` (text or `null`), `escort_language` and `arrival_method` (codes or `null`). `detailsGrid` (`order-details.js`, used by both screens) adds after "Phone / Email": **"Also travelling"** (the names as typed, new lines kept; only when not empty) and **"Language · Getting there"** (`English · Taxi or shuttle`; only when at least one is set; a missing half shows "–"). | Asaf: every staff screen. One shared grid, so both screens agree. |
| D13 | Field agent card and agent archive panel | `toAgentView` adds the same three fields (the agent needs them to do the service). In `agent.js` `card` and `archive.js` `agentPanel`: a line **"Also travelling"** under the customer's name and phone (only when not empty), and two items in the card grid after "Escort": **"Language"** and **"Getting there"** (only when set; old orders keep the four-item grid). Labels come from `GET /api/config` (both pages already load it). | Asaf: every staff screen; the escort is who the details are for. |
| D14 | Order lookup (`check-order`) | `LOOKUP_SELECT` adds `escort_language, arrival_method` (not `traveller_names`). `toCustomerView` adds `escort_language` and `arrival_method` as **labels** (`"English"`, `"Taxi or shuttle"`) or `null`. The result page shows two more items after "Escort": **"Escort language"** and **"Getting there"**, only when set. The names never leave the server on this path (tested), like the customer's own name and phone today. | Asaf: language and arrival in the lookup, not the names (FR-47 keeps personal details off the page). |
| D15 | Emails | `approvedEmailPayload` adds **`escort_language`** and **`arrival_method`** as labels or `null`. In n8n, "Set customer_approved" gets two rows after "Escort": **"Escort language"** and **"Getting to the airport"** (the template already skips an empty row, so old orders show no row). The flight-change email reuses the approval payload, so it carries the fields, but its template does not show them. No change to the manager alert, "request received", rejection or clarification emails, and the names are in no email. | Asaf: the approval email only, without the names. |
| D16 | The 5-minute target (PRD §6) | Two taps in step 3 (the language usually zero, since it starts on English) and one optional box in step 4. Checked by a timed run at the build (§6.2): the whole form, with 3 travellers and both names typed, well under 5 minutes. | MILESTONES: the form must stay under 5 minutes. |
| D17 | Live site during the change | Order: Asaf runs `007_order_details.sql` (the old site keeps working; new orders get empty details) → push (page, functions and lists go live together) → Asaf's n8n edit (until then the approval email has no new rows; nothing breaks). Friends testing now are told after the push. | One shared database and a live site with testers (as M11, M13). |
| D18 | What stays | The four steps and their order, every existing field, message and validation, the meeting-time formula and the price (no new price item), the wheelchair stepper, the booking rules and consent box, the anti-bot field, the rate limits, the reply of `POST /api/submit-order`, the landing page, the chat (`data/faq.json` is not changed), the archive search (still customer name or flight), the seed (demo orders show nothing new), the AI, the fonts and colours. | Keep M16 to what MILESTONES lists. |

---

## 1. Files

### New
- `supabase/migrations/007_order_details.sql` (D7, D8).
- `tests/order-details-fields.test.js` (§5).

### Changed
- `data/lists.json`: `escort_languages`, `arrival_methods` (D1).
- `public/order.html`: step 3 language select and arrival buttons (D2, D3), step 4 names box (D4), two summary rows (D5), one review row (D6).
- `public/js/order-form.js`: fill the select and the buttons from the config lists; show / hide the names box with the travellers count; validate step 3 arrival and step 4 names; summary and review rows; send `escort_language`, `arrival_method`, `traveller_names` (only when travellers ≥ 2).
- `public/css/theme.css`: the select, the 2 × 2 arrival buttons with icons, the divider in step 3; dark look, 8px controls, no shadows.
- `lib/validate.js`: D9.
- `api/submit-order.js`: D10.
- `lib/orders-view.js`: `toManagerView`, `toAgentView` (D12, D13), `LOOKUP_SELECT`, `toCustomerView` (D14).
- `lib/notify.js`: `approvedEmailPayload` (D15).
- `public/js/order-details.js`: `detailsGrid` (D12).
- `public/js/agent.js`, `public/js/archive.js`: the agent card and the agent panel (D13).
- `public/js/check-order.js` (and `public/check-order.html` only if a holder is needed): D14.
- `supabase/migrations/005_estimated_price.sql`: one comment line ("replaced by 007").
- `n8n/sereno-notifications.json`: two rows in "Set customer_approved" (placeholders untouched, ADR-5) (D15).
- `tests/validate*.test.js` / `tests/order-consent.test.js`, `tests/orders-view.test.js`, `tests/order-lookup.test.js`, `tests/notify-payload.test.js`: only where expected objects gain the new fields.
- `spec/PRD.md`, `spec/DESIGN.md`, `spec/ARCHITECTURE.md`, `spec/MILESTONES.md` (M16 DoD): **only** the wording of O1, and only after Asaf approves it.
- `spec/ARCHITECTURE.md`: new ADRs (end of build). `spec/MILESTONES.md`: 🟡 and checked DoD items (end of build). `CLAUDE.md`: no change expected.

### Not changed
- `lib/prompts.js`, `lib/ai.js` (D11), `public/js/price.js`, `public/js/meeting-time.js`, `public/js/boarding-pass.js`, `public/js/chat.js`, `data/faq.json`, `public/index.html`, `api/chat.js`, `api/order-decision.js`, the seed, `vercel.json`, `.env.example`.

---

## 2. Server

### 2.1 `supabase/migrations/007_order_details.sql`
As D8: three `add column if not exists`, three named checks added only if missing (`orders_traveller_names_check`, `orders_escort_language_check`, `orders_arrival_method_check`), drop the 17-parameter `insert_order_with_limits`, create it with 20 parameters (the three new ones last, `default null`), insert them into the new columns, same `revoke` / `grant` lines as 005 for the new signature. Header comment: run after 001–006, safe to re-run, safe while the old site is live.

### 2.2 `lib/validate.js`
```
const LANGUAGE_CODES = lists.escort_languages.map((l) => l.code);
const ARRIVAL_CODES = lists.arrival_methods.map((a) => a.code);
// inside validateOrderBody, after escort_scope:
escort_language: undefined/null -> null; a code -> it; else 400 'Please choose a language for your escort.'
arrival_method:  undefined/null -> null; a code -> it; else 400 'Please choose how you will get to the airport.'
traveller_names: undefined/null/'' -> null; not a string or control chars (except \n) -> 400 'Names are not valid.';
                 trim, collapse spaces in each line, drop empty lines; > 300 -> 400 'Names must be 300 characters or fewer.';
                 non-empty with travelers === 1 -> 400 "Other travellers' names need 2 or more travellers."
```
The returned `value` gains `traveller_names`, `escort_language`, `arrival_method`.

### 2.3 `api/submit-order.js`
The insert call gets `p_traveller_names: order.traveller_names`, `p_escort_language: order.escort_language`, `p_arrival_method: order.arrival_method`. Nothing else.

### 2.4 Views and payloads
- `toManagerView` / `toAgentView`: `traveller_names: row.traveller_names || null`, `escort_language: row.escort_language || null`, `arrival_method: row.arrival_method || null`.
- `toCustomerView`: `escort_language: label or null`, `arrival_method: label or null` (an unknown stored code shows the code, like the escort scope today); `LOOKUP_SELECT` gains the two columns only.
- `approvedEmailPayload`: the same two labels or `null`.

---

## 3. Browser / CSS

### 3.1 `order.html` + `order-form.js`
- The form does not load `/api/config` today (its service and escort labels are written in the HTML). So the three `<option>`s and four buttons are written in `order.html` too, with values equal to the D1 codes, and a test checks that the HTML and `data/lists.json` hold the same codes and labels. No new request, and the form never waits for one. (The staff pages and the lookup take the labels from the server, which reads `data/lists.json`.)
- Step 3: the divider, the select (`id="escort-language"`), the radio group (`name="arrival_method"`, `id="field-arrival"`, error `arrival-error`). `validateStep(3)` adds the arrival check after the escort check.
- Step 4: `field-traveller-names` with the textarea `traveller-names` and `traveller-names-error`; `syncTravellerNames()` (called where `syncWheelchairs` is) hides it when travellers < 2. `validateStep(4)` adds the length check after Email.
- Summary and review: `sum-language`, `sum-arrival`, `review-extras`; `renderSummary()` and `renderReview()` fill them.
- Submit: three more fields; `traveller_names` is `null` when the box is hidden or empty.
- `form.reset()` after sending resets the select to English and clears the buttons and the box (as today).

### 3.2 Look
- Select: same height and border as `.input`, the Style Guide down-arrow, the cream text on the dark field, gold focus ring; the native list opens in the system style.
- Arrival buttons: like `.check` / the radio cards — dark field, soft border, 8px corners, gold border when chosen, icon 20px gold at the left, label Montserrat 600. Icons are inline SVG in the HTML (`aria-hidden`), no new file.
- Names box: the existing `.textarea` style.

### 3.3 Fit (375px and 1280px)
Places to watch: the 2 × 2 buttons with "Driving and parking" on a 375px phone (wraps to two lines inside the button, never cut), the select width, the new summary rows inside the desktop sunset panel at 1280 × 800 (the whole summary must still fit beside the form, as in M13 §8.1), the review row "Language · Getting there" with its "Edit", the agent card grid with six items at 375px, the manager grid with the names on two lines.

---

## 4. Emails / n8n (Asaf, by hand, in the live workflow; the repo export gets the same change)
1. Open the workflow, node **"Set customer_approved"**, the `rows` field.
2. After the row `{ label: "Escort", value: $json.body.escort_scope },` add:
   `{ label: "Escort language", value: $json.body.escort_language },`
   `{ label: "Getting to the airport", value: $json.body.arrival_method },`
3. Save.

Plain-Hebrew steps at build step 6, done **after the push** (before that the event carries no new fields, and an empty row is skipped anyway).

---

## 5. Tests (`node --test`)
New `tests/order-details-fields.test.js`:
- `data/lists.json` has exactly the three languages and four ways of D1, in that order; `order.html` holds the same codes and labels (if the HTML route of §3.1 is taken).
- `validateOrderBody`: each language and arrival code is kept; a missing one gives `null`; an unknown one gives the D9 message; names are trimmed and kept, `''` → `null`, 301 characters → the message, control characters → refused, names with 1 traveller → the message; the consent check is still last.
- `toManagerView` and `toAgentView` carry the three fields; an old row (all empty) gives three `null`s.
- `toCustomerView` gives the two labels and **never** `traveller_names` (also not inside any value); `LOOKUP_SELECT` does not name `traveller_names`.
- `approvedEmailPayload` carries the two labels (`null` for an old row) and no names; `receivedEmailPayload` and the manager alert are unchanged.
- `buildOrderDraftInput` has none of the three fields (D11).
- `007_order_details.sql` declares the three parameters with `default null` (the old call still works) and drops the 17-parameter version.
- The n8n export has the two new rows in "Set customer_approved" only.

Existing 211 tests stay green (only expected objects that gain the new fields are updated).

---

## 6. How the build is verified (before marking 🟡)

### 6.1 Asaf's part
1. Before the push: run `007_order_details.sql` in the Supabase SQL Editor (steps given at build step 2; the file opens in the side pane).
2. After the push: the n8n edit (§4), then one order on the live site to his allowlisted address, approved in the manager screen: the approval email shows "Escort language" and "Getting to the airport", and no names.

### 6.2 Checks (local run, port 3000, browser pane, Development database)
- **Steps 3 and 4 at 375px and 1280px, no cut or overflowing text, no sideways scroll:** step 3 with nothing chosen, with an error ("Next" without a way), and with each way chosen; the select opened; step 4 with 1 traveller (no names box) and with 3 travellers (box shown), a too-long names error, the review row; the summary rows on the desktop panel and in the phone's opened summary.
- **Back and Edit keep everything:** choose Hebrew and Train, type names, go Back to step 2 and forward, and "Edit" from the review: all kept; travellers down to 1 hides the box and the order is sent without names.
- **The order sends and saves:** one order with 3 travellers, names, Russian, Drop-off; one with 1 traveller and English, Taxi or shuttle; one typed flight. The rows in Supabase (Development) hold the values; the manager screen and the manager archive panel show "Also travelling" and "Language · Getting there"; the agent card and the agent archive panel show the names line and the two items (after approving); an old seed order shows nothing new and both screens look as before.
- **The customer side:** the lookup page for the first order shows "Escort language" and "Getting there" and no names (also not in the network reply); the approval event in the local server log carries the two labels and no names.
- **The AI:** the stored `ai_output` of the new orders was made as before; the draft input (unit test) has none of the new fields.
- **Form time:** a timed run from step 1 to "Request received" with 3 travellers and two typed names, written in the report (target: under 5 minutes, PRD §6).
- **Screenshots** of step 3 and step 4 at both widths, the agent card at 375px and the manager details at 1280px, in the build report.
- **Unit tests:** all green.

---

## 7. Open points

| # | Question | Options | Recommendation |
|---|---|---|---|
| O1 | The PRD / ARCHITECTURE / DESIGN / MILESTONES wording below (MILESTONES M16: "before planning, PRD §3 and §4.1 are updated with Asaf's approval"; DoD "set in planning"). | (a) approve as written; (b) approve with changes Asaf names. | **Decided (27.11.2026): (a).** Applied at build step 0, nothing else. |
| O2 | The button label for being driven to the airport (Asaf asked "isn't it drop off?"). | (a) **"Drop-off"** (a noun, like "Train" and "Taxi or shuttle"); (b) "Dropped off" (as in the mock-up); (c) "Someone drops me off". | **Decided (27.11.2026): (a)** — Asaf's own word, short, and clear on a button. |
| O3 | An order page opened before the deploy sends no language or way to the airport. | (a) save the order with those two empty (D9); (b) refuse it with a message, so every order has them (as ADR-39 did for the consent). | **Decided (27.11.2026): (a)** — nobody gets stuck during the few minutes of the deploy; staff screens simply show nothing for such an order. |
| O4 | The step 3 hint text under the four buttons. | (a) "So your escort knows how you are arriving."; (b) no hint. | **Decided (27.11.2026): (a)** — says why we ask, without promising a different meeting point (the meeting point stays fixed, ADR-41). |
| O5 | The proposed DoD (§8). | (a) approve; (b) change. | **Decided (27.11.2026): (a).** |

### O1 — proposed wording changes (Hebrew, as the documents are written)

**`spec/PRD.md`**
- §3, "טופס ההזמנה: ארבעה שלבים", the sentence about the summary: `… השירותים, הליווי, שעת המפגש המומלצת …` → `… השירותים, הליווי, שפת המלווה ודרך ההגעה לשדה (Milestone 16), שעת המפגש המומלצת …`
- Item 3: after `… והמחיר ההתחלתי (Milestone 13).` add: ` מתחת לכרטיסים הלקוח בוחר שפה מועדפת למלווה מרשימה קבועה (English, Hebrew, Russian; מתחיל ב-English), ואיך הוא מגיע לשדה, בכפתור אחד מארבעה (Taxi or shuttle, Driving and parking, Drop-off, Train). שני הפרטים חובה (Milestone 16, החלטה של אסף, 27.11.2026).`
- Item 4: `**פרטי קשר וסקירה** — שם מלא, טלפון, מייל ושדה הערות חופשי (אופציונלי).` → `**פרטי קשר וסקירה** — שם מלא, טלפון, מייל, שמות הנוסעים הנוספים (תיבת טקסט אחת, אופציונלית, רק כשיש 2 נוסעים ומעלה, Milestone 16) ושדה הערות חופשי (אופציונלי).`
- §3, "בדיקת הזמנה": `… הנוסעים והמזוודות, השירותים, היקף הליווי והמחיר המשוער.` → `… הנוסעים והמזוודות, השירותים, היקף הליווי, שפת המלווה ודרך ההגעה לשדה (Milestone 16) והמחיר המשוער.` and `לא מוצגים הערות מנהל, הנציג, הטלפון, …` → `לא מוצגים שמות הנוסעים, הערות מנהל, הנציג, הטלפון, …`
- New row in 4.1, after FR-48: `| FR-49 | פרטים נוספים בטופס: שמות הנוסעים הנוספים (תיבת טקסט אחת, אופציונלית, עד 300 תווים, רק כשיש 2 נוסעים ומעלה), שפה מועדפת למלווה מרשימה קבועה (English, Hebrew, Russian) ודרך ההגעה לשדה מרשימה קבועה (Taxi or shuttle, Driving and parking, Drop-off, Train), שתיהן חובה. הפרטים נשמרים בהזמנה ומוצגים בסיכום ובסקירה, למנהל, לנציג השטח ובארכיון. השפה ודרך ההגעה (בלי השמות) מוצגות גם במייל האישור ובבדיקת ההזמנה. ה-AI לא מקבל אותם (Milestone 16, החלטה של אסף, 27.11.2026) | – | Should |`
- FR-26: `… (שמות, נוסעים, טלפון, …` → `… (שמות, נוסעים, שמות הנוסעים הנוספים, שפת המלווה, דרך ההגעה לשדה, טלפון, …`
- FR-31: after `… והמחיר המשוער (Milestone 13)` add `, ושפת המלווה ודרך ההגעה לשדה (Milestone 16)`.
- FR-47: `… מקום המפגש ופרטי ההזמנה שהלקוח בחר, בלי מידע פנימי.` → `… מקום המפגש ופרטי ההזמנה שהלקוח בחר (כולל שפת המלווה ודרך ההגעה, בלי שמות הנוסעים), בלי מידע פנימי.`
- §4.3 stays (the AI input list does not change; "פרטי הזמנה נוספים" there is the existing order data).

**`spec/DESIGN.md`**
- Screen 2, the "Your escort" summary bullet: `שורות Flight, Departure, Travellers · Bags, Services, Escort,` → `שורות Flight, Departure, Travellers · Bags, Services, Escort, Language ו-Getting there (Milestone 16; לפני בחירה: "Choose how you arrive"),`
- Step 3, "מה יש", add: `מתחת לכרטיסים, אחרי קו דק (Milestone 16): "Preferred language for your escort" ברשימה נפתחת (English, Hebrew, Russian; מתחילה ב-English), ו-"How will you get to the airport?" עם ארבעה כפתורים ברשת 2 × 2, כל אחד עם אייקון קו זהב: "Taxi or shuttle", "Driving and parking", "Drop-off", "Train". הכפתור הנבחר במסגרת זהב. מתחת הטקסט "So your escort knows how you are arriving."`
- Step 3, "מה קורה", add: `"Next" בלי בחירת דרך הגעה מציג מתחת לכפתורים "Please choose how you will get to the airport."`
- Step 4, "מה יש": `"Full name", "Phone", "Email", "Notes (optional)".` → `"Full name", "Phone", "Email", "Other travellers (optional)" (תיבת טקסט, רק כשיש 2 נוסעים ומעלה, עם "e.g. Maya Avraham, Noam Avraham" והטקסט "Their full names, so your escort can greet everyone."; Milestone 16), "Notes (optional)".` and the review: after `… Escort,` add `שורה "Language · Getting there" עם "Edit" לשלב 3 (Milestone 16),`
- Screen 3, "פרטי ההזמנה (ימין)": after `Customer, Phone / Email,` add `"Also travelling" ו-"Language · Getting there" כשיש (Milestone 16),`
- Screen 4, "מה יש במסך": after `מספר טלפון (מוצג כקישור),` add `"Also travelling" עם שמות הנוסעים הנוספים כשיש,` and after `Escort,` add `Language ו-Getting there כשיש (Milestone 16),`
- Screen 6, "התוצאה": `ו-Travellers · Bags, Escort, Services ו-Estimated price.` → `ו-Travellers · Bags, Escort, Escort language, Getting there, Services ו-Estimated price (בלי שמות הנוסעים).`
- "מה לא מוצג בתמונות", add a bullet: `- **פרטים נוספים בטופס (Milestone 16, החלטה של אסף, 27.11.2026):** לא מופיעים בתמונות. הרשימה הנפתחת, ארבעת כפתורי ההגעה עם אייקוני קו (רכיב "אייקונים" מה-Style Guide) ותיבת השמות נבנים במראה הכהה, באותו סגנון של השדות וכרטיסי הבחירה: פינות 8px, מסגרת זהב לבחירה, בלי צללים.`

**`spec/ARCHITECTURE.md`**
- §2 `orders`, after `estimated_price`, three rows: `| \`traveller_names\` | text, **יכול להיות ריק**, עד 300 תווים | שמות הנוסעים הנוספים כפי שהלקוח כתב (Milestone 16). ריק כשאין, כשיש נוסע אחד, ובהזמנות ישנות. לא נשלח ל-AI, ללקוח בבדיקת ההזמנה או במיילים |`, `| \`escort_language\` | text, **יכול להיות ריק**, עד 20 תווים | קוד מ-\`escort_languages\` ב-\`data/lists.json\` (\`en\`, \`he\`, \`ru\`). ריק בהזמנות ישנות |`, `| \`arrival_method\` | text, **יכול להיות ריק**, עד 20 תווים | קוד מ-\`arrival_methods\` ב-\`data/lists.json\` (\`taxi\`, \`car\`, \`drop_off\`, \`train\`). ריק בהזמנות ישנות |`
- §5.1 `POST /api/submit-order`, the sample body: add `"traveller_names": "Maya A., Noam A.", "escort_language": "en", "arrival_method": "taxi",`; "ולידציה" add: `\`escort_language\` ו-\`arrival_method\` קודים מהרשימות (חסר = ריק, בשביל דף שנפתח לפני העדכון), \`traveller_names\` אופציונלי, עד 300 תווים, ורק כש-\`travelers\` 2 ומעלה.`
- §5.1 `POST /api/order-lookup`, the sample reply: add `"escort_language": "English", "arrival_method": "Taxi or shuttle",` and in the paragraph `לא נשלחים הערות מנהל, …` → `לא נשלחים שמות הנוסעים, הערות מנהל, …`
- §5.1 `GET /api/orders`, the sample: add `"traveller_names": null, "escort_language": "en", "arrival_method": "taxi",` (manager and agent alike).
- §5.2, the sample payload: add `"escort_language": "English", "arrival_method": "Taxi or shuttle",` and in the paragraph: `\`escort_language\` ו-\`arrival_method\` (תוויות, או null בהזמנה ישנה) נשלחים ב-\`customer_approved\` (ומכאן גם ב-\`customer_flight_change\`, בלי להופיע בתבנית שלו) (Milestone 16). שמות הנוסעים לא נשלחים באף מייל.`
- §7 folder tree: `007_order_details.sql` under `migrations/` ("פרטים נוספים בהזמנה (Milestone 16)").
- (The ADRs are written at the end of the build.)

**`spec/MILESTONES.md`**, Milestone 16, "תנאי השלמה: נקבעים בתכנון." → the five items of §8 as `- [ ]` lines (Hebrew), and under "לפני התכנון" nothing changes.

No part of the spec M16 needs is a placeholder. No conflict between documents: PRD §3 / FR-26 / FR-31 / FR-47 are only extended, and the images show none of the new details (DESIGN's text wins after O1, as with earlier DESIGN updates).

---

## 8. Definition of Done (proposed, O5)

| DoD item | How it is met | Checked in |
|---|---|---|
| 1. The form asks for the language (English, Hebrew, Russian) and the way to the airport (four buttons) in step 3, both required, and for the other travellers' names in step 4 (one optional box, only with 2 or more travellers); the summary and the review show them; at 375px and 1280px with no cut text | D1–D6, §3 | §6.2 Steps 3 and 4, Back and Edit, Screenshots |
| 2. The details are saved with the order (three new columns on `orders`, no fourth table), and old orders and the live site keep working | D7–D10, D17 | §5, §6.1, §6.2 The order sends and saves |
| 3. The manager screen, the field agent's card and both archive panels show the three details; the approval email and the order lookup show the language and the way to the airport, and never the names | D12–D15 | §5, §6.2 The order sends and saves, The customer side, §6.1 after the push |
| 4. The AI gets none of the new details, and the form still takes under 5 minutes | D11, D16 | §5, §6.2 The AI, Form time |
| 5. The existing tests pass, and new tests cover the validation, the views and the email payload | §5 | `node --test` |

### 8.1 DoD result (27.11.2026, local run on port 3000, Development database)

| DoD item | Result |
|---|---|
| 1. Form: language and way in step 3, names in step 4, summary and review, 375px and 1280px | Pass. "Next" in step 3 with no way chosen shows "Please choose how you will get to the airport." and stays; choosing clears it. The summary shows "Language" and "Getting there" ("Choose how you arrive" before a choice), the review "Russian · Drop-off". The names box shows with 3 travellers and hides with 1; Back to step 2 and forward kept the language and the way. 301 characters shows "Names must be 300 characters or fewer.". At 375px: no cut text in the four buttons (two lines in "Taxi or shuttle" and "Driving and parking", all 54–55px high), no sideways scroll; at 1280 × 800 the whole summary fits beside the form (bottom at 770px). |
| 2. Saved with the order, old orders and the live site keep working | Pass. Asaf ran 007 (Success). Order 2963200E (3 travellers, names on two lines with extra spaces, English, Driving and parking) and order 661F9E02 (typed flight LY916, 1 traveller, Partial, Taxi or shuttle, no names box) were sent and saved; the names came back trimmed ("Noam Avraham"). The old site keeps working: 007's new parameters have defaults (tested), and a body without the new fields is accepted (tested). Seed order 00000014 shows exactly what it showed before. |
| 3. Staff screens show all three; approval email and lookup show language and way, never names | Pass. The manager screen and the manager's archive panel show "Also travelling" (two lines) and "Language · Getting there"; after approving 2963200E ("Email sent to the customer"), the agent's card at 375px and the agent's archive panel show the names line and "Language" / "Getting there". The lookup page shows "Escort language: English" and "Getting there: Driving and parking"; its network reply has no names (checked). The approval payload carries the two labels and no names (unit test; the local server does not print the payload). |
| 4. AI gets none of the details; form under 5 minutes | AI: pass (unit test on `buildOrderDraftInput`; the new order's draft was made as before). Time: **not measured by a person** — the change adds one required tap in step 3 (the language starts on English) and one optional box, so the form should stay well under 5 minutes; Asaf times one booking in his check. |
| 5. Existing tests pass, new tests cover validation, views and email payload | Pass: 226 tests (211 before + 15 new in `tests/order-details-fields.test.js`; three existing expected lists updated for the new fields). |

---

## 9. Build steps (one at a time, each with Asaf's go-ahead)

0. **Documents (after O1):** the approved wording in PRD, DESIGN, ARCHITECTURE and the M16 DoD in MILESTONES, nothing else.
1. **Lists and validation:** `data/lists.json`, `lib/validate.js`, the new tests; run the unit tests.
2. **Database (Development, the shared project):** write `007_order_details.sql`; Asaf runs it in the SQL Editor (plain-Hebrew steps, the file opened in the side pane); check the columns and the function exist.
3. **Server:** `api/submit-order.js`, `lib/orders-view.js`, `lib/notify.js`, the updated tests; run the unit tests.
4. **Form:** step 3 select and buttons, step 4 names box, summary and review rows, CSS.
5. **Staff and lookup screens:** manager details grid, agent card, agent archive panel, the lookup result.
6. **Emails:** the n8n export (§4) and the plain-Hebrew steps for Asaf (to do after the push).
7. **Verify:** §6.2 at 375px and 1280px, screenshots, the timed run, three orders end to end on the local run.
8. **DoD pass:** results written under §8 as "DoD result".
9. **Close:** ADRs (the three optional columns and the 20-parameter insert function; the lists in `data/lists.json` with length-only database checks; what each audience sees, and that the names stay off the customer paths and the AI), 🟡 and checked items in MILESTONES, shut down the local run. No commit.
