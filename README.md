# Development Budget & Cost Forecast (Kairon)

A CFO tool for a German house builder. For each project and for the whole portfolio it shows the budget, the actual spend, the open commitments, the forecast final cost (EAC) and the cost lines that will go over budget. Every number is recalculated live on each edit, in every tab.

What was built, the assumptions and the limitations are in [SOLUTION.md](SOLUTION.md). The original task and the demo scenario are in [howItWorks/SUMMARY.md](howItWorks/SUMMARY.md).

## Install

Requirements: Node 24 (tested on 24.16) and npm. Use `npm ci` only, because `package-lock.json` is committed.

```sh
npm ci                                          # also runs `prisma generate`
cp apps/api/.env.example apps/api/.env          # DATABASE_URL (SQLite), PORT=3454, DEMO_TODAY=2026-10-14
cd apps/api && npx prisma migrate deploy && npx prisma db seed && cd ../..
```

The seed is idempotent: you can run it again safely, and it never deletes rows.

## Run

```sh
npm start                                       # api + web together
```

- Web: http://localhost:4274 (the dev server proxies `/api` to the API)
- API: http://localhost:3454/api (health check: `/api/health`)

You can also run each app on its own with `npx nx serve api` and `npx nx serve web`. For a browser walkthrough there is a wrapper that takes the machine-wide port lock: `bash howItWorks/bin/app.sh up [--seed] | status | down`.

## How to use it

Open **Projects → Current projects → "Stadtvilla Taucha — Family of 4"**. This is the seeded demo house near Leipzig. It has deliberate overruns and schedule conflicts.

| Where                            | What you can do                                                                                                                                                                                                                                           |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header KPI strip                 | Budget · Spent · Open commitments · Forecast (EAC) · Variance, plus "N lines over budget". It is shown on every page.                                                                                                                                     |
| **Land** tab                     | Plot, municipality, soil and utilities with their costs, plus the site plan.                                                                                                                                                                              |
| **Architecture** tab             | Floor plan on the plot, house sections and an editable takeoff (BOQ). Changing a BOQ quantity updates the linked cost rows.                                                                                                                               |
| **Building materials** tab       | A sub-nav of sections with overrun and late badges. Editable tables for quantity, price, committed, actual, supplier, installer and dates. Click an organisation to open a modal with contacts and deadlines. The rightmost column flags late deliveries. |
| **Construction** tab             | Works per section and a Gantt chart. An alert appears when materials arrive after the work starts (e.g. "Windows arrive … 9 days after installation start"). "Shift work start" keeps the duration.                                                       |
| **Marketing** tab                | Marketing channels for a German homebuilder and a campaign calendar.                                                                                                                                                                                      |
| **Profitability** tab            | Markup (default 15 %), contract price, profit, margin and charts.                                                                                                                                                                                         |
| **Delivery tracking**            | Import deliveries from a CSV. Valid rows update actuals and dates. Bad rows are listed with their row number and the reason. Sample files: `apps/web-e2e/fixtures/deliveries-*.csv`.                                                                      |
| **Analytics**                    | Portfolio KPIs and charts across all projects, filtered by year.                                                                                                                                                                                          |
| **Projects → Calculate project** | A 5-step wizard that creates a full project from a template, scaled by living area.                                                                                                                                                                       |
| **Search** (header)              | Finds projects, lines, items and organisations, ignoring case and umlauts (`warmepumpe` finds "Wärmepumpe"), and jumps to the matching row.                                                                                                               |

Edits save automatically. Nothing is lost when you switch tabs, and a failed save rolls back with a toast.

A short demo path: in Electrical, change the NYM-J cable quantity, then check the header and Profitability. In Construction → Windows & doors, move the delivery earlier and the alert disappears. In Profitability, change the markup from 15 % to 12 %.

## How it works

```
apps/web (React 19, Vite, TanStack Query, Tailwind)
   │  GET /api/projects/:id → one snapshot per project; edits = optimistic update + 400 ms save queue
   ▼
apps/api (NestJS 11, Prisma 6, SQLite)  ── REST: projects, lines, items, organisations, land,
   │                                          architecture, deliveries, analytics, wizard, search
   ▼
libs/shared/budget-engine  ← pure money engine, used by BOTH api and web (identical numbers)
libs/shared/types          ← zod schemas and types (`@default-project/types`)
```

- **Money** is stored as integer euro cents, quantities as integer milli-units and rates as basis points. Rounding is half-up and happens in exactly two places: row amount = qty × price, and the markup. All amounts are net, excluding VAT.
- **The forecast (EAC) of a row depends on its status:**
  - DONE = actual;
  - CONTRACTED = max(actual, committed);
  - PLANNED/PARTIAL = max(actual, committed + the uncontracted remainder).

  A line is over budget only when its forecast is greater than the approved budget.

- **Live recalculation.** Every tab and the header are computed from the same cached snapshot by the shared engine. One edit therefore updates everything without a refetch.
- **"Today"** for schedules and analytics is fixed to `2026-10-14` (`DEMO_TODAY` in `.env`).

Architecture docs per feature: [docs/architecture/README.md](docs/architecture/README.md).

## Tests

| Command                                              | What it checks                                                                                                                                                                                                                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx nx run-many -t lint test typecheck build`       | Everything: lint, unit tests (Jest for the api and libs, Vitest for web), typecheck and build for api, web, web-e2e, types and budget-engine                                                                                                                           |
| `npx nx affected -t lint test typecheck --base=HEAD` | Only the projects touched by uncommitted changes                                                                                                                                                                                                                       |
| `npx nx test budget-engine` / `api` / `web`          | Unit tests of one project (the money logic lives in `budget-engine`)                                                                                                                                                                                                   |
| `bash howItWorks/bin/e2e.sh`                         | The whole Playwright suite (chromium, 12 specs including the CFO journey `cfo-journey.spec.ts`). Starts api :3454 and a web preview :4300 itself, then checks the AC registry. Main tree only, one run at a time on the machine. Writes a record to `docs/test-runs/`. |
| `bash howItWorks/bin/e2e.sh --grep "AC-04"`          | Only the matching e2e tests                                                                                                                                                                                                                                            |
| `bash howItWorks/bin/ac-ledger.sh [--block NN]`      | Checks that each acceptance criterion `AC-NN.M` in `howItWorks/NN-*/BLOCK.md` has a tagged test that passes                                                                                                                                                            |

Before running e2e, stop the app if `app.sh up` started it: `bash howItWorks/bin/app.sh down`. Both use the same ports.

Last verified result (2026-10-14): run-many exit 0; e2e 20/20 passed; AC ledger OK=138, UNCOVERED=0, FAILED=0.

## Repository layout

| Path                        | What                                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api`                  | NestJS API, Prisma schema, migrations and seed (`apps/api/prisma/`)                                                                                    |
| `apps/web`                  | React app, one folder per feature in `src/features/`                                                                                                   |
| `apps/web-e2e`              | Playwright specs and CSV fixtures                                                                                                                      |
| `libs/shared/budget-engine` | The pure money and forecast engine                                                                                                                     |
| `libs/shared/types`         | Shared zod contracts                                                                                                                                   |
| `howItWorks/`               | How the work was split into 13 parallel blocks; each block's `BLOCK.md` holds its acceptance criteria, and `bin/` holds the run, e2e and merge scripts |
| `docs/`                     | Task statements, design specs, architecture docs and e2e run records                                                                                   |
| `.claude/`                  | Claude Code setup: coding rules (`CLAUDE.md`), skills, agents and hooks                                                                                |

## Working with Claude Code

The usual task flow is:

```
/create-task → /brainstorm → code + tests → /test-task → /update-doc → /done-check
```

Before shipping, run `/e2e-full`, `/explore-app` and `/review-full`. Then the owner runs `/mr`. A red test goes to `/fix-test`. Each skill is described in `.claude/skills/<name>/SKILL.md`. The stack rules are in `.claude/CLAUDE.md`.
