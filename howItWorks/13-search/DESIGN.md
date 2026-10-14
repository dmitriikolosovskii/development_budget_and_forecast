# DESIGN — 13 Search across the app

Status: implemented (see "As built"); approved by the panel (prosecutor, advocate, architect, tester → judge), 2026-10-14. Risk: **medium**.

## Goal / Non-goals
**Goal.** `GET /api/search?q=` finds projects, cost items, organisations and budget lines (templates excluded), case- and diacritic-insensitively, and returns ready `href`s. The web app has a header combobox (⌘K / Ctrl+K, ↑↓ Enter Esc, `<mark>` highlights) with a Sheet on mobile, and a `/search?q=&type=` results page with type filters.

**Non-goals.** German transliteration (`ß`→`ss`, `ue`→`ü`), fuzzy matching or typo tolerance, a search index or a folded DB column, pagination beyond 8 per type and 30 in total, request cancellation (`apiGet` has no `signal`), and changes to `header.tsx`, `ui/`, `lib/`, `libs/shared/*` or `app.module.ts`.

## Chosen approach (A) and why not the others
**A: load each type, fold and filter in JS.** There is one `findMany` per type with a fixed minimal `select`, and templates are excluded in the `where`. `fold(s) = s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase()` is applied to the BLOCK fields, results are ranked deterministically and capped, and `href`s are built in memory from the rows already loaded. That is 4 queries, with no N+1.
- **B: Prisma `contains` as an SQL prefilter.** Rejected. A live sqlite probe by the judge gave `'Mühlberg' LIKE '%muhlberg%'` = 0 and `'aroTHERM' LIKE '%AROTHERM%'` = 1. LIKE ignores case for ASCII only and never folds `ü`, so the prefilter would drop the `muhlberg` match that AC-13.1 needs.
- **C: a folded search column or raw SQL `REPLACE` chains.** Rejected. It needs a CR on the frozen schema and types, write-path hooks in blocks 01, 03, 04 and 10, and SQL built from strings.

## Judge constraints (mandatory)
1. The DTO trims with `@Transform` (non-strings pass through), then `@IsString() @Length(2, 64)`, otherwise 400. A missing `q` gives 400. No SQL is built from strings.
2. Templates are excluded in every query: `isTemplate: false` on projects, and `project: { isTemplate: false }` on items and lines. The organisation → project lookup uses only non-template rows.
3. The cap is 8 per type and 30 in total. The type order is project, item, organization, line, and the final list is sliced to 30. Ranking: exact title (0) < title prefix (1) < title contains (2) < another field contains (3), then project order (createdAt, id asc), then title, then id.
4. **The API owns `href`; the web app only renders it.** The category → tab map lives in the API and is pinned by a Jest table test:
   - item MATERIALS/CONSTRUCTION/MARKETING → `/projects/:pid/<tab>/<section>?highlight=<itemId>`; LAND/ARCHITECTURE → `/projects/:pid/<land|architecture>?highlight=<itemId>`;
   - line → the same without `highlight` (byte-for-byte like web `lineHref`); project → `/projects/:id`;
   - organisation → `/projects/<first non-template project (createdAt, id asc) that has its rows as supplier or contractor>/materials?org=<id>`, otherwise `/search?q=<encoded name, ≤ 64 chars>`.
   Every path segment and query value is `encodeURIComponent`-encoded.
5. `fold` exists once per side (`apps/api/src/search/fold.ts`, `apps/web/src/features/search/fold.ts`), with identical code and identical test vectors (`AROTHERM`, `Mühlberg`, `MÜHLBERG`). The web version also returns an index map back to the original string for `<mark>`. Highlights are React elements only, never `dangerouslySetInnerHTML`.
6. `GlobalSearch` keeps its export, file, `role="search"` form, `aria-label="Search"` input, and **one** document ⌘K/Ctrl+K listener. The header gets no `role="status"` (AC-02.9 reads the banner's single status).
7. `SearchPage` renders an `<h1>Search</h1>` synchronously in every state and does not fetch for fewer than 2 characters (AC-02.16 renders `/search?q=x`). `q` and `type` live in the URL.
8. `useSearch(q)`: key `queryKeys.search(q)`, `enabled` only for 2–64 trimmed characters, `placeholderData: keepPreviousData`, 250 ms debounce (tested with fake timers), loading/error/empty states, empty text `No results for “q”`.
9. Mobile (`useIsMobile`): the input is replaced by an icon button "Open search" that opens `ui/Sheet` (a bottom sheet, 90vh: the accepted reading of "full-screen", because `ui/` belongs to 02). After the Sheet opens, focus moves to the input explicitly, because Modal focuses its panel. In the combobox, Esc closes the list with `stopPropagation`; a second Esc closes the Sheet through Modal. ⌘K on mobile opens the Sheet.
10. Files touched: only `apps/api/src/search/**`, `apps/web/src/features/search/**` and `apps/web-e2e/src/search.spec.ts` (plus `howItWorks/13-search/{DESIGN,HANDOFF}.md` in the main tree). If 01 lands the stub `search.module.ts`/`search.controller.ts`, keep its file and class names.
11. The e2e test does not depend on its own duplicate ranking in the top 8 (duplicates pile up across runs). It asserts a seeded item result and the `?highlight=` row it leads to.
12. DTO tests go through `ValidationPipe.transform` (supertest is not installed). Every AC test has a negative assertion beside the positive one.

## Affected files
API `apps/api/src/search/`: `search.module.ts`, `search.controller.ts`, `search.service.ts`, `search-href.ts`, `fold.ts`, `dto/search-query.dto.ts`, specs `search.service.spec.ts`, `search-href.spec.ts`, `search-query.dto.spec.ts`, `fold.spec.ts`.
Web `apps/web/src/features/search/`: `global-search.tsx` (body replaced), `search-page.tsx` (body replaced), `search-combobox.tsx`, `search-results.tsx`, `highlight.tsx`, `fold.ts`, `use-search.ts`, `use-debounced-value.ts`, `search-labels.ts`, specs `global-search.spec.tsx`, `search-page.spec.tsx`, `highlight.spec.tsx`, `fold.spec.ts`, `use-search.spec.tsx`.
E2E: `apps/web-e2e/src/search.spec.ts`.

## Risks
- Focus and Esc interplay with `Modal` (document listener) → explicit tests for Esc in the Sheet.
- The fold is duplicated across api and web → identical vectors in both specs.
- Load-all on every query grows with e2e duplicates (≈190 rows per copy) → the 2-character minimum and the 250 ms debounce keep it cheap; revisit with C if it exceeds ~10k rows.
- Shared header tests from 02 (AC-02.9, AC-02.16) → run the whole web suite in `check.sh`.
- The search stub from 01 is not there yet → merge main after `w0-frozen` and adapt to its names.

## Test strategy (ACs)
BLOCK ACs: AC-13.1–AC-13.6 (Jest/Vitest, see BLOCK.md). Added by the panel (registered in BLOCK.md):
- AC-13.7 (Jest) organisation `href`: with rows → `/projects/<first non-template project>/materials?org=<id>`; only template rows or none → `/search?q=<encoded name>`.
- AC-13.8 (Jest) line `href` = `/projects/:pid/<tab>[/<section>]` (no section for LAND/ARCHITECTURE), project `href` = `/projects/:id`; LAND item → `/projects/:pid/land?highlight=<id>`.
- AC-13.9 (Jest) with 4 types × 8 matches the total is 30, in type order project, item, organization, line; `q` longer than 64 characters → 400.
- AC-13.10 (Vitest) fewer than 2 characters → no `fetch`; "aro" → exactly one fetch, only after 250 ms (none at 249 ms).
- AC-13.11 (Vitest) `/search?q=aro&type=item` shows only items; a filter chip updates `?type=` in the URL.
- AC-13.12 (e2e) ⌘K → "arotherm" → the item result → the URL is `/projects/<id>/materials/heating?highlight=<itemId>` and the row is highlighted.

## How to verify
`bash $BIN/check.sh 13` → CHECK: PASS; `bash $BIN/ac-ledger.sh --block 13` → 13.1–13.11 OK (13.12 UNRUN until the integrator runs the e2e). Live Prisma probe for `contains` (aroTHERM/AROTHERM, Mühlberg/muhlberg), recorded in HANDOFF.

## Open questions
None blocking. ß/ue transliteration is a known gap (HANDOFF).

## As built (2026-10-14)
- Implemented as designed (approach A); commits `3064c72` (feature), `387c4d3` (e2e wait) on `feat/13-search`.
- Live Prisma probe: `contains` on SQLite folds case for ASCII only. `muhlberg` and `MÜHLBERG` → no rows, while `AROTHERM` → found. This confirms the JS fold. The details are in HANDOFF.
- Deviations from the plan:
  - Enter is handled in the input's `onKeyDown`, so jsdom and browsers behave the same.
  - Accessible-name matching in Vitest is split by `<mark>`, so the specs assert `textContent` for highlighted titles.
  - The e2e spec does not duplicate the demo project (read-only test, constraint 11). It waits for the combobox to be visible before ⌘K, because the dev server can reload on its first visit.
- The AC-13.12 row highlight depends on block 04's `MaterialsPage` (`EditableTable` `?highlight=`).
