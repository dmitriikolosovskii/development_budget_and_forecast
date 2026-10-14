<!-- paths: apps/web/src/features/marketing/**, apps/web-e2e/src/marketing.spec.ts | Marketing tab: 8 channel sections, campaign phase, marketing share of contract price, channel mix, calendar -->
# Marketing tab (as-built, block 09)

## What it does
`/projects/:projectId/marketing/:section?` is the marketing plan and budget for selling the house, derived live from the one `ProjectSnapshot` cache (no API, schema, types or engine change):
- a SubNav of the 8 MARKETING lines (`navigation "Marketing channels"`; an overrun line shows an `Over` badge inside the button name);
- per section: channel notes and benchmarks (`channels.ts:7` `CHANNELS`, from GERMANY-DATA §6) and an editable table of SERVICE rows;
- `BudgetHealthPanel(MARKETING)` (`marketing-page.tsx:219`);
- below: the marketing share card, the channel-mix donut, and the campaign calendar.

Without `:section` the page redirects (`replace`) to `useUiStore.lastSection.marketing` or the first line (`marketing-page.tsx:84-100`); page component `marketing-page.tsx:80`.

## Key files — `apps/web/src/features/marketing/`
- `marketing-model.ts` (pure, "today" always passed in from `useToday()`):
  - `campaignPhase(start, end, today)` (`:12`): string compare on `YYYY-MM-DD`, inclusive; `NO_DATES` → `INVALID` (end < start) → `PLANNED` → `FINISHED` → `RUNNING`. Labels/tones in `PHASE_LABEL` (`:24`).
  - `marketingShare(forecastCents, contractPriceCents)` (`:47`): warn when `forecast·10000 > 500·contractPrice` as exact BigInt (`:57-58`), exactly 5 % is ok, contract price 0 → `neutral`; `bps` via engine `roundHalfUp` is for the label only. `SHARE_WARN_BPS = 500` (`:36`), `SHARE_BENCHMARK_BPS = 300` (`:38`).
  - `channelMix(lines, rollup.byLine)` (`:71`): forecast per line in line order, zero slices dropped, `bps` of the marketing total.
  - `marketingCalendar(rows, project, today)` (`:122`) + `addMonths` (`:93`): continuous months, window clamped to project start − 1 month … end + 1 month, rows with no/invalid dates left out, bars clipped at the edges.
- `marketing-overview.tsx`: `MIX_COLORS` (`:33`, 8 colours from 02's `CATEGORY_COLORS`/`CHART_COLORS`, no status colours), `MarketingShareCard` (`:53`, `aria-label="Marketing share"`, badge `Within 5%` / `Above 5%` / `No contract price yet`), `MarketingMix` (`:103`, recharts donut + accessible legend `ul[aria-label="Channel mix legend"]`), `MarketingCalendar` (`:188`, `role="table"` "Campaigns by month", today's month `aria-current="date"`).
- `marketing-columns.tsx`: `MARKETING_COLUMNS` (`:33`, module-level): Code · Activity · Qty+unit · Unit price · Planned (engine `itemPlannedCents`) · Committed · Actual · Status · Agency/vendor (`OrgCell` on `contractorId`, picker filtered to AGENCY via a spread constant `AGENCY_PICKER`, `:30`, `:123-125`) · Start · End · Campaign (`PhaseBadge`, `:17`).

## Invariants
- The share and the donut use the MARKETING **forecast (EAC)** (owner decision), the same figure as the KPI strip and the health panel, so they move together on an edit.
- `contractPrice` comes from `computeProfitability(summary.project, project.markupBps)` (`marketing-page.tsx:156`) over `useProjectSummary` (`:87`).
- All arithmetic is integer cents/bps; the threshold check is exact, the label rounds (5.001 % shows as 5.00 % but warns).
- Rows render through `useItemIds` / `useItem` / `useEditItem` (02); edits go through the autosave queue (`item:<id>`, 400 ms debounce).
- `?highlight=<itemId>` from Search works through 02's `EditableTable`.

## Tests
| AC | Where |
|---|---|
| 09.3, 09.4 + boundaries | `marketing-model.spec.ts` (16 tests: phase edges, exactly 5 % ok, 5.001 % warn, price 0 neutral, mix sums, calendar clamp) |
| 09.1–09.5 | `marketing-page.spec.tsx` (8 tests over the full ProjectPage → MarketingPage route, fake timers, mocked fetch) |
| e2e (untagged) | `apps/web-e2e/src/marketing.spec.ts` on a duplicate of `taucha-stadtvilla`: Paid search €2,700 → €3,600 moves the legend, one PATCH, survives reload; `SRV-VIS-001` "Running now", "Within 5%", agency modal "Paul Hartig" |

## Decisions / deviations
- No CR, no frozen files touched.
- `marketing-mix.tsx` and `marketing-share-badge.tsx` from the design were merged into one `marketing-overview.tsx`; the calendar model is the single `marketingCalendar()`.
- No Unit picker column (CONTRACTS §1 units have no months/days; `QtyCell` shows the unit).
- 05's Gantt and 06's donut are not reused (not exported); the calendar is its own CSS-grid timeline.
- The calendar marks today's month rather than drawing a vertical day line.

## Known gaps
- No add/delete row on this tab (BLOCK 09 does not ask for it); rows come from the seed or the wizard. The kit supports it (`useCreateItem`, `useDeleteItem`, codes `SRV-<PREFIX>-NNN`).
- Phase is date-only: a DONE row whose end date is in the future still shows "Running now" (the judge rejected status logic).
- Mobile: EditableTable falls back to cards; the calendar scrolls horizontally.
