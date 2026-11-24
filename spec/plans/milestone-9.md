# Milestone 9 — Assigning a field agent to an order (plan)

**Source:** `spec/MILESTONES.md` (Milestone 9, the overview table, "How the document is built", the requirement table — M9: feature 28 and the "orders he escorted himself" filter of FR-35 — and the dependencies: M9 builds on M8), PRD §2 (field agent row), §3 (main flow step 8), FR-26, FR-27, FR-35, FR-41, §7 (feature 28 listed as Could), assumptions 1–2, ARCHITECTURE §2 (`orders`, status transitions, database functions, migration rules), §3 (roles in `app_metadata`, permission matrix, what the agent may see, the note on FR-35), §5.1 (`GET /api/orders`, `POST /api/order-decision`), §6 (keys), §7 (folders), ADR-10 (roles set in the SQL Editor), ADR-15 (agent scope, "all agents see all approved orders"), ADR-22, ADR-24, ADR-26, ADR-28 to ADR-32, DESIGN screen 3 (Approvals: "Meeting time", "Manager notes", "Approve"), screen 4 (agent: "In the first version all agents see all approved orders"), screen 5 (Archive, filter row, cards), "What is not shown in the images", the dark "website" section, the Style Guide (fields with the label above, checkboxes, tags), the three images (no frame shows an agent choice or a "My orders only" filter: built in the same design line, DESIGN rule of 10.11.2026). The code is the source of truth for what M8 built: `api/orders.js`, `api/order-decision.js`, `lib/auth.js`, `lib/orders-view.js`, `lib/validate.js`, `lib/supabase.js`, `public/js/manager.js`, `public/js/order-details.js`, `public/js/archive.js`, `public/js/agent.js`, `public/staff/*.html`, `supabase/migrations/001_schema.sql`, `002_functions.sql`, `supabase/seed/*`, `tests/` (136 tests).

**Status:** written 24.11.2026. **Approved by Asaf (24.11.2026)** with the recommended answer to every open point: O1 (a) the wording changes as written; O2 (a) the agent's cards follow the table and "My orders only" is on by default for the agent; O3 (a) completing an unassigned order records the agent; O4 (b) optional display names, email when none; O5 (a) the "Assigned to you" tag; O6 (a) `404` for another agent's order; O7 (a) the `?id=` row of the matrix aligned with the code. **Build step 0 done (24.11.2026):** the O1 wording (with O2–O7) applied to PRD (§2 agent row, §3 step 8, FR-27, FR-35, §7 row 28, assumptions 1–2), ARCHITECTURE (§2 `orders` column, index, transitions, the functions note; §3 matrix with the O7 fix, the note; §5.1 `view`, `mine`, reply fields, `agent_id`, `assign_agent`, `complete`, `GET /api/agents`; §7 folders) and DESIGN (screens 3, 4 and 5, "What is not shown"). **Build step 1, first part (24.11.2026):** `supabase/migrations/003_agent_assignment.sql` written; **Asaf ran it (24.11.2026, "Success")**; the check through the running app is still to do (the sandbox gives my shell no access to `.env.local`). **Build step 2, code part (24.11.2026):** `api/agents.js`; `agentVisibility`, `isAgentUser`, `agentName`, `agentsFromUsers`, `assigned_agent_id` / `assigned_to_me` in `lib/orders-view.js` (pure helpers there, as planned); `agent_id`, `assign_agent` and `mine` in `lib/validate.js`; visibility and `mine` in `api/orders.js`; approve with an agent, `assign_agent` and the complete rule in `api/order-decision.js`; `supabase/seed/assign-demo.sql`; `tests/assignment.test.js`. 146 unit tests pass. **Not yet checked against the database** (needs the second agent user, the seed files and the local run). **Steps 3–5, code part (24.11.2026):** `loadAgents`, `agentNameFor`, `agentField` in `order-details.js`; the "Field agent" menu in the Approvals decision area (under "Meeting time"; the list reloads with Refresh; the status line names the agent); in the archive the manager panel's "Field agent" + "Save agent" (approved) and the read-only "Field agent" item (completed), the agent's "My orders only" box (checked on opening) and "Assigned to you" in his panel; the tag on the agent card; styles. 146 unit tests pass; `/api/agents` answers `401` without a token on the local run. **Steps 6–7 done (24.11.2026):** checks of §6.2 with the manager and two agents (results in §8.1, every DoD item passes); ADR-33 to ADR-35 added; MILESTONES M9 marked 🟡 with every item checked; local run stopped. No commit. **Fix during Asaf's check (24.11.2026):** Asaf asked for the "Field agent" menu on a "Flight time changed" order too (a new flight time may need another agent). The menu starts on the order's current agent; a different choice is saved with `assign_agent` just before "Ignore" or "Approve change" (no server change), and the status line names the new agent. Checked: the menu shows on Noa B.'s order (00000004) with its current value. Asaf approved the DESIGN update: "What is not shown" (the "Flight time changed" area and the M9 bullet) now mention it. **Second fix (24.11.2026):** Asaf asked to close orders on the Approvals screen: nothing opens by itself (on load, after a decision, after a filter), a second click on the open order, the × button or Escape (not while typing) closes it, and a hint "Select an order to see its details." fills the empty details column on wide screens (ADR-36). Checked at 1280px: load (none open, hint shown), open, second click (closed, focus back on the row), ×, Escape, a filter hiding the open order. Asaf checked the local run and approved with the push (24.11.2026, ✅).

**Goal:**
1. **Assign on Approve (feature 28):** on the Approvals screen, next to "Approve", the manager may choose a field agent from the list of agents (Supabase Auth users with the role `agent`). The choice is optional.
2. **Change the agent later:** from the order panel in the archive (M8, "View"), for an approved order.
3. **Agent screen:** each agent sees the approved orders assigned to him and the orders assigned to nobody; another agent's order is not shown, and he cannot mark it completed.
4. **Agent archive (FR-35):** the same rule, plus a "My orders only" filter.
5. **Data:** one new column on `orders` and a migration Asaf runs in the Supabase SQL Editor. The agent list is read on the server only; another agent's email never reaches an agent's browser. **No email change.**

---

## 0. Decisions this plan proposes

| # | Topic | Proposal | Why |
|---|---|---|---|
| D1 | The new column | `orders.assigned_agent_id uuid null`, a reference to `auth.users (id)` with `on delete set null`, and an index on it. Empty = assigned to nobody. The agent is always identified by his Supabase user id (`staff.user.id` from `lib/auth.js`, read from the verified token), never by anything the page sends about itself. | MILESTONES M9 ("a new column on `orders` for the assigned agent"). The user id is stable; the email can change. `set null` means deleting an agent user returns his orders to "everyone", instead of hiding them. |
| D2 | Who sees an order (agent) | An agent sees an order when `assigned_agent_id` is empty **or** equals his own id. The rule is one pure function in `lib/orders-view.js` (`agentVisibility(userId)`, a PostgREST `or` group: `assigned_agent_id.is.null,assigned_agent_id.eq.<id>`), used by `view=approved` and by `view=archive` (combined with the search and date groups through the existing `combineOrGroups`). The manager's views do not change: he sees everything. | MILESTONES M9 ("an unassigned order shows to every agent; another agent's order does not show"). One rule in one place for both screens. |
| D3 | The agent list | New endpoint `GET /api/agents`, **manager only** (`403` for the agent). The server reads the users with `auth.admin.listUsers()` (secret key, server only; at most 5 staff users, ARCHITECTURE §3) and keeps those with `app_metadata.role = "agent"`. Reply: `{ agents: [{ id, name }] }`, sorted by name, where `name` is the user's display name if Asaf set one (O4), otherwise the email. The pure part (`agentsFromUsers(users)`) is in `lib/orders-view.js` and unit-tested. The agent's browser never calls it and never gets an agent id other than his own (D6). | MILESTONES M9 ("the agent list is read on the server only; another agent's email is not sent to an agent's browser"). A separate small file is clearer than a new `view` on `/api/orders`; Vercel allows 12 functions on the free plan and the project uses 5. |
| D4 | Approve with an agent | `POST /api/order-decision`, `action: approve` accepts an optional `agent_id` (uuid, or empty / `null` = no agent). The server checks it is a current agent (`auth.admin.getUserById` → role `agent`), else `400` "This field agent was not found.". `decide_order` gets a new last parameter `p_agent_id uuid default null` and sets `assigned_agent_id` in the **same** conditional update when the new status is `approved`, so the decision and the assignment can never be half saved. Reject and the other actions never touch the column. The customer email does not change (no agent name, MILESTONES M9). | Atomic with the decision, as the stack requires for actions two people can do at once (ARCHITECTURE §2). |
| D5 | Change the agent later | New action `assign_agent` (manager only) with `agent_id` (uuid, or `null` to clear). Allowed only while the status is `approved`: one conditional update `where id = … and status = 'approved'`; zero rows → `409` "This order is no longer approved.". No email. The order is then moved by the rule of D2 on the agents' next Refresh. A `completed` order keeps its agent (it records who did the job) and cannot be changed. | MILESTONES M9 ("the manager can change the agent later, from the order panel in the archive"). One statement, so no database function is needed (like `add_note`). |
| D6 | What each role's rows carry | Manager rows (`toManagerView`): `assigned_agent_id` (or `null`); the browser turns it into a name with the list from D3 ("Unknown agent" if the user no longer exists or lost the role). Agent rows (`toAgentView`): only `assigned_to_me` (true / false), **never an id or an email**. | MILESTONES M9 (no other agent's data in an agent's browser). The agent does not need to know who else has an order: he never sees it. |
| D7 | "Mark completed" on someone else's order | `complete_order` gets a second parameter `p_agent_id uuid default null` and completes only when `assigned_agent_id is null or assigned_agent_id = p_agent_id`. The API reads the order first: an order assigned to another agent answers **`404` "Order not found."** (as if it does not exist for him), before the function is called. A race (the manager reassigns at the same moment) → the function changes nothing → `409` as today. | MILESTONES M9 DoD ("`403` or `404`"). `404` tells the agent nothing about other agents' orders. |
| D8 | Completing an unassigned order records the agent | When an agent completes an order that was assigned to nobody, the same update sets `assigned_agent_id` to him (`coalesce(assigned_agent_id, p_agent_id)`). See **O3**. | Then every order completed from M9 on says who did it, so "My orders only" and the agent's cards (O2) can count "the orders I handled", which is what Asaf asked for on 24.11.2026. |
| D9 | Keeping the live site working during the change | There is **one** Supabase project, used by the local run and by the live site. The migration replaces `decide_order` and `complete_order` inside one transaction, and both new parameters have `default null`, so the live M8 code (which does not send them) keeps working between the migration and the push: approve saves no agent, and complete works on unassigned orders (all orders are unassigned until M9 is used). The file ends with `notify pgrst, 'reload schema';` so the API sees the new column and functions at once. | ARCHITECTURE §2 (functions), CLAUDE.md (no surprises on the live site). |
| D10 | Migration file | New `supabase/migrations/003_agent_assignment.sql`, run once by Asaf in the SQL Editor after 001 and 002: the column, the index, `drop function` + `create function` for `decide_order` and `complete_order` (same security rules as 002: `security invoker`, empty `search_path`, `revoke execute` from `public`, `anon`, `authenticated`, `grant execute` to `service_role`), the schema reload. 001 and 002 are not edited (they are what is already in the database). Safe to re-run (`add column if not exists`, `create index if not exists`, `drop function if exists` for both signatures). | MILESTONES M9 ("a migration Asaf runs on the Development database"). |
| D11 | Approvals screen: the choice | In the decision area of a **pending** order, a third field next to "Meeting time" and "Manager notes": label **"Field agent"** (label above, Style Guide), a menu with **"Not assigned (all agents)"** first and selected, then the agents by name. Approve sends `agent_id` when one is chosen. The list is loaded once when the page opens (`GET /api/agents`) and again on "Refresh". If it cannot be loaded, the menu holds only "Not assigned (all agents)" and a small line under it says "Agent list could not be loaded." — Approve still works. Not shown for "Needs clarification" or "Flight time changed" orders (those buttons do not approve a new order). The status line after Approve adds the agent: "Order A1B2C3D4 approved for Dana K. Email sent to the customer." | MILESTONES M9 ("next to Approve, the manager chooses an agent; the choice is optional"). DESIGN rule for what the images do not show: same field style. |
| D12 | Archive panel (manager): change the agent | In the "View" panel, under "Manager notes": for an **approved** order, the same "Field agent" menu (current agent selected, or "Not assigned (all agents)") with a small secondary button **"Save agent"**; success line "Agent saved for order A1B2C3D4." / "Order A1B2C3D4 is now open to all agents."; errors under the menu (a `409` also reloads the table). For a **completed** order: a read-only line "Field agent: Dana K." (or "–"). For other statuses nothing is shown. The panel's details also show "Field agent" as a data item for approved and completed orders. The menu code is shared in `order-details.js` (`agentField`), used by both screens. | MILESTONES M9 ("from the order panel in the archive, M8"). One copy of the menu (ADR-30). |
| D13 | Agent screen | `view=approved` for the agent returns his orders and the unassigned ones (D2), sorted as today. The card shows a small tag **"Assigned to you"** on his own orders (see **O5**); unassigned cards look as today. The "Approved orders" heading and everything else stay. | MILESTONES M9. The tag lets the agent tell his own orders from the shared ones. |
| D14 | Agent archive: "My orders only" | In the filter row, after "To", **for the agent only**: a checkbox **"My orders only"** (Style Guide checkbox, gold when checked in the dark look). It sends `mine=1`; the server then keeps only `assigned_agent_id = <his id>` (inside his visible orders). Changing it starts again at page 1, like the other filters. Its default (on or off) follows **O2**. The manager does not get the checkbox; a `mine` sent by the manager is ignored. | MILESTONES M9 ("My orders only: orders that were assigned to him"), FR-35. |
| D15 | Agent archive cards | The cards keep following the table and its filters (ADR-29), now with the visibility of D2 and the "My orders only" filter. What exactly they count for the agent is **O2** (Asaf's request of 24.11.2026). | ADR-29, Asaf 24.11.2026. |
| D16 | Manager archive | No new column and no new filter in the table (not asked for). The agent appears in the panel only (D12). | Keep M9 to what MILESTONES lists. |
| D17 | Emails, n8n, AI | **No change.** The email payloads never read the new column (a unit test checks that an approve payload has no agent field). | MILESTONES M9 ("Emails: no change. The customer does not get the agent's name"). |
| D18 | Test data | New `supabase/seed/assign-demo.sql` (Development only, run after `seed.sql` and `archive-demo.sql`): it finds the agent users in `auth.users` by role (ordered by email: "agent A" and "agent B"), and assigns a few seed approved orders to A, one to B, leaves the rest unassigned, and assigns some completed demo orders to A and some to B, so every check has something to show. If fewer than two agents exist it stops with a clear message. `seed.sql` and `archive-demo.sql` do not change (they insert rows without the column, which stays empty). | ADR-1, ADR-27. Two agent users are needed for the DoD ("checked with two agent users"). |

---

## 1. Files

### New
- `supabase/migrations/003_agent_assignment.sql` (D1, D4, D7–D10).
- `api/agents.js`: `GET /api/agents`, manager only (D3).
- `supabase/seed/assign-demo.sql` (D18).
- `tests/assignment.test.js`: the pure helpers and validation of M9 (§5).

### Changed
- `api/orders.js`: agent visibility in `view=approved` and `view=archive`, `mine`, the stats over the visible rows (D2, D14, D15).
- `api/order-decision.js`: `agent_id` on approve, `assign_agent`, the complete rule (D4, D5, D7, D8).
- `lib/orders-view.js`: `agentVisibility`, `agentsFromUsers`, `assigned_agent_id` / `assigned_to_me` in the views, the archive's `mine` condition (D2, D3, D6, D14).
- `lib/validate.js`: `agent_id` (only with `approve` and `assign_agent`), the new action, `mine` in `validateArchiveQuery` (D4, D5, D14).
- `lib/auth.js`: `roleMayDecide` — `assign_agent` is manager only (already true: the manager may do everything except `complete`; a test is added).
- `public/js/order-details.js`: `agentField` (the menu, shared), "Field agent" data item (D11, D12).
- `public/js/manager.js`: loads the agents, the menu in the decision area, `agent_id` with Approve (D11).
- `public/js/archive.js`: manager panel "Field agent" + "Save agent"; agent checkbox "My orders only"; cards per O2 (D12, D14, D15).
- `public/js/agent.js`: the "Assigned to you" tag (D13, O5).
- `public/staff/archive.html`: the checkbox in the filter row (hidden until the role is known).
- `public/css/staff.css`, `public/css/theme.css`: the third field in the decision area (wraps on narrow screens), the checkbox in the filter row, the tag (dark look).
- `spec/PRD.md`, `spec/ARCHITECTURE.md`, `spec/DESIGN.md`: **only** the wording changes of O1, and only after Asaf approves them.
- `spec/ARCHITECTURE.md`: new ADRs (end of build). `spec/MILESTONES.md`: 🟡 and checked DoD items (end of build). `CLAUDE.md`: no change expected.

### Not changed
- `api/submit-order.js`, `api/flights.js`, `api/config.js`, `lib/ai.js`, `lib/prompts.js`, `lib/notify.js`, `n8n/sereno-notifications.json`, `supabase/migrations/001_schema.sql`, `002_functions.sql`, `supabase/seed/seed.sql`, `archive-demo.sql`, `public/js/inbox-filter.js`, the public site. No new key in `.env.example` (`auth.admin` uses the existing `SUPABASE_SECRET_KEY`).

---

## 2. Server

### 2.1 Migration `003_agent_assignment.sql` (outline)
```sql
begin;
alter table public.orders
  add column if not exists assigned_agent_id uuid references auth.users (id) on delete set null;
create index if not exists orders_assigned_agent_idx on public.orders (assigned_agent_id);

drop function if exists public.decide_order(uuid, text[], text, timestamptz, text, timestamptz, timestamptz);
drop function if exists public.decide_order(uuid, text[], text, timestamptz, text, timestamptz, timestamptz, uuid);
create function public.decide_order(... the same 7 parameters ..., p_agent_id uuid default null)
  -- the M5 update, plus:
  --   assigned_agent_id = case when p_to = 'approved' then p_agent_id else assigned_agent_id end
  ...;
revoke / grant as in 002.

drop function if exists public.complete_order(uuid);
drop function if exists public.complete_order(uuid, uuid);
create function public.complete_order(p_order_id uuid, p_agent_id uuid default null)
  -- update orders set status = 'completed',
  --        assigned_agent_id = coalesce(assigned_agent_id, p_agent_id)      (D8, O3)
  --  where id = p_order_id and status = 'approved'
  --    and (assigned_agent_id is null or assigned_agent_id = p_agent_id)  (D7)
  ...;
revoke / grant as in 002.
commit;
notify pgrst, 'reload schema';
```

### 2.2 `GET /api/agents` (new)
1. `requireStaff(req, res, ['manager'])` (agent → `403`).
2. `auth.admin.listUsers({ page: 1, perPage: 1000 })`; `agentsFromUsers(users)` → `[{ id, name }]` (role `agent` only; `name` = `user_metadata.full_name` if set, else the email), sorted by name.
3. Reply `{ ok: true, data: { agents } }`. Errors as the other endpoints (`500` with the generic message, logged without personal data).

### 2.3 `GET /api/orders` (changes only)
- **`view=approved`, agent:** add `.or(agentVisibility(staff.user.id))`. Manager: unchanged.
- **`view=archive`:** `validateArchiveQuery` accepts `mine` (`1` / empty; anything else `400` "Unknown filter."). For the agent, the groups sent to `combineOrGroups` are the search group, the date group **and** `agentVisibility(id)`; with `mine=1` the query adds `.eq('assigned_agent_id', id)` instead of the visibility group. The page rows and `allMatching` (stats) use the same `build`, so cards and table stay in step (ADR-29). Manager: `mine` ignored, nothing else changes.
- **Rows:** manager views carry `assigned_agent_id`; agent views carry `assigned_to_me` (D6). `id=` stays manager only (`403` for the agent, ADR-15).

### 2.4 `POST /api/order-decision` (changes only)
- `validateDecisionBody`: new action `assign_agent`; `agent_id` allowed only with `approve` and `assign_agent` (else `400` "A field agent can only be set when approving or assigning."); a uuid or empty / `null` (→ `null`); required key for `assign_agent` (`null` clears).
- **approve:** if `agent_id` is set, `getUserById` → must be role `agent` (`400` "This field agent was not found."); then `decide_order(..., p_agent_id)`. Email as today.
- **assign_agent:** same agent check (unless `null`); `update orders set assigned_agent_id = … where id = … and status = 'approved'` returning the row; none → `409` "This order is no longer approved."; reply `{ order: managerView }`, no email.
- **complete (agent):** after reading the order: `assigned_agent_id` set and not his id → `404` "Order not found."; not `approved` → `409` (today's text); then `complete_order(p_order_id, p_agent_id = staff.user.id)`; zero rows → `409`. Reply `toAgentView`.
- `roleMayDecide` already gives `assign_agent` to the manager only.

### 2.5 Errors
New messages only: "This field agent was not found." (`400`), "A field agent can only be set when approving or assigning." (`400`), "This order is no longer approved." (`409`), "Unknown filter." (`400`), and `404` "Order not found." for another agent's order on complete. Everything else keeps the M3–M8 answers.

---

## 3. Browser

### 3.1 Approvals screen (D11)
- `order-details.js`: `agentField({ agents, selectedId, loadError })` → `{ node, value() }`: `<label for="agent-select">Field agent</label>` + `<select class="input select" id="agent-select">` with "Not assigned (all agents)" (`value=""`) and the agents; under it the load-error line when needed.
- `manager.js`: `agents` loaded at start and on Refresh (`GET /api/agents`; a failure only sets the load-error flag). `decisionArea` puts `agentField` in `.decision__fields` after "Meeting time" and before "Manager notes"; Approve sends `agent_id` when chosen; Reject ignores it. Status line names the agent (D11).
- `staff.css` / `theme.css`: `.decision__fields` takes three fields (on wide screens Meeting time and Field agent side by side, Manager notes under them; one column on phones).

### 3.2 Archive, manager panel (D12)
- `archive.js`: loads `GET /api/agents` once at start for the manager (names for the data item and the menu). Panel for `approved`: `agentField` (current agent selected) + "Save agent" → `assign_agent`; on success the row object gets the new `assigned_agent_id` and the success line is shown in the panel status line (`role="status"`); `409` → message and reload of the table (the panel closes, as on any reload). For `completed`: read-only "Field agent" data item.

### 3.3 Archive, agent (D14, D15)
- `archive.html`: in the filter form, `<div class="archive__mine" hidden><input type="checkbox" id="mine"><label for="mine">My orders only</label></div>`; `archive.js` shows it for the agent only, sends `mine=1` when checked, and treats a change as a filter change (page 1, panel closed).
- Cards: as O2 decides (the server already counts what the table shows).

### 3.4 Agent screen (D13, O5)
- `agent.js`: when `order.assigned_to_me`, a tag "Assigned to you" next to the customer name (Style Guide tag; gold outline as the "Returning" tag). Nothing else changes; Refresh brings in reassigned orders and drops orders given to another agent.

---

## 4. n8n
No change (D17).

---

## 5. Tests (`node --test`)
- `agentVisibility(id)`: exactly `assigned_agent_id.is.null,assigned_agent_id.eq.<id>`; refuses a value that is not a uuid (throws), so nothing else can enter the filter.
- `combineOrGroups` with search + dates + visibility → one `and(or(…),or(…),or(…))`.
- `agentsFromUsers`: keeps only role `agent` (not `manager`, not users without a role); name from `user_metadata.full_name`, else email; sorted; returns only `id` and `name`.
- `toAgentView`: has `assigned_to_me` true for his id and false for another id or none; never `assigned_agent_id`, never an email. `toManagerView`: has `assigned_agent_id`.
- `validateDecisionBody`: `approve` with and without `agent_id`, `agent_id: null`, a bad uuid, `agent_id` with `reject` / `add_note` / `complete` → error, `assign_agent` with a uuid, with `null`, without the key → error.
- `validateArchiveQuery`: `mine=1` → true, empty → false, `mine=yes` → error.
- `roleMayDecide('agent', 'assign_agent')` false, manager true.
- `approvedEmailPayload` of an order with `assigned_agent_id` has no agent field (D17).
- The existing 136 tests stay green.

---

## 6. How the build is verified (before marking 🟡)

### 6.1 Asaf's one-time setup (plain-Hebrew instructions at the matching build step)
1. Run `003_agent_assignment.sql` in the Supabase SQL Editor (one time).
2. Create a **second agent user** in the Supabase dashboard (Authentication → Add user) and give it the role with the one SQL line from ADR-10 (`raw_app_meta_data || '{"role":"agent"}'`); optional display names per O4.
3. On the test day, before 14:30 Israel time: `seed.sql`, then `archive-demo.sql`, then `assign-demo.sql`.
4. Sign in on the local run in the browser pane: tab 1 manager, tab 2 agent A, tab 3 agent B (each tab keeps its own sign-in; I never type passwords).

### 6.2 Checks (local run, port 3000)
- **Migration:** the column and the two functions exist; the M8 behaviour is unchanged before the new code runs (approve without agent, complete of an unassigned order).
- **Agent list:** manager gets the two agents (names or emails); agent → `403` on `/api/agents`; no `/api/agents` request appears in an agent tab (network view).
- **Approve with / without agent:** approve a pending order for agent A → it shows in A's list after Refresh, not in B's; approve another order with "Not assigned" → it shows for both. The customer email (n8n run) is the same as before, with no agent name.
- **Change agent:** in the archive panel, move A's approved order to B → after Refresh it leaves A's list and appears in B's; set it to "Not assigned" → both see it. A completed order shows its agent read-only and no menu.
- **Another agent's order:** agent B's list and archive never show A's orders (also by searching the customer name); `POST complete` for A's order from B's tab (a hand-made request in the browser console of B's tab) → `404`, the order is unchanged; `?id=` → `403`.
- **Complete:** B completes an unassigned order → it leaves both lists and (with O3 (a)) now counts as B's in "My orders only".
- **"My orders only":** A's archive with the box → only orders assigned to A (approved and completed), the count equals a recount; without the box → his and the unassigned ones, never B's. The manager has no box.
- **Cards (O2):** the agent's cards equal what the table shows with the same filters, for both agents.
- **Regression:** Approvals (select, history, notes, reject, missing flight, flight change, status menu), archive for the manager (cards, tags, "View", "Save note"), the agent's "Mark completed" — as before.
- **Look:** Approvals decision area with three fields at 1280px and 375px; archive filter row with the box (agent) at 1280px; agent card with the tag at 375px; dark look everywhere.
- **Unit tests:** all green.

---

## 7. Open points (need Asaf's answer)

| # | Question | Options | Recommendation |
|---|---|---|---|
| O1 | PRD, ARCHITECTURE and DESIGN say "no assignment in the MVP". The exact wording changes I propose are listed under this table. | (a) approve as written (adjusted to the answers of O2–O5); (b) approve with changes Asaf names; (c) leave the documents (then the build contradicts them). | (a). MILESTONES M9 asks for this approval before the build. |
| O2 | **The agent's archive cards (Asaf, 24.11.2026: count only the orders he handled / completed himself).** | (a) the cards follow the table, and **"My orders only" is on by default** for the agent: on opening, the table and the cards show only his own orders; unticking adds the unassigned ones; (b) the cards follow the table, the box is off by default: the cards show his own only when he ticks it; (c) the cards **always** count only his own orders, whatever the box says (the cards and the table may then show different numbers). | (a): he gets exactly what he asked for on opening, and the cards never disagree with the table (the M8 rule). |
| O3 | When an agent marks an **unassigned** order completed, is it recorded as his? | (a) yes: the order becomes assigned to him at that moment (D8); (b) no: it stays unassigned, and "My orders only" shows only orders the manager assigned to him. | (a): otherwise orders he did himself never count as his, and O2 cannot work for them. Note: orders completed **before** M9 have no agent and will not count as anyone's (no guess is made). |
| O4 | How agents are named in the manager's menu. | (a) by email (nothing to set); (b) by a display name Asaf sets once per agent with one SQL line I give him (like the role), and by email when no name is set. | (b): "Dana K." is easier to pick than an address; it stays optional. |
| O5 | A tag "Assigned to you" on the agent's own cards (agent screen, and in his archive panel). | (a) yes; (b) no, the cards look as today. | (a): one small tag, so he knows which orders are his and which are shared. |
| O6 | Another agent's order on "Mark completed" (or any request for it). | (a) `404` "Order not found." (D7); (b) `403` "You do not have permission for this action.". | (a): it does not even tell him the order exists. Both meet the DoD. |
| O7 | ARCHITECTURE §3's permission matrix says the agent may open `?id=` for an approved or completed order, but ADR-15 and the code answer `403` (the agent never needs it). | (a) fix the row to match the code ("no, `403`") together with O1; (b) leave it. | (a): the row is next to the ones O1 changes anyway. Settled by the code being the source of truth; no behaviour change. |

### O1 — proposed wording changes (Hebrew, as the documents are written; shown with the recommended answers)

**`spec/PRD.md`**
- §2, the field-agent row, column "צורך": From `רואה את ההזמנות המאושרות ואת כל פרטי השירות, ומסמן הזמנה כהושלמה אחרי ביצוע השירות` To `רואה את ההזמנות המאושרות ששובצו לו ואת אלה שלא שובצו לאף נציג, עם כל פרטי השירות, ומסמן הזמנה כהושלמה אחרי ביצוע השירות`
- §3 main flow, step 8: From `8. לאחר אישור, פרטי ההזמנה מופיעים במסך נציג השטח.` To `8. לאחר אישור, פרטי ההזמנה מופיעים במסך נציג השטח: אצל הנציג שהמנהל שיבץ, או אצל כל הנציגים כשלא נבחר נציג.`
- FR-27: From `| FR-27 | כל הנציגים רואים את כל ההזמנות המאושרות (ללא שיבוץ ב-MVP) | 27 | Must |` To `| FR-27 | נציג רואה את ההזמנות המאושרות ששובצו לו ואת אלה שלא שובצו לאף נציג. הזמנה ששובצה לנציג אחר לא מוצגת לו (שיבוץ: Milestone 9, פיצר 28) | 27 | Must |`
- FR-35: From `| FR-35 | נציג שטח רואה בארכיון את ההזמנות לפי הרשאה. סינון "הזמנות שליווה בעצמו" יתאפשר רק אחרי שיבוץ נציג להזמנה (ראו סעיף 7) | 34 | Should |` To `| FR-35 | נציג שטח רואה בארכיון את ההזמנות לפי הרשאה: ההזמנות ששובצו לו ואלה שלא שובצו. סינון "My orders only" מציג רק את ההזמנות ששובצו לו, כולל הזמנה לא משובצת שהוא סימן כהושלמה (Milestone 9) | 34 | Should |`
- §7 table: From `| 28 — שיבוץ נציג להזמנה | Could | ב-MVP כל הנציגים רואים את כל ההזמנות המאושרות (FR-27) |` To `| 28 — שיבוץ נציג להזמנה | Could | נבנה ב-Milestone 9 (החלטה של אסף, 23.11.2026): בחירת נציג באישור (לא חובה), והחלפה מחלונית ההזמנה בארכיון |`
- Assumption 1: From `1. **שיבוץ נציג:** כל הנציגים רואים את כל ההזמנות המאושרות (FR-27). שיבוץ מפורש להזמנה הוא שלב מאוחר.` To `1. **שיבוץ נציג (Milestone 9):** השיבוץ לא חובה. הזמנה שלא שובצה מוצגת לכל הנציגים, והזמנה משובצת רק לנציג שלה (FR-27). המנהל יכול להחליף נציג להזמנה מאושרת. הלקוח לא מקבל את שם הנציג.`
- Assumption 2: From `2. **ארכיון לנציג:** הסינון "רק הזמנות שליווה בעצמו" ייושם רק אחרי שיבוץ. עד אז ההרשאה היא לפי תפקיד בלבד.` To `2. **ארכיון לנציג (Milestone 9):** "My orders only" מציג את ההזמנות ששובצו לנציג. הזמנה לא משובצת שנציג סימן כהושלמה נרשמת כשלו. הזמנות שהושלמו לפני Milestone 9 לא משויכות לאף נציג.`

**`spec/ARCHITECTURE.md`**
- §2 `orders` table, add after the `manager_notes` row: `| \`assigned_agent_id\` | uuid, FK ל-\`auth.users\`, \`on delete set null\`, **יכול להיות ריק** | הנציג המשובץ (Milestone 9). ריק = לא שובץ, וכל הנציגים רואים את ההזמנה. נקבע באישור או בהחלפה מהארכיון, ונרשם ב"הושלם" כשהיה ריק |`; and the index line: `…, \`orders(created_at desc)\`, \`orders(assigned_agent_id)\`.`
- §2 status transitions: the `pending` → `approved` row, column "תנאי", add at the end: `. אם נבחר נציג, גם \`assigned_agent_id\``; add a row `| \`approved\` | \`approved\` | מנהל | החלפת נציג בלבד (\`assign_agent\`): מתעדכן \`assigned_agent_id\` |`; the `approved` → `completed` row, column "תנאי": `פעולת \`complete\` (החלטה 8), רק להזמנה לא משובצת או משובצת לאותו נציג. הזמנה לא משובצת נרשמת על שמו`.
- §2 "פונקציות במסד הנתונים", after the paragraph about zero rows, add: `Milestone 9: \`supabase/migrations/003_agent_assignment.sql\` מוסיף ל-\`decide_order\` את \`p_agent_id\` (ברירת מחדל ריקה, נשמר רק באישור), ול-\`complete_order\` את \`p_agent_id\` (משלים רק הזמנה לא משובצת או של אותו נציג, ורושם אותו כשהייתה לא משובצת).`
- §3 permission matrix:
  - `GET /api/orders` row, agent column: From `הזמנות \`approved\` ו-\`completed\` בלבד` To `הזמנות \`approved\` ו-\`completed\` ששובצו לו או שלא שובצו`
  - `GET /api/orders?id=` row, agent column (O7): From `רק הזמנה \`approved\` או \`completed\`` To `לא (\`403\`)`
  - `POST /api/order-decision` row, agent column: From `רק \`action = complete\` (כל פעולה אחרת \`403\`)` To `רק \`action = complete\` (כל פעולה אחרת \`403\`), ורק להזמנה שלו או לא משובצת (אחרת \`404\`)`
  - new row: `| \`GET /api/agents\` | לא | לא (\`403\`) | כן: רשימת הנציגים (מזהה ושם) |`
- §3, the note under the matrix: From `הערה: הסינון "רק הזמנות שליווה בעצמו" בארכיון הנציג (FR-35) דורש שיבוץ נציג, ואין שיבוץ ב-MVP. עד אז ההרשאה היא לפי תפקיד, כפי שמופיע במטריצה.` To `הערה (Milestone 9): נציג מזוהה לפי מזהה המשתמש שלו ב-Supabase Auth, מתוך הטוקן. רשימת הנציגים נקראת בשרת בלבד (\`auth.admin\`), ונשלחת רק למנהל. לנציג לא נשלחים מזהה או מייל של נציג אחר: בהזמנות שלו מופיע רק \`assigned_to_me\`. בארכיון הנציג יש סינון "My orders only" (\`mine=1\`).`
- §5.1 `GET /api/orders` table: the `view` row: `approved` (`נציג: \`approved\` בלבד, ששובצו לו או שלא שובצו, ממוין לפי \`final_time\``); add a row `| \`mine\` | ארכיון, נציג בלבד: \`1\` = רק הזמנות ששובצו לו |`. Under the reply: `למנהל נוסף \`assigned_agent_id\` (או \`null\`). לנציג נוסף \`assigned_to_me\` (true/false), בלי מזהה של נציג.`
- §5.1 `POST /api/order-decision` table: `approve` row, column "שדות נוספים": add `, \`agent_id\` (אופציונלי, נציג קיים)`; new row `| \`assign_agent\` | \`agent_id\` (או \`null\` לביטול) | סטטוס \`approved\` | עדכון \`assigned_agent_id\` | אין |`; `complete` row, column "תנאי": `סטטוס \`approved\`, ולא משובצת לנציג אחר (אחרת \`404\`)`, column "פעולה": `\`rpc complete_order\` עם מזהה הנציג`.
- §5.1, new subsection after `POST /api/order-decision`: `#### \`GET /api/agents\`` — `מנהל בלבד. מחזיר את משתמשי Supabase Auth עם התפקיד \`agent\`: \`{ "ok": true, "data": { "agents": [ { "id": "uuid", "name": "Dana K." } ] } }\`. השם הוא \`user_metadata.full_name\` אם נקבע, אחרת המייל. ממוין לפי שם.`
- §7 folder tree: add `api/agents.js` and `supabase/migrations/003_agent_assignment.sql`, `supabase/seed/assign-demo.sql`.
- ADR-15 stays as written (history); the new ADR at the end of the build says it is superseded on this point.

**`spec/DESIGN.md`**
- Screen 3, "מה יש במסך", the details bullet: after `שדה "Manager notes" ("Add a note for the field agent").` add `שדה "Field agent" (Milestone 9): רשימת הנציגים, וברירת המחדל "Not assigned (all agents)". הבחירה לא חובה.`
- Screen 3, "מה קורה במסך": From `"Approve" מאשר: ההזמנה עוברת למסך נציג השטח והלקוח מקבל מייל עם שעת המפגש.` To `"Approve" מאשר: ההזמנה עוברת למסך הנציג שנבחר, או לכל הנציגים כשלא נבחר נציג, והלקוח מקבל מייל עם שעת המפגש (בלי שם הנציג).`
- Screen 4, "מה יש במסך", after the card contents bullet, add: `- בכרטיס של הזמנה ששובצה לנציג עצמו, תגית "Assigned to you" ליד שם הלקוח.`
- Screen 4, "מה קורה במסך": From `- מופיעות רק הזמנות שהמנהל אישר. בגרסה הראשונה כל הנציגים רואים את כל ההזמנות המאושרות.` To `- מופיעות רק הזמנות שהמנהל אישר: אלה ששובצו לנציג, ואלה שלא שובצו לאף נציג. הזמנה של נציג אחר לא מופיעה.`
- Screen 5, "מטרה": From `ב-PRD ההרשאה של הנציג נקבעת לפי תפקיד.` To `הנציג רואה את ההזמנות ששובצו לו ואת אלה שלא שובצו.`
- Screen 5, the cards bullet (from M8), the agent sentence: From `אצל נציג השטח מוצגים שלושה כרטיסים: Total orders, Approved (הזמנות שעוד לא בוצעו) ו-Completed.` To `אצל נציג השטח מוצגים שלושה כרטיסים: Total orders, Approved (הזמנות שעוד לא בוצעו) ו-Completed, והם סופרים את מה שמוצג בטבלה. כשהמסנן "My orders only" מסומן (ברירת המחדל לנציג), הם סופרים רק את ההזמנות שלו.`
- Screen 5, the filter-row bullet: add at the end `. לנציג בלבד: תיבת סימון "My orders only" (מסומנת כברירת מחדל).`
- "מה לא מוצג בתמונות", add a bullet: `- **שיבוץ נציג (Milestone 9, החלטה של אסף, 23.11.2026):** במסך האישורים, שדה "Field agent" ליד "Meeting time" ו-"Manager notes", באותו סגנון שדה. בחלונית ההזמנה בארכיון, להזמנה מאושרת: אותו שדה עם "Save agent", ולהזמנה שהושלמה: "Field agent" לקריאה בלבד. אצל הנציג: תגית "Assigned to you", ובארכיון תיבת הסימון "My orders only".`

**Not changed:** MILESTONES (already describes M9), PRD FR-26 and FR-41 (still true), the emails part of DESIGN, the images.

No part of the spec M9 needs is a placeholder. Settled by the rules in `CLAUDE.md` (no question needed): PRD / ARCHITECTURE / DESIGN "no assignment in the MVP" vs MILESTONES M9 — MILESTONES records Asaf's later decision and asks for this update in planning (O1); ARCHITECTURE §3 `?id=` row vs ADR-15 and the code — the code is the source of truth (O7 only aligns the wording).

---

## 8. Definition of Done mapping

| DoD item (MILESTONES M9) | How it is met | Checked in |
|---|---|---|
| The manager can approve with or without an agent, and change the agent of an approved order | D3, D4, D5, D11, D12 | §6.2 Approve with / without agent, Change agent + unit tests |
| An agent sees his orders and the unassigned ones, not another agent's; checked with two agent users | D2, D6, D13, D18 | §6.2 Approve (two agent tabs), Another agent's order |
| An agent cannot open or mark completed another agent's order (`403` or `404` on the server) | D2 (not in his rows), D7, O6, `?id=` `403` | §6.2 Another agent's order |
| "My orders only" in the agent's archive returns only orders that were assigned to him | D14, D8, O3 | §6.2 "My orders only" + unit tests |
| The migration ran on the Development database, and the M1–M8 tests still pass | D9, D10 | §6.2 Migration, Regression, unit tests |

### 8.1 DoD result (24.11.2026)

Local run, the Development database. Asaf created the second agent user and signed in in the browser pane: manager, agent 1 (A) and agent 2 (B) in three tabs. `assign-demo.sql` was not run; the assignments were made through the app itself (manager: 00000002 → A, 00000012 → B). Unit tests: 146 pass (136 before + 10 in `tests/assignment.test.js`).

| DoD item | Result |
|---|---|
| The manager can approve with or without an agent, and change the agent of an approved order | Pass. Approvals screen: "M8 Check" (1BC1C490) approved for A ("Order 1BC1C490 approved for … Email sent to the customer."), "M8 Live" (CAE8D510) approved with "Not assigned" (n8n accepted both emails, no agent in the payload, unit test). Archive panel: 00000003 → B with "Save agent" ("Agent saved…"), then back to "Not assigned" ("…is now open to all agents."); a completed order shows "Field agent" read-only and no menu. `assign_agent` on a rejected order → `409`, an unknown agent id → `400`, `agent_id` with `reject` → `400`. |
| An agent sees his orders and the unassigned ones, not another agent's; two agent users | Pass. A's screen: Ronen D. and M8 Check with "Assigned to you", Hadas M., M8 Live, Noa B.; B's: Maya Z. with the tag, the same unassigned ones; neither sees the other's orders (also by archive search). After 00000003 moved to B it left A's list and appeared in B's. No `@` and no `assigned_agent_id` in any agent reply; `/api/agents` → `403` for the agent. |
| An agent cannot open or mark completed another agent's order | Pass. B "complete" on A's 00000002 → `404` "Order not found.", the order stays approved; `?id=` → `403`; the archive never lists it for B (no panel to open). |
| "My orders only" returns only orders assigned to him | Pass. B completed the unassigned 00000013 → it became B's (O3), and B's "My orders only" shows 00000013 (completed) and 00000012 (approved), cards 2 / 1 / 1; A completing 00000013 afterwards → `404`. A's archive opens with the box checked: 2 orders, cards 2 / 2 / 0; unticked: 53 / 5 / 48 (his + unassigned, equal to the rows found), B's 00000012 absent. |
| The migration ran on Development, and the M1–M8 tests still pass | Pass. Asaf ran `003_agent_assignment.sql` ("Success"); the new column is read and written through the app; the old 136 tests pass (6 needed only the new fields added to their expected values). |

Look: Approvals at 1280px (the "Field agent" menu under "Meeting time") and 375px (one column, no sideways scroll); the agent card tag at 375px; the archive filter row with "My orders only" at 1280px; dark look everywhere. Console: only the error answers caused on purpose by the checks.

**Test data changed by the checks** (back to normal at the next `seed.sql` run): 00000002 assigned to A, 00000012 to B, 00000013 completed by B, the test orders "M8 Check" (approved, A) and "M8 Live" (approved, unassigned).

---

## 9. Build steps (one at a time, each with Asaf's go-ahead)

0. **Documents (after O1):** the approved wording changes in PRD, ARCHITECTURE and DESIGN, nothing else.
1. **Migration:** write `003_agent_assignment.sql`; Asaf runs it in the SQL Editor; check the column and functions, and that the current screens (approve, complete) still work unchanged.
2. **Server:** `/api/agents`, the visibility rule, `mine`, approve with `agent_id`, `assign_agent`, the complete rule; `assign-demo.sql`; unit tests. Asaf creates the second agent user (and names, O4) and runs the three seed files; check with requests from the manager tab and both agent tabs.
3. **Approvals screen:** the "Field agent" menu; approve with and without an agent; look at 1280px and 375px.
4. **Archive, manager panel:** "Field agent" + "Save agent", the read-only line for completed orders.
5. **Agent side:** the "Assigned to you" tag (O5), the "My orders only" box and its default (O2), the cards.
6. **End-to-end and DoD pass:** §6.2 with the manager and both agents (seed files re-run first, before 14:30 Israel time); results written under §8 as "DoD result".
7. **Close:** ADRs (assignment column and the two functions; who sees an order and the agent list on the server; "My orders only" and the agent's cards; completing records the agent), 🟡 and checked items in MILESTONES, shut down the local run. No commit.
