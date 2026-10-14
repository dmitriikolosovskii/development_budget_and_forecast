# SOLUTION — Development Budget & Cost Forecast

A CFO tool for a German house builder. For every project, and across the portfolio, it answers five questions:

- What is the budget?
- What has actually been spent?
- What is already committed?
- What will the project probably cost in the end (EAC)?
- Which cost lines are going over budget?

The demo project is "Stadtvilla Taucha — Family of 4" near Leipzig. Every number is recalculated live in every tab.

## 1. What was done

All 13 planned blocks are merged into `main`. Each block has a `merge: <block>` commit (`git log --merges --oneline`). Block 00 integrated CRs and specs several times.

| Block                 | What the user gets                                                                                                                                                                                                                                        |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 Foundation         | Prisma schema and migration, shared zod types, a pure money engine `@default-project/budget-engine` (rounding, EAC by status, rollup, profitability, schedule checks), CRUD API, `POST /projects/:id/duplicate`                                           |
| 02 App shell          | Header with KPI strip ("N lines over budget"), collapsible sidebar / mobile drawer, routes and tabs, UI kit (EditableTable, modal, toast, charts), one snapshot cache with optimistic edits and a 400 ms save queue                                       |
| 03 Seed               | The Taucha demo (43 lines, 187 items, 14 organisations, 7 deliveries) with deliberate overruns (concrete, electrical, earthworks) and schedule conflicts (windows +9 d, heat pump +18 d), two more projects and a wizard template. The seed is idempotent |
| 04 Building materials | Sections sub-nav with overrun and late badges; an editable table (qty, price, committed, actual, supplier, installer, dates); organisation modal; the rightmost Schedule column flags late materials                                                      |
| 05 Construction       | Works per section, Gantt with material diamonds, alert "Windows arrive … 9 days after installation start", "Shift work start" keeping the duration, contingency usage                                                                                     |
| 06 Profitability      | Editable markup (15 % default), contract price, forecast profit, margin, waterfall, category and cash-flow charts. Everything is recalculated on any edit                                                                                                 |
| 07 Land               | Municipality, plot, soil, utilities (water, sewer, power, gas, telecom…) with costs. Site diagram = 08's SitePlan                                                                                                                                         |
| 08 Architecture       | Floor plan (SVG rooms) on the plot, house sections, editable materials takeoff (BOQ). Changing a BOQ quantity updates the linked cost rows in one transaction                                                                                             |
| 09 Marketing          | Marketing sub-sections for a German homebuilder, with a campaign calendar                                                                                                                                                                                 |
| 10 Delivery tracking  | CSV import of deliveries (partial, idempotent, bad rows listed with their row number) → actuals and delivery dates                                                                                                                                        |
| 11 Analytics          | Portfolio KPIs and charts across projects, period filter by year, delivery KPIs                                                                                                                                                                           |
| 12 Calculate project  | A wizard that creates a full project from the template, scaled by living area, with an exact budget split                                                                                                                                                 |
| 13 Search             | Global search (projects, lines, items, organisations), case- and umlaut-insensitive, jumps to the highlighted row                                                                                                                                         |

Verification (main tree, exit codes):

| Command                                                      | Result                                                                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `npx nx run-many -t lint test typecheck build`               | exit 0: 5 projects (api, web, web-e2e, types, budget-engine)                                           |
| `bash howItWorks/bin/e2e.sh` (Playwright, all specs)         | exit 0: 20 passed; AC ledger OK=138, UNCOVERED=0, FAILED=0 (`docs/test-runs/2026-10-14-122531-e2e.md`) |
| `bash howItWorks/bin/ac-ledger.sh --block 00 --e2e-report …` | exit 0: AC-00.2 OK (CFO journey)                                                                       |
| `npx prisma db seed` twice → identical row counts            | 0 / 0, identical (AC-03.5)                                                                             |

The demo journey `apps/web-e2e/src/cfo-journey.spec.ts` [AC-00.2] walks through these steps:

1. Current projects.
2. The KPI strip.
3. Edit the NYM-J cable quantity. The row, the section, the KPIs and Profitability update immediately, and the value survives a reload.
4. Late windows on Construction. Moving the delivery earlier clears the alert.
5. The supplier modal.
6. Profitability uses the same EAC as the header. Markup 15 % → 12 % lowers the price and the profit.

## 2. Assumptions

- **All amounts are net** (excl. 19 % VAT). In practice a developer building for sale cannot reclaim construction VAT, so a VAT toggle would be the next step.
- **Money** is stored as integer euro cents (`Int`), quantities as integer milli-units and rates as basis points.
  - Rounding is half-up away from zero, in exactly two places: row amount = qty × price, and the markup.
  - Totals are sums and are never rounded again.
  - Input like `"1,234.56"` is parsed from the string, never via float.
- **Int limit:** every money or quantity field is ≤ 2,000,000,000 (Prisma `Int` is 32-bit, about €20 M per field). The engine multiplies through BigInt with a safe-integer check.
- **Forecast (EAC) per row by status:**
  - DONE = actual;
  - CONTRACTED = max(actual, committed);
  - PLANNED/PARTIAL = max(actual, committed + uncontracted remainder).

  A line is over budget only when forecast > approved; equal is not over.

- **Markup** applies to the whole approved budget, land included: `contractPrice = roundHalfUp(approved × (1 + bps/10000))`, profit = price − EAC, and the margin is 0 when the price is 0. Portfolio margin = Σ profit / Σ contract price, because projects have different markups.
- **"Today"** for schedules and analytics is `2026-10-14` in the demo (`DEMO_TODAY`, or `?today=` on the analytics API).
- **Delivery CSV import** is partial: valid rows are applied in one transaction and idempotently (upsert by item + delivery note). DELIVERED invoices replace a manually entered actual. The row cap is 500.
- **Cash flow:** works are spread evenly over their months, with the remainder cent going to the first month. Materials fall into their delivery month. Rows without dates are shown as "unscheduled".
- **Wizard:** only continuous units (m³, m², m, t, kg, h) are scaled by the area factor; counted items stay as they are (one heat pump is one heat pump).
- **Concurrent edits:** last write wins.

## 3. Decisions

- **Stack deviation (owner's decision):** the Kairon Nx workspace (NestJS 11 + Prisma/SQLite + React 19/Vite + Tailwind) instead of the Next.js + Postgres skeleton, because the workspace, tests and tooling were ready. Postgres would need a fresh initial migration.
- **One pure engine** in `libs/shared/budget-engine` (scope:shared). The API and the web app compute identical numbers, and money logic is unit-tested in one place.
- **One snapshot per project** (`GET /api/projects/:id`) in TanStack Query.
  - An edit is an optimistic `setQueryData` on one row plus a coalescing save queue: 400 ms, flushed on blur, unmount, route change and beforeunload.
  - A failed save rolls back and shows a toast.
  - Every tab and the header derive from the same cache, so one edit updates everything without a refetch.
- **Parallel delivery:**
  - 13 Claude Code sessions, one git worktree and branch each, against frozen contracts (`howItWorks/shared/CONTRACTS.md`).
  - Each block merges itself (`--no-ff`) through `howItWorks/bin/merge-block.sh`: merge order, a check gate, and a lock on main.
  - Contract changes go through change requests (CR-05, CR-11, CR-12), applied by the integrator session. History is kept as is: no squash, no force.
- **Demo data decision:** the NYM-J cable is PARTIAL (1,000 of 1,300 m bought), so the demo quantity edit visibly moves the forecast.

## 4. Out of scope

Auth, multi-currency, multi-tenancy, bank integrations, deploy, audit log, approval workflow, a VAT toggle, real-time collaboration, a real CAD drawing (the floor plan is SVG rectangles), and a cascading re-plan of later works after a shift.

## 5. Limitations

- **SQLite search:** Prisma `contains` on SQLite is case-insensitive for ASCII only and does not fold diacritics. So search loads the candidate rows and matches in JS with a case- and umlaut-folding function (`warmepumpe` finds "Wärmepumpe"). There is no transliteration (`muehlberg` ≠ "Mühlberg"). Every candidate row is loaded per query, which is fine up to a few thousand rows.
- **Last write wins,** with no conflict detection. Editing a freshly added row before its POST returns fails with a toast.
- **Re-seeding never deletes:** rows added by users or by CSV imports survive a re-seed. For a clean demo, seed a fresh database.
- **e2e runs duplicate the demo project** (`POST /duplicate`), and the copies show up in lists and search.
- **Analytics** filters by year only. There is no date-range period and no drill-down from the heatmap.
- **Wizard:** no server-side idempotency (a double click is blocked only in the UI), no cost multipliers for house options, and no bungalow plan.
- **The CSV import** is capped at 500 rows by Express's default 100 kB JSON body limit.
- **Found by the final browser pass, not fixed** (`docs/test-runs/2026-10-14-123000-explore.md`):
  - A few rows at the per-field maximum (qty 2,000,000 × €20,000,000) can push a project total out of the safe-integer range; the engine throws, and the project list and analytics return 500 for every project. A write that would overflow should be rejected with 400.
  - The Land area field reads a decimal comma as a thousands separator (`600,5` → 6,005 m²).
  - The mobile navigation drawer does not close on Escape.

## 6. With one more day

- Postgres and BigInt money columns, an audit log of edits, and optimistic concurrency (version column → 409 instead of last write wins).
- A VAT toggle (net/gross) and per-line VAT rates.
- CSV import preview and undo per batch; a streaming import for large files.
- Search: transliteration (`ß`/`ss`, `ü`/`ue`) and full-text search on Postgres.
- Wizard: idempotency key, house-option cost multipliers, a bungalow plan.
- Analytics: date-range periods and drill-down.

## How to run

```bash
npm ci
cd apps/api && npx prisma migrate deploy && npx prisma db seed && cd ../..
npm start                       # api http://localhost:3454/api · web http://localhost:4274
npx nx run-many -t lint test typecheck build
bash howItWorks/bin/e2e.sh      # Playwright: api 3454 + web preview 4300 (main tree, one runner)
```

How the parallel run was organised: `howItWorks/README.md`. Architecture as built: `docs/architecture/README.md`.
