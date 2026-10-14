<!-- paths: libs/shared/budget-engine/**, libs/shared/types/** | money units, EAC, rollups, profitability, schedule, cash flow, portfolio -->
# Budget engine and shared types

`@default-project/budget-engine` is a pure TypeScript library (scope:shared, only dependency
`@default-project/types`) that turns a project's lines and rows into every number the app shows.
The API (list, analytics) and the web (KPI strip, tabs, Profitability) call the same functions, so a
number is computed one way everywhere. Built by block 01; `cashflow.ts` body by 06, `portfolio.ts`
body by 11, `addDays` by the integrator (CR-05).

## Units (CONTRACTS §1)
- Money: integer euro cents, net. Quantity: integer milli-units. Rates: basis points. Dates:
  `YYYY-MM-DD` strings, compared lexicographically.
- Zod caps: `MAX_INT_FIELD = 2_000_000_000` (Prisma Int is 32-bit), `centsSchema`, `qtyMilliSchema`,
  `bpsSchema` (`libs/shared/types/src/lib/money.ts:4`, `:9`, `:11`, `:13`); ids are
  `z.string().min(1)` (`money.ts:41`) because copies get `randomUUID()` ids.
- `CONTRACT_VERSION = 2` (`libs/shared/types/src/lib/version.ts:2`).
- Budget line catalogue: `BUDGET_CATALOG` (43 sections with code prefixes), `catalogSections`,
  `findCatalogSection` (`libs/shared/types/src/lib/catalog.ts:29`, `:86`, `:91`).

## Key files
| What | Where |
|---|---|
| Structural inputs `EngineItem`/`EngineLine`/`EngineSnapshot` (Prisma rows and JSON both fit) | `libs/shared/budget-engine/src/lib/engine-types.ts:7` |
| `roundHalfUp(num, den)` bigint, half away from zero, throws on den 0 or unsafe result | `money.ts:13` |
| `itemPlannedCents` = round(qtyMilli × unitPriceCents / 1000) | `money.ts:24` |
| `parseEurToCents` / `parseQtyToMilli` (string parsing, never float) | `money.ts:58`, `money.ts:63` |
| `itemForecastCents` (EAC by status) | `rollup.ts:24` |
| `itemOpenCommitment`, `itemExposure`, `toBps` | `rollup.ts:39`, `:46`, `:53` |
| `finalizeSummary` (variance, overrun, bps) | `rollup.ts:78` |
| `summarizeProject` → `{project, byCategory, byLine, overrunLines}` | `rollup.ts:93` |
| `computeProfitability(summary, markupBps)` | `profitability.ts:5` |
| `daysBetween`, `addDays` (CR-05), `checkSchedule` | `schedule.ts:16`, `:21`, `:70` |
| `monthlyCashflow(snapshot, today)` (block 06) | `cashflow.ts:39` |
| `summarizePortfolio`, `aggregatePortfolio`, `mergeCashflows`, `clipCashflow` (block 11) | `portfolio.ts:121`, `:76`, `:136`, `:184` |
| Formatters `formatEur`, `formatEurWhole`, `formatQty`, `formatBps`, `formatDate` | `format.ts:22`–`:44` |
| Test factories `makeProject`, `makeLine`, `makeItem`, `makeOrg`, `makeSnapshot` | `testing.ts:14`, `:33`, `:48`, `:80`, `:104` |
| Zod `Summary`, `Profitability`, `CashflowMonth` | `libs/shared/types/src/lib/budget-summary.ts:6`, `:59`, `:103` |
| `ProjectSnapshot`, `ProjectListItem`; `PortfolioAnalytics` | `types/src/lib/snapshot.ts:16`, `:36`; `analytics.ts:39` |

## Formulas
- EAC per row (`rollup.ts:26`): `DONE` → actual; `CONTRACTED` → max(actual, committed);
  `PLANNED`/`PARTIAL` → max(actual, committed + max(planned − committed, 0)).
- openCommitment = max(committed − actual, 0); exposure = actual + openCommitment.
- Rollup line → category → project is a plain sum of rounded row values; totals are never rounded
  again. `approved` comes only from `BudgetLine.approvedCents`. Rows whose line is missing are skipped
  (`rollup.ts:100`). `overrunLines` sort: overrun desc, then name, then id (`rollup.ts:143`).
- Bps: `toBps(x, base)` = round(x·10000/base), 0 when base is 0.
- Profitability (`profitability.ts:10`): contractPrice = round(approved·(10000+markup)/10000);
  plannedProfit = contractPrice − approved; forecastProfit = contractPrice − forecast (may be
  negative); marginBps = 0 when contractPrice is 0; profitErosion = plannedProfit − forecastProfit.
- Schedule (`schedule.ts:36`): MATERIAL statuses in order DELIVERED → UNSCHEDULED → LATE_FOR_WORK →
  OVERDUE → AT_RISK (0 < slack < 3, `:61`) → ON_TIME; `needBy` = start of the linked WORK row only.
  WORK: `end < start` → INVALID_DATES with `blockingMaterials: []` (`:92`); any LATE_FOR_WORK
  material → BLOCKED with worst delay; else READY. SERVICE rows are absent. `today` is a parameter.
- Cash flow (`cashflow.ts:18`, `:64`): MATERIAL → month of `deliveryDate` (fallback
  `deliveredDate`); WORK/SERVICE → even split over `[start ?? end, end ?? start]` inclusive,
  `end < start` → start month; the cent remainder goes to the first month (10000/3 → 3334, 3333,
  3333). Actual → month of `deliveredDate ?? endDate ?? startDate ?? today`. No plan date →
  `unscheduled`. Months are continuous between the first and last month that received a non-zero
  amount; months are computed by string arithmetic, no `Date`.
- Portfolio (`portfolio.ts:60`): totals and byCategory are summed Summaries re-finalized; profitability
  is the sum of per-project fields with `marginBps = toBps(Σ forecastProfit, Σ contractPrice)`
  (projects have different markups, CR-11). `summarizePortfolioExtended` (`:94`) adds `startDate`,
  `endDate`, `overrunLineCount`. The API (`apps/api/src/analytics/analytics.service.ts`) adds each
  project's `monthlyCashflow` and merges them with `mergeCashflows`; the web filters re-aggregate
  with `aggregatePortfolio`.

## Invariants
- No float arithmetic on money: bigint only inside `roundHalfUp`; sums are numbers checked with
  `Number.isSafeInteger` (`rollup.ts:80`). `BigInt(1000)` is used instead of `1000n` (target es2015).
- Σ line = category, Σ category = project for every amount field (a 500-row property test in
  `rollup.spec.ts`); Σ months + unscheduled = Σ rows for planned and forecast (`cashflow.spec.ts`).
- The engine never reads the clock; callers pass `today` (web: `useToday()` → `__DEMO_TODAY__`).
- `planned` is never stored; it is always derived from qty × price.

## Decisions and deviations from CONTRACTS
- Engine takes structural `Pick<>` inputs instead of full zod types, so the API passes Prisma rows
  without mapping (01 DESIGN).
- Ties in `overrunLines` are broken by name, then id (not specified in CONTRACTS).
- Cash flow assumptions beyond the contract: MATERIAL falls back to `deliveredDate`; one-date WORK
  goes to that month; `end < start` goes to the start month; `today` does not extend the month range.
- `addDays` was added after the freeze (CR-05); Construction's date-shift uses it
  (`apps/web/src/features/construction/construction-model.ts:82`).
- `parseEurToCents` trims, accepts a leading `€`, and rejects negatives and more than 2 decimals.

## Known gaps
- No currency other than EUR; no VAT handling (all amounts net).
- `checkSchedule` only links MATERIAL → WORK; a MATERIAL linked to a non-WORK row gets no `needBy`.
- Number totals are safe up to 2^53 cents; a single DB field is capped at 2·10^9 cents (€20M).
