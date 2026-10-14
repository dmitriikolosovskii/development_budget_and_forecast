# DESIGN — 09 "Marketing" tab (2026-10-14)

Status: approved by the judge (approach A), risk **low–medium**. Owner's answer: the marketing share uses the **forecast (EAC)**.

## Goal
`/projects/:id/marketing/:section?` is the marketing plan and budget for selling the house. It has:
- a SubNav of the 8 MARKETING sections, each with a channel description and benchmarks;
- an editable table of SERVICE rows;
- a campaign calendar;
- a channel-mix donut;
- the marketing share of the contract price (ok when ≤ 5 %, warn when > 5 %);
- `BudgetHealthPanel(MARKETING)`.

All of it is derived live from the shared snapshot cache.

## Non-goals
No new API, schema, types or engine functions. No editing of the line catalogue. No reuse of 05's Gantt or 06's donut: neither is exported, and the merge order is undefined. No status-driven phase: "DONE means Finished" is not in BLOCK.md. No e2e runs (the integrator runs them).

## Chosen approach (A) and why not the others
Pure logic goes in `marketing-model.ts`, tested at its boundaries. Components stay thin over the 02 kit.
- **B (inline computations in components):** rejected. The threshold rules couldn't be tested in isolation, and 06 sets the rule "derive, store nothing".
- **C (a 9th "Overview" sub-nav item):** rejected. It breaks AC-09.1 ("8 sections") and the 1:1 match between a section and a BudgetLine. The overview (share, donut, calendar) is always visible above the section content.

## Files (all owned by 09: `apps/web/src/features/marketing/*`)
| File | Content |
|---|---|
| `marketing-model.ts` | `campaignPhase`, `marketingShare`, `channelMix`, `calendarRange` / `calendarBars` (pure) |
| `channels.ts` | 8 entries `{section, blurb, benchmarks[]}` in English, from GERMANY-DATA §6 |
| `marketing-columns.tsx` | EditableTable column config (memoized at module level or with `useMemo`) |
| `marketing-calendar.tsx` | Its own CSS-grid timeline: months × campaigns, a "Today" line |
| `marketing-mix.tsx` | Recharts donut in `ChartCard` plus an accessible legend list (section, € forecast, %) |
| `marketing-share-badge.tsx` | `Badge` tone ok, warn or neutral, with "Marketing x.x % of contract price · benchmark ~3 %" |
| `marketing-page.tsx` | `MarketingPage` (replaces 02's placeholder body) |
| `*.spec.ts(x)` | Vitest |
| `apps/web-e2e/src/marketing.spec.ts` | Untagged journey on a duplicated project |

## Judge constraints (mandatory)
1. **Files.** Only `features/marketing/**` and `marketing.spec.ts`.
2. **Kit and tokens only.** Use the 02 kit and the design tokens: no raw hex, no own fetch or state.
3. **Donut palette.** Use 02's exported chart palette if 02 provides one. Otherwise use the token CSS variables (`var(--color-brand-500)`, `brand-600`, `info-600`, `brand-100`, …), never the ok, warn or risk status colours, and add `// TODO CR-02 categorical palette`.
4. **`marketing-model.ts` is pure.** "Today" always comes from `useToday()` and is passed in as an argument.
5. **`campaignPhase(start, end, today)`** compares `YYYY-MM-DD` strings (no `Date`):
   - empty or null start/end → `NO_DATES` ("No dates", muted)
   - end < start → `INVALID` ("Invalid dates", risk)
   - start ≤ today ≤ end → `RUNNING` ("Running now", info)
   - today < start → `PLANNED` ("Planned", muted/brand)
   - today > end → `FINISHED` ("Finished", ok)
6. **`marketingShare(forecastCents, contractPriceCents)`** works on integers only.
   - Warn when `BigInt(forecast)*10000n > 500n*BigInt(contractPrice)`. Exactly 5 % is ok.
   - `contractPrice = 0` → tone `neutral`.
   - `bps` is computed with the engine's `roundHalfUp`, for the label only.
   - `contractPrice` comes from `computeProfitability(summary.project, project.markupBps)`.
7. **The share and the donut use the MARKETING forecast (EAC).** This is the same figure as the KPI and BudgetHealthPanel, so they move together. Slices with value 0 are dropped. An accessible legend sits next to the chart.
8. **Calendar range.**
   - The range is clamped to the project's `startDate − 1 month … endDate + 1 month`.
   - `NO_DATES` and `INVALID` rows are not drawn.
   - Bars that go past the edge are clipped.
   - With no rows it shows an EmptyState.
9. **Re-renders.**
   - The table uses `useItemIds` / `useItem` / `useEditItem`.
   - The overview uses one memoized selector over the MARKETING rows.
   - Columns are memoized.
   - `lastSection.marketing` is used as 02 types it.
10. **Tests.** Every title follows `should X when Y [AC-09.N]`. The e2e spec carries no tags. No `.skip` or `.only`.

## Affected neighbours
- **06 and 11:** they pick up MARKETING automatically through the engine. Nothing changes for them.
- **13 search:** `?highlight=` is handled by EditableTable.
- **02:** we depend on its hook and component paths. Check them against 02's HANDOFF after `w0-frozen`.

## Risks
| Risk | Mitigation |
|---|---|
| The 02 API differs from the contract (names, paths, `useProjectSummary` shape) | Read 02's HANDOFF before coding. If something is missing, use a local adapter `// TODO CR-NN` |
| recharts draws nothing in jsdom | Assert on the legend from `channelMix`; stub `ResizeObserver` in the spec |
| Boundary arithmetic | Integer comparison and boundary tests |
| AC-09.2 on a CONTRACTED row doesn't move the forecast | The fixture row is PLANNED |

## Test strategy
- **`marketing-model.spec.ts` (AC-09.3, AC-09.4 plus boundaries):**
  - phase: start == today, end == today, today = start − 1, today = end + 1, null, `''`, end < start;
  - share: exactly 5 % (50 000 / 1 000 000) ok; 50 001 / 1 000 000 (5.001 %, rounds to 500 bps) **warn**, because the integer check is exact and the label is not; price 0 neutral;
  - `channelMix` drops zero slices and sums to the category forecast;
  - calendar clamp.
- **`marketing-page.spec.tsx` (fixture `makeSnapshot` with 8 MARKETING lines and SERVICE rows, `makeOrg` AGENCY, mocked fetch, fake timers):**
  - AC-09.1: 8 SubNav items. An edit in `listings`, then switching to `paid-search` and back keeps the value, and exactly one PATCH goes out after 400 ms.
  - AC-09.2: changing the unit price of a PLANNED `paid-search` row immediately changes the legend value, the MARKETING total in the panel and the KPI.
  - AC-09.3 (render): the "Running now" badge appears for a row whose dates span today.
  - AC-09.4 (render): warn and ok badge for two fixtures with different markup.
  - AC-09.5: clicking the agency cell opens a dialog with the organisation's name.

## How to verify
`bash howItWorks/bin/check.sh 09` → `CHECK: PASS`. `bash howItWorks/bin/ac-ledger.sh --block 09 --root $WT` shows AC-09.1–5 as OK.

## Open questions
None. The share basis was answered by the owner: forecast.

## As built (2026-10-14, commits f1522c3 and d239b54 on feat/09-marketing)
Implemented as designed. Where the code differs from the table above:

- **Files.**
  - `marketing-mix.tsx` and `marketing-share-badge.tsx` were merged into one `marketing-overview.tsx`: `MarketingShareCard`, `MarketingMix`, `MarketingCalendar`, `MIX_COLORS`.
  - The calendar model is the single function `marketingCalendar()` (plus `addMonths`).
- **Palette.** 02 exports `CHART_COLORS` and `CATEGORY_COLORS`, so `MIX_COLORS` uses 8 of them (no overrun red, no profit green). No CR was needed.
- **Columns.** There is no Unit picker. CONTRACTS §1 units have no months or days, and `QtyCell` already shows the unit.
- **OrgCell.** Its `role` filter is passed as a spread constant, because jsx-a11y mistakes it for an ARIA role.
- **Sub-nav badges.** Overrun lines show an `Over` badge in the sub-nav. It is part of the button's accessible name, so tests match the name by prefix.
- **Layout.**
  - Top: SubNav | channel notes + table | BudgetHealthPanel(MARKETING).
  - Below: share card + channel mix, then the calendar.
- **Tests.** `marketing-model.spec.ts` has 16 tests and `marketing-page.spec.tsx` has 8. AC-09.1–5 are all OK in the ledger. Mutation red-proof was done for AC-09.3 and AC-09.4.
