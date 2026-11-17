# Milestone 1 — Walking Skeleton (plan)

**Source:** `MILESTONES.md` → Milestone 1. Features 4, 15, 36 · FR-15, FR-16.
**Goal:** every part of the system is connected and runs end to end (browser → Vercel function → Supabase; function → n8n → Gmail; function → Gemini), with no product feature yet.
**Out of scope:** the order form, design tokens/CSS, staff screens, auth, real AI layer (`lib/ai.js`), email templates. Those belong to M2–M4.

---

## 0. Starting point (checked while planning)

- Repo exists, branch `main`, remote `origin` = `github.com/asafpedael/sereno-project-for-code`. Only `spec/`, `CLAUDE.md`, `.gitignore`, `.claude/settings.json` exist. No code yet.
- `.gitignore` already covers `.env`, `.env.*`, `!.env.example`, `node_modules/`, `.vercel/`, `tmp/`. Nothing to add for M1 (re-check at the end of the build).
- `.claude/settings.json` already denies `Read(./.env)` and `Read(./.env.*)`. Not touched.
- `.env.example` does not exist yet.
- **Node.js is not installed** on this machine (`node`/`npm` not found). Python is not installed either (not needed). Node is required for the Vercel CLI, the local run and the temporary scripts.

---

## 1. What Asaf does himself (accounts, keys, dashboards)

The AI guides each step in plain language, at the moment it is needed. The AI never sees a secret value.

| # | Step | When |
|---|---|---|
| A1 | Install Node.js LTS (from nodejs.org, or let the AI run `winget install OpenJS.NodeJS.LTS` after approval). Then the AI installs the Vercel CLI (`npm i -g vercel`) and Asaf runs `vercel login`. | First |
| A2 | Make sure the GitHub repo is **public**. | Before deploy |
| A3 | Create the Supabase project (free tier, region close to Israel). Turn off "Allow new users to sign up" (needed only from M3, but free to do now). Create a **second secret key** for local development. | Before DB step |
| A4 | Run `001_schema.sql` and then `seed.sql` in the Supabase SQL Editor (the AI tells exactly what to paste and what result to expect). | DB step |
| A5 | Create two Gemini API keys in Google AI Studio (one for local dev, one for Vercel). | Before Gemini check |
| A6 | Open n8n Cloud (Starter plan). Turn on 2-step verification in the Gmail account and create an App Password. In n8n: import `n8n/sereno-notifications.json`, create the SMTP credential (Gmail app password), create **two** Header Auth credentials (header name `X-Webhook-Secret`, one secret for `sereno`, one for `sereno-dev`), put the real test inbox addresses in the Allowlist Code node and in the manager address field, publish the workflow. | Before n8n check |
| A7 | Create the Vercel project from the GitHub repo (no framework). Set the environment variables (table in §6). Run `vercel link` locally. | Before deploy |
| A8 | Paste the local dev secrets into `.env.local` (the AI creates the file with empty names). | Before local run |
| A9 | Approve the push that triggers the first Vercel deployment (CLAUDE.md: a push needs approval). | Deploy step |

---

## 2. Files to create

```
api/
  config.js            GET /api/config
  flights.js           GET /api/flights (minimal, no search)
lib/
  supabase.js          single Supabase client (secret key, server only)
  http.js              JSON envelope, method check, error handling
  notify.js            POST to n8n webhook (initial version)
data/
  lists.json           statuses, services, escort scopes (code + label)
public/
  index.html           TEMPORARY page: calls /api/config and /api/flights
  js/meeting-time.js   meeting-time formula (pure function; used by the seed script now, by the form and server from M2)
supabase/
  migrations/001_schema.sql
  seed/seed.sql
n8n/
  sereno-notifications.json   workflow export, no credentials, no real addresses
vercel.json            { "outputDirectory": "public" } (+ whatever §7 verification says is needed for a no-framework project)
package.json           "type": "module", dependency @supabase/supabase-js, engines.node per Vercel's current default
package-lock.json
.env.example           GEMINI_API_KEY / SUPABASE_SECRET_KEY / N8N_WEBHOOK_SECRET — names only, no values, no comments
.env.local             copied once from .env.example; Asaf fills values (not committed, never read by the AI)
```

Temporary files (in `tmp/`, which is git-ignored; deleted at the end of the build):
`tmp/gen-seed-times.mjs`, `tmp/check-n8n.mjs`, `tmp/check-gemini.mjs`.

Also updated at the end: `CLAUDE.md` → "Run commands"; `spec/MILESTONES.md` → 🟡 on Milestone 1; `spec/ARCHITECTURE.md` → ADRs (see §9).

Not created in M1 (later milestones): `tests/`, `css/`, `order.html`, `staff/*`, `submit-order.js`, `orders.js`, `order-decision.js`, `auth.js`, `validate.js`, `ai.js`, `prompts.js`, `orders-view.js`, `time.js`, `002_functions.sql`.

---

## 3. Build steps, in order

### Step 1 — Project scaffold
- `package.json` (`"type": "module"`, only `@supabase/supabase-js`), `npm install`, `vercel.json`.
- `.env.example` with exactly three lines: `GEMINI_API_KEY=`, `SUPABASE_SECRET_KEY=`, `N8N_WEBHOOK_SECRET=`. Copy once to `.env.local`. Tell Asaf to paste the dev values.
- Folder layout per ARCHITECTURE §7, only the files listed above.

### Step 2 — Database (`supabase/migrations/001_schema.sql`)
- Copy the SQL from ARCHITECTURE §2 as is: three tables (`customers`, `flights`, `orders`) with all columns, checks and indexes; RLS enabled with no policies; `revoke all ... from anon, authenticated`; explicit grants to `service_role` (select/insert/update on `customers` and `orders`, select on `flights`).
- Asaf runs it in the SQL Editor (A4).

### Step 3 — Meeting-time formula (`public/js/meeting-time.js`)
- One pure exported function: `(departureAt: Date, travelers, bags) → Date`.
  `minutes = 90 + 5 × (travelers − 1) + 3 × bags`; subtract; round **down** to a multiple of 5 minutes. No dependencies, returns a Date.
- Created now because ARCHITECTURE §2 says the seed script must use it (single source of truth). Its tests and its use in the form/server come in M2.

### Step 4 — Demo data (`supabase/seed/seed.sql`)
Source: `spec/sereno-demo-data.xlsx` (sheets `customers`, `flights`, `orders`; `test_cases` is notes only and is not loaded).

**Relative dates (decision 18).** Excel's 10 Dec 2026 = "today" at the moment the seed runs. The seed does not contain fixed dates. It defines a session-only helper
`pg_temp.il(day_offset int, t time) → timestamptz` = `((today in Asia/Jerusalem) + day_offset) + t`, interpreted in `Asia/Jerusalem`,
and every timestamp is written as `pg_temp.il(<offset>, '<HH:MM>')` using the Excel time of day. So the seed can be re-run on any day and everything moves together (DST handled by the time zone, not by a fixed `+02:00`).

Offsets used: flights at day 0, +1, +2, and −9 / −7 (1 and 3 Dec, the two past flights of `completed` orders). Customers and orders `created_at`, `decided_at`: days −20 … −1. Nothing lands in the future.

**Rules applied:**
- Same UUIDs as the Excel (so order 1 keeps reference `A1B2C3D4`).
- `contact_name` and `contact_phone` copied from the order's customer.
- `services` only `porter` / `wheelchair` (as in the Excel).
- Emails `@example.com` (as in the Excel).
- Order 6 (Yossi C., DM999): `flight_id` null, `flight_no_submitted = 'DM999'`, status `needs_clarification`, no `recommended_time`.
- `final_time` = `recommended_time`, `approved_departure_at` = flight departure for approved/completed orders — **except** order 4 (Noa B., DM404): `approved_departure_at` = day +1 20:50, `final_time` = day +1 19:05, flight now day +1 21:20 (so "Flight time changed" will show in M5). Final time is on the flight's day.
- `recommended_time`: computed by `tmp/gen-seed-times.mjs`, which imports `public/js/meeting-time.js`, runs every order through it, and prints the times. The script asserts they equal the Excel formula results; those values go into the seed. Expected:

| Order | Flight (day, time) | Trav · Bags | recommended_time |
|---|---|---|---|
| 1, 2, 14 | DM101 (0, 14:30) | 2 · 3 | 0, 12:45 |
| 3 | DM202 (0, 18:45) | 5 · 8 | 0, 16:30 |
| 4 | DM404 (+1, 21:20) | 2 · 3 | +1, 19:35 |
| 5 | DM202 (−7, 18:45) | 2 · 1 | −7, 17:05 |
| 7 | DM404 (+2, 21:20) | 1 · 1 | +2, 19:45 |
| 8 | DM202 (0, 18:45) | 5 · 4 | 0, 16:40 |
| 9 | DM505 (+1, 11:00) | 3 · 2 | +1, 09:10 |
| 10 | DM101 (−9, 14:30) | 2 · 2 | −9, 12:45 |
| 11 | DM606 (+2, 01:10) | 1 · 0 | **+1**, 23:40 (crosses midnight) |
| 12 | DM102 (0, 16:10) | 10 · 10 | 0, 13:25 |
| 13 | DM107 (0, 19:45) | 1 · 0 | 0, 18:15 |
| 15 | DM101 (−9, 14:30) | 1 · 2 | −9, 12:50 |

- The seed starts by clearing the three tables (orders → customers → flights), so it can be re-run when the dates drift. The AI asks before each re-run once real test orders exist.
- The temporary script is deleted at the end (not committed).

### Step 5 — Shared server code
- `lib/supabase.js`: one client built from `SUPABASE_URL` + `SUPABASE_SECRET_KEY`, no session persistence.
- `lib/http.js`: helpers for `{ ok: true, data }` / `{ ok: false, error: { code, message } }`, a method check (`405`), and a wrapper that catches errors, logs details with `console.error`, and returns `500 server_error` with a plain message (never a provider message).
- `data/lists.json`: `statuses` (pending "Pending approval", approved "Approved", rejected "Rejected", needs_clarification "Needs clarification", completed "Completed"), `services` (porter "Porter / luggage help", wheelchair "Wheelchair"), `escort_scopes` (full "Full (to the gate)", partial "Partial (to security)"). Labels from ARCHITECTURE §5.1 and the mockups.

### Step 6 — API
- `api/config.js` (GET only): returns `supabase_url`, `supabase_publishable_key`, `lists`. Reads `lists.json` with the method chosen in §7 (point 5).
- `api/flights.js` (GET only, minimal): selects `id, flight_no, airline, destination, departure_at` from `flights`, ordered by `departure_at`. No search, no future-only filter yet (both are M2).

### Step 7 — Temporary page (`public/index.html`)
- Plain HTML + a small inline script, no styling work (design starts in M2).
- Calls `/api/config` → shows "Config loaded" and the number of statuses/services (does not print the key).
- Calls `/api/flights` → table: flight number, airline, destination, departure date and time in Israel time (`Intl.DateTimeFormat`, `timeZone: 'Asia/Jerusalem'`).
- All data rendered with `textContent`. Clear error text if a call fails.
- Replaced by the real landing page in M6.

### Step 8 — n8n (initial version)
- `lib/notify.js`: `notify(payload)` → `POST N8N_WEBHOOK_URL`, header `X-Webhook-Secret: N8N_WEBHOOK_SECRET`, 8-second timeout. Returns `true` / `false`, logs failures without the secret or provider details. Never throws.
- `n8n/sereno-notifications.json` (structure from ARCHITECTURE §5.3):
  two Webhook nodes `sereno` and `sereno-dev` (POST, Header Auth, respond immediately) → Switch on `type` (5 outputs) → Set per type (simple placeholder subject/body for now; real templates in M3–M5) → Code: Allowlist → IF → Send Email (Gmail SMTP) / "Blocked – not in allowlist" node that records the blocked address in the execution log.
  The exported file contains **placeholder** addresses (`test-inbox@example.com`) and no credentials, because the repo is public. Asaf puts the real test addresses in n8n (A6).
- Check with `tmp/check-n8n.mjs` (uses `lib/notify.js`, dev webhook `sereno-dev`):
  1. Call without the header → rejected (401/403).
  2. Valid call, `type: customer_approved`, `to` = an allowlisted test inbox → exactly one email arrives.
  3. Valid call, `to` = an address not in the allowlist → no email; the n8n execution shows the "Blocked" branch.

### Step 9 — Gemini connection check (one-off)
- `tmp/check-gemini.mjs`, run locally with Node (server side, key from `.env.local`, never in a browser):
  REST `fetch` to `generateContent` for `GEMINI_MODEL` (default `gemini-3.8-flash`), key sent in a header if the docs allow it (§7 point 3), demo order data (Daniel A., DM101, no email/phone), `responseMimeType: application/json` + the `order_draft` `responseSchema` from ARCHITECTURE §4.
- Pass = the response parses as JSON, has `recommended_services` (subset of porter/wheelchair) and `customer_paragraph`. Print the result, not the key.
- Deleted afterwards. The real AI layer (`lib/ai.js`, `lib/prompts.js`) is M4.

### Step 10 — Local run, then deploy
- Local: `vercel dev` (Config values from the Vercel Development environment, secrets from `.env.local`). Open `http://localhost:3000`, see flights.
- Deploy: ask Asaf to approve the push (A9). After approval: commit + push → Vercel builds from GitHub. If env vars were added after the first deploy → Redeploy.
- Check the public URL shows the flights.

### Step 11 — Security checks
- Direct call to Supabase REST `…/rest/v1/flights` (and `customers`, `orders`) with the **publishable** key → error / no rows.
- Search the repo (all tracked files + git history), the files served from `public/`, and the `/api/config` + `/api/flights` responses for: `sb_secret_`, `AIza`, JWT-looking strings (`eyJ`), `service_role`, the word `secret` near a value, the webhook URL. Expected: only the publishable key in `/api/config` (allowed).
- `.env.example` has names only.

### Step 12 — Wrap up
- Delete `tmp/` scripts. Stop the local run.
- Fill "Run commands" in `CLAUDE.md`: Run (dev) `vercel dev`; Test: `none` (until M2 adds `node --test`).
- Add ADRs (§9). Mark 🟡 on Milestone 1 in `MILESTONES.md`. Report each DoD item. No extra commit beyond the approved deploy push.

---

## 4. API shapes (M1 only)

```json
GET /api/config
{ "ok": true, "data": { "supabase_url": "...", "supabase_publishable_key": "...",
  "lists": { "statuses": [...], "services": [...], "escort_scopes": [...] } } }

GET /api/flights
{ "ok": true, "data": { "flights": [ { "id": "uuid", "flight_no": "DM101", "airline": "Demo Airlines",
  "destination": "London", "departure_at": "2026-...Z" } ] } }
```
Wrong method → `405 method_not_allowed`. Any failure → `500 server_error` with a plain English message.

---

## 5. Definition of Done → how each item is checked

| DoD item | How it is checked |
|---|---|
| Public Vercel URL loads and shows flights from Supabase via `/api/flights` | Open the URL in the browser pane; compare rows with the `flights` table |
| Direct call with the publishable key fails / returns nothing | `curl` to Supabase REST for all three tables with the publishable key |
| Demo data: 8 / 10 / 15; DM999 has no `flight_id`; services only porter/wheelchair; future flights except the two `completed` flights; nothing created in the future; Noa B. final time on the flight day | SQL count/filter queries in the SQL Editor (the AI gives them), plus `/api/flights` output |
| `recommended_time` follows the formula (2 trav, 3 bags, 14:30 → 12:45) | The temp script's asserts + query of the seeded values vs the table in §3 Step 4 |
| All Vercel env vars set (Secret + Config) and Redeploy done | Asaf shows the env-var list (names only) / the AI checks with `vercel env ls` |
| No key or secret in repo, browser code, or API responses; `.env.example` names only | Step 11 search |
| n8n webhook without the header is rejected | `tmp/check-n8n.mjs` case 1 |
| Valid call sends one email to the test inbox; non-allowlisted address gets none and is logged | `tmp/check-n8n.mjs` cases 2–3 + Asaf's inbox + n8n executions |
| Gemini call from the server returns valid JSON per schema; key not exposed | `tmp/check-gemini.mjs` + Step 11 search |
| ARCHITECTURE §9 points for M1 verified and reported | §7 below, reported in the build summary |

---

## 6. Environment variables

| Name | Type | Production (Vercel) | Development |
|---|---|---|---|
| `SUPABASE_URL` | Config | project URL | same, in Vercel Development env |
| `SUPABASE_PUBLISHABLE_KEY` | Config | publishable key | same, in Vercel Development env |
| `GEMINI_MODEL` | Config | `gemini-3.8-flash` | same |
| `N8N_WEBHOOK_URL` | Config | `…/webhook/sereno` | `…/webhook/sereno-dev` |
| `SUPABASE_SECRET_KEY` | Secret | prod secret key | second secret key → `.env.local` |
| `GEMINI_API_KEY` | Secret | prod key | dev key → `.env.local` |
| `N8N_WEBHOOK_SECRET` | Secret | secret of `sereno` | secret of `sereno-dev` → `.env.local` |

Secrets in Vercel are marked Sensitive. Config values never go into `.env.example` / `.env.local`. For the temporary Node scripts, Config values are pulled with `vercel env pull` into a file inside `tmp/` (not `.env.local`, so Asaf's file is never overwritten) and passed with `--env-file`.

---

## 7. ARCHITECTURE §9 — points to verify against current docs during the build

1. **Vercel:** `outputDirectory: "public"` for a project with no framework (and whether `buildCommand`/framework preset must be set); whether importing a file from `public/` inside a function is bundled. If not → move `meeting-time.js` to `lib/` and serve a copy via `data/` (as ARCHITECTURE already allows). Also confirm how `vercel dev` loads Development env vars.
2. **Supabase Auth:** not needed in M1 (M3).
3. **Gemini:** key in the `x-goog-api-key` header (not the URL); `generateContent` still the recommended endpoint vs the Interactions API; current model name `gemini-3.8-flash`.
4. **n8n:** exact Header Auth configuration (header name field), Send Email node with Gmail SMTP in the current n8n Cloud version, Production webhook URL only after publishing.
5. **Node:** `import lists from '../data/lists.json' with { type: 'json' }` vs reading with `fs` on Vercel's current Node version; pick the one that bundles reliably.

Results are reported in the build summary; meaningful choices become ADRs.

---

## 8. Open question for Asaf (needs an answer before the seed is run)

**Today's flights may already be in the past.** Decision 18 says Excel's "10 Dec" = the day the seed runs, and four flights are "today" (14:30, 16:10, 18:45, 19:45). If the seed runs after 14:30 Israel time, some of today's flights are already past, which breaks the DoD line "flight dates are future". Moving everything one day later would instead put some orders' `created_at` in the future (also a DoD failure).
- **Recommended:** keep the spec as is, and run the seed in the morning (before 14:30 Israel time) — also on a demo day, to refresh the dates.
- Alternative: Asaf decides on another rule (would change ARCHITECTURE decision 18 → needs his approval).

---

## 9. ADRs expected from this milestone (added to ARCHITECTURE.md)

- Seed dates via a session-only `pg_temp.il(day, time)` helper in `Asia/Jerusalem` instead of fixed dates.
- How `data/lists.json` is loaded in functions (import attribute vs `fs`), per §7 point 5.
- Gemini endpoint and key transport, per §7 point 3.
- `meeting-time.js` location (stays in `public/js/` or moves to `lib/`), per §7 point 1.
- Repo n8n export keeps placeholder addresses; real test addresses live only in n8n.
