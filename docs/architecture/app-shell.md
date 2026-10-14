<!-- paths: apps/web/src/app/**, apps/web/src/ui/**, apps/web/src/lib/**, apps/web/src/features/project/**, apps/web/src/features/projects-list/**, apps/web/src/features/organizations/**, apps/web/vite.config.mts | Web shell, routes, project snapshot cache, autosave queue, UI kit -->
# App shell, data layer and UI kit (block 02)

The web shell every tab plugs into: header + collapsible sidebar (mobile drawer), the route table from
CONTRACTS §7, the `ProjectPage` layout (header, KPI strip, tabs, `?org=` modal), the projects list, the
normalised project snapshot cache in TanStack Query, the optimistic autosave queue and the UI kit
(`EditableTable` + cells, cards, badges, modal/sheet, toasts, charts frame). Feature tabs only replace the
body of their `<X>Page` placeholder and consume these hooks; they never `fetch` themselves.

## Key files
- Routes: `apps/web/src/app/routes.tsx:17` (`AppRoutes`; `/projects/:projectId` layout with index redirect to `land` at :24).
- Shell: `apps/web/src/app/layout/app-shell.tsx:9` (`useAutosaveFlush`: flush on pathname change :17 and on `beforeunload` :20), `header.tsx:8` (hosts `GlobalSearch`), `sidebar.tsx:80` / `:111` (`Sidebar`, `MobileDrawer`), nav entries `apps/web/src/app/nav-config.ts:17`.
- Project layout: `apps/web/src/features/project/project-page.tsx:21` (KPI strip :69, tabs :71, `?org=` → `OrganizationModal` :75); tab list `tabs-config.ts:11` (Materials/Construction/Marketing remember their sub-section).
- Snapshot cache: `features/project/use-project-snapshot.ts:8` (`fetchProjectCache` = zod parse → `normalise` → `overlayUnconfirmed`), `:15` (`useProjectSnapshot`, `staleTime 30s`, no refetch on focus).
- Pure reducers: `features/project/project-cache.ts:29` (`normalise`), `:52` (`applyItemPatch`), `:69` `upsertItem`, `:81` `removeItem`, `:101` `replaceItem`, `:105` `applyLinePatch`, `:116` `applyProjectPatch`, `:120` `applyOrgPatch`, `:132` `cacheKey`, `:140` `overlayUnconfirmed`, `:158` `applyItemsPatch`; `update-project-cache.ts:10` (`updateProjectCache` for other blocks, e.g. 08/10).
- Selectors: `use-item.ts:7` (`useItem`), `use-item-ids.ts:8` (`useItemIds`), `use-budget-lines.ts:9`/`:21`, `use-project-summary.ts:11` (module-level `select` → `summarizeProject`), `use-schedule.ts:11` (`checkSchedule(items, useToday())`), `use-today.ts:2` (`__DEMO_TODAY__`).
- Edits: `autosave-edit.ts:28` (`autosaveEdit`: cancel → save confirmed row → optimistic write → enqueue), `:22` (`invalidateRollups` → `['projects']`, `['analytics']`); `use-edit-item.ts:10`, `use-edit-budget-line.ts:10`, `use-edit-project.ts:10`, `use-create-item.ts:38` (temp row `tmp-N`, replaced by the server row), `use-delete-item.ts:11`; `features/organizations/use-edit-organization.ts:10`.
- Queue: `apps/web/src/lib/autosave-queue.ts:74` (`enqueue` :75, `flush` :88, `has` :94, `unconfirmed` :100, `discard` :116, `__reset` :125); delay `AUTOSAVE_DELAY_MS = 400` at :3; failure → rollback + toast at :56-64.
- HTTP: `lib/api-client.ts:1` (`API_TIMEOUT_MS = 15_000`, `ApiError` :3, `keepalive` option); keys `lib/query-keys.ts:2`; client defaults `lib/query-client.ts:6`; UI state `lib/ui-store.ts:18` (persisted as `kairon-ui`: `sidebarCollapsed`, `lastSection`).
- UI kit barrel `apps/web/src/ui/index.ts`; `EditableTable` `ui/editable-table/editable-table.tsx:204` (memo rows :187, `?highlight` read at :191, `HIGHLIGHT_MS` :9); cells `ui/editable-table/cells.tsx` (`MoneyCell` :164 with "Enter an amount like 1,234.56" :155, blur flush :104, `OrgCell` :296, `scheduleLabel` :355, `ScheduleFlagCell` :386); `KpiStrip` `ui/kpi-strip.tsx:22`; `ChartCard`, `CHART_COLORS`, `CATEGORY_COLORS` `ui/chart-card.tsx:6-37`.
- Panels: `BudgetHealthPanel` `features/project/budget-health-panel.tsx:52`, `lineHref` :26 (category → tab/section URL); `OrganizationModal` `features/organizations/organization-modal.tsx:77`; list `features/projects-list/projects-list-page.tsx:57`.
- Build constants: `apps/web/vite.config.mts:8-28` (dev port 4274, preview 4300, `/api` proxy to 3454 on both, `define __DEMO_TODAY__`).

## Invariants
- Server data lives only in the TanStack cache `['project', id]`; zustand holds UI state only.
- One edit replaces one row object: `applyItemPatch` keeps every other row, line and id list by reference;
  `itemIdsByLineId` is rebuilt only when line/sortOrder/code change. Rows are `memo`, `useItem`/`useItemIds`
  return only `.data`, edit callbacks are `useCallback`-stable → editing one row re-renders one row.
- Autosave per key (`item:<id>`, …): patches merge, send 400 ms after the last change, saves for one key are
  serial, the latest `opts` win. Flush on cell blur, route change and `beforeunload` (`keepalive: true`).
- On success the server row is written back merged with any newer unconfirmed patch; on failure the
  server-confirmed row is restored, queued patches for that key are dropped, a `role="alert"` toast shows.
- Refetch never loses unconfirmed edits: `queryFn` re-applies `autosaveQueue.unconfirmedAll()`.
- Success invalidates `['projects']` and `['analytics']`, never `['project', id]`.
- "Today" is a build constant (`DEMO_TODAY`, default `2026-10-14`; `today` → build date), so demo
  statuses do not drift.
- URL segments go through `encodeURIComponent`; no `dangerouslySetInnerHTML`. `role="status"` is reserved for
  HealthBadge (Toast uses `alert`, Skeleton uses `aria-busy`).

## Decisions / deviations from CONTRACTS
- `EditableTable` takes `useRow(context, rowId)` + `context` (rules-of-hooks) and a table-level `footer`
  keyed by column id (totals inside columns re-rendered every row).
- `Tabs` take a `match` so a tab linking to a remembered sub-section stays active on sibling sections.
- `query-client.ts` sets `retry: 1` for queries (CONTRACTS is silent on retries).
- `OrgCell` imports `useOrganizations`/`useProjectSnapshot` from `features/` (same app, deliberate shortcut).
- Fake-timer specs must set `notifyManager.setScheduler((cb) => cb())` (TanStack notifies on a 0 ms timeout).

## Known gaps
- No header "project selector"; navigation goes through Current projects.
- Editing a temp row (`tmp-N`) before its POST returns sends a PATCH to the temp id → toast.
- A failed DELETE restores the whole pre-delete project cache (other rows edited meanwhile are still saved
  by the queue, but drop out of the cache until the next refetch).
