# Milestone 12 — Design: fonts (plan)

**Source:** `spec/MILESTONES.md` (Milestone 12, the overview table, "How the document is built" — M10–M14 were added on 26.11.2026 as improvements before real people use the site; their wording, content and design choices are set in each one's planning with Asaf), DESIGN Part 2 "גופנים" (fonts, weights, sizes) and the places that name a font ("שדות": label in Assistant 600; "בחירה והזנה": stepper number in Frank Ruhl), DESIGN "עיצוב 'אתרי'" (the dark look, ADR-25), DESIGN "מיילים", the three images (the Style Guide's "02 Typography" shows Frank Ruhl Libre and Assistant; the wireframes and mockups use the same pair), ARCHITECTURE ADR-8 (self-hosted fonts, latin subset, `public/assets/fonts/`, `@font-face` in `tokens.css`, about 66 KB), ADR-16 (one email template in n8n, Georgia / Arial), ADR-25 (dark look), ADR-5 (n8n export holds placeholders). The code is the source of truth for what M1–M11 built: `public/css/tokens.css` (the two `@font-face` rules and `--font-heading` / `--font-body`), `base.css`, `theme.css`, `landing.css`, `staff.css`, the six HTML pages (`index.html`, `order.html`, `staff/login.html`, `staff/manager.html`, `staff/agent.html`, `staff/archive.html` — each preloads both font files), `public/assets/fonts/` (`frank-ruhl-libre-latin.woff2` 44,332 bytes, `assistant-latin.woff2` 22,096 bytes, `README.md`), `n8n/sereno-notifications.json` ("Render email": `SERIF = Georgia…`, `SANS = Arial…`), `tests/` (165 tests, all green on 26.11.2026).

**Status:** written 26.11.2026. **Approved by Asaf (26.11.2026, "Approve the plan")**, with the recommendations of O1 (the DESIGN / ARCHITECTURE wording, applied at build step 0), O2 (email web fonts, D12–D13) and O3 (local fit fixes, reported), and the deletion of the two old font files (D9). **Build (27.11.2026):** step 0 applied the O1 wording to DESIGN and ARCHITECTURE. Fonts downloaded (Gilda Display 20,204 bytes, Montserrat 37,956 bytes; 58,160 in all, below the 66,428 before), old files deleted, tokens / weights / preloads switched, `tests/fonts.test.js` added (170 unit tests pass). Fit pass found three things, fixed: the step numbers on the landing page inherited a bold weight (set to 400, and `font-synthesis-weight: none` on `body`); the staff header did not fit on a 375px phone (tabs tightened and the role label hidden on phones — Asaf chose this, 27.11.2026); the manager's order details were 4px too wide on a phone (grid `minmax(0, 1fr)`). One older bug found and fixed on the way: a hidden "Actions" label made the archive scroll sideways on phones. `vercel.json` header and the n8n export done; Asaf's n8n steps come after the push. ADR-43 added. Every DoD item passes (§8.1); MILESTONES M12 marked 🟡. **Asaf checked the local run and approved with the push (27.11.2026, ✅).** During the check he also chose, for a new milestone (not M12), a richer booking form with estimated prices and "Order number" instead of "Reference". Already answered by Asaf in planning (26.11.2026): what he does not like — **"the text is too plain"**, and the result must **look like a website, not a styled Word file**; he asked for more options **based on a survey of similar websites**; after seeing the comparison page (https://claude.ai/artifact/U8pvff91VEb5o9FSroN882 — nine options on the real landing hero at desktop and phone, form step 1, the agent card and the approval email) he chose **option ז, "in the style of Belmond": Gilda Display for headings, Montserrat for text**. He also asked whether the phone look is the same on desktop — yes: one font everywhere, only the sizes grow on desktop, as today.

**Survey behind the options (26.11.2026, fonts read from each site's home page):** Four Seasons — Saol Display headings, Garamond / Helvetica text; Aman — Lyon headings, Whitney text; Belmond — Sebenta headings, Gotham text; VistaJet — Albra headings, Museo Sans text; NetJets — GT Zirkon everywhere; Blacklane — PP Fragment headings, Geist text; Marhaba (VIP airport escort, Dubai) — one rounded sans everywhere. Common pattern: a large, thin serif heading and a clean modern sans text. Those fonts are paid; Gilda Display + Montserrat is the free (SIL Open Font License) pair closest to Belmond's.

**Goal:**
1. Every screen (landing, order form, request received, staff sign-in, manager, agent, archive) uses **Gilda Display** where Frank Ruhl Libre is used today (headings, the name Sereno, step numbers, meeting time, stepper numbers, archive statistics) and **Montserrat** everywhere Assistant is used today (text, buttons, fields, tables, tags). Nothing else changes: colours, sizes, spacing, layout, texts and behaviour stay as they are.
2. The fonts are files on the site itself (ADR-8): no request to Google or any other site. The total font download stays about the same as today (66 KB), and the pages load as fast as before.
3. The emails use the new fonts where the email app allows it, and keep Georgia / Arial where it does not (Gmail).
4. No server, database, API or key change.

---

## 0. Decisions this plan proposes

| # | Topic | Proposal | Why |
|---|---|---|---|
| D1 | The pair | Headings: **Gilda Display** (one weight, 400). Text: **Montserrat** (variable, weights 400–700 used). Both SIL Open Font License 1.1, both include Latin (the interface is English). Neither includes Hebrew letters; the site shows none (ADR-8 already serves only the latin subset). | Asaf, 26.11.2026 (option ז on the comparison page). |
| D2 | Where each font goes | Exactly where the old ones went: the code already uses two tokens, `--font-heading` and `--font-body` (`tokens.css`), and every CSS rule refers to them. So the switch is the two `@font-face` rules and the two tokens. Fallbacks: headings `'Gilda Display', Didot, Georgia, 'Times New Roman', serif`; text `'Montserrat', 'Segoe UI', Arial, sans-serif` (same as the comparison page). | One place to change; no screen is missed. |
| D3 | Heading weight | Gilda Display has only weight 400. Headings, step numbers, the meeting time and the stepper numbers are set to **400** (today 500: `.h1/.h2/.h3`, the hero heading, `theme.css`, `landing.css`, `staff.css`, `base.css` rules that say `font-weight: 500` with `--font-heading`). | With only one weight, 500 shows as 400 anyway; writing 400 makes the code say what is shown. |
| D4 | The name "Sereno" | Gilda Display **400** (today Frank Ruhl 700). Same size (26 desktop / 22 phone). | A single-weight font would be thickened artificially by the browser at 700, which looks smudged. The comparison page showed it this way. |
| D5 | The gold words in the hero ("better beginning.", "four short steps.") | Stay gold and slanted, as on the comparison page (the browser slants the font; Gilda Display has no italic file). This is also how Frank Ruhl is shown today (no italic file is served). | What Asaf saw and chose; no extra file to download. |
| D6 | Button weight | Buttons in Montserrat **600** (today Assistant 700). Every other weight stays as it is (labels 600, values, names and tags 700, text 400). | Montserrat 700 is much heavier than Assistant 700; the comparison page showed buttons at 600. |
| D7 | Sizes | **No size changes.** All the `--fs-*` tokens and fixed sizes stay. Montserrat is wider than Assistant, so a few places that must stay on one line are checked at 375px and 1280px (§6.2); where text is cut or overflows, the smallest local fix is made in that rule only (slightly less letter spacing, or a size step down on phones), never a site-wide size change. Places to watch: the hero bar button "Book your escort" and the corner labels (`nowrap`), the hero heading lines from 600px (`nowrap`), the form progress labels ("Travellers" at 13px in four columns), tags and "Assigned to you", the agent card two-column grid, the staff header buttons, the archive table (`nowrap`, inside its own scroll area) and the archive panel heading (`nowrap`). | DoD: "no broken or cut text"; Asaf chose what he saw at today's sizes. |
| D8 | The font files | Downloaded once from Google Fonts' file server (fonts.gstatic.com), **latin subset only**, woff2, like ADR-8: `public/assets/fonts/gilda-display-latin.woff2` (static 400) and `public/assets/fonts/montserrat-latin.woff2` (variable, one file for all weights). `@font-face` in `tokens.css` with `font-display: block` (as today: preloaded, no font jump). `README.md` in the fonts folder lists the new files, source, date and licence. | ADR-8. One file per family keeps two requests per page, as today. |
| D9 | The old files | `frank-ruhl-libre-latin.woff2` and `assistant-latin.woff2` are **deleted** from `public/assets/fonts/` once nothing uses them (git keeps them in history). Asaf's approval of this plan is the approval for deleting these two files (CLAUDE.md: no deleting without asking). | Unused files would still be deployed; the folder should hold only what the site loads. |
| D10 | Preload | The two `<link rel="preload">` lines in each of the six pages point to the new file names. | Each page keeps loading both fonts first, as today (no flash of the fallback font). |
| D11 | Load size (DoD "loads as fast as before") | Before: 66,428 bytes of fonts per page (both preloaded). After: the two new files are measured at build step 1. **Rule: the new total must be no more than about 10% above 66 KB (≤ 73 KB).** If the Montserrat file is larger, the build uses Google's smaller "latin" subset only (never latin-ext) and, if still above, a file with only weights 400–700 instead of the full variable range; the number is reported to Asaf. No other page file changes, so the rest of the load is identical. | A measurable meaning for "as fast as before". |
| D12 | Emails | In "Render email" (n8n): `SERIF = "'Gilda Display', Georgia, 'Times New Roman', serif"` and `SANS = "Montserrat, Arial, Helvetica, sans-serif"`; a `<style>` block in the email's `<head>` with two `@font-face` rules that load the same two files from the live site (`https://sereno-olive-mu.vercel.app/assets/fonts/…`). Apple Mail (iPhone, Mac) and some other apps then show Gilda Display and Montserrat; **Gmail ignores web fonts and keeps showing Georgia / Arial**, exactly as today. The header "Sereno" uses weight normal (D4). Nothing else in the email changes. | MILESTONES M12: "in the emails as far as possible". The comparison page showed both cases. |
| D13 | Fonts read by the email apps | `vercel.json` gets one `headers` rule for `/assets/fonts/(.*)`: `Access-Control-Allow-Origin: *` (font files only). Without it, email apps that block fonts from another address would refuse them. This only lets other places *display* our two font files; it opens nothing else. | Needed for D12 to work in Apple Mail. |
| D14 | n8n (Asaf, by hand) | The repo export gets the same change as the live node (ADR-5: placeholders untouched). Asaf replaces two lines and adds the `<style>` block in the live "Render email" Code node (plain-Hebrew steps at build step 4). Until he does, emails look exactly as today — nothing breaks. | ADR-5, ADR-16. |
| D15 | What stays | Colours, sizes, spacing, rounded corners, the scene, every text, every screen's structure, the plain-text email version, the server, database, APIs, AI and tests' behaviour. The three images in `spec/` are not redrawn; DESIGN's text records the new fonts (O1) and wins over the Style Guide image on fonts. | Keep M12 to what MILESTONES lists ("only the chosen font changes"). |

---

## 1. Files

### New
- `public/assets/fonts/gilda-display-latin.woff2`, `public/assets/fonts/montserrat-latin.woff2` (D8).
- `tests/fonts.test.js` (§5).

### Changed
- `public/css/tokens.css`: the two `@font-face` rules and the two font tokens (D2, D8).
- `public/css/base.css`, `landing.css`, `theme.css`, `staff.css`: heading weights 500 → 400 (D3), brand 700 → 400 (D4), button 700 → 600 (D6), and only the local one-line fixes D7 finds.
- `public/index.html`, `public/order.html`, `public/staff/login.html`, `manager.html`, `agent.html`, `archive.html`: the two preload lines (D10).
- `public/assets/fonts/README.md`: new files, source, date, licence (D8).
- `vercel.json`: the font-files header rule (D13).
- `n8n/sereno-notifications.json`: "Render email" font stacks and `<style>` block (D12, D14).
- `spec/DESIGN.md`, `spec/ARCHITECTURE.md`: **only** the wording of O1, and only after Asaf approves it.
- `spec/ARCHITECTURE.md`: new ADR (end of build). `spec/MILESTONES.md`: 🟡 and checked DoD items (end of build). `CLAUDE.md`: no change expected.

### Deleted (D9)
- `public/assets/fonts/frank-ruhl-libre-latin.woff2`, `public/assets/fonts/assistant-latin.woff2`.

### Not changed
- Everything in `api/`, `lib/`, `data/`, `supabase/`, every `public/js/*.js`, `public/assets/scene.svg`, the video, `.env.example`.

---

## 2. Server
No change. (`vercel.json` gets the header rule only, D13.)

---

## 3. Browser / CSS

### 3.1 `tokens.css`
```
@font-face { font-family: 'Gilda Display'; font-style: normal; font-weight: 400;
  font-display: block; src: url('/assets/fonts/gilda-display-latin.woff2') format('woff2'); }
@font-face { font-family: 'Montserrat'; font-style: normal; font-weight: 100 900;
  font-display: block; src: url('/assets/fonts/montserrat-latin.woff2') format('woff2'); }
--font-heading: 'Gilda Display', Didot, Georgia, 'Times New Roman', serif;
--font-body: 'Montserrat', 'Segoe UI', Arial, sans-serif;
```
(The weight range of the Montserrat rule follows the file actually downloaded, D11.)

### 3.2 Weights
- Every rule with `font-family: var(--font-heading)` and `font-weight: 500` → `400` (D3).
- `.brand` (and any rule that sets the name Sereno to 700) → `400` (D4).
- `.btn` and the other button rules at 700 → `600` (D6).

### 3.3 Fit checks and local fixes (D7)
Done screen by screen at 375px and 1280px (§6.2). Each fix is one rule, recorded in the build report.

---

## 4. n8n (Asaf, by hand, in the live workflow; the repo export gets the same change)
In "Render email":
1. Replace the line `const SERIF = …` with `const SERIF = "'Gilda Display', Georgia, 'Times New Roman', serif";`
2. Replace the line `const SANS = …` with `const SANS = "Montserrat, Arial, Helvetica, sans-serif";`
3. Inside `<head>`, after `<title>…</title>`, add the `<style>` block with the two `@font-face` rules pointing to `https://sereno-olive-mu.vercel.app/assets/fonts/gilda-display-latin.woff2` and `…/montserrat-latin.woff2`.
4. In the header line that writes "Sereno", `font-weight:bold` → `font-weight:normal`.
5. Save.

Plain-Hebrew steps are given at build step 4. It must be done **after the push** (the font files must be on the live site first); before that, and if never done, emails look as today.

---

## 5. Tests (`node --test`)
New `tests/fonts.test.js` (reads files only; no browser):
- Every font file named in a `@font-face` `src` in `tokens.css` exists in `public/assets/fonts/`.
- Each of the six HTML pages preloads exactly the font files `tokens.css` declares, and each exists.
- No HTML or CSS file under `public/` refers to `fonts.googleapis.com` or `fonts.gstatic.com` (ADR-8).
- The total size of the declared font files is ≤ 73 KB (D11).
- `--font-heading` starts with `'Gilda Display'` and `--font-body` with `'Montserrat'`.

The existing 165 tests stay green (none touches fonts).

---

## 6. How the build is verified (before marking 🟡)

### 6.1 Asaf's part
1. After the push: the five n8n steps (§4), then one approval email to his allowlisted address, opened on his iPhone (Apple Mail or Gmail) — he says what he sees. Not part of the local DoD check (the fonts must be live first).

### 6.2 Checks (local run, port 3000, browser pane)
- **Load size before / after:** before any change, record the network list of `/` and `/order.html` (font files, sizes, total page bytes). After the change, the same list: only the two font files differ, total fonts ≤ 73 KB, no request to any other site, no font request fails (no 404), and the page shows the fonts without a jump.
- **Fonts actually used:** on each page, the browser's font list (`document.fonts`) shows Gilda Display and Montserrat loaded, and the computed `font-family` of a heading, a paragraph, a button and a field starts with the new names.
- **Every screen at 375px and 1280px, no cut or broken text, no sideways scroll:** landing (hero, How it works, About, Escort options, footer), order form steps 1–4 (with the wheelchair stepper shown, the rules panel, the consent box, a field error) and "Request received", staff sign-in (with an error), manager (list, an order's details, a decision box, the tags), agent (cards with "Assigned to you", meeting point and manager notes), archive (stats, filters, table, panel, paging). For each: the D7 watch list is looked at closely; any fix is re-checked at both widths.
- **Screenshots** of the landing hero, form step 2, an agent card and the archive at both widths, shared with Asaf in the build report.
- **Unit tests:** all green.

---

## 7. Open points

| # | Question | Options | Answer / recommendation |
|---|---|---|---|
| O1 | The DESIGN and ARCHITECTURE wording below (MILESTONES M12: "DESIGN.md (Style Guide, fonts) is updated per Asaf's choice"). | (a) approve as written; (b) approve with changes Asaf names. | **Decided (26.11.2026): (a).** Applied at build step 0, nothing else. |
| O2 | The emails (D12, D13): add the web fonts for apps that support them, or leave the emails exactly as today. | (a) as D12–D13 (Apple Mail shows the new fonts, Gmail stays Georgia / Arial); (b) no email change at all. | **Decided (26.11.2026): (a)** — it is "as far as possible", costs one small `vercel.json` rule and five lines in n8n, and cannot break an email. |
| O3 | If a text does not fit at 375px with Montserrat (D7). | (a) a local fix in that one rule, reported in the build summary; (b) stop and ask Asaf about each case. | **Decided (26.11.2026): (a)** — Asaf sees every fix in the screenshots and can ask to change it. |

### O1 — proposed wording changes (Hebrew, as the documents are written)

**`spec/DESIGN.md`, Part 2, "גופנים"**
- The fonts table: From
  `| Frank Ruhl Libre | כותרות, שם המוצר, מספרי צעדים ושעת המפגש | 500 לכותרות, 700 לשם Sereno |`
  `| Assistant | טקסט, כפתורים, שדות, טבלאות | 400 רגיל, 600 לתוויות, 700 לכפתורים |`
  To
  `| Gilda Display | כותרות, שם המוצר, מספרי צעדים ושעת המפגש | 400 (משקל אחד בלבד), גם לשם Sereno |`
  `| Montserrat | טקסט, כפתורים, שדות, טבלאות | 400 רגיל, 600 לתוויות ולכפתורים, 700 לערכים ולתגיות |`
- Under the table: From `שני הגופנים כוללים אותיות עבריות, אף שהממשק באנגלית. שם המוצר נכתב בגופן הכותרות, ללא סמל.` To `**עודכן 26.11.2026 (החלטה של אסף, Milestone 12):** הגופנים הוחלפו אחרי השוואה של כמה זוגות על מסכי Sereno ובדיקה של אתרי יוקרה בתחום (בסגנון Belmond: כותרת בסריף דק וקלאסי, טקסט בפונט גיאומטרי נקי). שני הגופנים חינמיים (SIL Open Font License) וכוללים אותיות לטיניות בלבד, כי הממשק באנגלית. הפונטים ב-Style Guide שבתמונה הוחלפו בטבלה הזו. שם המוצר נכתב בגופן הכותרות, ללא סמל.`
- The sizes table: every `Frank Ruhl 500` → `Gilda Display 400`; `Frank Ruhl · 52 · זהב` → `Gilda Display · 52 · זהב`; `Frank Ruhl 700 · 26` → `Gilda Display 400 · 26`; every `Assistant` → `Montserrat`; the button row `Assistant 700 · 17` → `Montserrat 600 · 17`. Sizes and line heights unchanged.
- "שדות": `תווית מעל השדה (Assistant 600, 15.5).` → `תווית מעל השדה (Montserrat 600, 15.5).`
- "בחירה והזנה": `מספר בגופן Frank Ruhl` → `מספר בגופן Gilda Display`.
- "מה לא מוצג בתמונות", add a bullet: `- **גופנים (Milestone 12, החלטה של אסף, 26.11.2026):** בכל המסכים ובמיילים הגופנים הם Gilda Display ו-Montserrat ולא אלה שבתמונות (ראו חלק 2, "גופנים"). במיילים הם מוצגים רק בתוכנות מייל שתומכות בגופני רשת (למשל המייל של אייפון); ב-Gmail נשארים Georgia ו-Arial.`

**`spec/ARCHITECTURE.md`**
- ADR-8 is kept as history, with one line added at its end: `**Updated by ADR-43 (Milestone 12):** the fonts are now Gilda Display and Montserrat, under the same rules.`
- ADR-16, at its end: `**Updated by ADR-43:** the email fonts are Gilda Display / Montserrat where the email app loads web fonts, with Georgia / Arial as fallback.`
- (ADR-43 itself is written at the end of the build, per CLAUDE.md.)

**Not changed:** PRD (no feature or behaviour changes), MILESTONES (already describes M12), the images.

No part of the spec M12 needs is a placeholder. Conflict note: the Style Guide image shows Frank Ruhl Libre and Assistant; MILESTONES M12 records that DESIGN is updated per Asaf's choice, so after O1 the DESIGN text (with its explicit note) is the source for fonts, as with the earlier DESIGN updates of 22.11.2026.

---

## 8. Definition of Done mapping

| DoD item (MILESTONES M12) | How it is met | Checked in |
|---|---|---|
| Every screen shows the chosen fonts, on phone and desktop, with no broken or cut text | D1–D7, D10, §3 | §6.2 Fonts actually used, Every screen at 375px and 1280px, Screenshots |
| The fonts load from the site itself (ADR-8), and the site loads as fast as before | D8, D9, D11, §5 | §6.2 Load size before / after + `tests/fonts.test.js` |
| (MILESTONES "what is built": in the emails as far as possible) | D12–D14, §4 | §6.1 after the push |

### 8.1 DoD result (27.11.2026, local run)

| DoD item | Result |
|---|---|
| Every screen shows the chosen fonts, on phone and desktop, with no broken or cut text | Pass. On every page `document.fonts` shows Gilda Display and Montserrat loaded; headings, the meeting time and stepper numbers compute to Gilda Display, text, buttons and fields to Montserrat (buttons 600). Checked at 375px and 1280px with a script that flags clipped text, text past the screen edge, sideways page scroll and faked bold: landing (all sections), order form steps 1–4 with every hidden part and every field error shown, "Request received", staff sign-in, manager (list, order details with a flight-time change), archive (stats, filters, table, order panel), agent (9 cards with meeting point, manager notes and "Assigned to you"). After the fixes listed in the Status line: no findings at either width. |
| The fonts load from the site itself (ADR-8), and the site loads as fast as before | Pass. No request to any other site; both font files answer 200 from `/assets/fonts/`. Home page before: 103,446 bytes (fonts 66,428); after: 95,669 bytes (fonts 58,160); the other files are the same apart from the small CSS edits. `tests/fonts.test.js` checks the files, the preloads, no Google links and the size limit. |
| (Emails as far as possible) | Repo export done and checked by running the "Render email" code with a sample: the HTML carries the two `@font-face` rules, the font stacks and a normal-weight "Sereno". The local server sends `Access-Control-Allow-Origin: *` on the font files only. The live n8n change and the iPhone check are Asaf's, after the push (§4, §6.1). |

---

## 9. Build steps (one at a time, each with Asaf's go-ahead)

0. **Documents (after O1):** the approved wording in DESIGN and ARCHITECTURE, nothing else.
1. **Measure and download:** record the "before" load list (§6.2); download the two latin woff2 files, measure them against D11, write the fonts `README.md`.
2. **Site:** `tokens.css`, the weights (D3, D4, D6), the six preload pairs, delete the two old files (D9), `tests/fonts.test.js`; run the unit tests.
3. **Fit pass:** every screen at 375px and 1280px, local fixes (D7, O3), screenshots, the "after" load list.
4. **Emails:** `vercel.json` header rule, the n8n export, and the plain-Hebrew steps for Asaf (to do after the push).
5. **DoD pass:** results written under §8 as "DoD result".
6. **Close:** ADR-43 (new fonts under ADR-8's rules; email fonts and the font-files header), 🟡 and checked items in MILESTONES, shut down the local run. No commit.
