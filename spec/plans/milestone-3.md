# Milestone 3 — The manager decides (plan)

**Source:** `MILESTONES.md` → Milestone 3. Features 14, 21, 22, 23, 24 · FR-14, FR-22, FR-23, FR-24, FR-25, FR-42.
**Goal:** a manager signs in to the staff app, sees new orders from the form, changes the meeting time if needed, and approves or rejects. The status in the database changes. Every new order sends one alert email to the manager's test inbox.
**Out of scope (later milestones):** customer emails after a decision and the agent screen (M4), AI recommendations (M4: the box shows "AI suggestions unavailable"), manual flight entry / "Needs clarification" handling and "Flight time changed" handling (M5), "Returning" tag, customer history and "Manager notes" (M6), archive (M7).

---

## 0. Decisions this plan takes (all approved by Asaf on 18.11.2026)

| # | Topic | Proposed decision | Why |
|---|---|---|---|
| D1 | Which orders the manager list shows in M3 | **Approved by Asaf: only `pending`.** `view=inbox` returns `pending` orders, soonest departure first. `needs_clarification` (seed order 6) and approved orders with a changed flight (seed order 4) join the list in M5, together with their boxes and buttons | Their actions belong to M5; showing them now without actions would be half-built |
| D2 | "Status: All" filter in the list header | **Approved by Asaf: not built in M3.** With one status in the list it filters nothing. It is added in M5, when the list holds three kinds of orders. The "Refresh" button sits where the filter will go | Simplest; no control that does nothing |
| D3 | "Archive" tab in the manager header | **Approved by Asaf: not shown until M7.** The header shows Sereno, the "Approvals" tab (active), the role label "Manager" (plain text, no dropdown — the mockup's arrow opens nothing the spec defines) and "Log out" | No link to a page that does not exist |
| D4 | Where a field agent lands after sign-in in M3 | **Approved by Asaf: a small placeholder `staff/agent.html`:** same dark header (Sereno, "Field agent", "Log out") and one line "Approved orders will appear here." M4 replaces its body with the real screen | Proves role routing and "Log out" for the agent now (DoD item 1), without building M4 |
| D5 | `/api/orders` for the agent role in M3 | **Approved by Asaf: manager only. An agent gets `403` for every view.** The agent views (`view=approved`, restricted `id=`) are built in M4 with the agent screen | Nothing in M3 needs them |
| D6 | `/api/order-decision` actions in M3 | **Approved by Asaf: only `approve` and `reject`** (manager). Every other action, including `complete`, returns `400 bad_request` "Unknown action." for a manager; an agent gets `403` for any action. `complete` arrives in M4, the others in M5/M6 | Matches the M3 scope; the DoD asks for `403` for an agent |
| D7 | Meeting-time field | **Approved by Asaf: two inputs side by side under the label "Meeting time": a date (`type=date`) and a time (`type=time`)**, both Israel time, pre-filled with the recommended date and time. Under them: "Recommended 12:45" (with the date when it is not the departure day). The page converts Israel wall-clock time to an ISO instant (`public/js/time.js`) | DESIGN: date and time, Israel time. Separate inputs look the same in every browser, unlike `datetime-local` |
| D8 | Which meeting time the page sends on "Approve" | **Approved by Asaf: `final_time` is sent only if the manager changed the date or time.** If not, the server uses the meeting time it recomputes from the current flight time (FR-42), so a flight change between page load and the click can never save a stale time | ARCHITECTURE §5.1: default is the recomputed `recommended_time` |
| D9 | `decide_order` and approving without a flight | **Approved by Asaf: the function's `where` also requires `flight_id is not null` when the target status is `approved`** (one extra condition, not in the ARCHITECTURE SQL). The API checks it first too and returns `409` | ARCHITECTURE status table: "`pending` → `approved`: `flight_id` required". The extra guard keeps it true even if the API check is ever skipped |
| D10 | Meeting time in the past | **Approved by Asaf: no extra rule.** Only "must be before departure" (FR-25) is enforced | The spec does not ask for more; don't invent requirements |
| D11 | Text of the `manager_alert` email | **Approved by Asaf: keep the template in the repo export and add two lines:** "Travellers: N, bags: N" and "Suggested meeting time: …". The webhook body sends `meeting_time_local` (the recommended time). No link in the email (the site address is not in the spec) | Gives the manager the essentials; within the §5.2 payload |
| D12 | Staff CSS | **Approved by Asaf: new file `public/css/staff.css`** for the staff header tabs, the two-column layout, list items and the detail grid. Buttons, fields, tags, panels and alerts come from `base.css` unchanged | Keeps `base.css` shared; staff-only styles in one place |
| D13 | Login token storage | **Approved by Asaf: `sessionStorage` key `sereno_session`:** `{ access_token, expires_at, role, email }`. The stored role is used **only** to choose which page to open; every API call is checked on the server from the token | ARCHITECTURE §3 steps 3–7 |
| D14 | Expired token check | **Approved by Asaf: both:** the page treats a token past `expires_at` as gone (back to login), and any `401` from the API clears the session and goes to login | DoD item 3; covers the one-hour Supabase default without waiting |

### Points verified against current docs (ARCHITECTURE §9 point 2)

- **Sign-in URL:** `POST {SUPABASE_URL}/auth/v1/token?grant_type=password`, headers `apikey: <publishable key>` and `Content-Type: application/json`, body `{ "email", "password" }`. Answer: `access_token`, `expires_in`, `expires_at`, `user` (with `app_metadata`). Supabase's API-keys guide says publishable and secret keys go in the `apikey` header, never in `Authorization: Bearer` (they are not JWTs). **Still to confirm by a live call in build step 2:** that `/auth/v1/token` accepts the `sb_publishable_…` key (the docs show the pattern but not this exact endpoint). If it is refused, stop and ask.
- **Server check:** `lib/auth.js` calls `getSupabase().auth.getUser(token)` (secret-key client) and reads `user.app_metadata.role`.
- **Editing `app_metadata`:** the Supabase dashboard user page shows the metadata but third-party guides and community answers edit it with SQL, not in the UI. Plan: Asaf runs one `update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"manager"}'::jsonb where email = '…';` in the SQL Editor per user (exact text in §5.1). If the dashboard offers an edit box at build time, either way is fine. A role change shows up after the next sign-in.

---

## 1. Files

### New

| File | What |
|---|---|
| `lib/auth.js` | `requireStaff(req, res, allowedRoles)`: reads `Authorization: Bearer`, verifies with `auth.getUser`, returns `{ user, role }` or sends `401`/`403` and returns `null`. Pure helper `roleFromUser(user)` (only `manager`/`agent`, else `null`) |
| `lib/orders-view.js` | `ORDER_SELECT` (one select string with embedded customer email and flight), `currentRecommended(row)` (FR-42), `toManagerView(row)` |
| `lib/time.js` | `formatLocalIL(date)` → `"27 Oct 2026, 14:30"` (Asia/Jerusalem) for the webhook body |
| `api/orders.js` | `GET /api/orders?view=inbox` and `GET /api/orders?id=<uuid>` (manager only in M3) |
| `api/order-decision.js` | `POST /api/order-decision` with `approve` / `reject` |
| `public/staff/login.html` | "Staff sign in" |
| `public/staff/manager.html` | Approvals screen |
| `public/staff/agent.html` | Placeholder (D4) |
| `public/css/staff.css` | Staff layout styles (D12) |
| `public/js/session.js` | Session in `sessionStorage`, `requireRole`, `logout`, staff `get`/`post` with the token and the 401 rule |
| `public/js/login.js` | Sign-in flow |
| `public/js/manager.js` | List, details, meeting time, approve/reject |
| `tests/time.test.js` | Israel wall-clock ↔ ISO conversion, day labels |
| `tests/orders-view.test.js` | `currentRecommended`, `toManagerView` |
| `tests/validate-decision.test.js` | `validateDecisionBody` |
| `tests/auth.test.js` | `roleFromUser` |

### Changed

| File | Change |
|---|---|
| `supabase/migrations/002_functions.sql` | Add `decide_order` (`create or replace`, same style and grants as `insert_order_with_limits`) |
| `api/submit-order.js` | Step 8: `manager_alert` webhook after a successful insert |
| `lib/validate.js` | Add `validateDecisionBody(body)` and `isUuid` |
| `public/js/time.js` | Add `israelInputToIso(date, time)`, `toIsraelInputs(iso)` and `formatDayTimeIL(value)` ("Today 14:30" / "Tomorrow 21:20" / "Thu 10 Dec 14:30") |
| `public/js/api.js` | `getJson`/`postJson` accept an optional token (adds `Authorization: Bearer`) |
| `n8n/sereno-notifications.json` | `Set manager_alert` text (D11), placeholders only (ADR-5) |
| `spec/MILESTONES.md` | 🟡 next to Milestone 3 at the end of the build |
| `spec/ARCHITECTURE.md` | New ADRs (§8), on Asaf's approval |
| `CLAUDE.md` | Run commands unchanged (only if they change) |

No new dependency. No new secret key: the login uses `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, already in Vercel (Config) and returned by `/api/config`.

---

## 2. Server

### 2.1 `supabase/migrations/002_functions.sql` — add `decide_order`

Appended after `insert_order_with_limits`, same header style:

```sql
-- Records the manager's decision on an order in one conditional update (approve or reject).
-- Returns the updated row, or zero rows when the order is no longer in an allowed status
-- (decided already, or by someone else at the same moment) -> the API answers 409.
create or replace function public.decide_order(
  p_order_id uuid, p_from text[], p_to text,
  p_final_time timestamptz, p_notes text, p_departure timestamptz,
  p_recommended timestamptz
) returns setof public.orders
language sql security invoker set search_path = ''
as $$
  update public.orders
     set status = p_to,
         final_time = p_final_time,
         recommended_time = coalesce(p_recommended, recommended_time),
         manager_notes = coalesce(p_notes, manager_notes),
         approved_departure_at = p_departure,
         decided_at = pg_catalog.now()
   where id = p_order_id
     and status = any (p_from)
     and (p_to <> 'approved' or flight_id is not null)
  returning *;
$$;
revoke execute on function public.decide_order(uuid, text[], text, timestamptz, text, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.decide_order(uuid, text[], text, timestamptz, text, timestamptz, timestamptz)
  to service_role;
```

Same signature as ARCHITECTURE §2 (so M5/M6 reuse it), plus the D9 guard and `pg_catalog.now()` (empty `search_path`). Asaf re-runs the whole file in the SQL Editor (safe: `create or replace`). `resolve_flight_change` (M5) and `complete_order` (M4) are not added now.

### 2.2 `lib/auth.js`

1. Header must be `Authorization: Bearer <token>`, token 20–4096 characters, no spaces → else `401 unauthorized` "Please sign in."
2. `const { data, error } = await getSupabase().auth.getUser(token)`. Error or no user → `401` (logged with `console.error` without the token).
3. `role = roleFromUser(data.user)` — reads `app_metadata.role` only, never `user_metadata`. `null` → `403 forbidden` "Your account has no staff role."
4. Role not in `allowedRoles` → `403 forbidden` "You do not have permission for this action."

### 2.3 `GET /api/orders` (`api/orders.js`)

Order of checks: method `GET` (else 405) → `requireStaff(['manager'])` (D5) → parameters.

- `view=inbox`: `select(ORDER_SELECT).eq('status','pending')`, limit 50. Sorted in code by the flight's `departure_at` ascending (D1). Answer `{ orders: [...], page: 1 }`.
- `id=<uuid>`: one order in any status (manager). Bad uuid → `400`; not found → `404`.
- Any other `view` → `400` "Unknown view." (`approved` and `archive` come in M4/M7).

`ORDER_SELECT` = `*, customer:customers(email), flight:flights(flight_no, destination, departure_at)` (one PostgREST call with the existing foreign keys).

`toManagerView(row)` — shape from ARCHITECTURE §5.1, only the M3 fields:

```json
{ "id": "uuid", "reference": "A1B2C3D4", "status": "pending",
  "customer": { "full_name": "<contact_name>", "phone": "<contact_phone>", "email": "<customers.email>" },
  "flight": { "flight_no": "DM101", "destination": "London", "departure_at": "..." },
  "travelers": 2, "bags": 3, "services": ["porter"], "escort_scope": "full",
  "customer_notes": "...", "recommended_time": "...", "final_time": null, "created_at": "..." }
```

- `customer_notes` is added to the documented shape because the mockup shows the "Customer notes" box (the column exists already).
- Order without a flight (M5 case): `flight = { flight_no: flight_no_submitted, destination: null, departure_at: null }`.
- `currentRecommended(row)`: for `pending` with a flight → `meetingTime(flight.departure_at, travelers, bags)` (FR-42, decision 14); otherwise the stored column.
- Not returned in M3: `ai_output` (M4), `is_returning_customer`, `previous_orders`, `manager_notes` (M6), `flight_change_pending` (M5).

### 2.4 `POST /api/order-decision` (`api/order-decision.js`)

Order of steps:

1. Method `POST` (else 405).
2. `requireStaff(['manager'])` → 401 / 403 (an agent always gets 403 in M3, D6).
3. `validateDecisionBody(body)` → 400. Rules: `order_id` uuid; `action` in `approve`, `reject` (else "Unknown action."); `final_time` optional, only with `approve`, a string ≤ 40 characters with a time zone (`Z` or `±hh:mm`) that parses to a valid date. `manager_notes` is ignored in M3 (M6).
4. Load the order with `ORDER_SELECT` → 404 if missing.
5. **reject:** status must be `pending` (M3; `needs_clarification` joins in M5) → else 409. `rpc decide_order(p_from: ['pending'], p_to: 'rejected', p_final_time: null, p_notes: null, p_departure: null, p_recommended: null)`.
6. **approve:** status must be `pending` and `flight_id` not null → else 409 "This order can no longer be approved." Then:
   - `departure = flight.departure_at` (read now — the current flight time), `recommended = meetingTime(departure, travelers, bags)`.
   - `final = final_time ?? recommended`.
   - `final >= departure` → `400 bad_request` "Meeting time must be before departure".
   - `rpc decide_order(p_from: ['pending'], p_to: 'approved', p_final_time: final, p_notes: null, p_departure: departure, p_recommended: recommended)`.
7. Zero rows from the rpc → `409 conflict` "This order was already decided."
8. Answer `{ ok: true, data: { order: toManagerView(updated) } }`. No customer email in M3 (`email_sent` is added in M4).

### 2.5 `manager_alert` in `api/submit-order.js` (FR-14)

After the insert succeeds (step 8 in the code; the AI call is added before it in M4):

```js
await notify({
  type: 'manager_alert',
  reference, customer_name: order.full_name,
  flight_no: flight.flight_no, destination: flight.destination,
  departure_local: formatLocalIL(departure), meeting_time_local: formatLocalIL(recommended),
  travelers, bags, services: <labels from lists.json>, escort_scope: <label>,
  needs_clarification: false,
});
```

- The flight query in step 4 adds `destination` to its select.
- No `to` field: the manager address lives in n8n (§5.2). No manager notes, no AI text.
- A failed webhook is only logged; the customer still gets the normal answer (ARCHITECTURE step 9).
- Honeypot and `429` paths send nothing.

### 2.6 n8n (ADR-5)

- Repo export: `Set manager_alert` text gets the D11 lines; the address stays `manager-inbox@example.com`.
- **Live workflow in n8n Cloud (Asaf, by hand, guided step by step):** open "Sereno notifications" → node `Set manager_alert` → paste the new text → check that the `to` value is Asaf's real manager test inbox and that the same address is in the `Allowlist check` list → save and publish. Both webhooks (`sereno`, `sereno-dev`) already lead to the Switch.

---

## 3. Browser

### 3.1 Shared: `session.js` and `api.js`

- `saveSession({ access_token, expires_at, role, email })`, `getSession()` (returns `null` when missing, unreadable or `expires_at` passed), `clearSession()`.
- `requireRole(role)`: no session → `location.replace('/staff/login.html')`; other role → the other role's page.
- `staffGet(path)` / `staffPost(path, body)`: add the token; on `ApiError` with status `401` → `clearSession()` and go to login.
- `logout()`: `clearSession()` and go to login (no call to Supabase; ARCHITECTURE §3 step 7).

### 3.2 `staff/login.html` + `login.js`

- Dark header with "Sereno". Narrow centred column (same `container-narrow` as the form): heading "Staff sign in", fields "Email" and "Password" (labels above, `autocomplete="username"` / `"current-password"`), primary button "Sign in" full width.
- If a valid session exists → go straight to the role's page.
- Submit: both fields required (field errors in the Style Guide error style). `GET /api/config` → `fetch(supabase_url + '/auth/v1/token?grant_type=password', { apikey })`.
  - `400`/`401` from Supabase → error box above the button: "Incorrect email or password".
  - Role missing or unknown → "This account has no staff access." (nothing saved).
  - Network or other error → "Something went wrong. Please try again."
  - Success → `saveSession` → `manager.html` or `agent.html`.
- The button is disabled while waiting. The password is never stored or logged.

### 3.3 `staff/manager.html` + `manager.js` (desktop, two columns, to the mockup)

**Header (dark):** "Sereno", tab "Approvals" (active: cream text, gold underline), right side "Manager" label and small on-dark button "Log out" (D3).

**Title row:** "Orders awaiting decision" (h3 size) and a small secondary "Refresh" button on the right (D2).

**Left column — list** (about 5/12 of the width, the panel border on the right):
- One button per order (keyboard focusable, `aria-pressed` for the selected one, gold left bar like `.option.is-selected`).
- Line 1 bold: "Daniel A. · DM101". Line 2 small, soft: "London · Today 14:30 · 2 travellers". Line 3: tag "Pending".
- Empty list: "No orders are waiting for a decision."

**Right column — details** of the selected order (first order selected on load):
- "Order A1B2C3D4" (h3) and the status tag on the right.
- Two-column data grid (small soft label above bold value): Customer · Phone / Email · Flight ("DM101 · London") · Departure ("Today 14:30") · Travellers · Bags ("2 · 3") · Services · Escort ("Porter / luggage help · Full (to the gate)"; "No extra services" when empty). Escort scope is text only — no control can change it (FR-05).
- Two panels side by side: "Customer notes" (the notes, or "No notes") and "AI recommendations" ("AI suggestions unavailable" in M3).
- "Meeting time": date + time inputs (D7), hint "Recommended 12:45" under them. Field error under the inputs: "Meeting time must be before departure" (checked in the page before sending, and shown again if the server answers 400 with that message). Missing date or time → "Please enter a date and time."
- Bottom right: "Reject" (secondary) and "Approve" (primary). Both disabled while a request runs.
- After success: the order leaves the list, the next one is selected, and a short status line under the title says "Order A1B2C3D4 approved." / "… rejected." (`role="status"`).
- `409` → error box "This order was already decided." and the list reloads. Other errors → "Something went wrong. Please try again."
- "Refresh" reloads the list (keeps the selection if the order is still there). This is how a flight-time change shows (FR-42).
- Below 900px wide: list above details, one column (DESIGN "mobile version of the manager screen").

All data text is set with `textContent` (`dom.js`). Labels for services and escort come from `GET /api/config` lists. Times use `time.js` (Israel time).

### 3.4 `staff/agent.html` (placeholder, D4)

Header "Sereno", "Field agent", "Log out"; body heading "Approved orders" and the line "Approved orders will appear here." Uses `requireRole('agent')`. Replaced in M4.

---

## 4. Tests (`node --test`)

| File | Cases |
|---|---|
| `tests/time.test.js` | `israelInputToIso('2026-12-10','12:45')` = 10:45Z (winter) and a summer date (UTC+3); round trip with `toIsraelInputs`; midnight crossing; `formatDayTimeIL` gives "Today" / "Tomorrow" / a date |
| `tests/orders-view.test.js` | `pending` order → recommended recomputed from a moved departure; `approved` order keeps its stored value; `customer.full_name/phone` come from `contact_*`; email from the customer; no-flight order maps `flight_no_submitted`; `reference` = first 8 characters upper case |
| `tests/validate-decision.test.js` | bad uuid, unknown action, `complete` → 400 in M3, `final_time` without zone, invalid date, `final_time` with `reject` rejected, valid approve with and without `final_time` |
| `tests/auth.test.js` | `roleFromUser` reads only `app_metadata.role`; `user_metadata.role = "manager"` gives `null`; unknown role gives `null` |
| `tests/meeting-time.test.js` | unchanged, must still pass |

---

## 5. How the build is verified (before marking 🟡)

### 5.1 Asaf's one-time setup (step-by-step instructions given in plain Hebrew at build step 2)

1. Supabase → **Authentication → Sign In / Providers** → turn **off** "Allow new users to sign up" → Save.
2. **Authentication → Users → Add user → Create new user**: the manager's email (a test inbox of Asaf's), a password, tick **Auto Confirm User**. Repeat for the agent with another email.
3. **SQL Editor** → run, once per user (Asaf replaces the email; nothing is sent to the AI):
   ```sql
   update auth.users
      set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"manager"}'::jsonb
    where email = 'MANAGER_EMAIL_HERE';
   ```
   and the same with `"agent"` for the agent's email. Then check: `select email, raw_app_meta_data->>'role' from auth.users;`.
4. **SQL Editor** → paste and run the whole new `002_functions.sql`.
5. n8n: update `Set manager_alert` and check the allowlist (§2.6).
6. Re-run `supabase/seed/seed.sql` **before 14:30 Israel time** on the test day (ADR-1). This also removes test orders from earlier runs.

Passwords are typed by Asaf only (in Supabase and on the login page); the AI never sees them.

### 5.2 Checks (local run, `vercel dev` on port 3000, Development keys)

**Rate-limit budget:** every form submission counts toward 30 per hour for the whole system and 3 per hour per email. The checks below submit **at most 5 orders in one hour**, with two different `example.com` emails. Seed orders do not count (they were "created" in past days).

1. `node --test` — all tests pass.
2. Without a token: `GET /api/orders?view=inbox` → 401; `POST /api/order-decision` → 401.
3. Asaf signs in as manager → `manager.html`; the list shows the seed `pending` orders (Daniel A., Maya Z., Alon P., …) and no order of another status.
4. Wrong password → "Incorrect email or password". Sign-up: `POST /auth/v1/signup` with the publishable key is refused.
5. Asaf signs in as agent (another tab) → `agent.html`. With the agent token: `GET /api/orders?view=inbox` → 403, `POST /api/order-decision` (approve) → 403.
6. Expired token: change the stored `expires_at` to the past → page goes to login. Corrupt the token → API 401 → login. "Log out" → `sessionStorage` empty, Back button cannot use the screen.
7. Submit 1 order from `/order.html` → it appears after "Refresh" with the details and the recommended meeting time; **one** alert email reaches the manager test inbox (Asaf confirms).
8. Approve a seed order without changing the time → row: `approved`, `final_time = recommended_time`, `approved_departure_at = flight departure`, `decided_at` set.
9. Approve another order after moving the meeting time 15 minutes earlier → `final_time` = the new value.
10. Meeting time equal to or after departure → page error "Meeting time must be before departure"; the same request sent directly to the API → 400; the row is unchanged.
11. Reject an order → `rejected`.
12. Approve the same order again (direct API call) → 409, row unchanged; two approvals sent at the same moment → one 200 and one 409.
13. FR-42: in the Supabase Table Editor, move the departure of a flight that has a pending order by +60 minutes → "Refresh" → recommended time is 60 minutes later; approve → `final_time`, `recommended_time` and `approved_departure_at` use the new departure. Re-run the seed afterwards.
14. Escort scope is shown as text; the API ignores any `escort_scope` sent to it.
15. The screen at 1280px matches the mockup (two columns); at 375px it does not break (one column). Keyboard: Tab reaches list items, inputs and buttons with the gold focus ring.
16. Secrets: no key in the repo, the browser code or API answers; the staff pages show only the publishable key (from `/api/config`).
17. Production (after Asaf's push in a later step, not part of the build): repeat checks 3, 7 and 8 on the live site.

---

## 6. Definition of Done mapping

| DoD item (MILESTONES M3) | Covered by | Check |
|---|---|---|
| Manager signs in and reaches `manager.html`; an agent is recognised as an agent; no self sign-up | §3.2, D4, §5.1 steps 1–3 | 5.2 #3, #4, #5 |
| `/api/orders` without a token → 401; agent to `/api/order-decision` → 403 | §2.2, §2.3, §2.4 | 5.2 #2, #5 |
| Expired token → login; "Log out" deletes the token | §3.1, D14 | 5.2 #6 |
| A new order from the form appears in the manager list with its details and recommended time | §2.3, §3.3 | 5.2 #7 |
| Each new order sends one alert email to the manager's test inbox | §2.5, §2.6 | 5.2 #7 |
| Approve → `approved`, `final_time` (default or changed), `approved_departure_at`, `decided_at` | §2.1, §2.4 | 5.2 #8, #9 |
| Reject → `rejected` | §2.4 | 5.2 #11 |
| A second decision → 409, nothing changes | §2.1, §2.4 step 7 | 5.2 #12 |
| Escort scope cannot be changed on the manager screen | §3.3 | 5.2 #14 |
| Meeting time not before departure → "Meeting time must be before departure", not approved | §2.4 step 6, §3.3 | 5.2 #10 |
| Flight time changed in the dashboard for a pending order → after Refresh recomputed, approval saves the new time | §2.3 `currentRecommended`, §2.4 step 6 | 5.2 #13 |
| The screen looks like the mockup on desktop: list and details side by side | §3.3, `staff.css` | 5.2 #15 |

---

## 7. Open points (need Asaf's answer before or during the build)

1. ~~D1–D14~~ — all approved as proposed (18.11.2026).
2. **Test inboxes:** which addresses Asaf uses for the manager and agent users and as the manager-alert address in n8n (Asaf types them himself in Supabase and n8n; they are not written in the repo).
3. **ADRs to add after the build** (with Asaf's approval): staff session and login flow (D13/D14, sign-in URL verified), `decide_order` extra guard (D9), M3 scope of the manager list and of the APIs (D1, D5, D6).

---

## 8. Build steps (one at a time, each approved by Asaf)

1. **Database function:** add `decide_order` to `002_functions.sql`. Asaf runs the file in the SQL Editor. Check: the function exists, and with the secret key a direct `rpc` on a seed order works once and returns zero rows the second time (then re-run the seed).
2. **Staff users and login:** guide Asaf through §5.1 steps 1–3. Build `lib/auth.js`, `session.js`, `login.js`, `staff/login.html`, `staff/agent.html` placeholder, `staff.css` (header and login parts), the `api.js` token option, `tests/auth.test.js`. Confirm the live sign-in call with the publishable key. Check: manager and agent sign in and land on the right page; wrong password message; sign-up refused.
3. **Orders API:** `lib/orders-view.js`, `api/orders.js` (`inbox`, `id`), `tests/orders-view.test.js`. Check: 401 without token, 403 for the agent, the pending seed orders with recomputed times.
4. **Manager screen (read):** `staff/manager.html`, `manager.js`, rest of `staff.css`, `time.js` additions + `tests/time.test.js`. Check: list and details match the mockup at 1280px, one column at 375px, Refresh, Log out, expired-token redirect.
5. **Decisions:** `lib/validate.js` `validateDecisionBody` + tests, `api/order-decision.js`, meeting-time inputs and Approve/Reject in `manager.js`. Check: 5.2 #8–#14.
6. **Manager alert:** `manager_alert` in `submit-order.js`, `lib/time.js`, repo n8n export text; guide Asaf through the live n8n change (§2.6). Check: one order from the form → one email in the manager test inbox (5.2 #7).
7. **Full verification and wrap-up:** all of §5.2 #1–#16 in one pass (within the rate-limit budget), re-run the seed, shut the local server down, propose the ADRs, mark 🟡 in `MILESTONES.md`. No commit.
