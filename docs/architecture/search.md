<!-- paths: apps/api/src/search/**, apps/web/src/features/search/**, apps/web-e2e/src/search.spec.ts | global search (block 13) -->
# Search

`GET /api/search?q=` finds projects, cost items, organisations and budget lines (templates excluded),
case- and diacritic-insensitively, and returns ready `href`s. The web app has a header combobox (⌘K / Ctrl+K,
↑↓ Enter Esc, `<mark>` highlights), a bottom Sheet on mobile, and a `/search?q=&type=` results page with type filters.

## SQLite limitation and the chosen fold
SQLite `LIKE` (what Prisma `contains` compiles to) folds case **for ASCII only** and never folds diacritics: a live
probe gave `'aroTHERM' LIKE '%AROTHERM%'` = 1 but `'Mühlberg' LIKE '%muhlberg%'` = 0, and `MÜHLBERG` found nothing.
Prisma's `mode: 'insensitive'` does not exist on SQLite. So the service does **not** filter in SQL: it loads the
candidate rows of each type with a minimal `select` and matches in JS with
`fold(s) = s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase()` (`apps/api/src/search/fold.ts:6`).
A folded DB column was rejected (schema CR plus write hooks in 4 blocks); an SQL `contains` prefilter was rejected
because it drops the `muhlberg` match. Not handled: German transliteration (`ß` ≠ `ss`, `ue` ≠ `ü`, so `muehlberg`
does not find "Mühlberg"), fuzzy matching.

## Key files
API (`apps/api/src/search/`):
- `search.controller.ts:10` — `GET /search`, `SearchQueryDto`.
- `dto/search-query.dto.ts:7` — trims with `@Transform`, then `@IsString() @Length(2, 64)`; anything else (incl. a
  missing `q`) → 400.
- `search.service.ts:79` — `search(q)`: 4 `findMany` in parallel (`:81`), `isTemplate: false` on projects and
  `project: { isTemplate: false }` on items and lines; no N+1, no SQL strings.
- `search.service.ts:46` — `rankMatch`: 0 exact title, 1 title prefix, 2 title contains, 3 another field contains.
  Fields: project name/code/city/client; item name/code/description; organisation name/contact/city/email;
  line name/section.
- `search.service.ts:58` — tie-break: rank, project order (`createdAt, id`), title, id.
- `search.service.ts:16` — caps: 8 per type, 30 in total; type order project, item, organization, line (`:231`).
- `search-href.ts` — the API owns every `href`: `projectHref` (`:21`), `lineHref` (`:25`, section segment only for
  MATERIALS/CONSTRUCTION/MARKETING), `itemHref` (`:35`, line href + `?highlight=<itemId>`), `organizationHref`
  (`:45`: `/projects/<first non-template project with its rows>/materials?org=<id>`, else `/search?q=<name ≤ 64>`).
  Every segment is `encodeURIComponent`-encoded.

Web (`apps/web/src/features/search/`):
- `use-search.ts:17` — `useSearch(q)`: key `['search', q.trim()]`, enabled only for 2–64 trimmed chars
  (`isSearchable`, `:11`), `staleTime` 30 s, `keepPreviousData`.
- `global-search.tsx:9` — `GlobalSearch` (02's export kept): one document ⌘K/Ctrl+K listener (`:17`); on mobile an
  "Open search" icon opens `ui/Sheet` (`:47`).
- `search-combobox.tsx:35` — ARIA combobox (`role="combobox"`, `:179`) in a `role="search"` form, grouped listbox,
  250 ms debounce (`:45`); the first Esc closes only the list via `stopPropagation` (`:87`), the second closes the Sheet.
- `fold.ts:13` — `matchRanges(text, q)`: folded offsets mapped back to the original string (decomposed umlauts too);
  `highlight.tsx:10` renders React `<mark>` elements, never `dangerouslySetInnerHTML`.
- `search-page.tsx:17` — `/search?q=&type=`; `<h1>Search</h1>` always rendered (`:140`), no fetch below 2 chars,
  filter chips set `?type=`; loading, error + Retry, `No results for “q”` (`:70`) and per-type empty states.

## Invariants
- Templates never appear in results or as an organisation's target project.
- `fold` exists once per side with identical code and the same test vectors (`AROTHERM`, `Mühlberg`, `MÜHLBERG`).
- Item `href`s land on `EditableTable` `?highlight=` (scroll + flash); organisation `href`s use the `ProjectPage`
  `?org=` modal (see [app-shell.md](app-shell.md)).
- The header has no `role="status"` of its own (02's AC-02.9 reads the banner's single status).

## Decisions and deviations from CONTRACTS
- No CR: CONTRACTS §5 `GET /search` row unchanged; limits, fields and hrefs follow BLOCK.md plus panel ACs 13.7–13.12.
- `fold` is duplicated api ↔ web because `libs/shared/types` is frozen.
- "Full-screen" mobile search is 02's `ui/Sheet`: a bottom sheet, max height 90vh.
- Enter is handled in the input's `onKeyDown`, so jsdom and browsers behave the same.

## Tests
- API: `search.service.spec.ts`, `search-href.spec.ts`, `dto/search-query.dto.spec.ts`, `fold.spec.ts`
  (AC-13.1–13.9; DTO via `ValidationPipe.transform`, no supertest).
- Web: `global-search.spec.tsx`, `search-page.spec.tsx`, `highlight.spec.tsx`, `fold.spec.ts` (AC-13.10, 13.11; fake
  timers for the debounce).
- e2e: `apps/web-e2e/src/search.spec.ts:5` [AC-13.12] ⌘K → "arotherm" → `/projects/<id>/materials/heating?highlight=<id>`
  with the row highlighted; `:40` empty results page. Read-only, uses the seeded projects.

## Known gaps
- Every request loads all candidate rows (debounced, ≥ 2 chars). Fine for hundreds to a few thousand rows; e2e
  duplicates add ~190 rows each. Past ~10k rows the next step is a folded search column via a schema CR.
- No transliteration, no fuzzy match, no pagination beyond 8/type and 30 total, no request cancellation
  (`apiGet` has no `signal`).
- e2e duplicates of the demo project appear in results like any project; the oldest project's rows rank first.
