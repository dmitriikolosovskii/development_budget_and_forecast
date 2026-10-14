# 13 — Search across the app

> **Parallel launch:** first read [../PARALLEL-RUN.md](../PARALLEL-RUN.md). Gate, base branch, merge order and your files are in `bin/blocks.conf` (row `13`). Start: `bash $BIN/bootstrap.sh 13` (in the background) → brainstorm into `DESIGN.md` → code in `$WT` → `bash $BIN/check.sh 13` → `bash $BIN/merge-block.sh 13`.

**Wave:** W3 · **Priority:** STRETCH · **Estimate:** 45–60 min · **Worktree:** `Kairon-wt/13-search` (gate and base: `bin/blocks.conf`)
**In parallel:** 12 wizard, with no overlap. In the header there is already a `GlobalSearch` placeholder from 02 (`features/search/global-search.tsx`). You replace its body; the file name and export stay the same.

## Goal
Find projects, cost items (materials, works, services), organisations and budget lines from anywhere: a header input with a ⌘K / Ctrl+K palette, plus a `/search?q=` results page.

## You own
`apps/api/src/search/**` (`GET /search?q=`), `apps/web/src/features/search/**` (`GlobalSearch`, `SearchPage`), `apps/web-e2e/src/search.spec.ts`.

## API
- `q` is trimmed, 2–64 characters (otherwise 400). Up to 8 results per type, 30 in total.
- Case: SQLite has no `mode: 'insensitive'` (CLAUDE.md). **Check with a live probe** how Prisma `contains` behaves on SQLite for `arotherm`/`aroTHERM` and for umlauts (`Mühlberg`/`muhlberg`).
  - If it isn't case-insensitive: load the candidate fields in one query per type and filter in JS with `normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase()`. The volume is small (hundreds of rows).
  - Record the result in HANDOFF.
- Fields: Project (name, code, city, clientName), CostItem (name, code, description), Organization (name, contactPerson, city, email), BudgetLine (name, section).
- `href`:
  - item MATERIALS/CONSTRUCTION/MARKETING → `/projects/:pid/<tab>/<section>?highlight=<itemId>`; item LAND/ARCHITECTURE → `/projects/:pid/land?highlight=<itemId>` / `/projects/:pid/architecture?highlight=<itemId>` (these routes have no `:section`);
  - organisation → `/projects/<first non-template project with its rows>/materials?org=<id>` (`?org=` is handled by the ProjectPage layout on any tab); with no rows → `/search?q=<name>`;
  - project → `/projects/:id`.
- Template projects are excluded.

## Web
- `GlobalSearch`: input + a popover with results grouped by type, 250 ms debounce, `useQuery(['search', q])`, keyboard navigation (↑↓ Enter Esc), the ⌘K/Ctrl+K hotkey, highlighted matches (**text through React, no `dangerouslySetInnerHTML`**).
- On mobile: a search icon in the header → a full-screen Sheet.
- `SearchPage` shows the full list with type filters.
- **Highlight**: the `?highlight=` and `?org=` parameters are already handled by 02's EditableTable (scroll + flash, open the modal). You only build correct `href` values.

## Acceptance criteria
- AC-13.1 (Jest) `q` of 1 character → 400; `"  AROTHERM "` finds "Vaillant aroTHERM plus 7 kW" regardless of case; `muhlberg` finds "Holzbau & Bedachung Mühlberg".
- AC-13.2 (Jest) Templates are not in the results; the limit is 8 per type.
- AC-13.3 (Jest) `href` for a MATERIAL row = `/projects/<id>/materials/<section>?highlight=<itemId>`.
- AC-13.4 (Vitest) ⌘K focuses the search; ↓ + Enter navigates to the result; Esc closes.
- AC-13.5 (Vitest) An empty result → "No results for …"; an API error → ErrorState.
- AC-13.6 (Vitest) The match highlight renders `<mark>` through React (no innerHTML).
- AC-13.7 (Jest) Organisation `href`: with rows → `/projects/<first non-template project>/materials?org=<id>`; only template rows or none → `/search?q=<encoded name>`.
- AC-13.8 (Jest) Line `href` = `/projects/:pid/<tab>[/<section>]` (no section for LAND/ARCHITECTURE); project `href` = `/projects/:id`; a LAND item → `/projects/:pid/land?highlight=<id>`.
- AC-13.9 (Jest) With 4 types × 8 matches the total is 30 (type order project, item, organization, line); `q` longer than 64 characters → 400.
- AC-13.10 (Vitest) Fewer than 2 characters → no request; "aro" → exactly one request, only after the 250 ms debounce.
- AC-13.11 (Vitest) `/search?q=aro&type=item` shows only items; a filter chip updates `?type=` in the URL.
- AC-13.12 (e2e) ⌘K → "arotherm" → the item result → `/projects/<id>/materials/heating?highlight=<itemId>` and the row is highlighted.
