# 02 — App shell, UI kit, data hooks & autosave

> **Parallel launch:** first read [../PARALLEL-RUN.md](../PARALLEL-RUN.md). Gate, base branch, merge order and your files are in `bin/blocks.conf` (row `02`). Start: `bash $BIN/bootstrap.sh 02` (in the background) → brainstorm into `DESIGN.md` → code in `$WT` → `bash $BIN/check.sh 02` → `bash $BIN/merge-block.sh 02`.

**Wave:** W0 · **Priority:** MUST · **Estimate:** 75–90 min · **Worktree:** `Kairon-wt/02-app-shell-ui-kit` (gate and base: `bin/blocks.conf`)
**In parallel:** 01 is building the types/engine/API. Step 1 (Tailwind/vite) doesn't depend on 01. When 01 sets **`deps-ready`**, run `git merge feat/01-foundation-contracts && npm ci` (lucide, recharts) and do steps 2–3. When it sets **`contracts-ready`**, merge again + `npm ci` and continue from step 4.
**Everyone after you** builds pages from your kit and hooks. Your component APIs (DESIGN-SYSTEM §5, CONTRACTS §6) are a contract: don't rename them without a CR.

## Goal
A working shell: Tailwind, header, collapsible sidebar, routes with placeholders, a project page with tabs and a KPI strip, the UI kit, the snapshot/summary/edit hooks with a save queue, and `BudgetHealthPanel` + `OrganizationModal`. The app is responsive and light (DESIGN-SYSTEM).

## You own
CONTRACTS §7, row 02.

## Steps
1. **Tailwind 4:** `import tailwindcss from '@tailwindcss/vite'` → `plugins` in `vite.config.mts`; `styles.css` = tokens from DESIGN-SYSTEM §1; import styles in `main.tsx` (and remove the `<link>` from `index.html` if it duplicates it). You own the whole `vite.config.mts`: `server.port = Number(process.env.WEB_PORT ?? 4274)`, `preview.port = Number(process.env.PREVIEW_PORT ?? 4300)`, an `/api` proxy on **both** server and preview to `http://localhost:${process.env.API_PORT ?? 3454}`, and `define: { __DEMO_TODAY__: JSON.stringify(process.env.DEMO_TODAY ?? '2026-10-14') }` + a `declare const __DEMO_TODAY__: string` in `src/env.d.ts` (CONTRACTS §6).
2. **Layout:** `app/layout/{app-shell,header,sidebar}.tsx`, `app/nav-config.ts` (Projects → Calculate project `/projects/new`, Current projects `/projects`; Delivery tracking `/deliveries`; Analytics `/analytics`; lucide icons), collapsing remembered in zustand `useUiStore` (persist). Mobile drawer. `HealthBadge` stays in the header.
3. **UI kit** `ui/` (DESIGN-SYSTEM §5) without data: Card, Badge, Tabs, SubNav, Modal/Sheet, Toast, Skeleton, Empty/Error/ComingSoon, ChartCard, EditableTable + cells. EditableTable reads `?highlight=<rowId>` from the URL itself: it scrolls to the row and flashes it for 2 s (search 13 depends on this), and `?org=<orgId>` opens OrganizationModal.
4. **(after merging 01)** `lib/api-client.ts`, `lib/query-keys.ts`, `lib/autosave-queue.ts`; `features/project/`: `use-project-snapshot.ts` (normalised `ProjectCache`), `use-item.ts`/`use-item-ids.ts`, `use-project-summary.ts`, `use-edit-item.ts`, `use-edit-budget-line.ts`, `use-edit-project.ts`, `use-create-item.ts`, `use-delete-item.ts`, `use-edit-organization.ts`, `use-today.ts` (CONTRACTS §6, `__DEMO_TODAY__`), `use-schedule.ts` (calls `checkSchedule` with `useToday()`), `project-page.tsx` (header + KPI strip + tabs from `tabs-config.ts`; handles `?org=<id>` → OrganizationModal), `budget-health-panel.tsx`. Flush the queue on route change (in AppShell) and on `beforeunload`. `main.tsx`: `QueryClient` defaults `refetchOnWindowFocus:false`.
5. **Routes** `app/routes.tsx` exactly as in the CONTRACTS §7 table, plus placeholder files `features/<x>/<x>-page.tsx` for blocks 04–13 (`<ComingSoon/>`) and `features/search/global-search.tsx` (an input that navigates to `/search?q=`).
6. `features/projects-list/projects-list-page.tsx`: project cards (name, city, status, budget, EAC, variance, overrun badge, profit), a skeleton, an error state, and a "Calculate project" button.
7. `features/organizations/organization-modal.tsx` (DESIGN-SYSTEM §5) + `use-organizations.ts`; `lib/ui-store.ts` (`useUiStore`). All paths are listed in CONTRACTS §6.
8. Rewrite `app.spec.tsx` and `apps/web-e2e/src/example.spec.ts` deliberately (the heading changed to the shell: banner + nav "Projects", "Delivery tracking", "Analytics"; keep the `status` assertion of HealthBadge). Explain why in the commit message.
9. `bash $BIN/check.sh 02` (the rewrite of `app.spec.tsx`/`example.spec.ts` is allowed by the owner: `state/02.spec-rewrite`) → HANDOFF with examples "how to build a tab with a table in 20 lines" → `bash $BIN/merge-block.sh 02` (it waits for `01.merged` and sets `w0-frozen`).

## Acceptance criteria (Vitest + Testing Library, mocked fetch, fake timers)
- AC-02.1 The sidebar collapses and expands; the state survives a remount (persist).
- AC-02.2 `/projects/:id/materials/electrical` renders the "Building materials" tab active and passes `section=electrical`.
- AC-02.3 KpiStrip shows Budget/Spent/Open commitments/Forecast/Variance for a fixture snapshot; loading → skeleton; error → ErrorState with retry.
- AC-02.4 `useEditItem`: an edit changes the KPI immediately (before the PATCH); exactly **one** PATCH goes out 400 ms after a series of edits; a PATCH failure → rollback + toast.
- AC-02.5 Unmounting a component before 400 ms does not lose the save (the queue sends the PATCH); a route change calls `flush()`.
- AC-02.6 Editing one row does not re-render the others (a render counter in the test: 1 changed row → other rows 0 renders).
- AC-02.7 OrganizationModal shows the name, contact person, phone (`tel:`), email (`mailto:`) and the organisation's rows with dates.
- AC-02.8 Mobile (viewport < 640 via matchMedia mock): the sidebar is a drawer behind the burger; EditableTable renders cards.
- AC-02.10 `?highlight=<id>` → the row gets `data-highlighted` and `scrollIntoView` is called.
- AC-02.9 The rewritten `app.spec.tsx` is green; health tests are untouched and green.

### Added by the design panel (DESIGN.md, judge constraints 2–8)
- AC-02.11 Autosave saves for one key run strictly one after another; different keys do not wait for each other.
- AC-02.12 A successful save never overwrites a newer pending edit of the same row.
- AC-02.13 A failed save restores the last server-confirmed row, drops the queued patches for that key and keeps other rows' references.
- AC-02.14 A refetch while edits are unconfirmed keeps the edited values (overlay).
- AC-02.15 `beforeunload` flushes the queue; a successful save invalidates `['projects']` and `['analytics']`, not `['project', id]`.
- AC-02.16 Every route of CONTRACTS §7 renders (placeholders included); `/` redirects to `/projects`.

## Verify
`npx nx test web && npx nx lint web && npx nx typecheck web && npx nx build web` (exit 0). Visual: `WEB_PORT=4202 API_PORT=3502 npx nx serve web` (+ `PORT=3502 npx nx serve api`), then `pkill -f "$PWD/node_modules"`.

## Do not do
The contents of the tabs (04–13), backend code, `playwright.config.ts` (01).
