# HANDOFF — 09-marketing

Filled in by the block session (main-tree path). Neighbours read it before using your work.

## Status
done. `check.sh 09` → **CHECK: PASS**: ownership, format, affected lint/test/typecheck/build (web 75/75 tests) and test-weakening all exit 0. `ac-ledger.sh --block 09` → **5/5 OK**. Branch `feat/09-marketing`, commits `f1522c3` (feature) and `d239b54` (format/lint). **Merged into main: `afdb52d`** (11:53, merge-block.sh run again by the integrator after main was cleaned; check.sh green in the merge). e2e: the only full run so far (`docs/test-runs/2026-10-14-120224-e2e.md`) was before `03.merged` and failed for every block, including both `marketing.spec.ts` tests. Since the seed landed (`c525ef9`) `marketing.spec.ts` **has not been re-run**. It is untagged, so the ledger doesn't track it.

## Ready for neighbours (exports / components / endpoints, with examples)
All paths are under `apps/web/src/features/marketing/`. There is no API, schema, types or engine change.

| File | What it gives you |
|---|---|
| `marketing-page.tsx` | `MarketingPage` for `/projects/:id/marketing/:section?` |
| `marketing-model.ts` | Pure rules, safe to import |
| `marketing-overview.tsx` | Overview components and the `MIX_COLORS` palette |
| `marketing-columns.tsx` | Table columns and the phase badge |
| `channels.ts` | Channel notes |

### `marketing-page.tsx`
- `MarketingPage`, at `/projects/:id/marketing/:section?`.
- Without `:section` it redirects (replace) to `useUiStore.lastSection.marketing`, or to the first line.
- It stores the open section in `lastSection.marketing`.

### `marketing-model.ts`
- `campaignPhase(start, end, today)` returns `RUNNING | PLANNED | FINISHED | NO_DATES | INVALID`.
  - It compares `YYYY-MM-DD` strings; start and end are inclusive.
  - `PHASE_LABEL` gives the label and Badge tone for each phase: "Running now", "Planned", "Finished", "No dates", "Invalid dates".
- `marketingShare(forecastCents, contractPriceCents)` returns `{bps, tone: 'ok'|'warn'|'neutral'}`.
  - Warn when `forecast·10000 > 500·contractPrice`, compared as exact BigInt.
  - Exactly 5 % is ok.
  - A contract price of 0 gives `neutral`.
  - `bps` is `roundHalfUp` and is used for the label only.
- `channelMix(lines, rollup.byLine)` returns `MixSlice[]`: the forecast per line in line order, without zero slices, plus `bps` of the marketing total.
- `marketingCalendar(rows, project, today)` returns `{months: 'YYYY-MM'[], bars}`.
  - Months are continuous.
  - The window is clamped to the project's start − 1 month … end + 1 month.
  - Rows with no dates or invalid dates are left out.
- `addMonths('YYYY-MM', n)`.
- `SHARE_WARN_BPS = 500`, `SHARE_BENCHMARK_BPS = 300`.

### `marketing-overview.tsx`
- `MarketingShareCard({share, forecast, contractPrice})`.
- `MarketingMix({slices, colorBySection})`: a recharts donut plus an accessible legend, `ul[aria-label="Channel mix legend"]` with one `li[aria-label=<line name>]` per slice.
- `MarketingCalendar({calendar, today, colorBySection})`: `role="table"` with `aria-label="Campaigns by month"`; today's month is marked `aria-current="date"`.
- `MIX_COLORS`: 8 colours taken from 02's `CHART_COLORS`/`CATEGORY_COLORS`, excluding the status colours.

### `marketing-columns.tsx`
- `MARKETING_COLUMNS`: a module-level `Column<CostItem>[]`.
  - Columns: Code · Activity · Qty+unit · Unit price · Planned (engine `itemPlannedCents`) · Committed · Actual · Status · Agency/vendor (`OrgCell` on `contractorId`, picker filtered to role AGENCY) · Start · End · Campaign (phase badge).
- `PhaseBadge({start, end})` uses `useToday()`.

### `channels.ts`
`CHANNELS[section] = {blurb, benchmarks[]}` (from GERMANY-DATA §6) and `MARKETING_BENCHMARK_NOTE`.

### Accessible names, for e2e and search (13)
| Element | Accessible name |
|---|---|
| Sub-nav | `navigation "Marketing channels"`; buttons are named by the line name, plus "Over" when the line is over budget |
| Cell edit buttons | `Edit Unit price SRV-SEA-001`, `Edit Qty …`, `Edit Committed …`, `Edit Actual …`, `Edit Activity …`, `Edit Start …`, `Edit End …` |
| Share card | `aria-label="Marketing share"`; its badge reads `Within 5%` / `Above 5%` / `No contract price yet` |
| Highlighted row | `?highlight=<itemId>` works through EditableTable (02) |

## How to check
- From `$WT`:
  - `bash $BIN/check.sh 09` → `CHECK: PASS`
  - `bash $BIN/ac-ledger.sh --block 09 --root $WT` → `OK=5`
- Unit specs: `marketing-model.spec.ts` (16 tests, boundaries) and `marketing-page.spec.tsx` (8 tests, the full ProjectPage → MarketingPage route with fake timers).
- **Red-proof:** two mutations each turned a test red, then the file was restored:
  - `>` → `>=` in the share rule fails AC-09.4 "exactly 5 %";
  - `today > end` → `>=` fails AC-09.3 "end day is running".
- **e2e for the integrator:** `apps/web-e2e/src/marketing.spec.ts`. It is untagged because block 09 has no e2e AC, and it runs on a copy of `taucha-stadtvilla` made with `POST /duplicate`. It has two tests:
  1. Paid search goes from €2,700 to €3,600: the legend moves, one PATCH is sent, and the value survives a reload.
  2. Visuals: `SRV-VIS-001` shows "Running now" on 2026-10-14, the share shows "Within 5%", the calendar is visible, and the Nordlicht agency opens a modal with "Paul Hartig".

  I wrote it against the seed from block 03 but **have not run it** (only the integrator runs e2e).

## Gaps, CRs, deviations from CONTRACTS
- **No CRs.** No frozen files were touched.
- **No add or delete row on this tab.** BLOCK 09 doesn't ask for it, so rows come from the seed or the wizard. The kit already supports it (`useCreateItem`, `useDeleteItem`), with codes `SRV-<PREFIX>-NNN`.
- **Phase is decided by dates only, as BLOCK says.** A DONE row whose end date is in the future still shows "Running now". The judge rejected adding status logic because the requirement doesn't ask for it.
- **The calendar marks today's month** (`aria-current="date"`) rather than drawing a vertical day line.
- **Mobile:** EditableTable cards (02); the calendar scrolls horizontally.
- **Visual check not done.** Blocks don't run serve; the integrator's e2e covers it.
