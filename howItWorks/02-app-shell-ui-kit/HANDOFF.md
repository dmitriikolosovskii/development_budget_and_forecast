# HANDOFF — 02-app-shell-ui-kit

Filled in by the block session (main-tree path). Neighbours read it before using your work.

## Status
merged into main (`3bb93ad`, flags `02.merged`, `w0-frozen`). `check.sh 02` → CHECK: PASS (ownership/format/affected lint,test,typecheck,build/test-weakening all exit 0); AC ledger 16/16 OK; web tests 51/51. Branch `feat/02-app-shell-ui-kit` (head `4e35d39`), merged into main by `merge-block.sh 02` after `01.merged` (that merge sets `w0-frozen`). Everything below is implemented as described.

## Ready for neighbours (exports / components / endpoints, with examples)

Paths are relative to `apps/web/src/`. All server data goes through these hooks; never `fetch` in a feature.

### Data hooks — `features/project/`
| Hook (file) | Returns |
|---|---|
| `useProjectSnapshot(projectId, select?)` (`use-project-snapshot.ts`) | TanStack `UseQueryResult` of `ProjectCache` = `ProjectSnapshot` + `itemsById`, `itemIdsByLineId`, `linesById`, `orgsById` (plain objects) |
| `useItemIds(projectId, lineId)` (`use-item-ids.ts`) | `string[]` (stable identity while the line's membership is unchanged) |
| `useItem(projectId, itemId)` (`use-item.ts`) | `CostItem \| undefined` (only this row re-renders on its own edit) |
| `useBudgetLines(projectId, category?)` (`use-budget-lines.ts`) | `BudgetLine[]` sorted by `sortOrder`; `useBudgetLine(projectId, category, section)` → one line |
| `useProjectSummary(projectId)` (`use-project-summary.ts`) | `summarizeProject(...)` result (`project`, `byCategory`, `byLine`, `overrunLines`) or `undefined` while loading; memoised per cache version |
| `useEditItem(projectId)` (`use-edit-item.ts`) | stable `(itemId, patch: Partial<CostItem>) => void`: optimistic, autosaved (400 ms, merged), rollback + toast on error |
| `useEditBudgetLine(projectId)` | stable `(lineId, patch) => void` (same semantics) |
| `useEditProject(projectId)` | stable `(patch) => void` (e.g. `{ markupBps }`) |
| `useEditOrganization()` (`features/organizations/use-edit-organization.ts`) | stable `(orgId, patch) => void`; updates `['organizations']` and every cached project |
| `useCreateItem(projectId)` | `(input: CreateCostItemInput) => Promise<CostItem>`: optimistic temp row, replaced by the server row |
| `useDeleteItem(projectId)` | `(itemId) => Promise<void>`: optimistic remove, restored + toast on error |
| `useToday()` (`use-today.ts`) | `'YYYY-MM-DD'` (= `__DEMO_TODAY__`, default `2026-10-14`) |
| `useSchedule(projectId)` (`use-schedule.ts`) | `Record<itemId, ScheduleResult>` = `checkSchedule(items, useToday())`, memoised |
| `useOrganizations()` (`features/organizations/use-organizations.ts`) | `UseQueryResult<Organization[]>` (key `['organizations']`) for pickers |
| `useProjects()` (`features/projects-list/use-projects.ts`) | `UseQueryResult<ProjectListItem[]>` (key `['projects']`) |
| `updateProjectCache(qc, projectId, (cache) => cache)` (`update-project-cache.ts`) | apply any reducer from `project-cache.ts` (`applyItemPatch`, `applyItemsPatch(cache, [{id, patch}])`, `upsertItem`, `removeItem`, `applyLinePatch`, …) or `(c) => ({ ...c, plan })`; skip rows with `autosaveQueue.has('item:<id>')` |
| `lineHref(projectId, category, section)` (`budget-health-panel.tsx`) | link to a line's tab/sub-section |

Low level (`lib/`): `apiGet/apiPost/apiPatch/apiDelete` (`api-client.ts`, 15 s timeout, throws `ApiError{status,message}`), `queryKeys` (`query-keys.ts`), `autosaveQueue` (`autosave-queue.ts`: `enqueue/flush/has/unconfirmed/discard`), `useUiStore` (`ui-store.ts`: `sidebarCollapsed`, `lastSection[tab]`, `setLastSection(tab, section)`), `showToast(text, tone)` (`toast-store.ts`), `useIsMobile()` (`use-media-query.ts`).

### UI kit — `ui/` (barrel `ui/index.ts`)
`Card`, `SectionTitle`, `Badge({tone})` (`ok|warn|risk|info|brand|muted`), `Pill`, `Skeleton`, `EmptyState`, `ErrorState({error, retry})`, `ComingSoon({title})`, `Tabs({items:[{label,to}], label})` (route-based), `SubNav({items:[{id,label,badge?}], active, onSelect})`, `Modal`, `Sheet`, `Toaster` / `useToast()`, `KpiStrip({summary, overrunCount?})`, `ChartCard({title, children})` + `CHART_COLORS`, `CATEGORY_COLORS`.
Project-level: `BudgetHealthPanel({projectId, category?, lineId?})` (`features/project/budget-health-panel.tsx`), `OrganizationModal({orgId, projectId, onClose})` (`features/organizations/organization-modal.tsx`). On any project tab, `?org=<orgId>` opens the modal (handled by `ProjectPage`); `OrgCell` sets it for you.

### EditableTable — `ui/editable-table/`
```ts
interface Column<Row> {
  id: string;
  header: ReactNode;
  cell: (row: Row, edit: (patch: Partial<Row>) => void) => ReactNode; // edit is bound to the row
  align?: 'left' | 'right';
  width?: string;          // e.g. 'w-28'
  mobile?: 'title' | 'field' | 'hidden'; // card layout on < 640 px (default 'field')
}
<EditableTable<Row extends { id: string }, Ctx>
  caption="Electrical" rowIds={ids} context={projectId} useRow={useItem /* (ctx, rowId) => Row | undefined */}
  columns={COLUMNS /* stable: module scope or useMemo */}
  onEdit={editItem /* stable */} footer={{ amount: formatEur(total) } /* by column id, may change freely */}
  onAdd={...} onDelete={deleteItem /* stable */} />
```
Rows are `memo`: editing one row re-renders only that row. `?highlight=<rowId>` scrolls to the row and flashes it for 2 s (`data-highlighted`). On mobile it renders cards; "Edit" opens a Sheet with the editable fields.
Cells (display + inline editor; Enter commits into the 400 ms queue, **blur commits and flushes at once**, Esc cancels; invalid input shows `role="alert"` text and does not commit; without `onCommit` a cell is read-only):
`TextCell({value, onCommit?, label?})`, `MoneyCell({cents, onCommit?, label?})` (`parseEurToCents`: `12,5,0`, `-3`, `abc` → "Enter an amount like 1,234.56"), `QtyCell({milli, unit, onCommit?})`, `DateCell({value, onCommit?})` (empty → `null`), `SelectCell({value, options, onCommit, allowEmpty?})`, `StatusCell({status, onCommit?})`, `OrgCell({orgId, role?, onCommit?})` (click name → sets `?org=`; pencil → picker filtered by role; reads `projectId` from the route), `ScheduleFlagCell({result})`, plus `ScheduleBadge` and `scheduleLabel(result)` → `{label, tone}` (`On time`, `At risk · 2 d`, `Late for work · 9 d`, `Overdue`, `Delivered`, `Unscheduled`; WORK: `Ready`, `Blocked · 9 d`, `Invalid dates`). `label` becomes the accessible name: `Edit <label>` on the button, `<label>` on the input.

### A tab with a table in ~20 lines
```tsx
import { useParams } from 'react-router-dom';
import { EditableTable, MoneyCell, QtyCell, TextCell, type Column } from '../../ui';
import { useBudgetLine } from '../project/use-budget-lines';
import { useItemIds } from '../project/use-item-ids';
import { useItem } from '../project/use-item';
import { useEditItem } from '../project/use-edit-item';
import type { CostItem } from '@default-project/types';

const COLUMNS: Column<CostItem>[] = [
  { id: 'name', header: 'Item', mobile: 'title', cell: (r, edit) => <TextCell value={r.name} onCommit={(name) => edit({ name })} /> },
  { id: 'qty', header: 'Qty', align: 'right', cell: (r, edit) => <QtyCell milli={r.qtyMilli} unit={r.unit} onCommit={(qtyMilli) => edit({ qtyMilli })} /> },
  { id: 'price', header: 'Unit price', align: 'right', cell: (r, edit) => <MoneyCell cents={r.unitPriceCents} onCommit={(unitPriceCents) => edit({ unitPriceCents })} /> },
];

export function MaterialsPage() {
  const { projectId = '', section = 'electrical' } = useParams();
  const line = useBudgetLine(projectId, 'MATERIALS', section);
  const ids = useItemIds(projectId, line?.id ?? '');
  const editItem = useEditItem(projectId);
  return <EditableTable caption={line?.name ?? ''} rowIds={ids} context={projectId} useRow={useItem} columns={COLUMNS} onEdit={editItem} />;
}
```
(`useRow` is called as a hook inside each memo row as `useRow(context, rowId)`, so pass a real hook such as `useItem`, never an inline arrow.)

### Shell
Routes exactly as in CONTRACTS §7. Placeholders `features/<x>/<x>-page.tsx` export `<X>Page` rendering `<ComingSoon/>`: **replace the body, keep the name**. `ProjectPage` renders the project header, `KpiStrip`, tabs, and an `<Outlet/>`; the tab pages get `projectId` (and `section`) from `useParams()`.

### Testing helpers for neighbours — `testing/render.tsx`
`renderWithProviders(ui, { url, client })` (QueryClient with `retry:false` + MemoryRouter), `mockApi({ 'GET /api/projects/p1': () => fakeResponse(snapshot) })` (routes `fetch` by `METHOD /api/path` prefix, unmatched → 404), `fakeResponse(body, status)`, `testQueryClient()`. Seed a cache without fetch: `client.setQueryData(queryKeys.project(id), normalise(makeSnapshot({...})))`.
**Fake timers:** TanStack delivers updates on a 0 ms `setTimeout`, which fake timers freeze. In specs with `vi.useFakeTimers()` add `notifyManager.setScheduler((cb) => cb())` in `beforeEach` (restore with `(cb) => setTimeout(cb, 0)`), drive time with `await act(() => vi.advanceTimersByTimeAsync(ms))`, and call `autosaveQueue.__reset()` before/after each test. Example: `features/project/use-edit-item.spec.tsx`.

## How to check
`bash $BIN/check.sh 02` (CHECK: PASS), `bash $BIN/ac-ledger.sh --block 02` from the worktree (16/16 OK). Visual check was **not** done (the API from 01 had no schema yet when this block finished); the integrator's e2e `example.spec.ts` covers the shell.

## Gaps, CRs, deviations from CONTRACTS
- No CRs. Nothing frozen was changed outside 02's files.
- `DEMO_TODAY=today` is resolved in `vite.config.mts` (`new Date()` at build time), so `useToday()` always returns a date.
- `EditableTable` API differs from the one-line summary in DESIGN-SYSTEM §5 in two places (decided by the panel): `useRow(context, rowId)` + `context` prop (rules-of-hooks), and `footer` is a table prop keyed by column id (totals in `columns` would re-render every row).
- `ui/editable-table/cells.tsx` (`OrgCell`) imports `useOrganizations`/`useProjectSnapshot` from `features/`: same app and scope, a deliberate shortcut.
- Toast uses `role="alert"`, Skeleton uses `aria-busy` + `data-testid="skeleton"`: `role="status"` belongs to HealthBadge only.
- Not done: the header "project selector" from DESIGN-SYSTEM §4 (navigation goes through Current projects); the sticky right-hand BudgetHealthPanel column at ≥ 1536 px is up to each tab's layout (the panel itself is ready).
- Known limits: editing a just-created temp row (`tmp-N`) before the POST returns sends a PATCH to the temp id, which fails with a toast; a failed delete restores the whole pre-delete cache of that project (edits to other rows made during the DELETE are dropped from the cache, though they are still saved by the queue).

## Red-proof
Shown in the worktree by a temporary mutation of the product code (reverted at once, no commits); each test went red when mutated and green when restored. On main after all merges: AC ledger `--block 02` 16/16 OK, REGRESSED=0; web Vitest 289/289.

| AC | Mutation | Result |
|---|---|---|
| AC-02.6 | `MemoRow = RowView` (no `memo`) in `editable-table.tsx` | 1 failed (`expected 1 to be +0`) |
| AC-02.4 | queue sends at once instead of the 400 ms debounce | 3 failed |
| AC-02.11 | no per-key serialisation (`s.running` chain removed) | 1 failed |
| AC-02.12 | on success write the server row without newer pending patches | 1 failed |
| AC-02.13 | rollback does not restore the confirmed row | 1 failed |
| AC-02.14 | `fetchProjectCache` without `overlayUnconfirmed` | 1 failed |
| AC-02.10 | row without `data-highlighted` | 1 failed |

Not red-proved by mutation: AC-02.1, 02.2, 02.3, 02.5, 02.7, 02.8, 02.9, 02.15, 02.16 (straightforward render/assert tests; the AC-02.9 e2e is run by the integrator).
