<!-- paths: apps/web/src/features/project/**, apps/web/src/lib/autosave-queue.ts, apps/web-e2e/src/cfo-journey.spec.ts, howItWorks/bin/** | how one edit propagates across tabs; CFO journey; parallel delivery -->
# Integration flow

How the blocks fit together at run time (one cost edit, end to end), the e2e test that proves it,
and how the 13 blocks were delivered in parallel.

## One cost edit, end to end
There is exactly **one** client-side source of truth per project: the TanStack Query entry
`['project', id]` holding a `ProjectCache` (the `GET /api/projects/:id` snapshot plus indices).
Nothing derived (planned, forecast, variance, profit, schedule status) is stored; every view
recomputes it from that cache with the pure `@default-project/budget-engine`.

1. **Edit.** A cell commits (Enter or blur) and calls `useEditItem(projectId)(itemId, patch)`
   (`apps/web/src/features/project/use-edit-item.ts:10`).
2. **Optimistic write.** `autosaveEdit` (`features/project/autosave-edit.ts:28`) cancels in-flight
   fetches of the project query (:29), remembers the last confirmed row for rollback (:32), then
   `setQueryData` applies the patch through `applyItemPatch`
   (`features/project/project-cache.ts:52`). Only that row object is replaced; other rows, lines
   and id lists keep their identity, so only the edited `React.memo` row re-renders.
3. **Recompute.** Every consumer re-derives from the new cache version:
   - KPI strip: `useProjectSummary` (`features/project/use-project-summary.ts:8`, a module-level
     `select` over `summarizeProject`, `libs/shared/budget-engine/src/lib/rollup.ts:93`) feeds
     `<KpiStrip>` in the project layout (`features/project/project-page.tsx:69`).
   - Row forecast (EAC) by status: `itemForecastCents` (`rollup.ts:24`).
   - Tabs (Materials, Construction, Marketing, Land costs) use the same `useProjectSummary`.
   - Profitability: `useProfitability` (`features/profitability/use-profitability.ts:14`) memoises
     `summarizeProject` → `computeProfitability` and `monthlyCashflow`, so its EAC is the header's EAC.
   - Schedule badges: `useSchedule` (`features/project/use-schedule.ts:11`).
4. **Save queue.** `autosaveQueue.enqueue('item:<id>', patch)` (`apps/web/src/lib/autosave-queue.ts:75`)
   merges patches per key and sends them 400 ms after the last change (:3, :84). Saves for one key
   run strictly in sequence (:41). `flush()` (:88) runs on cell blur
   (`apps/web/src/ui/editable-table/cells.tsx:104`), on route change and on `beforeunload`
   (`apps/web/src/app/layout/app-shell.tsx:9-23`); PATCHes use `keepalive` so they outlive the page.
5. **Server persistence.** `PATCH /api/projects/:projectId/items/:itemId` →
   `CostItemsService.update` (`apps/api/src/cost-items/cost-items.service.ts:42`): the row must
   belong to the project (404), references are validated in-project (400, :72), then a plain
   `prisma.costItem.update`. The global `ValidationPipe({whitelist, transform})`
   (`apps/api/src/main.ts:14`) enforces the int/limit DTO rules.
6. **Confirm or roll back.** On success the server row is written back merged with any newer
   unconfirmed patch (`autosave-edit.ts:36-41`), then `['projects']` and `['analytics']` are
   invalidated (:22) so the list and portfolio refetch when next shown. On failure the confirmed
   row is restored (:44-47) and a toast is shown (`autosave-queue.ts:64`).
7. **Refetch safety.** Any refetch of the snapshot re-applies unconfirmed patches on top of the
   server data (`use-project-snapshot.ts:11`, `overlayUnconfirmed` in `project-cache.ts:140`), so
   a stale GET can never erase an edit that is still queued.

Project fields follow the same path: the Profitability markup editor calls `useEditProject`
(`features/profitability/profitability-page.tsx:49`, `features/project/use-edit-project.ts:10`)
with queue key `project:<id>`; contract price, profit and margin recompute instantly.

### Invariants
- Money stays in integer cents end to end; the engine rounds rows once and never re-rounds totals.
- One engine, one cache: the KPI strip, every tab and Profitability show identical numbers.
- Unconfirmed edits win over server data until their save settles.
- `today` comes from `useToday()` (build constant `__DEMO_TODAY__`, default `2026-10-14`).

## The CFO journey e2e — `apps/web-e2e/src/cfo-journey.spec.ts` [AC-00.2]
One test, one `test.step` per step of `howItWorks/SUMMARY.md` §3, on a copy made with
`POST /api/projects/:id/duplicate` of `taucha-stadtvilla` (:9-17); the demo is never modified.
Numbers are compared before/after rather than hard-coded.
1. Projects list shows the demo; open the copy (:44).
2. KPI strip shows Budget / Spent / Open commitments / Forecast (EAC) / Variance and the
   "N lines over budget" count (:51).
3. Edit MAT-ELE-001 (NYM-J cable, PARTIAL in the seed) to 900 m: section total and header EAC
   change **before** the PATCH resolves (optimistic), and survive a reload (:60-85).
4. Construction flags MAT-WIN-001 late by 9 days; "Open material" deep-links with `?highlight=`;
   moving the delivery to 2026-10-18 turns WRK-WIN-001 Ready (:87-105).
5. A supplier name opens the organisation modal with `tel:` / `mailto:` links (:107).
6. Profitability hero EAC equals the header EAC; markup 15 % → 12 % lowers price and profit and
   persists across a reload (:120-149).
Waits are `waitForResponse` on the PATCH and `expect.poll`; no `waitForTimeout`.

## Parallel delivery (how the code got here)
- Each block NN was built in its own git worktree `Kairon-wt/NN-*` on `feat/NN-*`, against the
  frozen contracts (`howItWorks/shared/CONTRACTS.md`, tag `w0-frozen`); file ownership per block
  is CONTRACTS §7. Process: `howItWorks/PARALLEL-RUN.md`, protocol: `howItWorks/shared/PROTOCOL.md`.
- `howItWorks/bin/merge-block.sh` is self-service: merge main into the branch, run `check.sh`, and
  under a git lock merge `--no-ff` into main (up to 5 attempts if main moves; refuses a dirty main
  and records status `main-dirty`).
- Changes to frozen files go through change requests (`howItWorks/shared/change-requests/`),
  applied by the integrator (block 00, worktree `Kairon-wt/00-integrator`):
  CR-05 `addDays` in the engine schedule, CR-11 portfolio extension (`?today=`, optional per-project
  fields, summed profitability, `CONTRACT_VERSION` 2), CR-12 wizard template route and
  block-private query keys (docs only).
- `howItWorks/bin/integrator-watch.sh` runs in the background and wakes the integrator only on
  events (`MERGED`, `FLAG w0-frozen|main.broken`, `STATUS conflict|check-failed|main-dirty`, `CR`,
  `DIRTY`); `--once` / `--ack` keep events from being lost. Design: `howItWorks/00-integrator/DESIGN.md`.

## Known gaps
- Rollups shown outside the project (`['projects']`, `['analytics']`) refresh only after a save
  succeeds, not optimistically.
- `CostItemsService.update` is last-write-wins; there is no version check for two browsers
  editing the same row.
