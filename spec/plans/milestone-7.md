# Milestone 7 — Archive (plan)

**Source:** `spec/MILESTONES.md` (Milestone 7, "Out of this document"), PRD FR-33, FR-34, FR-35, §3 (screen 5, "Archive: desktop only", "the field agent reaches the archive from a link on the phone screen"), §5 ("the archive is a query on `orders`"), assumptions 1–2, ARCHITECTURE §1 (`public/staff/archive.html`, `api/orders.js`), §2 (`orders`, indexes, statuses), §3 (permission matrix, what the agent may see, the FR-35 note), §5.1 (`GET /api/orders` with `view=archive`, `q`, `status`, `from`, `to`, `page`), §7 (`archive.html`, `archive.js`), ADR-10, ADR-15, ADR-22, ADR-24, ADR-25, DESIGN (screen 4 tabs and "Archive · opens on desktop" link, screen 5 "Archive", navigation, "What is not shown in the images" — stats, "View" and the archive "Returning" tag are Could, the dark "website" section at the end of part 1, Style Guide tables, tabs and pagination), the three images (frame 9 "Archive", frames 7 and 8 for the headers).

**Status:** written 23.11.2026. All decisions D1–D16 and the recommended option of each open point (O1 a, O2 a, O3 a) approved by Asaf (23.11.2026). **Build step 1 done (23.11.2026):** `view=archive` checked against the Development database as manager (all statuses, search by name / flight number / Hebrew name, status, today's dates, combined, page past the end, 400s, 401). Found in the check: the local server does not turn "+" into a space in the query, and spaces are lost inside the "or" filter — the archive search reads "+" as a space, letters of any language are kept, and a space in a name search works as a wildcard ("maya z" finds "Maya Z."). The agent check is done at step 4. **Build step 2 done (23.11.2026):** `archive-demo.sql` written; Asaf ran `seed.sql` and then it. Manager archive: 75 orders, page 1 = 50 rows, page 2 = 25, no overlap, newest first; Completed 48, Rejected 16; a past date range with a status returns the right demo orders; the manager inbox and the approved list still show only seed orders. **Build step 3 done (23.11.2026):** `archive.html`, `archive.js`, `paging.js`, archive styles, `requireRole` with a list, `formatDayMonthIL`. Checked as manager at 1280 and 1920px: table, page 2 (focus moves to the table), search while typing, status, dates, From after To (error, table cleared), empty result. Fixed in the check: the "Rejected" tag was faint on dark (now the Style Guide red), and at 375px the header with two tabs was too wide (the role name is hidden below 600px; the table scrolls in its box). **Build step 4 done (23.11.2026):** manager "Archive" tab (both ways); agent "Orders / Archive" tab row and the "Archive · opens on desktop" link, both opening the archive from the 375px agent screen. As agent (Asaf signed in): 53 orders (5 approved + 48 completed) on 2 pages, only Approved / Completed in the menu and the rows, no email or other field outside `toAgentView`, `status=pending` → empty list, `view=inbox` → `403`; checked at 1280px. **Steps 5–7 done (23.11.2026):** end-to-end and DoD pass (§8.1, every item passes), ADR-26 to ADR-28 added, MILESTONES M7 marked 🟡, local run stopped. Approved by Asaf and pushed 23.11.2026 (✅).

**Goal:** the manager and the field agent can look back at earlier orders:
1. **Manager:** an "Archive" tab next to "Approvals" opens "Order archive": every order in every status, with search (customer name or flight number), a status filter, a departure date range (From / To) and 50 rows per page.
2. **Field agent:** an "Archive" tab and the link "Archive · opens on desktop" on the phone screen open the same archive, limited to `approved` and `completed` orders and without the customer's email.
3. **Look:** the archive is a desktop screen in the dark "website" look from M6 (`.dark-body`, `.theme-dark`, 8px buttons and fields), laid out as the Archive mockup without the statistics cards.

---

## 0. Decisions this plan proposes

| # | Topic | Proposal | Why |
|---|---|---|---|
| D1 | One page for both roles | One page `public/staff/archive.html` with `public/js/archive.js`, open to `manager` and `agent`. The page reads the role from the session only to draw the header and the status menu; what each role may see is decided by the server (D6). A visitor without a session goes to the sign-in page, as on the other staff pages. | ARCHITECTURE §1 and §7 name one file for both roles. The server is the only real permission check (ARCHITECTURE §3). |
| D2 | Header and tabs | The same dark header as the other staff screens (Sereno + tagline, tabs, role, "Log out"). **Manager:** tabs "Approvals" (→ `manager.html`) and "Archive" (active), role "Manager". **Agent:** tabs "Orders" (→ `agent.html`) and "Archive" (active), role "Field agent". The tabs are filled by `archive.js` from the session role, because a static page cannot know it. | DESIGN screen 5 ("same header as the manager screen, with Archive active") and navigation ("the orders tab returns to Approvals or Orders"). |
| D3 | Entry points | **Manager screen:** the "Archive" tab is added next to "Approvals" in `manager.html`. **Agent screen:** under the header, the tab row "Orders" (active) and "Archive", as DESIGN screen 4 and mockup 8; and at the bottom of the list the link "Archive · opens on desktop". Both are plain links to `/staff/archive.html` in the same tab, so the session (kept per tab, ADR-10) carries over. | MILESTONES M7 ("Archive tab on the manager screen, link on the agent's phone screen"); DESIGN screens 3 and 4 show both the tabs and the link. |
| D4 | What the screen shows | Heading "Order archive". **No** statistics cards (feature 33, Could). Filter row: search field "Search customer or flight", status menu ("Status: All" and one option per status, D7), "From" and "To" date fields. Table columns: **Reference**, **Customer**, **Flight** ("DM101 London"; a typed flight that was not found shows only the typed number, e.g. "DM999"), **Departure** ("25 Oct 14:30" in Israel time; "–" when there is no flight), **Meeting time** (the approved meeting time, "12:45"; "–" when there is none, e.g. pending or rejected; when the meeting falls on another day than the departure, the date is added: "23:40 · 30 Nov"), **Status** (the status tag: Pending, Approved, Rejected, Needs clarification, Completed). Under the table: "Showing 1–50 of 63" and the page buttons (D9). **Not shown:** the "View" link and the "Returning" tag in the archive (both feature 35, Could, see DESIGN "What is not shown"). | MILESTONES M7 ("not included: statistics, full order details with returning customers"), DESIGN screen 5 and its notes, mockup frame 9. |
| D5 | Dark look | `archive.html` uses `<body class="dark-body">` and `<main class="archive theme-dark">`, with `tokens.css`, `base.css`, `staff.css` and `theme.css`, like the manager and agent pages. The search field, status menu and date fields use the existing field style (`.input`, 8px corners, soft border, gold border in focus). The table follows the Style Guide (header row with a 2px line under it, thin rules between rows) in the dark colours that `.theme-dark` already maps; tags as on the manager screen. Page buttons: 40×40 squares with 8px corners (as the M6 buttons), the current page in gold. Content up to 1240px wide, centred. New styles go in a short "Archive" section of `staff.css`, and only the dark-specific lines in `theme.css`. | ADR-25 ("new screens that should match — the archive in M7 — use `.dark-body` and `.theme-dark`") and the DESIGN dark section, which wins over the mockup colours where they differ. |
| D6 | Who sees what (server) | `GET /api/orders?view=archive` accepts both roles. **Manager:** every status; each row is the manager view (`toManagerView`, with `is_returning_customer`, ADR-22). **Agent:** only `approved` and `completed`, enforced in the query itself (`status in (...)`), and each row goes through `toAgentView` — so no customer email, no `ai_output`, no customer notes, no history (ADR-15). A status filter the role may not see (e.g. an agent asking for `pending`) simply finds nothing. No token → `401`; a user with no staff role → `403` (existing `requireStaff`). | PRD FR-34, FR-35; ARCHITECTURE §3 matrix; MILESTONES DoD. The "only orders he escorted" filter is not built (needs assignment, feature 28, Could). |
| D7 | Status menu | Manager: All, Pending, Approved, Rejected, Needs clarification, Completed. Agent: All, Approved, Completed. The labels are the screen's tag labels ("Pending", not the `lists.json` "Pending approval", to match the tags in the table). | DESIGN screen 5 ("Status: All"), the role limits of D6. |
| D8 | Search and date filters (server) | **`q`** (optional): the existing `cleanSearchQuery` (up to 40 characters; only letters, digits, spaces and `-` are kept, so the text is safe inside the filter). It matches the order's customer name (`contact_name`, case-insensitive, anywhere in the name) **or** the flight number (`flight_no_submitted`, which always holds the number: the chosen flight's number or the typed one; the search text is compared without spaces and `-`, upper case, so "dm 101" finds "DM101"). **`status`** (optional): one of the five codes, else `400` "Unknown status.". **`from`, `to`** (optional, `YYYY-MM-DD`, Israel calendar days, both inclusive): an order matches when its flight departs within those days; an order whose typed flight was not found matches by the date the customer typed. A date that is not a real date → `400`; `from` after `to` → `400` "The From date must not be after the To date.". All filters combine (AND). | MILESTONES M7 and DoD ("search by customer name or flight number", "status and departure date filter, also combined"); ARCHITECTURE §5.1 parameters. |
| D9 | Pages | 50 rows per page. **`page`** (optional, whole number 1–1000, else `400`). The query asks the database for the exact count and only the rows of that page. The reply adds `total` and `page_size` to the §5.1 shape: `{ orders, page, page_size: 50, total }`. On the screen: "Showing 51–63 of 63", buttons ‹ and › (with the accessible names "Previous page" / "Next page", disabled at the ends) and page numbers (all of them when there are up to 7 pages, otherwise the first, the last and the two around the current one, with "…"). The current page has `aria-current="page"`. A new search or filter goes back to page 1. | MILESTONES ("50 rows per page", DoD "more than 50 orders shown in pages"); DESIGN screen 5 ("Showing 1–6 of 16", pages 1, 2, 3) and Style Guide pagination. |
| D10 | Order of the rows | Newest order first (`created_at` descending, which has an index), then by id so the pages never overlap. | The simplest stable order for an archive of all statuses; it works the same for orders without a flight. |
| D11 | How the page searches | The search runs while typing, 300 ms after the last key (and at once on Enter); the status menu and dates run on change. Only the newest answer is drawn (an older, slower answer is ignored). While loading: "Loading orders…". No match: "No orders match your search.". Failure: the error box "Orders could not be loaded. Please try again." All data text is set with `textContent`. A `401` ends the session and opens the sign-in page (existing `session.js`). | Simple and quick for a desktop screen; the same text and error rules as the other staff screens (ARCHITECTURE §1). |
| D12 | Phone size | The archive is designed for desktop only (PRD, DESIGN). It still opens on a phone (the agent's tabs lead to it), and below 900px the table scrolls sideways inside its own box instead of breaking the page; the header, filters and pages wrap. No separate phone layout is built. | PRD "desktop only"; MILESTONES DoD checks the archive on desktop. |
| D13 | `session.js` | `requireRole` also accepts a list of roles (`requireRole(['manager', 'agent'])`), so the archive opens for both; the manager and agent pages keep calling it with one role, unchanged. | Smallest change to the existing sign-in flow (ADR-10). |
| D14 | Database and n8n | **No change.** No migration (the archive is read-only queries on `orders` and `flights` with the existing indexes), no new key, no email, no n8n change. | PRD §5: "the archive and history are queries on `orders`". |
| D15 | Test data for more than 50 orders | The seed has 15 orders, too few to show pages. A new file `supabase/seed/archive-demo.sql`, run by Asaf in the SQL Editor **after** `seed.sql`, adds about 60 past orders: 12 extra demo customers ("Guest 01"… with `@example.com` addresses), past flights (1 to 60 days ago, so they never appear in the order form), about 45 `completed` and 15 `rejected` orders, with dates relative to the day it runs (the same helper as the seed). No `pending` or `approved` orders, so the manager and agent screens do not change. With it, the manager sees about 75 orders (2 pages) and the agent about 53 (2 pages). Re-running `seed.sql` deletes them, as it deletes every test order. See O1. | MILESTONES DoD ("more than 50 orders shown in pages"); creating 50 orders through the form is impossible within the hourly limits (3 per email, 30 overall). |
| D16 | Seed before testing | As before: re-run `seed.sql` before 14:30 Israel time on each test day (ADR-1), then `archive-demo.sql`. | ADR-1, D15. |

---

## 1. Files

### New
- `public/staff/archive.html`: the archive page (D1, D2, D4, D5).
- `public/js/archive.js`: header, filters, table, pages (D2, D4, D7, D9, D11).
- `public/js/paging.js`: two small pure helpers used by `archive.js` — the "Showing 51–63 of 63" text and the list of page numbers (D9), so they can be unit-tested.
- `supabase/seed/archive-demo.sql`: about 60 past orders for paging (D15, O1).
- `tests/archive.test.js`: archive query checks, role limits, paging helpers.

### Changed
- `api/orders.js`: `view=archive` (D6, D8, D9, D10).
- `lib/validate.js`: `validateArchiveQuery` (D8, D9).
- `lib/orders-view.js`: `archiveStatuses(role)` (D6).
- `public/js/session.js`: `requireRole` with a list of roles (D13).
- `public/staff/manager.html`: "Archive" tab (D3).
- `public/staff/agent.html` (and, if needed, a few lines of `public/js/agent.js`): "Orders" / "Archive" tabs and the "Archive · opens on desktop" link (D3).
- `public/css/staff.css`, `public/css/theme.css`: archive styles, agent tab row (D5, D12).
- `spec/ARCHITECTURE.md`: ADRs (end of build). `spec/MILESTONES.md`: 🟡 and checked DoD items (end of build). `CLAUDE.md`: no change expected.

### Not changed
- `supabase/migrations/*`, `supabase/seed/seed.sql`, `n8n/sereno-notifications.json`, `api/order-decision.js`, `api/submit-order.js`, the AI layer, `.env.example` (no new keys) (D14).

---

## 2. Server

### 2.1 `GET /api/orders?view=archive`
1. `requireStaff(req, res, ['manager', 'agent'])` (already the first line): no token → `401`.
2. `validateArchiveQuery(req.query)` → `{ q, flightQ, status, from, to, page }` or `400` with a plain message (D8, D9).
3. Allowed statuses: `archiveStatuses(role)` — manager: the five codes; agent: `approved`, `completed` (D6).
4. **Date range (only when `from` or `to` is given):** one small query on `flights` for the ids whose `departure_at` falls inside the Israel days (`israelDayRange` in `lib/time.js`; an open end has no limit).
5. **Main query** on `orders` with `ORDER_SELECT` and `count: 'exact'`:
   - `status in (allowed)`, plus `status = <status>` when given;
   - search: `contact_name ilike %q%` **or** `flight_no_submitted ilike %flightQ%`;
   - dates: `flight_id in (<ids from step 4>)` **or** (`flight_id is null` and `flight_date_submitted` inside the range);
   - order `created_at desc, id desc`; rows `(page − 1) × 50` to `page × 50 − 1`.
   - The search and the date conditions are each an "or" group and must both apply. **To verify at build step 1:** that two separate "or" groups combine as AND in the Supabase client; if not, they are sent as one combined group (`and(or(...),or(...))`). A unit test covers the filter text.
6. Rows → `managerViews` (manager, with the one extra returning query of ADR-22) or `toAgentView` (agent).
7. Reply: `{ ok: true, data: { orders, page, page_size: 50, total } }`. A page past the end returns `orders: []` with the real `total`.

`view=inbox`, `view=approved` and `id=` do not change.

### 2.2 Errors (plain English, as the other APIs)
| Case | Answer |
|---|---|
| no token / bad token | `401` "Please sign in." |
| user without a staff role | `403` |
| `q` longer than 40 characters | `400` "Search text must be 40 characters or fewer." |
| unknown `status` | `400` "Unknown status." |
| `from` / `to` not a real date | `400` "Dates must be in the form YYYY-MM-DD." |
| `from` after `to` | `400` "The From date must not be after the To date." |
| `page` not a whole number 1–1000 | `400` "Page is not valid." |

---

## 3. Browser

### 3.1 `archive.html` + `archive.js`
- `requireRole(['manager', 'agent'])`; header tabs and role label from the session role (D2); "Log out" as on the other pages.
- Filter row (D4, D7, D8): a search field with a visually hidden label "Search customer or flight" and that placeholder; the status menu (label hidden, first option "Status: All"); "From" and "To" date fields with their short visible labels. Keyboard order: search, status, From, To, then the table and the pages.
- Table (D4): a real `<table>` with `<caption class="visually-hidden">` and `<th scope="col">` headers; status tags as on the manager screen (`tag-pending`, `tag-approved`, `tag-rejected`, `tag-dark`; Completed as the green "approved" style, as on the manager screen today).
- Pages (D9): from `paging.js`; clicking a page loads it and moves focus to the table caption, so a keyboard user lands on the new rows.
- Times in Israel time with the helpers of `public/js/time.js` (a small "25 Oct 14:30" formatter added there if needed).
- Requests: `staffGet('/api/orders?view=archive&...')` with `URLSearchParams`; the newest-answer rule of D11.

### 3.2 Manager screen
- `manager.html`: the "Archive" tab in the existing `<nav class="tabs">`. Nothing else changes.

### 3.3 Agent screen
- `agent.html`: under the header, a row of two tabs, "Orders" (current) and "Archive", styled as the header tabs (gold line under the current one); after the list, the centred link "Archive · opens on desktop". Both go to `/staff/archive.html`. The cards and "Mark completed" do not change.

### 3.4 Styles (D5, D12)
- `staff.css`, new "Archive" section: page width and padding, filter row (wraps on narrow screens), table, row rules, the sideways-scroll box below 900px, footer with "Showing…" on the left and the page buttons on the right, the agent tab row and the bottom link.
- `theme.css`: the dark lines only (table header and row rules in the soft cream lines of the dark look, the status menu and date fields with the dark field style, the current page in gold).

---

## 4. n8n
No change (D14).

---

## 5. Tests (`node --test`)
- `validateArchiveQuery`: empty query → defaults (page 1, no filters); `q` cleaned and limited to 40 characters; `flightQ` without spaces and `-`, upper case; unknown status → error; real dates only; `from` after `to` → error; one-sided ranges allowed; `page` 0, −1, 1.5, "abc", 1001 → error.
- `archiveStatuses`: manager → all five; agent → `approved`, `completed` only; any other value → none.
- The filter text built for the search and the date range (the pure part of step 5 in §2.1), including that cleaned text never carries `,`, `(`, `)` or `%`.
- `paging.js`: "Showing 1–50 of 63", "Showing 51–63 of 63", "Showing 0 of 0"; page lists for 1, 2, 7, 8 and 20 pages at the start, middle and end.
- `toAgentView` (existing tests) still has no email, `ai_output` or history.
- The existing 116 tests stay green.

---

## 6. How the build is verified (before marking 🟡)

### 6.1 Asaf's one-time setup (plain-Hebrew instructions at the matching build step)
1. On the test day, before 14:30 Israel time: run `seed.sql` in the Supabase SQL Editor (Development project), then `archive-demo.sql` (D15, D16).
2. Sign in on the local run, once as the manager and once as the field agent, in the browser pane (I do not type passwords).
3. No new key, no n8n change, no migration.

### 6.2 Checks (local run, port 3000, Development keys)
- **No token:** `GET /api/orders?view=archive` without a token answers `401` (checked with a plain request).
- **Manager — everything:** the Archive tab opens "Order archive"; "Showing 1–50 of about 75"; all five statuses appear (with the status menu: each status alone shows only that status; seed counts: Pending 5, Approved 5, Rejected 1 + demo, Needs clarification 1, Completed 3 + demo).
- **Agent — limited:** from the phone-size agent screen, both the "Archive" tab and the "Archive · opens on desktop" link open the archive; only Approved and Completed rows; the status menu has only All / Approved / Completed; in the browser's network view the rows have no `email` field; a hand-made request with `status=pending` returns an empty list.
- **Search:** "Daniel" → only Daniel A.'s orders (1, 10, 14); "dm404" and "DM 404" → orders 4 and 7 (and demo orders on DM404, if any); "DM999" → order 6 (typed flight); a name that does not exist → "No orders match your search.".
- **Date filter:** From = To = today → only orders whose flight departs today (seed orders 1, 2, 3, 8, 12, 13, 14); a past range → only demo orders of those days; From after To → the error message, nothing breaks.
- **Combined:** status Completed + search "Noa" → order 5 only; status Rejected + a date range → only rejected orders of those days; changing a filter returns to page 1.
- **Pages:** manager and agent both have a page 2; page 2 starts with row 51; no row appears on two pages; ‹ and › are disabled at the ends; keyboard-only paging works.
- **Look (desktop 1280 and 1920px):** matches mockup frame 9 in the dark look — header with Archive active, heading, filter row, table, "Showing…" and pages; no statistics cards; no horizontal page scroll. **Phone (375px):** the page opens, the table scrolls inside its box, nothing overlaps.
- **Other screens unchanged:** the manager inbox and the agent list show the same orders as before `archive-demo.sql` (no demo order appears on them).
- **Unit tests:** all green.

---

## 7. Open points (need Asaf's answer)

| # | Question | Options | Recommendation |
|---|---|---|---|
| O1 | How do we get more than 50 orders, to check the pages? | (a) a separate file `archive-demo.sql` (D15), run after the seed only when testing the archive; (b) add the same past orders into `seed.sql` itself, so one run gives everything (the seed's "15 orders" description and its expected totals change); (c) temporarily show 5 rows per page for the check only (does not test the real 50). | (a): the seed that every earlier check relies on stays the same, and the extra orders are only past `completed` / `rejected` ones that no other screen shows. **Approved by Asaf (23.11.2026): (a).** |
| O2 | ADR-24 (M6) says that a note on an approved order no longer in the manager's list "can be added only through the archive later (M7)". MILESTONES M7 does not include opening an order from the archive ("View" — full order details, feature 35, Could). | (a) M7 as MILESTONES says: no "View" and no notes from the archive; at the end of the build a new ADR records that this stays open (until feature 35); (b) add to M7 a small panel that opens when a row is clicked, with "Manager notes" and "Save note" (manager only) — extra scope beyond MILESTONES. | (a): it is what MILESTONES and DESIGN define for M7; (b) can be a separate decision later. **Approved by Asaf (23.11.2026): (a).** |
| O3 | The agent screen: DESIGN shows both a tab row "Orders / Archive" under the header and the link "Archive · opens on desktop" at the bottom; MILESTONES mentions only a link. | (a) both, as DESIGN and mockup 8 (D3); (b) only the bottom link. | (a): DESIGN decides the layout, and both lead to the same page. **Approved by Asaf (23.11.2026): (a).** |

No contradiction between the documents blocks M7, and no part of the spec M7 needs is a placeholder. Settled by the rules in `CLAUDE.md` (no question needed): DESIGN screen 5 says "View opens an order", but DESIGN's own notes and MILESTONES say "View" (feature 35) and the statistics (feature 33) are Could and are not built — so neither is built; the archive colours follow the DESIGN dark section (Asaf's M6 decision), not the light mockup.

---

## 8. Definition of Done mapping

| DoD item (MILESTONES M7) | How it is met | Checked in |
|---|---|---|
| Manager sees all orders in all statuses; agent only `approved` and `completed`, without customer email | D6, D7, §2.1 steps 3 and 6 | §6.2 Manager, Agent + unit tests |
| A request to the archive without a token returns `401` | `requireStaff` | §6.2 No token |
| Search by customer name and by flight number returns the right orders | D8 | §6.2 Search + unit tests |
| Status filter and departure date filter work, also combined with search | D8 | §6.2 Date filter, Combined |
| More than 50 orders are shown in pages | D9, D10, D15 | §6.2 Pages + unit tests |
| The link from the agent's phone screen leads to the archive, and the archive looks right on desktop | D3, D5, D12 | §6.2 Agent, Look |
| The screen matches the Archive mockup, without the statistics | D4, D5 | §6.2 Look |

### 8.1 DoD result (23.11.2026)

Local run, Development database: `seed.sql` and then `archive-demo.sql` run by Asaf in the morning (75 orders). Asaf signed in in the browser pane, first as manager, then as field agent. Unit tests: 129 pass.

| DoD item | Result |
|---|---|
| Manager sees all statuses; agent only `approved` and `completed`, no email | Pass. Manager: 75 orders, all five statuses (Pending 5, Approved 5, Rejected 16, Needs clarification 1, Completed 48). Agent: 53 orders (5 approved, 48 completed), status menu All / Approved / Completed, rows hold only the `toAgentView` fields (no email); `status=pending` and `status=needs_clarification` → empty; `view=inbox` → `403`. |
| No token → `401` | Pass. `GET /api/orders?view=archive` without a token: `401` "Please sign in.". |
| Search by name and by flight number | Pass. Manager: "Daniel" → orders 1, 10, 14 (+ an M6 test order before the re-seed), "maya z" → orders 8, 12, "אסף פדאל" → his order, "dm 404" / "DM-101" / "DM999" → the right orders. Agent: "Daniel" → only order 10 (completed), "dm 404" → only order 4. |
| Status and departure-date filters, also with search | Pass. Today's range → orders 1, 2, 3, 8, 12, 13, 14 (agent: 2, 3, 12, 13); Completed + "Noa" → order 5; Approved + "maya" → order 12; Rejected + 31 Oct → the 3 demo orders on DM708; From after To → message, table cleared, server `400`. |
| More than 50 orders shown in pages | Pass. Manager 50 + 25, agent 50 + 3, no row on two pages, newest first; ‹ / › disabled at the ends; page buttons work with the mouse and the keyboard (focus moves to the table). |
| Agent's phone link leads to the archive; archive fine on desktop | Pass. From the 375px agent screen both the "Archive" tab and "Archive · opens on desktop" open the archive; checked at 1280 and 1920px; at 375px the page has no sideways scroll (the table scrolls in its box). |
| Matches the Archive mockup without statistics | Pass, in the dark look (DESIGN dark section, ADR-25): header with Archive active, "Order archive", filter row, table with the six columns, "Showing 1–50 of 75" and pages. No statistics, no "View" and no "Returning" tag (Could, as planned). |

---

## 9. Build steps (one at a time, each with Asaf's go-ahead)

1. **Server:** `validateArchiveQuery`, `archiveStatuses`, `view=archive` in `api/orders.js`; unit tests; the `401` check; verify the two "or" groups (§2.1 step 5).
2. **Demo data:** `archive-demo.sql` (after O1); Asaf runs `seed.sql` and then it; quick count check.
3. **Archive page:** `archive.html`, `archive.js`, `paging.js`, styles, `session.js`; check at 1280 and 1920px with Asaf signed in as manager.
4. **Entry points:** the manager "Archive" tab; the agent tabs and bottom link (after O3); check the agent screen at 375px and the archive as agent.
5. **End-to-end:** §6.2 for both roles (seed re-run first, before 14:30 Israel time).
6. **DoD pass:** every item in §8, written below it as "DoD result".
7. **Close:** ADRs (the archive query, filters and page reply; the demo-data file; what stays open from ADR-24 per O2), 🟡 and checked items in MILESTONES, shut down the local run. No commit.
