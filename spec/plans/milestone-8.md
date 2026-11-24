# Milestone 8 — Archive completion and the manager screen (plan)

**Source:** `spec/MILESTONES.md` (Milestone 8, the overview table, "How the document is built", "Out of this document", the requirement table and the dependencies: M8 builds on M7 and M6), PRD §3 (screen 5 "Archive", desktop only), FR-20 (returning customer), FR-29 (manager notes shown to the agent, never to the customer), FR-33 to FR-35, §7 (features 33 and 35 listed as Could), assumptions 1–2, ARCHITECTURE §3 (permission matrix, what the agent may see), §5.1 (`GET /api/orders` with `view=archive` and `id=`, `POST /api/order-decision` with `add_note`), §6 (keys), ADR-14 (Gemini → OpenAI, Gemini keys can go), ADR-22 (returning flag and customer history on each manager read), ADR-24 (notes on their own with `add_note`), ADR-25 (dark look), ADR-26 (archive query), ADR-28 (no details or notes from the archive in M7), DESIGN screen 3 ("Orders awaiting decision" and "Status: All"), screen 5 "Archive" (four summary cards, "Returning" tag, "View"), "What is not shown in the images" (full order details and archive statistics are Could, not built), the dark "website" section at the end of part 1, Style Guide (data panels and statistics cards, tags, tables with the selected row's gold bar), the mockups image (frame 9 Archive: the four cards, "Returning" tags, "View"; frame 7 Approvals: "Status: All" next to the heading). The code is the source of truth for what M7 built: `api/orders.js`, `lib/orders-view.js`, `lib/validate.js`, `api/order-decision.js`, `public/staff/archive.html`, `public/js/archive.js`, `public/staff/manager.html`, `public/js/manager.js`, `public/css/staff.css`, `public/css/theme.css`, `tests/`.

**Status:** written 23.11.2026. **Approved by Asaf (24.11.2026)** with these answers: O1 (a) the wording changes as written, adjusted to O2; O2 **(b)** "Approved" counts `approved` and `completed` together; O3 (a) customers; O4: Asaf wants the agent to see only the orders he completed himself — the system does not record who completed an order before M9 (agent assignment), so **until M9 the agent sees three cards (Total orders, Approved, Completed)** and the "only my own" count is noted for the M9 plan; O5: Asaf already removed the Gemini lines from `.env.example` himself. D3–D5 and the O1 wording below are updated to these answers. **Build step 0 done (24.11.2026):** the O1 wording applied to PRD §7 and DESIGN (screens 3 and 5, "What is not shown"). **Build step 1 done (24.11.2026):** `archiveStats`, `stats` in `view=archive`, one completed map for the page and the cards; 135 unit tests pass. Checked as manager against the Development data (seed + `archive-demo.sql` run by Asaf on 24.11): for no filter (75 / 53 / 12 / 16), "Daniel", Rejected, Completed, today's dates, "dm" + Completed, "guest" and a search with no match, the server's cards equal a recount of all rows across every page (returning customers counted by email); page 2 and a page past the end give the same cards; no token → `401`. The agent's cards are checked at step 4 (agent sign-in). **Build step 2 done (24.11.2026):** `public/js/order-details.js` holds the status tags, the six data items (`detailsGrid`, with optional extra items), the AI, "Flight not found" and "Flight time changed" panels, "Customer notes / history" (with `isCurrent` for late answers) and "Manager notes" (with an `onSaved(notes, message)` callback); `manager.js` imports them (about 215 lines fewer). Checked as manager: all 7 inbox orders show the same list, tags and details as before (pending, flight time changed, needs clarification, a meeting on the day before), history loads, "Save note" saves and clears with the same messages and the note stays when switching orders; no new console error. **Build step 3 done (24.11.2026):** `public/js/inbox-filter.js`, the menu next to "Refresh" in `manager.html`, filtering in `manager.js` (`orders` keeps the whole inbox), styles; 136 unit tests pass. Checked as manager on the seed: All 7, Pending 5, Needs clarification 1 (Yossi C.), Flight time changed 1 (Noa B., order 4); the open order (Alon P.) stays open under Pending and the first matching order opens under the other options; the choice stays after Refresh. Look checked at 1280px (menu left of Refresh, as mockup 7) and 375px (menu and Refresh on their own row, no sideways scroll). The "No orders match this filter." text is set in code; the seed has no option with an empty list, so it is not seen on screen. **Build step 4, manager part (24.11.2026):** the cards row in `archive.html`, `drawStats` and the "Returning" tag in `archive.js`, card styles. Checked as manager: 75 / 53 / 12 / 16 with no filter; "Daniel" → 3 / 1 / 1 / 0 and "Showing 1–3 of 3"; Rejected → 16 / 0 / 1 / 16; From after To → "–" on every card; cleared filters → back to 75 / 53 / 12 / 16. Tags: 32 rows tagged on page 1 = the 32 rows the server marks returning, and all 7 inbox orders carry the same flag in the archive as on the Approvals screen. Look at 1280 and 1920px (as mockup 9, dark) and 375px (two cards per row, no sideways scroll). **Agent part (24.11.2026):** Asaf signed in as the field agent in a second tab. Three cards, 53 / 5 / 48 (Total / Approved / Completed), equal to a recount of both pages; "Daniel" → 1 / 0 / 1; `status=pending` → 0 / 0 / 0; the reply's `stats` has no `returning_customers` or `rejected`; the rows hold only the `toAgentView` fields (no email, no `is_returning_customer`); no "Returning" tag on screen; checked at 1280px. **Build step 4 done.** **Build step 5 done (24.11.2026):** "View" column, the side panel (`archive.html` wrapper `archive__body`, `archive.js` open / close / Escape / focus, manager and agent panels, labels from `/api/config`), panel styles. Changed in the check: the panel is **360px** wide (not 440) and the table cells are slightly tighter while it is open, so all seven columns stay visible at 1280px; the panel heading is 22px on one line; the agent panel uses the agent card's short forms ("–" for no services, "Full" for "Full (to the gate)"). Checked as manager: approved order 00000013 (not in the Approvals list) opens with every detail, Meeting time 18:15, history, AI panel, no decision buttons; "Save note" → "Note saved for order 00000013."; another row replaces the panel (one gold-bar row); reopening keeps the note; Escape and the × button close it and return focus to that row's "View" (`aria-expanded` false); a missing-flight order shows the "Flight not found" panel; a status change closes the panel. As the field agent: the agent screen shows the note on that card after a reload ("Meet at gate B (M8 archive check)", a test note still on order 00000013 until the next seed run); the archive panel shows exactly the card's fields, no email, no input, only the close button, no `?id=` request. Look: 1280px and 1920px side by side with no sideways scroll; 375px the panel opens above the table and scrolls into view. 136 unit tests pass. **Steps 6–8 done (24.11.2026):** Gemini keys confirmed gone and the AI checked (§8.1); DoD pass written in §8.1 (every item passes locally; the live-site part of the `.env.example` item is checked after the push); ADR-29 to ADR-32 added; MILESTONES M8 marked 🟡 (the live-site item left unchecked); local run stopped. No commit. Asaf checked the local run and approved with the push (24.11.2026, ✅). **Live check after the push (24.11.2026, commit c0df5d0):** Asaf signed in on https://sereno-olive-mu.vercel.app as manager; the archive shows 76 / 53 / 12 / 16 with 32 "Returning" tags on page 1, "View" opens order 00000013 with its details and history, and the Approvals menu gives 8 / 6 / 1 / 1. A live test order "M8 Live" (CAE8D510, approved by Asaf) got a valid OpenAI draft without the Gemini keys, so the last DoD item is checked in MILESTONES.

**Goal:**
1. **Archive statistics (feature 33):** four summary cards above the archive, counted on the server and following the search and filters on the screen.
2. **Open an order from the archive (feature 35):** a "View" link in every row opens a side panel next to the table. Manager: the full order as on the Approvals screen, customer history, and "Manager notes" with "Save note". Field agent: only the fields of his card, read-only.
3. **"Returning" tag in the archive (feature 35):** next to the customer name, manager only, same rule as on the Approvals screen.
4. **"Status: All" filter on the Approvals screen** (DESIGN screen 3, mockup 7).
5. **Gemini keys cleaned up** from `.env.example` (ADR-14).

---

## 0. Decisions this plan proposes

| # | Topic | Proposal | Why |
|---|---|---|---|
| D1 | Where the statistics are counted | The server counts them, in the same `view=archive` request: the reply gets a new `stats` object next to `orders`, `page`, `page_size`, `total` (D3). The counts use the **same filters as the table** (role statuses, `q`, `status`, `from`, `to`) but **not the page**: they describe every matching order, not only the 50 rows shown. | MILESTONES M8 ("the numbers follow the search and filters, counted on the server", Asaf 23.11.2026). One request keeps the cards and the table always in step. |
| D2 | How the server counts | After the page query, one extra read of `id, status, customer_id` for **all** matching orders (the same filter as the page, no page range), read in chunks of 1000 rows (Supabase answers at most 1000 rows per request), at most 20 chunks. The counts are made in code by a new pure function `archiveStats(rows, completedMap, role)` in `lib/orders-view.js`. For the manager, the "completed orders of these customers" map (ADR-22, `completedMapFor`) is read once for all matching customers and is used both for the "Returning customers" card and for the "Returning" tags of the page rows (D9), so the two always agree. | No database change (no migration, no new SQL function). The demo has about 75 orders; even 20 000 would still be counted correctly. The function is pure, so it is unit-tested. |
| D3 | `stats` shape | Manager: `{ total, approved, returning_customers, rejected }`. Agent: `{ total, approved, completed }` (see D5). `total` equals the reply's `total`. | Only what each role's cards show; the agent's reply carries no returning information (D5). |
| D4 | Manager cards (as mockup frame 9) | Four cards in this order: **Total orders**, **Approved**, **Returning customers**, **Rejected**. "Approved" counts orders whose status is `approved` **or** `completed` — every order the manager approved (O2 (b), Asaf 24.11.2026). "Returning customers" counts **customers** (not orders): the different customers among the matching orders who have at least one matching order tagged "Returning" (see O3). "Rejected" counts status `rejected`. | Mockup frame 9 and DESIGN screen 5. The count of customers matches the card's name and agrees with the tags in the table. |
| D5 | Agent cards | Three cards: **Total orders**, **Approved** (status `approved` only, the orders still to be served), **Completed** (O4, Asaf 24.11.2026). Asaf wants the agent's cards to count only the orders he completed himself; that needs to know who completed each order, which arrives with agent assignment in M9, so it is noted for the M9 plan and not built here. No "Rejected" card (it would always be 0, because the agent never sees rejected orders) and no "Returning customers" card (the returning information is manager only: ARCHITECTURE §3 gives the agent no `is_returning_customer`, and MILESTONES gives the tag to the manager only). | MILESTONES M8 ("the agent's cards count only `approved` and `completed`; how the always-0 cards are shown is decided in planning"). |
| D6 | How the cards look | A row of cards between the heading "Order archive" and the filter row, as frame 9: a big number in the heading font (Frank Ruhl) and a small label under it, each card a "data panel" (Style Guide: 2px corners, thin border, no shadow), in the dark colours of `.theme-dark` (like the details panels of the Approvals screen). Four equal columns for the manager, three for the agent; on narrow screens two per row. The numbers update with every answer of the table; while loading they keep the last numbers (no flicker); after an error or a "From after To" date error they show "–". The row has a visually hidden heading "Summary" and each card is one readable line for a screen reader ("75 Total orders"). | DESIGN screen 5, Style Guide "statistics cards", the dark section (ADR-25). |
| D7 | "View" in the table | A seventh column at the end of each row with a small text button "View" (underlined, as in the mockup), with the accessible name "View order A1B2C3D4". The table header of that column is a visually hidden "Actions". The open order's row gets the gold bar on its left (Style Guide: "selected row marked with a Gold Dark bar") and the button gets `aria-expanded="true"`. | Mockup frame 9, DESIGN screen 5 ("View opens an order"), Asaf's decision: a side panel. It is a button, not a link, because it opens a panel on the same page. |
| D8 | The side panel | **Desktop (≥ 1200px):** the archive body becomes two columns: the table on the left (it keeps its columns, narrower) and the panel on the right (about 440px), like the list and details of the Approvals screen. **Narrower screens:** the panel opens under the cards and above the table, full width, so it is seen without scrolling. The panel has a heading "Order A1B2C3D4", the status tag, and a "Close" button (an X icon with the accessible name "Close order details"). Opening moves the keyboard focus to the panel heading; "Close" or the Escape key closes it and returns the focus to that row's "View". A new search, filter or page closes the panel (the order may no longer be in the rows). Only one order is open at a time; "View" on another row replaces it. The panel is a `<section aria-labelledby>` region, not a modal window: the table stays usable next to it. | Asaf's decision (a side panel next to the table); DESIGN "what is not shown is built in the same design line" (the details panel of the Approvals screen). Keyboard and screen-reader basics from DESIGN "Basic accessibility". |
| D9 | "Returning" tag in the table | Manager only: the tag "Returning" (Style Guide: Gold Dark outline, the same `tag tag-returning` style as on the Approvals screen) after the customer name in the "Customer" column, when the row's `is_returning_customer` is true. The server already sends this flag in every manager row (ADR-22); the agent's rows never have it, so the agent's table can never show the tag. | MILESTONES M8 ("for the manager only, by the same rule as on the Approvals screen, decision 11, ADR-22"), mockup frame 9. |
| D10 | Manager panel: what it shows | The same content and order as the details on the Approvals screen, **read-only** except the note: the six data items (Customer, Phone / Email, Flight, Departure, Travellers · Bags, Services · Escort), plus **Meeting time** (the approved time, "12:45 · 25 Oct", or "–" when there is none), then the panels "Customer notes" and "Customer history" (loaded from the existing `GET /api/orders?id=`, as on the Approvals screen) and "AI recommendations" (or, for a missing flight, the existing "Flight not found" panel with the typed number and date). Status tag and, if the customer is returning, the "Returning" tag next to it. **No** Approve, Reject, "Confirm flight missing" or flight-change buttons in the archive: decisions stay on the Approvals screen, where the order still is while it waits. | MILESTONES M8 ("all order details, as on the Approvals screen, including Customer history"). Keeping decisions in one place avoids a second way to approve. |
| D11 | Manager panel: "Manager notes" | Under the details, the same "Manager notes" box as on the Approvals screen (placeholder "Add a note for the field agent", up to 500 characters) with "Save note". It sends the existing `add_note` (`POST /api/order-decision`, manager only, any status, no email, ADR-24): an empty box clears the note. It is offered for **every** status, as `add_note` already allows (the main use is an approved order that is no longer in the Approvals list). After saving: a short success line in the panel ("Note saved for order A1B2C3D4." / "Note cleared for order A1B2C3D4."), and the row in memory gets the new note, so reopening it shows it. Errors are shown under the box, as on the Approvals screen. **No server change**: `add_note` already does exactly this, and the email builders never read the column (existing unit tests). | MILESTONES M8 (`add_note`, ADR-24, ADR-28), FR-29. |
| D12 | Agent panel | Only the fields of `toAgentView`, which the agent's archive rows already carry, so **no new request and no server change**: status tag, **Meeting time** (big, with its date), Departure, customer name, phone (as a `tel:` link, as on the agent card), Flight, Services, Travellers · Bags, Escort, and the "Manager notes" box when there is a note. No email, no customer notes, no history, no AI, no "Mark completed", nothing editable. The server still refuses `?id=` to an agent (`403`), unchanged. | MILESTONES M8 ("for the agent: only the fields he sees on his card, `toAgentView`, no editing"), ARCHITECTURE §3. |
| D13 | Sharing the details code | The parts of `public/js/manager.js` that draw the order details are moved, unchanged in behaviour, to a new module `public/js/order-details.js`: the status tags, the data items, the "Customer notes / Customer history" panel (with its loading of `?id=`), the "AI recommendations" and "Flight not found" panels, and the "Manager notes" box with "Save note" (it gets an `onSaved` callback instead of touching the manager list directly). `manager.js` and `archive.js` both import it. The Approvals screen must look and behave exactly as before (checked in §6.2). | One copy of the details: a later change (M9 adds the agent choice to this panel) is made once. The alternative, copying about 150 lines into `archive.js`, is simpler today but makes two copies that drift apart. |
| D14 | "Status: All" on the Approvals screen | A status menu next to "Refresh" in the Approvals header (DESIGN: "a small Refresh button next to the status filter"), with a visually hidden label "Status" and these options: **Status: All**, **Pending** (`pending`), **Needs clarification** (`needs_clarification`), **Flight time changed** (an approved order with `flight_change_pending`). The list is filtered in the browser (the inbox already holds every order of the screen, no server change). When the open order is not in the filtered list, the first order of the filtered list opens (or none). An empty filtered list shows "No orders match this filter." (the existing "No orders are waiting for a decision." stays for an empty inbox). The choice is kept on "Refresh" and after a decision, and goes back to "All" when the page is reloaded. "Returning" is not a menu option, because it is a mark of the customer, not a status. | MILESTONES M8 ("options decided in planning, by the tags shown on the screen: Pending, Needs clarification, Flight time changed"), DESIGN screen 3, mockup frame 7. |
| D15 | Gemini keys | Remove the lines `GEMINI_API_KEY` and `GEMINI_MODEL` from `.env.example` (see O5: I cannot open that file). The code has no Gemini reference left (checked: only the spec documents mention it, as history). Asaf removes the two variables from Vercel (both environments) and from `.env.local`, then a Redeploy at the next push. The new ADR (§9 step 7) records it. | MILESTONES M8, ADR-14 ("can be removed once M4 is approved"). |
| D16 | Database, n8n, emails | **No change.** No migration, no new key, no n8n change, no email change. The notes never reach an email (unchanged; checked again in §6.2). | Everything M8 needs is already stored. |
| D17 | Test data | The M7 data is enough: `seed.sql` (re-run before 14:30 Israel time on the test day, ADR-1) and then `archive-demo.sql` (75 orders: manager 75, agent 53). The seed has returning customers (Daniel A. and others with a completed order), and the demo customers have several completed orders each, so both the tag and the card have something to show. No new data file. | ADR-1, ADR-27. |

---

## 1. Files

### New
- `public/js/order-details.js`: the shared order-details drawing (D10–D13).
- `public/js/inbox-filter.js`: a small pure helper for the Approvals menu (which orders match "Pending", "Needs clarification", "Flight time changed"), so it can be unit-tested (D14).
- `tests/archive-stats.test.js`: `archiveStats`, the inbox filter.

### Changed
- `api/orders.js`: `view=archive` adds `stats` (D1–D3); the completed map is read once for the page and the stats (D2, D9).
- `lib/orders-view.js`: `archiveStats` (D2–D5).
- `public/staff/archive.html`: the cards row, the "Actions" column header, the panel region (D6–D8).
- `public/js/archive.js`: cards, "Returning" tag, "View" and the side panel for both roles (D6–D12).
- `public/js/manager.js`: uses `order-details.js` (D13); the status menu (D14).
- `public/staff/manager.html`: the status menu next to "Refresh" (D14).
- `public/css/staff.css`, `public/css/theme.css`: cards, the panel and the two-column archive, the selected row, the "View" button, the status menu in the Approvals header (D6–D8, D14).
- `.env.example`: the two Gemini lines removed (D15, O5).
- `spec/PRD.md`, `spec/DESIGN.md`: **only** the wording changes of O1, and only after Asaf approves them.
- `spec/ARCHITECTURE.md`: new ADRs (end of build). `spec/MILESTONES.md`: 🟡 and checked DoD items (end of build). `CLAUDE.md`: no change expected.

### Not changed
- `api/order-decision.js` (`add_note` is used as it is), `api/submit-order.js`, `lib/validate.js` (the archive query does not change), `lib/ai.js`, `lib/notify.js`, `public/js/agent.js`, `public/staff/agent.html`, `supabase/migrations/*`, `supabase/seed/*`, `n8n/sereno-notifications.json` (D16, D17).

---

## 2. Server

### 2.1 `GET /api/orders?view=archive` (changes only)
Steps 1–5 of ADR-26 stay as they are (role check, `validateArchiveQuery`, role statuses, flight ids for the dates, the page query with the exact `total`). Added:

6. **All matching orders for the counts (D2):** the same filter (`status in (role statuses)`, the optional `status`, the combined search and date filter), selecting only `id, status, customer_id`, ordered by `id`, read with `.range()` in chunks of 1000 until a chunk is shorter than 1000 (at most 20 chunks; past that, the reply is still sent and the server logs a warning — far beyond the demo).
7. **Manager only:** `completedMapFor(all matching rows)` (ADR-22; the customer ids are sent in groups of 200 so the request address stays short). The page rows use this same map for `is_returning_customer`, instead of a second read.
8. `stats = archiveStats(allRows, completedMap, role)`:
   - manager: `total` = number of rows, `approved` = rows with status `approved` or `completed` (O2 (b)), `rejected` = rows with status `rejected`, `returning_customers` = number of different `customer_id` among rows for which `isReturningCustomer(row, completedMap)` is true;
   - agent: `total`, `approved`, `completed` (no map is read, no returning count).
9. Reply: `{ ok: true, data: { orders, page, page_size: 50, total, stats } }`. A page past the end returns `orders: []` with the real `total` and `stats` (the stats do not depend on the page).

`view=inbox`, `view=approved`, `id=` and `POST /api/order-decision` do not change.

### 2.2 Errors
No new error. The archive keeps the M7 answers (`401`, `403`, `400` with the M7 messages).

---

## 3. Browser

### 3.1 Archive: cards (D4–D6)
- `archive.html`: between the heading and the filter form, `<section class="archive-stats" aria-labelledby="stats-heading">` with a visually hidden `<h2 id="stats-heading">Summary</h2>` and an empty list `<ul id="stats">`.
- `archive.js`: the role decides the cards (manager: Total orders, Approved, Returning customers, Rejected; agent: Total orders, Approved, Completed). Each answer redraws the numbers from `data.stats`; an error or the "From after To" message shows "–".

### 3.2 Archive: table (D7, D9)
- A seventh header `<th scope="col"><span class="visually-hidden">Actions</span></th>`.
- Customer cell: the name, then for the manager the "Returning" tag when `is_returning_customer`.
- Last cell: `<button type="button" class="link-button">View</button>` with `aria-label="View order <ref>"`, `aria-controls="order-panel"` and `aria-expanded`.

### 3.3 Archive: side panel (D8, D10–D12)
- `archive.html`: `<section class="archive-panel" id="order-panel" aria-labelledby="panel-heading" hidden>` inside a new body wrapper `archive__body` that holds the table box and the panel side by side at ≥ 1200px.
- **Manager:** drawn with `order-details.js` from the row (the manager row already has every field the Approvals screen uses); "Customer history" loads `?id=` on opening (once per order, kept until the page or filters change); "Manager notes" with "Save note" (`add_note`), its `onSaved` updates the row in memory and shows the success line in the panel (`role="status"`).
- **Agent:** drawn from the row with the agent card's fields (D12); phone as `tel:` link; the notes box only when there is a note.
- Open / close / focus / Escape as D8. The selected row gets the class `is-selected` (gold bar).

### 3.4 Approvals screen (D13, D14)
- `manager.html`: in `.approvals__head`, a group with `<label class="visually-hidden" for="status-filter">Status</label><select class="input select" id="status-filter">` (Status: All, Pending, Needs clarification, Flight time changed) and the existing "Refresh" button.
- `manager.js`: keeps the full inbox in `orders` and draws the filtered list from `inbox-filter.js`; selection rule and empty text as D14. The details code moves to `order-details.js` without any change in what the screen shows.

### 3.5 Styles
- `staff.css`: "Archive statistics" (grid of cards, 4 or 3 columns, 2 below 700px; number in the heading font), "Archive panel" (the two-column body at ≥ 1200px, the panel padding and head with the close button, the panel stacked above the table below 1200px), `.archive-table tr.is-selected` (gold bar on the first cell), `.link-button` (text button, underlined, at least 44px tall touch area), the Approvals header group (menu + Refresh, wraps on phones).
- `theme.css`: the dark lines only (cards and panel on the dark card colour of `.theme-dark`, as the Approvals details; the selected row bar in gold; the menu in the dark field style).

---

## 4. n8n
No change (D16).

---

## 5. Tests (`node --test`)
- `archiveStats` (manager): counts by status, with `approved` = `approved` + `completed`; `returning_customers` counts customers, not orders (one customer with two tagged orders → 1); a customer whose only order is a completed one is not returning; a status filter that leaves only rejected rows → `approved` 0; empty list → all 0.
- `archiveStats` (agent): only `total`, `approved`, `completed`; no `returning_customers` key even when a map is given.
- Inbox filter: "all" keeps everything; "pending" keeps only `pending`; "needs_clarification" keeps only that status; "flight_change" keeps only approved orders with `flight_change_pending`; an unknown value keeps everything.
- `toAgentView` (existing tests) still has no email, `ai_output`, history or `is_returning_customer`.
- The existing 129 tests stay green.

---

## 6. How the build is verified (before marking 🟡)

### 6.1 Asaf's one-time setup (plain-Hebrew instructions at the matching build step)
1. On the test day, before 14:30 Israel time: run `seed.sql` in the Supabase SQL Editor (Development project), then `archive-demo.sql` (D17).
2. Remove `GEMINI_API_KEY` and `GEMINI_MODEL` from `.env.local` (and, per O5, from `.env.example`), and from Vercel (Development and Production).
3. Sign in on the local run, once as the manager and once as the field agent, in the browser pane (I do not type passwords).

### 6.2 Checks (local run, port 3000, Development keys)
- **Cards, manager, no filter:** Total orders 75; Approved, Rejected and Returning customers equal to what the archive itself shows: Approved = the `total` with status Approved plus the `total` with status Completed, Rejected = the `total` with status Rejected, Returning customers = the different customer emails among the rows tagged "Returning", counted over both pages.
- **Cards follow filters:** a search ("Daniel"), a status (Rejected → Approved 0, Rejected = Total), a date range (today), and a combination; every time the cards match the rows found by the same filters. Page 2 does not change the cards. "From after To" → the cards show "–".
- **Cards, agent:** three cards, Total 53 = Approved 5 + Completed 48 (or the numbers of the day); no Returning card; the network reply's `stats` has no `returning_customers`.
- **"Returning" tag:** manager rows show it exactly for the rows the Approvals screen would tag (checked on the seed customers: a returning customer's pending order shows it in both screens); the agent's table never shows it, and the agent's rows in the network view have no `is_returning_customer`.
- **View, manager:** opens the panel beside the table at 1280 and 1920px; all the details, Meeting time, Customer notes, Customer history (loads), AI recommendations or the "Flight not found" panel; no decision buttons; Close and Escape close it and focus returns to "View"; "View" on another row replaces it; a new filter closes it.
- **Note from the archive:** open an **approved** order that is not in the Approvals list (an approved seed order), write a note, "Save note" → success line; reopen → the note is there; as the field agent, Refresh on the agent screen → the note shows on that card. Clearing the note works. Then confirm no email carries it: no email is sent by `add_note` (unit tests of the email builders, and the n8n executions list shows no new run).
- **View, agent:** only the card fields (no email, no customer notes, no history, no AI, no editing, no "Mark completed"); no request to `?id=` is made (network view).
- **Approvals "Status: All":** each option leaves only its orders (seed: Pending 5, Needs clarification 1, Flight time changed after Asaf changes a flight time as in M5, or 0); the open order follows the rule of D14; the choice stays after Refresh and after a decision; empty filter → "No orders match this filter.".
- **Approvals unchanged otherwise:** select, history, notes, approve / reject on a pending order, the missing-flight and flight-change areas look and work as before (regression of D13).
- **Gemini keys:** after Asaf removes them, the local run starts, a new order through the form gets an AI draft (OpenAI), and the staff screens work.
- **Look:** archive at 1280 and 1920px matches mockup frame 9 in the dark look, now with the four cards, the "Returning" tags and "View"; with the panel open no horizontal page scroll; at 375px nothing overlaps (the panel stacks above the table). Approvals header with the menu at 1280px and 375px.
- **Unit tests:** all green.

---

## 7. Open points (need Asaf's answer)

| # | Question | Options | Recommendation |
|---|---|---|---|
| O1 | PRD and DESIGN still call features 33 and 35 "Could, not built". The exact wording changes I propose (Hebrew, as the documents are written) are listed under this table. | (a) approve the changes as written; (b) approve with changes Asaf names; (c) leave the documents as they are (then the build contradicts them). | (a). MILESTONES M8 asks for this approval before the build. |
| O2 | What does the manager's "Approved" card count? The mockup has no Completed status, and in the demo most orders are Completed. | (a) only orders whose status is `approved` (with the demo: about 5), the same as the "Approved" status filter and tag; (b) `approved` and `completed` together ("ever approved", about 53); (c) a fifth card "Completed" next to the four. | (a): the card agrees with the table's "Approved" tag and with the status filter. |
| O3 | What does "Returning customers" count? | (a) customers: the different customers among the matching orders who have a "Returning" tag (one customer with two tagged orders counts once); (b) orders: the number of rows tagged "Returning". | (a): the card's name is "customers". |
| O4 | Which cards does the field agent see? | (a) three: Total orders, Approved, Completed (D5); (b) the same four as the manager, with Rejected always 0 and Returning customers hidden; (c) only Total orders. | (a): every card means something for the agent, and none tells him who is returning. |
| O5 | `.env.example`: I am not allowed to open it (CLAUDE.md, the sandbox blocks it), so I cannot remove the two Gemini lines myself while seeing the file. | (a) Asaf deletes the two lines `GEMINI_API_KEY=` and `GEMINI_MODEL=` himself in the editor, together with `.env.local` and Vercel; (b) I run one command that deletes the lines starting with `GEMINI_` without showing the file (it may be blocked by the sandbox; then we fall back to (a)). | (a): no blind edit of a file I cannot see; it is two lines. |

### O1 — proposed wording changes (for approval; I do not change these documents without it)

**`spec/PRD.md`, §7 "מחוץ ל-MVP (לפי MoSCoW)", the two rows in the table:**
- From: `| 33 — סטטיסטיקות בארכיון | Could | |`
  To: `| 33 — סטטיסטיקות בארכיון | Could | נבנה ב-Milestone 8 (החלטה של אסף, 23.11.2026): ארבעה כרטיסים בראש הארכיון, לפי החיפוש והסינון |`
- From: `| 35 — פרטי הזמנה מלאים וזיהוי חוזרים בארכיון | Could | |`
  To: `| 35 — פרטי הזמנה מלאים וזיהוי חוזרים בארכיון | Could | נבנה ב-Milestone 8 (החלטה של אסף, 23.11.2026): "View" פותח חלונית צד, ותגית "Returning" למנהל בלבד |`

**`spec/DESIGN.md`, screen 5 "ארכיון", "מה קורה במסך":**
- From: `"View" פותח הזמנה.`
  To: `"View" פותח את ההזמנה בחלונית צד ליד הטבלה (ראו "מה לא מוצג בתמונות").`

**`spec/DESIGN.md`, screen 5, the line about the four cards — add after it** (wording depends on O2–O4; shown with the recommended answers):
- `הכרטיסים מתעדכנים לפי החיפוש והסינון. Approved סופר את כל ההזמנות שהמנהל אישר (בסטטוס Approved או Completed), ו-Returning customers סופר לקוחות. אצל נציג השטח מוצגים שלושה כרטיסים: Total orders, Approved (הזמנות שעוד לא בוצעו) ו-Completed. התגית "Returning" מוצגת למנהל בלבד.`

**`spec/DESIGN.md`, screen 3 "אישור למנהל", after `כותרת "Orders awaiting decision" ומסנן "Status: All".`** — add:
- `אפשרויות המסנן: Status: All, Pending, Needs clarification, Flight time changed.`

**`spec/DESIGN.md`, "מה לא מוצג בתמונות, ואיך בונים אותו":**
- From: `- **פרטי הזמנה מלאים:** "View" בארכיון מוביל למסך שאינו מעוצב. פיצר Could, לא נבנה.`
  To: `- **פרטי הזמנה מלאים (Milestone 8, החלטה של אסף, 23.11.2026):** "View" בכל שורה בארכיון פותח חלונית צד ליד הטבלה (בטלפון ובמסך צר: מעל הטבלה), באותו קו עיצובי של פרטי ההזמנה במסך המנהל, עם כפתור "Close". למנהל: כל פרטי ההזמנה, שעת המפגש, "Customer notes", "Customer history", "AI recommendations", ושדה "Manager notes" עם "Save note". בלי כפתורי החלטה: ההחלטות נשארות במסך האישורים. לנציג: רק השדות של הכרטיס שלו, לקריאה בלבד.`
- From: `- **סטטיסטיקות בארכיון:** מופיעות במסכים, אבל ב-PRD הן Could, מחוץ לגרסה הראשונה. תגית "Returning" נבנית במסך המנהל (FR-20). בארכיון היא Could (פיצר 35) ולא נבנית.`
  To: `- **סטטיסטיקות ותגית "Returning" בארכיון (Milestone 8, החלטה של אסף, 23.11.2026):** ארבעת הכרטיסים שבמסכים נבנים ומתעדכנים לפי החיפוש והסינון (ראו מסך 5). התגית "Returning" מופיעה בטבלת הארכיון למנהל בלבד, לפי אותו כלל כמו במסך המנהל (FR-20).`

**Not changed:** ARCHITECTURE (the `stats` field in the archive reply, the panel and the end of ADR-28 are recorded as new ADRs at the end of the build, which CLAUDE.md allows), MILESTONES (already describes M8), PRD FR-33 to FR-35 (unchanged; features 33 and 35 have no FR code).

No part of the spec M8 needs is a placeholder. Settled by the rules in `CLAUDE.md` (no question needed): DESIGN "View leads to a screen that is not designed" vs Asaf's later decision (a side panel) — MILESTONES records Asaf's decision and O1 aligns DESIGN; the archive and panel colours follow the DESIGN dark section (ADR-25), not the light mockup.

---

## 8. Definition of Done mapping

| DoD item (MILESTONES M8) | How it is met | Checked in |
|---|---|---|
| The four cards show the right numbers, with no filter and after filters and search; for the agent they count only what he may see | D1–D6, §2.1 steps 6–8, O2–O4 | §6.2 Cards (manager, filters, agent) + unit tests |
| "View" opens the order in a side panel; the manager sees all the details and the customer history; the agent only his card's fields, without the customer email | D7, D8, D10, D12, D13 | §6.2 View, manager / agent |
| The manager saves a note on an approved order from the archive, and the agent sees it after Refresh; the note is in no email to the customer | D11, D16 | §6.2 Note from the archive |
| The "Returning" tag appears in the archive only for returning customers, and only for the manager | D9, D2 | §6.2 "Returning" tag |
| The status filter on the Approvals screen narrows the list correctly | D14 | §6.2 Approvals "Status: All" + unit tests |
| `.env.example` has no Gemini keys, and the app works locally and on the live site | D15, O5 | §6.2 Gemini keys (local). **The live site is checked after the push** (the push is Asaf's approval, CLAUDE.md), once Asaf has removed the keys from Vercel and the new version is deployed; until then this item is reported as "local: pass, live: after push". |
| The screen matches the Archive mockup, including the statistics, in the dark look | D4, D6–D9 | §6.2 Look |

### 8.1 DoD result (24.11.2026)

Local run, Development database: `seed.sql` and then `archive-demo.sql` run by Asaf in the morning, plus one test order "M8 Check" (1BC1C490) made at step 6. Asaf signed in in the browser pane as manager (first tab) and as field agent (second tab). Unit tests: 136 pass. **Step 6:** Asaf confirmed that `.env.example` has no `GEMINI_` line (git shows the file unchanged since the M7 commit, so the lines were already gone there) and that he removed both keys from `.env.local` and Vercel; after a restart of the local run, a new order got a valid OpenAI draft (`ai_output.status` ok, porter recommended) and the server logged no error.

| DoD item | Result |
|---|---|
| The four cards are right, with no filter and after filters and search; the agent's count only what he may see | Pass. Manager: no filter 76 / 53 / 12 / 16 (75 + the step-6 order); "maya", Approved, 24–25 Nov, "guest" + Rejected — every time the cards equal a recount of all rows across the pages. Agent: 53 / 5 / 48, equal to the recount; no returning or rejected count in the reply. |
| "View" opens the side panel; manager: all details and customer history; agent: only his card's fields, no email | Pass (step 5): manager panel with every detail, Meeting time, history, AI or "Flight not found" panel; agent panel with the card fields only, no `@` anywhere in the agent's rows, no input, `?id=` still `403` for the agent. |
| The manager saves a note on an approved order from the archive; the agent sees it after Refresh; the note is in no customer email | Pass. Order 00000013 (approved, not in the Approvals list): "Note saved", shown on the agent's card and in the agent's archive panel. `add_note` sends no email, and the unit test "customer emails never carry manager notes…" passes. |
| "Returning" appears in the archive only for returning customers, and only for the manager | Pass. Page 1: 32 tagged rows = the 32 rows the server marks; all inbox orders carry the same flag in both screens; the agent's rows have no flag and no tag. |
| The status filter on the Approvals screen narrows the list correctly | Pass. All / Pending / Needs clarification / Flight time changed → 7 / 5 / 1 / 1 (now 8 / 6 / 1 / 1 with the step-6 order); the choice stays after Refresh. |
| `.env.example` has no Gemini keys; the app works locally and on the live site | **Local: pass** (step 6). **Live site: after the push** — the push is Asaf's approval (CLAUDE.md); then the new version is deployed and checked on https://sereno-olive-mu.vercel.app. Left unchecked in MILESTONES until then. |
| The screen matches the Archive mockup, including the statistics, in the dark look | Pass. 1280 and 1920px: header with Archive active, "Order archive", four cards, filters, table with "Returning" tags and "View", "Showing…" and pages, as frame 9 in the dark look; with the panel open all columns stay visible; 375px works (two cards per row, panel above the table). |

---

## 9. Build steps (one at a time, each with Asaf's go-ahead)

0. **Documents (after O1):** the approved wording changes in PRD and DESIGN, nothing else.
1. **Server:** `archiveStats`, `stats` in `view=archive`, one completed map for page and stats; unit tests; check the numbers against the Development data as manager and as agent (seed and demo data run by Asaf first).
2. **Shared details module:** move the drawing to `order-details.js`; the Approvals screen checked unchanged (with Asaf signed in as manager).
3. **Approvals "Status: All":** the menu and `inbox-filter.js`; unit tests; check each option.
4. **Archive cards and "Returning" tag:** cards per role, the tag for the manager; check at 1280 and 1920px.
5. **Archive "View" panel:** manager panel with history and "Save note", agent panel; keyboard, Escape and focus; narrow screens.
6. **Gemini keys (after O5):** Asaf removes them (`.env.example`, `.env.local`, Vercel); the local run and an AI draft checked.
7. **End-to-end and DoD pass:** §6.2 for both roles (seed re-run first, before 14:30 Israel time); results written under §8 as "DoD result".
8. **Close:** ADRs (archive statistics counted on the server and the `stats` reply; the order panel in the archive and notes from it, ending ADR-28's limit; the shared details module; the Approvals status filter in the browser; Gemini keys removed, completing ADR-14), 🟡 and checked items in MILESTONES, shut down the local run. No commit.
