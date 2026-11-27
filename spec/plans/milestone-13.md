# Milestone 13 — Rich booking form and estimated price (plan)

**Source:** `spec/MILESTONES.md` (Milestone 13, the overview table, "How the document is built" — M10–M15 are improvements before real people use the site; their wording, content and design choices are set in each one's planning with Asaf — and the dependencies: M13 builds on M10 and M11; M14 will look an order up by the "Order number" this milestone shows), PRD §3 (the four form steps, the screen after sending, the screens table row 1), FR-03, FR-07, FR-08, FR-09, FR-10, FR-43, §4.3 (prompt limit 1: the AI never adds a price), §7 ("prices on the site" is out of scope today), DESIGN screen 2 (all four steps and "Request received"), screen 5 (archive column "Reference"), "עיצוב 'אתרי'" (dark look, ADR-25), Part 2 (Gilda Display + Montserrat from M12; the "route marker" icon: a line with small circles, solid for what is covered and dashed for the rest), the three images (`sereno-wireframes.png`, `sereno-mockups.png` frames 2–6 and 9; `sereno-style-guide.png` "03 UI Style" shows the route marker *Meeting point · Security · Gate*, never built), ARCHITECTURE §2 (`orders`), §5.1 (`POST /api/submit-order`), §5.2 (n8n payloads), ADR-4 (shared browser/server module in `public/js/`), ADR-5 (n8n export holds placeholders), ADR-40 (a column added without breaking the live site), ADR-41 (fixed text in `data/lists.json`), ADR-42 (one shared services helper). The code is the source of truth for what M1–M12 built: `public/order.html`, `public/js/order-form.js`, `public/js/meeting-time.js`, `public/js/services-text.js`, `public/css/base.css`, `theme.css`, `tokens.css`, `data/lists.json`, `api/submit-order.js`, `lib/validate.js`, `lib/notify.js`, `lib/orders-view.js`, `public/js/order-details.js`, `public/staff/archive.html`, `n8n/sereno-notifications.json` (six "Set …" nodes each with a `Reference` row), `supabase/migrations/004_wheelchairs.sql` (the insert function has 16 parameters), `tests/` (170 tests, all green on 27.11.2026). The working mock-up Asaf saw on 27.11.2026: https://claude.ai/artifact/ARCV7raCNci6WGXRffFAP5 — **its prices (450 / 300 / +100 / 80 / 120 ₪) were examples only and are not used anywhere.**

**Status:** written 27.11.2026. **Approved by Asaf (27.11.2026, "Approve the plan")**, with the recommendations of O1 (the PRD / DESIGN / ARCHITECTURE / MILESTONES wording, applied at build step 0), O2 (no prices on the landing page), O3 (no price in the manager-alert email) and O4 (the manager does not change the price). **Build (27.11.2026):** step 0 applied the O1 wording to PRD, DESIGN, ARCHITECTURE and the one MILESTONES line. `price.js`, the server, the form, the staff screens and the n8n export done; Asaf ran `005_estimated_price.sql` in Supabase. During the check the demo flights had all departed (seed dates are relative to the day it ran), so the form had no flight to choose; Asaf chose to re-run the regular seed (it cleared the orders and loaded the demo data again). An insert-only alternative, `supabase/seed/future-flights.sql` (10 flights over 30 days, deletes nothing), was written and kept for next time. 184 unit tests pass. ADR-44 and ADR-45 added. Every DoD item passes (§8.1); MILESTONES M13 marked 🟡. Asaf's n8n steps come after the push. Already answered by Asaf in planning (27.11.2026, after seeing two drawings with his real prices):
- **Price list (US dollars):** full escort **$300**, partial escort **$200** — each includes one traveller; each **extra traveller +$40**; **one checked bag per traveller is free**, each bag beyond that **+$5**; **porter +$30 per order**; **wheelchairs free** (any number).
- **Where the price shows:** the form (summary, and **next to every choice** — option ב in the drawing), the **"Request received" screen**, the **"request received" email**, the **approval email**, and the **manager screen and archive** (not the field agent). So the price is **stored with the order**.
- **"Order number" replaces "Reference" everywhere:** the "Request received" screen, every email, and the archive table column.
- **Boarding-pass card with real data only:** "Tel Aviv → destination", flight number, date, departure time, airline. No airport codes or terminals are invented.
- **A typed flight (not found in the list) gets an estimated price as usual** (the price does not depend on the flight).
- **Desktop summary inside the sunset panel** (option א in the drawing); on phones a bar at the bottom of the screen that opens with a tap.

**Goal:**
1. Booking feels like booking a VIP service: a live **"Your escort"** summary fills in at every step; the chosen flight becomes a **boarding-pass card**; the escort cards show a **route drawing** (Meeting point → Security → Gate); "Request received" becomes a boarding-pass card with the **Order number**.
2. The customer sees an **estimated price** that updates live, worked out only from Asaf's price list, with "No payment now. The final price is confirmed with your booking." No payment, no card details.
3. The server works out the same price, stores it with the order, and shows it in the two customer emails, the manager screen and the archive panel.
4. The order still sends and saves exactly as before. One small database change (a new optional column), run by Asaf before the push; the live site keeps working before and after it. n8n changes made by Asaf by hand. No new key.

---

## 0. Decisions this plan proposes

| # | Topic | Proposal | Why |
|---|---|---|---|
| D1 | The price rule | `estimate = escort + 40 × (travellers − 1) + 5 × max(0, bags − travellers) + (porter ? 30 : 0)`, where escort is 300 (full) or 200 (partial). Wheelchairs add 0. Whole dollars only. Example: 2 travellers, 3 bags, porter, full = 300 + 40 + 5 + 30 = **$375**. | Asaf, 27.11.2026. |
| D2 | One place for the price list and the rule | New `public/js/price.js` (like `meeting-time.js`, ADR-4): a constant `PRICES = { currency: 'USD', full: 300, partial: 200, extra_traveller: 40, extra_bag: 5, porter: 30, wheelchair: 0 }`, `estimatePrice({ travelers, bags, services, escort_scope })` → `{ total, lines }` (each line: label and amount), and `formatPrice(n)` → `"$375"`. Used by the form (live) and by the server (stored value). Changing a price later is one line in this file. | One rule in one place; the browser cannot read `data/lists.json` without an extra request, and the formula already lives in `public/js/` the same way. |
| D3 | The server decides the stored price | `api/submit-order.js` works out the price itself with D2 from the validated order (never from a value the page sends, like the meeting time today) and saves it. No new body field; validation unchanged. | Nobody can send a lower price; the old page (open during a deploy) still gets a price saved. |
| D4 | Storage | New column **`orders.estimated_price`** (integer, may be empty, ≥ 0), in whole US dollars. Orders saved before M13 keep it empty and show no price anywhere (no row in emails, no item on staff screens). The price is not recomputed later: what the customer saw is what is stored. | Asaf: shown in emails and staff screens, so it must be stored. Empty for old orders, like `wheelchairs` (ADR-40). |
| D5 | The migration (one shared database; the live site uses it) | New `supabase/migrations/005_estimated_price.sql`, safe to run while the old site is live and safe to re-run: (1) `add column if not exists estimated_price integer` with a check `estimated_price is null or estimated_price >= 0`; (2) `insert_order_with_limits` gets one more parameter at the end, `p_estimated_price integer default null` (the 16-parameter version from 004 is dropped first, so only one version exists; same grants as 004). Asaf runs it in the Supabase SQL Editor **before the push** (plain-Hebrew steps at build step 6). | ADR-40 pattern: the old code keeps calling without the new parameter and still saves orders. |
| D6 | Live summary "Your escort" — content | Heading "Your escort". Rows (label above value, like the review): **Flight** (`DM101 · London`, or the typed number; empty: "Choose your flight"), **Departure** (`Thu 10 Dec, 14:30`; typed: the date), **Travellers · Bags** (`2 · 3`), **Services** (same text as the review, "None" when empty), **Escort** (`Full (to the gate)`; empty: "Choose your escort"). Then the **"Suggested meeting time"** box with the time in gold (same formula and same date rule as step 2; typed flight: "We will confirm your meeting time after checking your flight."), with "Suggestion only. Subject to manager approval.". Then the **price** part (D8). It updates on every change, at every step (also on step 1 after choosing a flight). | MILESTONES M13 list. The meeting point is not added to the public form (M11 D5); it stays for the approval email and M14. |
| D7 | Summary placement | **Desktop (≥ 900px):** inside the left sunset panel, under the heading "Book your escort in four short steps.", as a dark card with a gold top line (the panel's existing look); the panel keeps the scene and stays beside the form; the form's position and width do not change. If the panel is shorter than the window, the summary scrolls with the page and stays visible (sticky). **Phone (< 900px):** a bar fixed to the bottom of the screen: "Your escort · Meet 12:45" on the left, "$375 ▴" on the right; a tap opens the full summary above the bar (the bar shows ▾ and the page behind stays scrollable); tapping again closes it. The page gets bottom padding the height of the bar, so "Back" / "Next" are never hidden. The bar is a real button (`aria-expanded`, `aria-controls`), reachable with the keyboard. Hidden on "Request received". | Asaf, 27.11.2026 (option א; phone bar as in the mock-up). |
| D8 | Price in the summary | Lines, each with its amount: "Full escort $300" / "Partial escort $200", "1 more traveller $40" (plural "2 more travellers $80"), "1 extra bag $5" ("2 extra bags $10"), "Porter / luggage help $30", and "Wheelchair Free" (or "Wheelchair × 2 Free") when chosen. Then **"Estimated price"** and the total in large Gilda Display, and under it **"No payment now. The final price is confirmed with your booking."** Before an escort is chosen (steps 1–2): no total yet, the line "Choose your escort to see your price." | Asaf saw this layout in the mock-up; option ב keeps the breakdown in the summary. |
| D9 | Prices next to each choice (option ב) | Step 2: under "Travellers (1–10)" the hint "Each extra traveller +$40."; under "Checked bags (0–10)" the hint "One bag per traveller included. Each extra bag +$5."; at the right of the "Porter / luggage help" box "+$30", and of the "Wheelchair" box "Free". Step 3: at the top right of each escort card "from $300" / "from $200". The hints use the existing small soft text style. | Asaf, 27.11.2026 (option ב). |
| D10 | Boarding-pass card, step 1 | After a flight is chosen from the list, a card in the boarding-pass style appears under the search box: label "Your flight", "Tel Aviv" and the destination in Gilda Display with a dashed line and a small plane icon between them, then four small fields — **Flight** (`DM101`), **Date** (`Thu 10 Dec`), **Departs** (`14:30`), **Airline** (`Demo Airlines`; left out when empty) — and a stub on the right (below on phones) with "Suggested meeting time" and the time. The read-only "Departure time" field is removed (the card shows the auto-filled time). Typing in the search box again removes the card and reopens the list, as today. Not shown in manual-entry mode. Gold thin border, 2px card corners (style guide), dashed divider before the stub. | Asaf, 27.11.2026 (only data the flights table has; all departures are from Tel Aviv). |
| D11 | Route drawing, step 3 | Under the text of each escort card: three small circles joined by lines, labelled "Meeting point", "Security", "Gate" (the Style Guide's route marker, 1.6px lines). **Full:** solid gold line and three filled circles. **Partial:** solid to "Security", dashed after it, and an empty circle at "Gate". Purely visual (`aria-hidden`); the card text ("Escort to the gate" / "Escort through security") still says it in words. | MILESTONES M13; DESIGN Part 2 "סימון מסלול". |
| D12 | Review, step 4 | One more review row at the end: **"Estimated price"** with the total (no "Edit" link; it follows the other rows). | The customer sees the price once more right before sending. |
| D13 | "Request received" as a boarding-pass card | Kept: the check icon, the title **"Request received"** and "Your request is awaiting manager review. We will email you the decision." Then one boarding-pass card (same as D10): "Tel Aviv → destination", Flight, Date, Departs, Airline; the stub shows **"Order number"** and the number in large gold letters, and under it "Estimated price" and the total. Under the card, the existing "Status · Awaiting review · Pending" row and "Back to home". **Typed flight:** the card shows "Tel Aviv" and, instead of a destination, "To be confirmed"; Flight = the typed number, Date = the typed date, no Departs / Airline. The price shown is the page's own (D2, same rule as the server). The screen never calls the order approved. | MILESTONES M13; FR-07 unchanged. |
| D14 | "Order number" everywhere | The label "Reference" becomes **"Order number"** on "Request received", in all six n8n email templates (the row label, also in the manager alert), and the archive table's first column. The number itself is unchanged (8 characters of the order id, upper case), and the code keeps the name `reference` internally (no API change). The email subjects keep "(A1B2C3D4)". | Asaf, 27.11.2026: one name for one number; M14 asks the customer for the "Order number". |
| D15 | Emails | `receivedEmailPayload` and `approvedEmailPayload` get `estimated_price`: the formatted text (`"$375"`) or `null` (old orders). In n8n, "Set customer_received" and "Set customer_approved" get a row **"Estimated price"** (the template already skips an empty row, so old orders show no row). The value is just `"$375"`; the label "Estimated price" says it is an estimate (keeps the n8n edit to one line per email). Not in the rejection, clarification, flight-change or manager-alert emails. The flight-change event reuses the approval payload, so it carries the field, but its template does not show it. | Asaf chose these two emails. |
| D16 | Staff screens | `toManagerView` adds `estimated_price` (number or `null`); the manager's order details and the archive's manager panel show one more item **"Estimated price"** (`$375`) after "Services · Escort", only when it is not empty. `toAgentView` does not get it: the field agent's card and the agent's archive panel are unchanged. | Asaf: manager screen and archive, not the agent. |
| D17 | The AI | The AI is **not** given the price, and prompt limit 1 ("never add a price") stays. The approval email's AI paragraph therefore never mentions money; the price comes only from the "Estimated price" row. | PRD §4.3. |
| D18 | Live site during the change | Order: Asaf runs `005_estimated_price.sql` (old site keeps working; new orders get an empty price) → push (page, functions and the new price go live together) → Asaf's n8n edits (until then the emails show "Reference" and no price row; nothing breaks). Friends testing now are told after the push. | One shared database and a live site with testers (as M11). |
| D19 | What stays | The four steps and their order, every existing field, validation and message, the meeting-time formula, the wheelchair stepper, the booking rules and consent box, the anti-bot field, the rate limits, `POST /api/submit-order`'s body and reply, the landing page (still **no prices** there), the agent screen, the AI, the fonts and colours, the seed (demo orders have no price and show none). | Keep M13 to what MILESTONES lists. |

---

## 1. Files

### New
- `public/js/price.js` (D1, D2).
- `supabase/migrations/005_estimated_price.sql` (D5).
- `tests/price.test.js` (§5).

### Changed
- `public/order.html`: the summary in the aside (D6, D7), the phone bar, the boarding-pass card holder on step 1 instead of the "Departure time" field (D10), step 2 hints and price tags (D9), the route and "from" price on the escort cards (D9, D11), the review row (D12), the new "Request received" card (D13).
- `public/js/order-form.js`: render the summary on every change; the phone bar open/close; the boarding pass; the price lines; the review row; the received card (D6–D13). Same values the submit sends.
- `public/css/theme.css` (and `base.css` only for shared pieces): summary card, phone bar, boarding pass, route marker, price tags; dark look, no shadows, 2px card corners, 8px controls.
- `api/submit-order.js`: work out the price with D2, pass `p_estimated_price`, add it to the "request received" email payload (D3, D15).
- `lib/notify.js`: `estimated_price` in `receivedEmailPayload` and `approvedEmailPayload` (D15).
- `lib/orders-view.js`: `estimated_price` in `toManagerView` only (D16).
- `public/js/order-details.js`: the "Estimated price" item (D16).
- `public/staff/archive.html`: column header "Order number" (D14).
- `n8n/sereno-notifications.json`: "Reference" → "Order number" in the six Set nodes; the "Estimated price" row in "Set customer_received" and "Set customer_approved" (placeholders untouched, ADR-5) (D14, D15).
- `tests/notify-payload.test.js`, `tests/orders-view.test.js`, `tests/wheelchairs.test.js`, `tests/manual-flight.test.js`, `tests/order-consent.test.js`: only where expected objects gain `estimated_price`.
- `spec/PRD.md`, `spec/DESIGN.md`, `spec/ARCHITECTURE.md`, `spec/MILESTONES.md` ("מחוץ למסמך" line): **only** the wording of O1, and only after Asaf approves it.
- `spec/ARCHITECTURE.md`: new ADRs (end of build). `spec/MILESTONES.md`: 🟡 and checked DoD items (end of build). `CLAUDE.md`: no change expected.

### Not changed
- `lib/validate.js` (no new body field), `lib/prompts.js`, `lib/ai.js`, `public/js/meeting-time.js`, `public/js/agent.js`, `public/index.html`, `data/lists.json`, the seed, `vercel.json`, `.env.example`.

---

## 2. Server

### 2.1 `public/js/price.js` (shared)
```
export const PRICES = { currency: 'USD', full: 300, partial: 200, extra_traveller: 40, extra_bag: 5, porter: 30, wheelchair: 0 };
export function estimatePrice({ travelers, bags, services, escort_scope }) -> { total, lines } | null
  // null when escort_scope is not 'full' / 'partial' or the counts are not whole numbers in range
export function formatPrice(n) -> '$375' (en-US grouping, no decimals)
```

### 2.2 `api/submit-order.js`
After validation and before the insert: `const price = estimatePrice(order)`; the insert call gets `p_estimated_price: price.total`. The "request received" payload gets `estimated_price: formatPrice(price.total)`. Reply unchanged (`reference`, `status`). The honeypot path is unchanged (nothing saved, no price).

### 2.3 `supabase/migrations/005_estimated_price.sql`
As D5: add the column and the check; drop the 16-parameter `insert_order_with_limits`; create it with the 17th parameter `p_estimated_price integer default null`, inserting it into `estimated_price`; same `revoke` / `grant` lines as 004. A comment line in 004 notes that 005 replaces the function.

### 2.4 Views and payloads
- `toManagerView`: `estimated_price: Number.isInteger(row.estimated_price) ? row.estimated_price : null`.
- `approvedEmailPayload` / `receivedEmailPayload`: `estimated_price: … ? formatPrice(…) : null`.

---

## 3. Browser / CSS

### 3.1 Summary (`order.html` aside + `order-form.js`)
- The aside is shown on every width: ≥ 900px as today (scene + heading) with the summary card below the heading (sticky inside the aside); < 900px only the bottom bar and the summary it opens (the scene stays hidden on phones, as today).
- One function `renderSummary()` reads the page state (the same functions the review and the submit use) and is called from every input, change and step event that exists today.
- The total and the meeting time get the short gold colour flash of the mock-up only for people who did not ask for "less motion".
- `aria-live="polite"` on the total and the meeting time only (not the whole card), so screen readers are not flooded.

### 3.2 Boarding pass (D10, D13)
One builder `boardingPass({ flight, typed, stub })` used on step 1 and on "Request received"; text set with `textContent` (`dom.js`), never HTML strings.

### 3.3 Route (D11)
Inline SVG in each escort card (no new file): 3 circles, 2 segments; the partial card's second segment `stroke-dasharray` and an empty "Gate" circle; labels as text under it.

### 3.4 Fit (375px and 1280px)
Places to watch: the boarding-pass fields on a 375px phone (they wrap to two lines; the stub moves under the main part), the "from $300" next to "Full", the "+$30" inside the service box, the bottom bar's two halves, the summary price lines, the "Order number" stub with 8 letters at 32px.

---

## 4. n8n (Asaf, by hand, in the live workflow; the repo export gets the same change)
1. In each of the six Set nodes (`manager_alert`, `customer_approved`, `customer_rejected`, `customer_clarification`, `customer_flight_change`, `customer_received`), in `rows`, change `label: "Reference"` to `label: "Order number"`.
2. In "Set customer_received" and "Set customer_approved", in `rows`, add `{ label: "Estimated price", value: $json.body.estimated_price },` (in the approval email after the "Escort" row; in the received email after the "Flight" row).
3. Save.

Plain-Hebrew steps at build step 6, done **after the push** (before that the events carry no `estimated_price` yet, and an empty row is skipped anyway).

---

## 5. Tests (`node --test`)
New `tests/price.test.js`:
- Asaf's examples: 1 traveller, 0 bags, full, nothing else = $300; partial, same = $200; 2 travellers, 3 bags, porter, full = $375; 10 travellers, 10 bags, partial = 200 + 360 = $560; bags ≤ travellers add nothing; porter adds 30 once; wheelchair (any number) adds 0.
- The lines match the total; `formatPrice(375) === '$375'`, `formatPrice(1200) === '$1,200'`.
- Bad input (no escort, out-of-range counts) → `null`.
- `toManagerView` has `estimated_price` (number or `null`); `toAgentView` does not have it.
- `receivedEmailPayload` / `approvedEmailPayload` carry `"$375"`, and `null` for a row without a price.
- `public/order.html` and `public/staff/archive.html` contain "Order number" and no visible "Reference" label; the n8n export has no `label: "Reference"` and has two `"Estimated price"` rows.
- `005_estimated_price.sql` declares `p_estimated_price … default null` (the old call still works).

Existing 170 tests stay green (only expected objects that gain `estimated_price` are updated).

---

## 6. How the build is verified (before marking 🟡)

### 6.1 Asaf's part
1. Before the push: run `005_estimated_price.sql` in the Supabase SQL Editor (steps given at build step 6).
2. After the push: the n8n edits (§4), then one order on the live site to his allowlisted address: the "request received" email shows "Order number" and "Estimated price"; after approving it in the manager screen, the approval email shows both.

### 6.2 Checks (local run, port 3000, browser pane)
- **Every step at 375px and 1280px, no cut or overflowing text, no sideways scroll:** step 1 (list, chosen flight → boarding pass, manual mode), step 2 (hints, "+$30", "Free", wheelchair stepper shown), step 3 (both cards with the route, one chosen), step 4 (review with the price row, rules, consent, a field error), "Request received" (from the list and typed). Phone: the bar closed and open, "Back" / "Next" fully visible above it, the bar reachable with Tab and Enter.
- **The summary updates at every step:** choose a flight → Flight, Departure, meeting time appear; change travellers / bags → meeting time and price change; tick porter / wheelchair → Services and price lines change; choose Partial → Escort and total change; Back keeps everything; "Edit" from the review and walking forward again keeps everything.
- **Prices only from Asaf's list:** the five sample orders of §5 entered in the page show the same totals as the test; no "₪" and none of the mock-up numbers anywhere (`grep` on `public/`).
- **The order still sends and saves:** one order from the list and one typed: "Request received" shows the Order number, the price and Pending; the row in Supabase (Development) has `estimated_price` equal to the page's total; the manager screen and the archive panel show "Estimated price"; the agent card does not; an old seed order shows no price item; the manager can approve as before. The n8n events (local server log of the payload, not the live workflow) carry `estimated_price`.
- **Nothing paid:** the page has no payment or card field and makes no request other than `/api/flights` and `/api/submit-order`.
- **Screenshots** of step 2, step 3 and "Request received" at both widths, and the phone bar open, in the build report.
- **Unit tests:** all green.

---

## 7. Open points

| # | Question | Options | Answer / recommendation |
|---|---|---|---|
| O1 | The PRD / DESIGN / ARCHITECTURE / MILESTONES wording below (MILESTONES M13: "before planning, PRD §3, FR-10 and §7 … and DESIGN screen 2 are updated per what Asaf approves"). | (a) approve as written; (b) approve with changes Asaf names. | **Decided (27.11.2026): (a).** Applied at build step 0, nothing else. |
| O2 | Landing page: still no prices (the drawing and the mock-up showed prices only in the form). | (a) no prices on the landing page, as today; (b) add a "from $200" line under "Escort options". | **Decided (27.11.2026): (a)** — not asked for; can be a small change later. |
| O3 | The manager-alert email: show the estimated price too? | (a) no (Asaf's list: the two customer emails and the staff screens); (b) yes, one more row. | **Decided (27.11.2026): (a)** — the manager sees it on the screen a click away. |
| O4 | Can the manager change the price? | (a) no: the system keeps the estimate; the final price is agreed outside the system (as the text "The final price is confirmed with your booking" says); (b) a price field in the manager screen (a new feature, not in M13). | **Decided (27.11.2026): (a)** — MILESTONES M13 lists no such feature. |

### O1 — proposed wording changes (Hebrew, as the documents are written)

**`spec/PRD.md`**
- §3, the screens table, row 1: `… ומוביל לטופס בכפתור "Book your escort" (Milestone 10). בלי מחירים. …` → `… ומוביל לטופס בכפתור "Book your escort" (Milestone 10). בלי מחירים (מחיר משוער מוצג רק בטופס ההזמנה, Milestone 13). …`
- §3, "טופס ההזמנה: ארבעה שלבים", before item 1, add: `לאורך כל הטופס מוצג סיכום "Your escort" שמתמלא בכל שלב: הטיסה, ההמראה, הנוסעים והמזוודות, השירותים, הליווי, שעת המפגש המומלצת (הצעה בלבד) והמחיר המשוער. בדסקטופ הוא בפאנל שליד הטופס, ובטלפון בפס בתחתית המסך שנפתח בלחיצה (Milestone 13).`
- Item 1, at the end: `אחרי בחירת טיסה מהרשימה היא מוצגת ככרטיס בסגנון כרטיס עלייה למטוס (Milestone 13).`
- Item 2, at the end: `ליד כל בחירה מוצגת התוספת שלה למחיר (Milestone 13).`
- Item 3: `**היקף ליווי** — מלא (עד השער) או חלקי (עד הביטחון). בחירה של הלקוח בלבד.` → `**היקף ליווי** — מלא (עד השער) או חלקי (עד הביטחון). בחירה של הלקוח בלבד. בכל אפשרות מוצגים ציור של המסלול (מקום המפגש, בידוק ביטחוני, שער) והמחיר ההתחלתי (Milestone 13).`
- Item 4: after `סקירה של כל ההזמנה …` add `, כולל המחיר המשוער,`.
- The paragraph after the steps: `לאחר השליחה מוצג מסך אישור שמציין שהבקשה התקבלה וממתינה לבדיקת מנהל. הוא לא מציג את ההזמנה כמאושרת.` → `לאחר השליחה מוצג מסך אישור בסגנון כרטיס עלייה למטוס, שמציין שהבקשה התקבלה וממתינה לבדיקת מנהל, עם "Order number" והמחיר המשוער. הוא לא מציג את ההזמנה כמאושרת.`
- New subsection after "נוסחת שעת המפגש": `### מחיר משוער (Milestone 13, החלטה של אסף, 27.11.2026)` / `המחיר בדולרים: ליווי מלא $300, ליווי חלקי $200, וכל אחד מהם כולל נוסע אחד. כל נוסע נוסף $40. מזוודה נבדקת אחת לכל נוסע כלולה, וכל מזוודה מעבר לכך $5. סבל $30 להזמנה. כיסאות גלגלים בחינם. המחיר מחושב בקוד (גם בשרת, שהוא זה שנשמר), ומוצג כהערכה בלבד עם "No payment now. The final price is confirmed with your booking." אין תשלום באתר ואין פרטי אשראי.`
- FR-07: `מסך אישור "ממתין לבדיקת מנהל" לאחר שליחה. ההזמנה אינה מוצגת כמאושרת` → `מסך אישור "ממתין לבדיקת מנהל" לאחר שליחה, עם מספר ההזמנה ("Order number") והמחיר המשוער. ההזמנה אינה מוצגת כמאושרת`
- FR-10: `… וסרטון. ללא מחירים` → `… וסרטון. ללא מחירים (המחיר המשוער מוצג בטופס, FR-45)`
- FR-43: `עם קוד האסמכתא והטיסה` → `עם מספר ההזמנה, הטיסה והמחיר המשוער`
- New rows in 4.1: `| FR-45 | מחיר משוער בטופס לפי רשימת המחירים (סעיף 3), שמתעדכן בכל שינוי ומוצג ליד כל בחירה ובסיכום, כהערכה בלבד ובלי תשלום. השרת מחשב אותו ושומר אותו עם ההזמנה, והוא מוצג במסך הסיום, במייל "הבקשה התקבלה", במייל האישור, במסך המנהל ובארכיון (לא לנציג השטח) (Milestone 13, החלטה של אסף, 27.11.2026) | – | Should |` and `| FR-46 | סיכום "Your escort" שמתמלא בכל שלב, כרטיס טיסה בסגנון כרטיס עלייה למטוס, ציור מסלול בכרטיסי הליווי, ומסך סיום בסגנון כרטיס עם "Order number" (Milestone 13) | – | Should |`
- FR-31, approval: `באישור: פרטי ההזמנה, שעת המפגש ונקודת המפגש הקבועה (…)` → add after it `, והמחיר המשוער (Milestone 13)`.
- §5, the "AI" row and §4.3 stay (the AI never gets or writes a price).
- §7: `- מחירים באתר.` → `- תשלום באתר וקביעת מחיר סופי במערכת. מחיר משוער מוצג בטופס ההזמנה (Milestone 13, החלטה של אסף, 27.11.2026).`

**`spec/DESIGN.md`**
- Screen 2, "חלקים משותפים לארבעת השלבים", add: `- סיכום "Your escort" (Milestone 13): בדסקטופ כרטיס כהה עם קו זהב עליון בתוך פאנל השקיעה, מתחת לכותרת. שורות Flight, Departure, Travellers · Bags, Services, Escort, תיבת "Suggested meeting time" עם השעה בזהב, ופירוט המחיר עם "Estimated price", הסכום בגופן הכותרות והטקסט "No payment now. The final price is confirmed with your booking." לפני בחירת ליווי: "Choose your escort to see your price." בטלפון: פס בתחתית המסך, "Your escort · Meet 12:45" ו-"$375", שלחיצה עליו פותחת את הסיכום המלא.`
- Step 1, "מה יש": `שדה "Departure time" לקריאה בלבד עם הטקסט "Auto-filled from flight", שמציג תאריך ושעה.` → `אחרי בחירת טיסה, כרטיס בסגנון כרטיס עלייה למטוס (Milestone 13): "Your flight", "Tel Aviv" והיעד בגופן הכותרות עם קו מקווקו ומטוס קטן ביניהם, השדות Flight, Date, Departs ו-Airline, ובצד (בטלפון מתחת) שעת המפגש המומלצת. מסגרת זהב דקה. הכרטיס מחליף את שדה "Departure time".`
- Step 2, "מה יש", add: `מתחת ל-"Travellers" הטקסט "Each extra traveller +$40.", מתחת ל-"Checked bags" הטקסט "One bag per traveller included. Each extra bag +$5.", ובצד ימין של "Porter / luggage help" ו-"Wheelchair" התוספת: "+$30" ו-"Free" (Milestone 13).`
- Step 3, "מה יש", add: `בכל כרטיס, בפינה הימנית העליונה, "from $300" או "from $200", ומתחת לטקסט ציור מסלול: שלוש נקודות, "Meeting point", "Security", "Gate". בליווי מלא קו זהב מלא ושלוש נקודות מלאות; בחלקי קו מלא עד "Security", מקווקו אחריו ונקודה ריקה ב-"Gate" (Milestone 13).`
- Step 4, "מה יש": after the four review rows add `, ושורה חמישית "Estimated price" בלי "Edit"`.
- "Request received", "מה יש": `תיבת "Reference" עם מספר ההזמנה (A1B2C3D4). שורות "Flight" ו-"Status" עם תגית "Pending".` → `כרטיס בסגנון כרטיס עלייה למטוס (כמו בשלב 1), ובצד שלו "Order number" עם המספר (A1B2C3D4) באותיות זהב גדולות, ו-"Estimated price" עם הסכום. לטיסה שהוקלדה: "To be confirmed" במקום היעד, והמספר והתאריך שהוקלדו. מתחת שורת "Status" עם תגית "Pending" (Milestone 13).`
- Screen 3, "פרטי ההזמנה (ימין)": after `Services · Escort` add `, ו-"Estimated price" כשיש (Milestone 13)`.
- Screen 5: `טבלה עם העמודות Reference, Customer …` → `טבלה עם העמודות Order number, Customer …`
- "מה לא מוצג בתמונות", add a bullet: `- **טופס הזמנה עשיר ומחיר משוער (Milestone 13, החלטה של אסף, 27.11.2026):** הסיכום, כרטיס הטיסה, ציור המסלול (רכיב "סימון מסלול" מה-Style Guide) ומסך הסיום ככרטיס נבנים במראה הכהה, בלי צללים, כרטיסים בפינות 2px ושדות בפינות 8px. "Order number" מחליף את "Reference" בכל המסכים והמיילים. המחירים בדולרים ומגיעים רק מרשימת המחירים (PRD, סעיף 3).`
- Screen 1, last bullet `כותרת תחתונה עם השם Sereno. אין מחירים.` stays (O2).

**`spec/ARCHITECTURE.md`**
- §2 `orders`, after `wheelchairs`: `| \`estimated_price\` | integer, **יכול להיות ריק**, 0 ומעלה | המחיר המשוער בדולרים שלמים, שהשרת חישב ב-\`public/js/price.js\` בשליחה (Milestone 13). ריק בהזמנות שלפני Milestone 13 |`
- §5.1 `POST /api/submit-order`, "סדר פעולות" item 6: `חישוב \`recommended_time\` ב-\`meeting-time.js\` (אם הטיסה נמצאה).` → `חישוב \`recommended_time\` ב-\`meeting-time.js\` (אם הטיסה נמצאה), ו-\`estimated_price\` ב-\`price.js\` (תמיד; ערך מהדף לא נלקח).`
- §5.2, in the sample payload add `"estimated_price": "$375",` and in the paragraph after it: `\`estimated_price\` (טקסט מעוצב, או null בהזמנה ישנה) נשלח ב-\`customer_received\` וב-\`customer_approved\` (Milestone 13).` Also: `ערכי \`type\`:` list gets `customer_received` (it is missing today).
- §7 folder tree: `price.js` under `public/js/` ("רשימת המחירים וחישוב המחיר המשוער (משותף לשרת)") and `004_wheelchairs.sql`, `005_estimated_price.sql` under `migrations/`.
- (The ADRs are written at the end of the build.)

**`spec/MILESTONES.md`**, "מחוץ למסמך", the Won't sentence: `… מחירים באתר, עדכונים בזמן אמת …` → `… עדכונים בזמן אמת …` and at its end `מחיר משוער (בלי תשלום) נוסף ב-M13.`

No part of the spec M13 needs is a placeholder. Conflict notes: PRD (FR-10, §7) says "no prices" — MILESTONES M13 records Asaf's decision to reverse it, so O1 updates the PRD before building; the mock-up image (frame 6) shows a "Reference" box — after O1 the DESIGN text wins, as with earlier DESIGN updates.

---

## 8. Definition of Done mapping

| DoD item (MILESTONES M13) | How it is met | Checked in |
|---|---|---|
| The summary, flight card, route and estimated price update correctly at every step, on phone and desktop, with no cut text | D6–D12, §3 | §6.2 Every step at 375px and 1280px, The summary updates at every step, Screenshots |
| The estimated price is worked out only from Asaf's price list, and shown as an estimate with no payment | D1–D3, D8, D9, §2.1 | §5 `price.test.js`, §6.2 Prices only from Asaf's list, Nothing paid |
| The final screen shows "Order number", and the order sends and saves as before | D13, D14, D3–D5 | §6.2 The order still sends and saves, §6.1 after the push |
| The existing tests pass | §5 | `node --test` |

### 8.1 DoD result (27.11.2026, local run)

| DoD item | Result |
|---|---|
| The summary, flight card, route and estimated price update correctly at every step, on phone and desktop, with no cut text | Pass. At 1280×800 and 375×812, a script walked steps 1–4 (flight from the list, travellers / bags changed, porter, wheelchair × 2, Full and Partial) and checked after each step that the summary values and the bar matched the page, and that no element left the screen and the page never scrolled sideways: no findings. The boarding pass shows Tel Aviv → destination, Flight, Date, Departs, Airline and the meeting time; the route is solid for Full and dashed after Security with an empty Gate for Partial. On the phone the bar opens and closes the summary, and Back / Next stay visible above it. On the desktop the whole summary fits beside the form at 1280×800 without scrolling. Typed flight: the summary shows the number and date and "We will confirm your meeting time after checking your flight.", and no pass. |
| The estimated price is worked out only from Asaf's price list, and shown as an estimate with no payment | Pass. `tests/price.test.js` checks the list, his examples ($300, $200, $375, $560), the free bags and wheelchairs, the flat porter, and that the lines add up for every count. In the page: 2 travellers / 3 bags / porter / Full = $375; 2 / 5 / porter / wheelchair × 2 / Partial = $285. "No payment now. The final price is confirmed with your booking." is under every total; the page has no payment or card field; no "₪" and no mock-up price in the page (tested). |
| The final screen shows "Order number", and the order sends and saves as before | Pass. Order from the list (DM202, desktop): "Request received" card with Order number 9CA15963 and $375; the manager screen and the archive panel show "Estimated price $375", read from the database; an older demo order shows no price; the archive column says "Order number". Typed flight (LY999, phone): saved as before, card shows "To be confirmed", Order number 7E61477D and $300. The field agent view has no price (tested). |
| The existing tests pass | Pass: 184 tests (170 before + 14 new). |

---

## 9. Build steps (one at a time, each with Asaf's go-ahead)

0. **Documents (after O1):** the approved wording in PRD, DESIGN, ARCHITECTURE and the one MILESTONES line, nothing else.
1. **Price:** `public/js/price.js`, `tests/price.test.js`; run the unit tests.
2. **Database (Development, the shared project):** write `005_estimated_price.sql`; Asaf runs it in the SQL Editor (plain-Hebrew steps); check the column and the function exist.
3. **Server:** `api/submit-order.js`, `lib/notify.js`, `lib/orders-view.js`, the updated tests; run the unit tests.
4. **Form:** summary and phone bar, boarding pass, step 2 prices, step 3 route, review row, "Request received" card, CSS.
5. **Staff screens:** "Estimated price" in the manager details and archive panel, "Order number" archive column.
6. **Emails:** the n8n export (§4) and the plain-Hebrew steps for Asaf (to do after the push).
7. **Verify:** §6.2 at 375px and 1280px, screenshots, one order from the list and one typed, end to end on the local run.
8. **DoD pass:** results written under §8 as "DoD result".
9. **Close:** ADRs (the shared price module and the server-decided stored price; "Order number" as a label only), 🟡 and checked items in MILESTONES, shut down the local run. No commit.
