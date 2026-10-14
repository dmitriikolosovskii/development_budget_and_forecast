# HANDOFF — 13-search

Filled in by the block session (main-tree path). Neighbours read it before using your work.

## Status
done, `check.sh 13` → CHECK: PASS (ownership, format, affected lint/test/typecheck/build for api, web, web-e2e, test weakening: all exit 0). AC ledger `--block 13`: AC-13.1–13.11 OK; AC-13.12 (e2e) UNRUN until the integrator runs it. Branch `feat/13-search`, merged by `merge-block.sh 13`. Design and as-built notes: `DESIGN.md`.

## Ready for neighbours (exports / components / endpoints, with examples)

### API: `GET /api/search?q=` → `SearchResult[]` (`apps/api/src/search/`)
```
GET /api/search?q=%20%20AROTHERM%20   → 200 [{type:'item', title:'Heat pump Vaillant aroTHERM plus …', subtitle:'MAT-HEA-001 · Heating & ventilation · Stadtvilla Taucha — Family of 4', href:'/projects/<pid>/materials/heating?highlight=<itemId>', …}, …]
GET /api/search?q=muhlberg            → 200 [{type:'organization', title:'Holzbau & Bedachung Mühlberg', href:'/projects/<taucha id>/materials?org=<orgId>', projectId:'<taucha id>', …}]
GET /api/search?q=a  | q > 64 chars | no q → 400 (class-validator message)
```
- `q` is trimmed, then must be 2–64 characters (`dto/search-query.dto.ts`).
- Fields searched:
  - Project: name, code, city, clientName
  - CostItem: name, code, description
  - Organization: name, contactPerson, city, email
  - BudgetLine: name, section
- Results come in type order project → item → organization → line, at most 8 per type and 30 in total.
- Ranking inside a type: exact title, then title prefix, then title contains, then another field. Ties go to the older project first (createdAt, id), then title, then id.
- Templates are excluded from every query (`isTemplate: false` / `project: { isTemplate: false }`). Organisations are shared, so they are always searched, but their link only ever points at a non-template project.
- `href` (`search-href.ts`) is the single source of truth, and the web app renders it as is:

  | Result | `href` |
  |---|---|
  | item in MATERIALS / CONSTRUCTION / MARKETING | `/projects/:pid/<tab>/<section>?highlight=<itemId>` |
  | item in LAND / ARCHITECTURE | `/projects/:pid/<land\|architecture>?highlight=<itemId>` |
  | line | same as the item, without `?highlight` (equals web `lineHref`) |
  | project | `/projects/:id` |
  | organisation with rows | `/projects/<oldest non-template project with its rows>/materials?org=<id>` |
  | organisation without rows | `/search?q=<encoded name ≤ 64>` |

- Subtitles:

  | Type | Subtitle |
  |---|---|
  | item | `CODE · Line name · Project name` |
  | project | `CODE · City · Client` |
  | organisation | `Role · City · Contact person` |
  | line | `Tab label · Project name` |

- **Live probe (required by BLOCK)**, Prisma 6.19 `contains` on SQLite, run on a temporary DB:
  - `arotherm`, `AROTHERM` and `aroTHERM` all find `Vaillant aroTHERM plus 7 kW`.
  - `Mühlberg` and `mühlberg` find `Holzbau & Bedachung Mühlberg`.
  - `muhlberg` and `MÜHLBERG` find **nothing**.

  So `contains` (SQL LIKE) folds case for ASCII only and never strips diacritics. The service therefore loads the candidate fields with **one `findMany` per type** (4 queries, minimal `select`, no N+1) and filters in JS with `fold()` = `normalize('NFD')` + remove `\p{Diacritic}` + `toLowerCase()`. Latency on the seeded DB (3 projects + template) is about 10 ms.

### Web: `apps/web/src/features/search/`
- `GlobalSearch` (header; same file and export as 02's placeholder):
  - Tablet/desktop: an ARIA combobox (`role="combobox"`, name "Search") inside `<form role="search">`, with a popover listbox grouped by type (`role="group"` names: Projects, Cost items, Organizations, Budget lines).
  - Keys: ↑↓ move, Enter opens the active result (or `/search?q=` when none is active), Esc closes the list.
  - Mobile (< 640 px): an "Open search" icon opens `ui/Sheet` (dialog "Search") with the same combobox. The input is focused, the first Esc closes the list, the second closes the Sheet, and picking a result closes it.
  - ⌘K / Ctrl+K has exactly one document listener: it focuses the input, or opens the Sheet on mobile.
- `SearchPage` (`/search?q=&type=`):
  - The `<h1>Search</h1>` is always rendered, and nothing is fetched below 2 characters (02's AC-02.16 stays green).
  - Filter chips "All (n)", "Projects (n)" and so on set `?type=` in the URL.
  - Every result is a `<Link>` to the server `href`. The page has loading, error (ErrorState + Retry), empty (`No results for “q”`) and per-type empty states.
- Reusable pieces:
  - `useSearch(q)`: TanStack `['search', q.trim()]`, enabled only for 2–64 characters, `staleTime` 30 s, `keepPreviousData`.
  - `isSearchable(q)` and `useDebouncedValue(value, ms)`; the combobox debounce is 250 ms.
  - `<Highlight text query/>` renders every case- and diacritic-insensitive match as a React `<mark>` (no innerHTML). `matchRanges(text, q)` maps folded offsets back to the original string, including decomposed umlauts.

## How to check
- `bash $BIN/check.sh 13` → CHECK: PASS.
- `bash $BIN/ac-ledger.sh --block 13` → 11 OK + 1 UNRUN.
- Unit tests: API 26 tests in `apps/api/src/search/**`; web 32 tests in `apps/web/src/features/search/**`.
- Red-proof was done by mutation. Each of these turned at least one guard red:
  - fold without diacritics; template filter removed (projects or items); limits 9/32; section for every tab; organisation always falls back; DTO length rule;
  - no `<mark>`; no debounce; fetch always enabled; Esc not stopped; no hotkey; type filter ignored; empty text changed.
- Manual check (worktree, API on port 3513 and web on 4213, seeded DB), in a real browser:
  - ⌘K → "arotherm" → popover with 3 heat pump rows, `<mark>aroTHERM</mark>`.
  - ↓ Enter → `/projects/<taucha>/materials/heating?highlight=<id>`.
  - `/search?q=muhlberg` shows the organisation with `Mühlberg` marked.
  - On mobile, the Sheet opens with the input focused.
- e2e `apps/web-e2e/src/search.spec.ts` [AC-13.12] is read-only and uses the seeded projects, not a duplicate. **Its row-highlight assertion needs block 04's `MaterialsPage`** (still the 02 placeholder when 13 was checked). Run it after 04 is merged.

## Gaps, CRs, deviations from CONTRACTS
- No CRs. Only block 13's files were touched.
- `fold` is duplicated in `apps/api/src/search/fold.ts` and `apps/web/src/features/search/fold.ts`, because `libs/shared/types` is frozen. Both specs use the same vectors. If shared code is ever unfrozen, move it to `libs/shared/types` through a CR.
- No German transliteration: `ß` ≠ `ss` and `ue` ≠ `ü` (so `muehlberg` does not find "Mühlberg").
- Mobile "full-screen Sheet" is `ui/Sheet` as built by 02: a bottom sheet with max height 90vh. `ui/` belongs to 02.
- The search loads every candidate row on each request (debounced, at least 2 characters). This is fine for hundreds to a few thousand rows. Duplicates from e2e runs (~190 rows each) grow the volume. Past ~10k rows, a folded search column through a schema CR would be the next step.
- e2e duplicates of the demo project show up in search results like any other project. Items and lines from the oldest project rank first.
- The CONTRACTS §5 row for `GET /search` is unchanged. The rules (limits, fields, hrefs) are as in BLOCK.md, plus AC-13.7–13.12 added by the panel.
