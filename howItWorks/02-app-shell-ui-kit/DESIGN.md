# DESIGN — 02 app shell, UI kit, data hooks & autosave (2026-10-14)

Express brainstorm (PARALLEL-RUN §2): prosecutor + tester → judge. Business questions: none new (BLOCK.md + CONTRACTS §6–§7 cover them).

## Goal / Non-goals
**Goal:** the web shell (Tailwind 4 tokens, header, collapsible sidebar + mobile drawer, routes with placeholders), the UI kit (DESIGN-SYSTEM §5), the project data layer (snapshot cache, item/summary hooks, autosave queue), `ProjectPage` with KPI strip + tabs, `BudgetHealthPanel`, `OrganizationModal`, the projects list.
**Non-goals:** contents of tabs 04–13, backend code, `playwright.config.ts`, any new npm package (no user-event/jest-dom: tests use `fireEvent` + plain `expect`).

## Chosen approach — A: normalised `ProjectCache` stored in TanStack Query
`queryFn` for `['project', id]` fetches `ProjectSnapshot`, normalises it into `ProjectCache = snapshot + itemsById + itemIdsByLineId + linesById + orgsById` (plain objects/arrays) and **re-applies unconfirmed autosave patches** on top. Rows read `useItem` / `useItemIds` via `select` (only `.data` is returned, so tracked props = data). Edits: `cancelQueries` → `setQueryData` with one pure reducer that replaces only the touched row → `autosaveQueue.enqueue`.
- **Why not B** (raw snapshot + WeakMap-memoised normalisation in `select`): every edit rebuilds every index → new arrays per line, fights AC-02.6.
- **Why not C** (zustand entity store): violates "server data only through TanStack Query".

## Judge constraints (mandatory)
1. URL segments via `encodeURIComponent`; `tel:`/`mailto:` hrefs = fixed prefix + encoded value; no `dangerouslySetInnerHTML`.
2. Rollback: on the first unconfirmed edit for a key the hook saves the **server-confirmed** row; a failed save restores it, the queue drops every queued patch for that key, a toast is shown. No edit-time rollback closures. Saves for one key are serial; the latest `opts` win.
3. Refetch overlay: the queue exposes `unconfirmed(key)` (in-flight ∪ queued, merged). `queryFn` re-applies all unconfirmed patches after normalising. On success the server row is written only if nothing newer is pending; otherwise server row + pending patches.
4. One pure reducer module `features/project/project-cache.ts` (`normalise`, `applyItemPatch`, `upsertItem`, `removeItem`, `applyLinePatch`, `applyProjectPatch`, `applyOrgPatch`, `overlayUnconfirmed`) with unit tests. Indices are plain objects/arrays (structural sharing does not handle `Map`).
5. Identity: `useItem`/`useItemIds` return only `.data`; edit callbacks `useCallback`-stable; rows `memo`. AC-02.6 is also checked after a refetch.
6. Flush on blur, on route change (AppShell) and on `beforeunload`; sends use `fetch(..., { keepalive: true })`; `flush()` returns a promise.
7. On success invalidate `['projects']` and `['analytics']`, not `['project', id]`.
8. Tests: queue `__reset()`; `retry:false` QueryClient; `vi.advanceTimersByTimeAsync`, no `findBy*` under fake timers.
9. Toast `role="alert"`; Skeleton `aria-busy`; neither uses `role="status"` (HealthBadge owns it).
10. `refetchOnWindowFocus:false`, `staleTime: 30s`.

## Affected files (all owned by 02, `bin/blocks.conf`)
`apps/web/vite.config.mts`, `index.html`, `tsconfig.{app,spec}.json`, `src/{main.tsx,styles.css,env.d.ts,test-setup.ts}`,
`src/app/{app.tsx,app.spec.tsx,routes.tsx,nav-config.ts,layout/*}`, `src/ui/**` (kit + `editable-table/`), `src/lib/{api-client,query-keys,query-client,autosave-queue,ui-store,use-media-query,toast-store}.ts`,
`src/features/project/**`, `src/features/projects-list/**`, `src/features/organizations/**`, placeholders `src/features/{land,architecture,materials,construction,marketing,profitability,delivery-tracking,analytics,project-wizard,search}/*-page.tsx` + `search/global-search.tsx`, `apps/web-e2e/src/example.spec.ts`.

## Risks
- Queue × refetch interaction (medium) → constraints 2–3, test-first.
- 01's exported names may differ from CONTRACTS → consume them only via `@default-project/{types,budget-engine}`; if they differ, a local adapter + note to 01.
- Placeholder pages are later replaced by 04–13: kept to a single `export function XPage()` so their diffs stay trivial.

## Test strategy (Vitest, mocked fetch, fake timers) — tags `[AC-02.N]`
BLOCK.md AC-02.1 … AC-02.10, plus from the panel:
- AC-02.11 Queue: saves for one key are serial (2nd send waits for the 1st); different keys do not wait for each other.
- AC-02.12 Success with a newer pending patch does not overwrite the newer value in the cache.
- AC-02.13 A failed save restores the server-confirmed row, drops the queued patches for that key, and leaves other rows' references unchanged.
- AC-02.14 A refetch while edits are unconfirmed keeps the edited values (overlay).
- AC-02.15 `beforeunload` flushes immediately; a successful save invalidates `['projects']` and `['analytics']`.
- AC-02.16 Every route in CONTRACTS §7 renders (placeholders included).

## How to verify
`bash $BIN/check.sh 02` (lint/test/typecheck/build affected + ownership + weakening). Visual (optional): `PORT=3502 npx nx serve api`, `WEB_PORT=4202 API_PORT=3502 npx nx serve web`.

## As built (2026-10-14)
- Implemented as specified; all 10 judge constraints hold. `check.sh 02` → CHECK: PASS; AC ledger 16/16; web tests 51/51.
- Deviations decided while implementing: `EditableTable.footer` moved from `Column` to a table prop (the red-proof showed totals inside `columns` re-render every row); `useRow(context, rowId)` instead of an inline arrow (rules-of-hooks); `Tabs` take `match` so a tab that links to a remembered sub-section stays active on its siblings.
- Test finding: TanStack notifies observers on a 0 ms `setTimeout`; under fake timers the cache updated but React did not re-render. Specs with fake timers set `notifyManager.setScheduler((cb) => cb())` (see HANDOFF "Testing helpers").
- Extra for 08 (note 11:03): `applyItemsPatch` + `updateProjectCache`.

## Open questions
None.
