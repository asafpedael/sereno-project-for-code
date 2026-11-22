# Milestone 5 — The manager handles exceptions (plan)

**Source:** `spec/MILESTONES.md` (Milestone 5), PRD FR-21, FR-30, FR-32, FR-36 to FR-39, ARCHITECTURE §2 (status transitions, flight-change detection, `resolve_flight_change`), §4 (`clarification_draft`), §5.1 to §5.3, DESIGN (order step 1 and 2, manager screen, "What is not shown in the images", emails, status tags).

**Status:** written 20.11.2026. All decisions in §0 (D1–D18) and open points in §7 (O1–O3) were reviewed with Asaf on 20–22.11.2026: all approved, D13 changed (the flight-change email shows only the new meeting time). Built 22.11.2026 (steps 1–11, each approved by Asaf); every DoD item passes (§8.1). Approved by Asaf and pushed 22.11.2026 (✅).

**Goal:** both exceptions are handled end to end, and the manager always decides:
1. **Flight not found:** the customer types a flight number and date; if no future flight matches, the order goes to the manager as "Needs clarification". The manager rejects it or confirms the flight is missing, and the customer gets one clarification email.
2. **Flight time changed after approval:** the manager sees "Flight time changed", then approves the change (new meeting time, agent screen updated, update email) or ignores it.

---

## 0. Decisions this plan proposes

| # | Topic | Proposal | Why |
|---|---|---|---|
| D1 | Manual flight fields (validation) | Body has **either** `flight_id` (from the list) **or** `flight_no` + `flight_date` (manual), never both (`400`). `flight_no`: letters, digits, spaces and `-`, up to 20 characters; stored normalized (upper case, spaces and `-` removed, e.g. "ly 315" → `LY315`) and must be 2–10 characters after that. `flight_date`: a real `YYYY-MM-DD` date, from today (Israel time) up to 365 days ahead. | ARCHITECTURE §5.1 rules, plus a narrow character set: the typed number is shown to the manager and goes to the AI, so it cannot carry text. The 365-day cap stops typos like 2062. **Approved by Asaf (20.11.2026).** |
| D2 | Finding a typed flight | Exact match on the normalized number (`flights.flight_no` is stored upper case, e.g. `DM101`) and the Israel-time day of `departure_at`, departure still in the future. More than one match that day → the earliest. Found → a normal `pending` order, exactly as if chosen from the list. Not found → `needs_clarification`. | ARCHITECTURE decision 3 and §5.1 step 4. **Approved by Asaf (20.11.2026).** |
| D3 | Saving a `needs_clarification` order | `insert_order_with_limits` gets two new parameters, `p_flight_date` and `p_status` (and accepts an empty `p_recommended`). The old version of the function is dropped in the same file (`drop function if exists` with the old parameter list) so only one exists. The hourly limits apply to these orders too. | The function hard-codes `pending` and an empty date today. Same locked step, no second insert path. **Approved by Asaf (20.11.2026).** |
| D4 | What the customer sees | Step 1: the link "Can't find your flight? Enter it manually" swaps the list for "Flight number" and "Departure date" (date picker), the text "Our team will check your flight and get back to you." and "Back to search". Step 2: the dark box shows "We will confirm your meeting time after checking your flight." instead of a time. Review and "Request received": flight shown as typed ("LY315 · 12 Dec 2026"). The reply is always `status: "pending"`. | DESIGN step 1 and step 2, ARCHITECTURE §5.1. The customer never learns whether the flight was found. **Approved by Asaf (20.11.2026).** |
| D5 | Manager alert for a missing flight | Same `manager_alert` with `needs_clarification: true`, the typed number, `destination: null`, `departure_local` = the typed date only ("12 Dec 2026"), no meeting time. n8n already shows "New order: flight not found" for it (M4 template); empty rows are hidden. | ARCHITECTURE §5.2. No n8n change for this email. **Approved by Asaf (22.11.2026).** |
| D6 | Manager inbox | `view=inbox` returns `pending` + `needs_clarification` + `approved` orders with `flight_change_pending`. Two queries: one for the first two statuses, one for `approved` orders (up to 500) filtered in code. Sorted by departure as today; orders without a known departure (missing flight) go last. | ARCHITECTURE §2: the check is done in code on each manager read, no trigger. Demo volumes are small. **Approved by Asaf (22.11.2026).** |
| D7 | `flight_change_pending` | `true` only when: status `approved`, the order has a flight, `approved_departure_at` is set, the flight's `departure_at` ≠ `approved_departure_at`, and ≠ `ignored_departure_at` (or that is empty). Compared as instants, not as text. One function in `lib/orders-view.js`, unit-tested. The manager view also gets `previous_departure_at` (= `approved_departure_at`) and `new_recommended_time` (from the formula on the new departure). | ARCHITECTURE §2 exactly. **Approved by Asaf (22.11.2026).** |
| D8 | Double action on a flight change | `resolve_flight_change` gets one more condition: `ignored_departure_at is distinct from p_new_departure`. So a second "Ignore", or "Approve change" right after "Ignore" of the same new time, changes nothing and answers `409`. Plus revoke/grant like the other functions. Recorded as an ADR. | The ARCHITECTURE version would let a second "Ignore" succeed again (no email, but no `409` either), and the DoD asks for `409` on both. **Approved by Asaf (20.11.2026).** |
| D9 | `confirm_flight_missing`: once only | Order of steps: (1) checks: status `needs_clarification`, clarification not sent yet; (2) `clarification_draft` (AI) or the fixed paragraph; (3) **claim**: one conditional update that saves the paragraph with `sent_at = now` only where status is still `needs_clarification` and `sent_at` is still empty → zero rows = `409`; (4) `customer_clarification` email; (5) if the email failed, `sent_at` is cleared again, so the manager can try again, and the warning box shows. The status stays `needs_clarification` (decision 9: it can only stay or be rejected). | Two clicks at once cannot send two emails. "Sent" stays true to its name; a failed email does not lock the order. **Approved by Asaf (20.11.2026).** |
| D10 | `clarification_draft` (AI) | Same `lib/ai.js` call and checks as `order_draft` (OpenAI, strict JSON schema `{ clarification_paragraph }`, 20 s, no URL, no time of day, HTML removed, ≤ 600 characters). Input: `customer_first_name`, `flight_no_submitted`, `flight_date_submitted` ("12 Dec 2026" or null). Never the email, phone or notes. Prompt: the same three rules, English, 2–4 sentences, ask the customer to check the flight number and date and send a new request with the correct details; do not say the flight does not exist, do not promise anything. | ARCHITECTURE §4. The input has no free text from the customer except the name, so the injection risk is small. **Approved by Asaf (22.11.2026).** |
| D11 | Fixed paragraph when the AI fails | "We could not find flight LY315 on 12 Dec 2026 in our schedule. Please check your flight number and departure date, and send a new request with the correct details. We will be glad to help." (without the date part when no date was typed). Stored as `ai_output = { status: "failed", clarification: { paragraph, sent_at } }`. | MILESTONES: "the email is sent with a fixed paragraph". **Approved by Asaf (22.11.2026).** |
| D12 | Reject from "Needs clarification" | `reject` is allowed from `pending` and `needs_clarification` (`decide_order` already takes a list). The rejection email shows the typed number and date. | ARCHITECTURE §2 transitions. **Approved by Asaf (22.11.2026).** |
| D13 | Approve a flight change | `final_time` optional; default = formula on the **current** departure; must be before the current departure (`400` "Meeting time must be before departure"). `resolve_flight_change(p_expected_departure = approved_departure_at read now, p_new_departure = current departure, ...)`. Email `customer_flight_change`: new meeting time highlighted, rows Reference, Flight, New departure. **The old meeting time is not shown to the customer** (`previous_meeting_time_local` is not displayed by the n8n template; recorded as an ADR). Ignore: no email. | FR-38, FR-39, ARCHITECTURE §5.1, §5.2. **Changed by Asaf (22.11.2026): show only the new meeting time; the rest approved.** |
| D14 | Manager screen | Tags "Needs clarification" and "Flight time changed" (dark tag, as DESIGN). In the details, instead of Reject/Approve: **missing flight** → panel with the typed number and date (or "Not given"), "Flight not found in our schedule", buttons "Reject" (secondary) and "Confirm flight missing" (primary); after sending, the line "Clarification email sent" replaces the primary button and the order stays in the list. **Flight changed** → panel "Previous departure" / "New departure", the "Meeting time" field filled with the new recommended time (hint "Recommended HH:MM"), buttons "Ignore" (secondary) and "Approve change" (primary); after either, the order leaves the list. The M4 warning box and "held order" behaviour are reused when `email_sent` is false. No AI box for missing-flight orders. | DESIGN "What is not shown in the images". **Approved by Asaf (22.11.2026).** |
| D15 | Agent screen | No change. After "Approve change" the new `final_time` shows after Refresh; the card already shows the flight's current departure. | FR-38: "the agent screen is updated" (on refresh, PRD note 3). **Approved by Asaf (22.11.2026).** |
| D16 | n8n | Two Set nodes get designed content in the same shape as M4: `customer_clarification` ("Please check your flight details", rows: Reference, Flight number you entered, Departure date you entered; the paragraph; closing "You are welcome to send a new request at any time.") and `customer_flight_change` ("Your meeting time has changed", highlight "New meeting time", rows as D13). The Render email node does not change. The repo export is regenerated (placeholders only, ADR-5); Asaf updates the live workflow (see O1). | DESIGN "Emails": one template for every email. **Approved by Asaf (22.11.2026).** |
| D17 | Testing without burning limits | Seed orders cover most checks: order 6 (DM999, needs clarification) and order 4 (Noa B., flight changed). New orders through the form only where the DoD needs them: manual flight not found, manual flight found, and one for the reject-from-clarification path. A flight change is made by Asaf in the Supabase Table Editor (`flights.departure_at`), as the DoD says. | Rate limits: 3 per email, 30 overall per hour. **Approved by Asaf (22.11.2026).** |
| D18 | Seed before testing | As in M4: re-run `seed.sql` before 14:30 Israel time on each test day. The seed's DM999 order has no typed date (ARCHITECTURE §3: number only), so the screen shows "Not given" for it. | ADR-1. **Approved by Asaf (22.11.2026).** |

---

## 1. Files

### New
- `tests/flight-change.test.js`: `flightChangePending` cases.
- `tests/manual-flight.test.js`: manual-flight validation and normalization.

### Changed
- `supabase/migrations/002_functions.sql`: new `insert_order_with_limits` (D3, drops the old one), `resolve_flight_change` (D8). Asaf runs the file in the SQL Editor.
- `lib/validate.js`: manual flight (D1); `DECISION_ACTIONS` adds `confirm_flight_missing`, `approve_flight_change`, `ignore_flight_change`.
- `lib/time.js`: Israel-day start/end for a `YYYY-MM-DD` date, "today in Israel", date-only formatting.
- `api/submit-order.js`: manual lookup (D2), `needs_clarification` path (no meeting time, no AI), alert (D5).
- `lib/orders-view.js`: `flightChangePending` (D7), manager-view fields: `submitted_flight { flight_no, date }`, `flight_change_pending`, `previous_departure_at`, `new_recommended_time`, `clarification { sent }`; `byDeparture` puts unknown departures last.
- `api/orders.js`: inbox per D6.
- `api/order-decision.js`: `reject` from `needs_clarification` (D12), `confirm_flight_missing` (D9), `approve_flight_change` and `ignore_flight_change` (D13).
- `lib/prompts.js`, `lib/ai.js`: `clarification_draft` (D10), fixed paragraph (D11). The `order_draft` code does not change.
- `lib/notify.js`: `clarificationEmailPayload`, `flightChangeEmailPayload`; `flightFields` uses the typed number and date when there is no flight.
- `public/order.html`, `public/js/order-form.js`, `public/css/base.css` (if needed): manual entry (D4).
- `public/js/manager.js`, `public/css/staff.css`: D14.
- `n8n/sereno-notifications.json`: D16.
- Tests: `tests/validate-decision.test.js`, `tests/orders-view.test.js`, `tests/notify-payload.test.js`, `tests/ai.test.js`.
- `spec/ARCHITECTURE.md`: ADRs (end of build). `spec/MILESTONES.md`: 🟡 (end of build).

---

## 2. Server

### 2.1 `002_functions.sql`
- `insert_order_with_limits(..., p_flight_date date, p_status text, ...)`: inserts `flight_date_submitted = p_flight_date`, `status = p_status` (only `pending` or `needs_clarification` accepted, otherwise zero rows), `recommended_time = p_recommended` (may be null). Same lock and limit checks. The two new parameters come last with defaults (`null`, `'pending'`), so the current `submit-order.js` call keeps working between build steps 1 and 2. `resolve_flight_change` also returns zero rows when the new departure equals the expected one (nothing to resolve). Before it: `drop function if exists public.insert_order_with_limits(<old 13 parameters>)`.
- `resolve_flight_change` as ARCHITECTURE §2, with the extra condition from D8, revoke/grant to `service_role` only.
- File stays safe to re-run.

### 2.2 `POST /api/submit-order`
Step 4 (flight) becomes:
- `flight_id` given → as today.
- Manual → look up by D2. Found → continue exactly as a list choice (`flight_id`, meeting time, AI, alert). Not found → `flight_id = null`, `flight_no_submitted` = normalized number, `flight_date_submitted` = typed date, status `needs_clarification`, no meeting time, no `order_draft` (`ai_output` stays empty), alert per D5.
- Reply always `{ reference, status: "pending" }`.

### 2.3 `GET /api/orders`
- `view=inbox` per D6. `view=approved` and `id=` unchanged, but every manager view carries the D7/D14 fields.

### 2.4 `POST /api/order-decision`
| Action | Check before | Update | Email |
|---|---|---|---|
| `reject` | status `pending` or `needs_clarification` | `decide_order` from both | `customer_rejected` |
| `confirm_flight_missing` | status `needs_clarification`, clarification not sent (else `409`) | D9 claim | `customer_clarification` (failure → release + warning) |
| `approve_flight_change` | `flight_change_pending` (else `409`) | `resolve_flight_change`, `p_ignore = false` (zero rows → `409`) | `customer_flight_change` |
| `ignore_flight_change` | `flight_change_pending` (else `409`) | `resolve_flight_change`, `p_ignore = true` (zero rows → `409`) | none |
- `approve` on an order without a flight stays `409` (and `decide_order` refuses it too).
- Replies: manager view of the order + `email_sent` (ignore: no `email_sent`).

### 2.5 `lib/notify.js` payloads
- `customer_clarification`: `to`, `customer_name`, `reference`, `flight_no` (typed), `departure_local` (typed date, date only, or null), `ai_paragraph` (the stored clarification paragraph).
- `customer_flight_change`: as `customer_approved`, plus `previous_meeting_time_local` (kept in the payload per ARCHITECTURE §5.2, but not shown in the email: D13); `ai_paragraph` empty.
- Never manager notes, customer notes or the phone (unit tests).

### 2.6 AI (`clarification_draft`)
- `CLARIFICATION_SYSTEM`, `CLARIFICATION_SCHEMA`, `buildClarificationInput(order)` in `lib/prompts.js`.
- `generateClarificationDraft(input)` in `lib/ai.js` shares the request, timeout and checks with `order_draft` (the shared parts are factored into one internal function; the `order_draft` behaviour and its tests stay the same).
- Returns `{ status: "ok", model, generated_at, paragraph }` or `{ status: "failed" }`; the caller uses the D11 paragraph on failure.

---

## 3. Browser

### 3.1 Order form (step 1, 2, 4, "Request received")
- Step 1: link → manual mode (D4). Fields with label above, same style as the form; errors: "Please enter your flight number." / "Enter a flight number with letters and digits only." / "Please choose your departure date." / "Choose a date from today on." "Back to search" returns to the list and clears the typed values.
- Step 2: the dark box text per D4.
- Step 4 review row "Flight" and the "Request received" flight line: typed number · date.
- The payload sends `flight_id: null`, `flight_no`, `flight_date` in manual mode.

### 3.2 Manager screen
- D14. The list item for a missing flight: name · typed number, "Flight not found" as the sub-line. Flight changed: name · flight, new departure.
- After "Confirm flight missing": status line "Clarification email sent for order X."; on `email_sent: false` the warning box (M4).
- After "Approve change": "Order X updated. Email sent to the customer." After "Ignore": "Flight change ignored for order X."
- `409` → message + reload, as in M3/M4.

### 3.3 CSS
- Reuse the existing panel, tag and field styles; only small additions (two-line "previous / new" panel).

---

## 4. n8n (D16) — changed by Asaf by hand (ADR-5)
1. The repo export gets the two designed Set nodes.
2. Asaf updates the live workflow (O1): either edit the two Set nodes (copy each field from the export) or re-import the whole file as a new workflow and fill in the same 5 things as in M4.
3. Test events of the two new types go to the test address; Asaf checks them in Gmail on desktop and phone.

---

## 5. Tests (`node --test`)
- Manual flight validation and normalization (D1), including both-given, neither-given, past date, 366 days ahead, bad characters.
- `flightChangePending` (D7): equal, changed, changed-then-ignored, ignored then changed again, not approved, no flight, no `approved_departure_at`.
- Decision validation: the three new actions; roles (agent → `403` on all three).
- Payload builders: clarification and flight-change, with no notes or phone.
- `clarification_draft`: request has no email/phone/notes, output checks, failure → `failed`, fixed paragraph with and without a date.
- Existing 65 tests stay green.

---

## 6. How the build is verified (before marking 🟡)

### 6.1 Asaf's one-time setup (plain-Hebrew instructions at the matching build step)
1. Re-run `002_functions.sql` in the SQL Editor.
2. Re-run `seed.sql` before 14:30 Israel time on each test day.
3. Update n8n (§4).
4. Change one flight's `departure_at` in the Table Editor when asked (flight-change test).

### 6.2 Checks (local run, port 3000, Development keys)
- **Manual, not found (new order #1, test address):** row is `needs_clarification`, `flight_id` empty, typed number and date saved, no `recommended_time`, `ai_output` empty; step 2 shows the text, not a time; "Request received" shown; manager alert "flight not found" arrives; the order shows "Needs clarification".
- **Manual, found (new order #2):** a seed flight's number and date typed by hand → normal `pending` order with a meeting time and AI paragraph.
- **Approve blocked:** `approve` on a missing-flight order → `409`.
- **Confirm flight missing (seed order 6 or #1):** clarification paragraph saved, one email to the test address, "Clarification email sent"; second request → `409`, no second email.
- **AI failure in clarification:** server started with `$env:OPENAI_API_KEY='invalid'` → the email arrives with the fixed paragraph.
- **Reject from clarification (new order #3):** rejection email with the typed number and date.
- **Flight change (seed order 4, and one made by Asaf):** shows "Flight time changed" only for approved orders whose flight moved; approve with an edited time → agent screen shows the new time after Refresh, update email with the new meeting time only (no old time, D13); ignore → no change, no email, the mark does not return; second approve/ignore → `409`, no email.
- **Allowlist:** a decision on a seed order with an `@example.com` address → blocked in n8n.
- **Email failure:** wrong webhook secret for one run → "Confirm flight missing" shows the warning and can be tried again.
- Asaf checks the two new emails in Gmail on desktop and phone.

---

## 7. Open points (need Asaf's answer)

| # | Question | Options | Recommendation |
|---|---|---|---|
| O1 | How to update n8n for the two new emails? | (a) edit the two Set nodes by hand in the live workflow; (b) re-import the whole file as in M4. | (a): only two nodes change, and the credentials and allowlist stay as they are. **Approved by Asaf (20.11.2026): (a).** |
| O2 | Should the manager see the clarification text that was sent? | (a) no, only "Clarification email sent" (DESIGN); (b) also show the paragraph under it. | (a): DESIGN describes only the line. **Approved by Asaf (20.11.2026): (a).** |
| O3 | Email failure on "Confirm flight missing" | (a) the order is released so the manager can try again (D9); (b) mark it as sent anyway. | (a). **Approved by Asaf (20.11.2026): (a), decided together with D9.** |

No contradiction between the documents blocks M5. One small note, no action proposed: ARCHITECTURE §3 lists the seed DM999 order with the number only, so it has no typed date; the screen shows "Not given" (D18).

---

## 8. Definition of Done mapping

| DoD item (MILESTONES M5) | How it is met | Checked in |
|---|---|---|
| Manual, not found → `needs_clarification` row, no meeting time, no AI, "Request received" | D1–D4, §2.2, §3.1 | §6.2 #1 |
| Manual, found → normal `pending` with meeting time | D2 | §6.2 #2 |
| Manager alert + "Needs clarification" | D5, D6, D14 | §6.2 #1 |
| Approve without a flight refused | §2.4, `decide_order` | §6.2 Approve blocked |
| `confirm_flight_missing`: paragraph, one email, second `409` | D9, D10 | §6.2 Confirm |
| Reject from clarification + email | D12 | §6.2 #3 |
| AI failure in clarification → fixed paragraph | D11 | §6.2 AI failure |
| Flight change shown only when it should | D6, D7 | §6.2 Flight change + unit tests |
| Approve change: recalculated, editable, agent updated, update email | D13, D15 | §6.2 Flight change |
| Ignore: no change, no email, mark does not return | D7, D8 | §6.2 Flight change |
| Double approve/ignore → `409`, no extra email | D8 | §6.2 Flight change |
| Emails only to test addresses | n8n allowlist (unchanged) | §6.2 Allowlist |

---

### 8.1 DoD result (build step 10, 22.11.2026)

Local run, Development database, seed re-run at 12:34. Test orders: A5F9CD78 (typed LY315, not found), DC0C39CD (typed "dm-505", found), 9C26B630 (typed AB12, not found). Unit tests: 97 pass.

| DoD item | Result |
|---|---|
| Manual, not found | Pass. A5F9CD78: `needs_clarification`, no flight, LY315 + 2026-12-12 saved, no recommended time, no AI; step 2 showed the note; "Request received". |
| Manual, found | Pass. DC0C39CD: `pending`, flight DM505, meeting time, AI paragraph. |
| Manager alert + "Needs clarification" | Pass. Alerts "New order: flight not found" received; tag shown in the list. |
| Approve without a flight refused | Pass. `409`. |
| `confirm_flight_missing` once only | Pass. Two requests at the same moment: one email, the other `409`; a third `409`. |
| Reject from clarification + email | Pass. 9C26B630 rejected from the screen; email shows AB12 and 20 Dec 2026. |
| AI failure → fixed paragraph | Pass. Server with an invalid OpenAI key; 9C26B630 got the fixed paragraph. |
| Flight change shown only when it should | Pass. Seed order 4 and DC0C39CD (after Asaf moved DM505 by one hour) marked; other approved orders not marked; unit tests. |
| Approve change | Pass, with one difference from the MILESTONES text: recalculated (10:30), edited to 10:15, agent list shows 10:15, update email received. The email shows only the new meeting time (D13, Asaf's decision 22.11.2026), while MILESTONES says "previous and new". |
| Ignore | Pass. Seed order 4 unchanged, no email, mark gone. |
| Double approve/ignore → `409` | Pass. Parallel ignore: one ok, one `409`; approve after ignore `409`; second approve and ignore after approve `409`. |
| Emails only to test addresses | Pass. Seed order 6 (@example.com) blocked in n8n ("Blocked - not in allowlist"). |
| Email failure (extra check) | Pass. Wrong webhook secret: warning shown, retry after the fix sent. |

## 9. Build steps (one at a time, each approved by Asaf)

1. **Database:** `002_functions.sql` (D3, D8); Asaf runs it.
2. **Manual flight on the server:** validation, lookup, `needs_clarification` path, alert; unit tests.
3. **Manual flight in the form:** step 1, step 2 box, review, "Request received"; check at phone and desktop size.
4. **Manager views:** inbox, `flightChangePending`, new fields; unit tests.
5. **Decisions:** reject from clarification, `confirm_flight_missing` (with the fixed paragraph first), flight-change actions, payload builders; unit tests.
6. **AI `clarification_draft`:** prompt, schema, call, checks; unit tests; a few real calls.
7. **Manager screen:** tags, the two panels, buttons, status lines.
8. **n8n:** the two designed emails in the export; Asaf updates n8n; test events; Asaf checks Gmail.
9. **End-to-end:** §6.2, within the rate limits (D17).
10. **DoD pass:** every item in §8.
11. **Close:** ADRs (manual flight lookup, flight-change double-action rule, clarification "sent" claim, old meeting time not shown in the flight-change email), 🟡 in MILESTONES, shut down the local run. No commit.
