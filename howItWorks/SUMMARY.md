# SUMMARY — Development Budget & Cost Forecast

## 1. The original task (TASK.md, condensed)

Source: https://github.com/dmitriikolosovskii/development_budget_and_forecast (`TASK.md`).

A real-estate development company has a construction project with an **approved budget** broken into **cost lines**
(Land, Construction, Concrete, Electrical, Architecture, Marketing). Over time the company signs **contracts**
(commitments) and incurs **actual costs**. The **CFO** must see:

1. the current state of the project budget;
2. how much money has actually been spent;
3. which costs and obligations already exist;
4. the likely final cost of the project (forecast / EAC);
5. which cost lines are expected to go over budget.

Rules of the take-home:
- **3 hours**, starting from the fork. Design and setup count toward the time. When time is up, stop and commit.
- Deliver a small but **complete, demonstrable scenario** that runs without manual edits to code or data.
- **Key business logic is covered by automated tests**. **Correct handling of money** is singled out.
- No squash or force-push: **git history is part of the result**. AI plans and configs stay in the repository.
- Add a short `SOLUTION.md`: what was done, assumptions, decisions, what is out of scope, limitations, and what you would do with one more day.
- Not required: auth, multi-currency, multi-tenancy, bank integrations, deploy, audit log, approval workflow, design system.
- **Deviation (owner's decision):** we use the Kairon Nx workspace (NestJS + Prisma/SQLite + React/Vite + Tailwind) instead of the skeleton's Next.js + Postgres. Record this in SOLUTION.md.

## 2. Owner's additions (from the Russian comments → binding requirements)

All UI text is **English**. Light theme in soft colours, smooth transitions, **Tailwind**. Responsive: mobile, tablet, laptop, wide.

| # | Requirement | Block |
|---|---|---|
| 0 | Header plus a **collapsible** left sidebar | 02 |
| 1 | A **default project** with realistic data for the **German** market (detached house for a family of 4) | 03 (+ GERMANY-DATA) |
| 2 | Menu **Projects** → **Calculate project**, **Current projects** | 02 / 12 |
| 2.1 | Project page with **tabs**: Land · Architecture · Building materials · Construction · Marketing · **Profitability** | 02 (shell) |
| 2.2 | **Land**: municipality, location, plot characteristics, soil, water, gas, power, sewer, telecom | 07 |
| 2.3 | **Architecture**: house drawing that fits the plot, standard house sections, **editable materials takeoff** (what goes into the build, and how much) | 08 |
| 2.4 | **Building materials** (Concrete + Electrical + …): left-hand sub-nav of sections derived from the takeoff. Editable tables: item, quantity, price, amount, **supplier**, **installer**, delivery / work dates. **Clicking an organisation opens a modal** with details, deadlines, responsible person and contacts. **Rightmost column flags materials that will arrive late**. Autosave on change, no data loss when switching tabs, no needless re-renders | 04 (+02 UI kit) |
| 2.5a | Menu **Delivery tracking**: upload data about delivered products (file import) | 10 |
| 2.5b | **Construction**: sub-sections per type of work, with a table of work items, volume, cost, contractor, start and end. **Algorithm: if materials arrive after the planned start of the work they belong to, highlight it and raise an alert** | 05 |
| 2.6 | **Marketing**: sub-sections based on how homebuilders market themselves in Germany/Europe | 09 |
| 2.7 | **Profitability**: approved budget, **company markup** (our choice: see CONTRACTS §3), profit, and charts. **Any change** to cost, volume or dates **recalculates it automatically** | 06 |
| 3 | **Every** tab shows the CFO's five answers, recalculated live; a change in one place updates every other place | 01 (engine) + 02 (`BudgetHealthPanel`) |
| 4 | **Analytics** page: numbers and charts across projects | 11 |
| 6 | **Calculate project**: a wizard that creates a project covering every section of Current projects | 12 |
| 7 | **Search** across the app | 13 |

## 3. The product scenario we demo (the e2e journey)

1. Open the app → **Current projects** → "Stadtvilla Taucha — Family of 4" (seeded, Taucha near Leipzig).
2. The header KPI strip shows Budget / Spent / Open commitments / Forecast (EAC) / Variance, plus "N lines over budget".
3. **Building materials → Electrical**: edit the quantity of NYM-J cable. The amount, the section total, the KPI strip and **Profitability** update instantly. After a reload the value is still there. (Seed: the cable is PARTIAL, 1,000 of 1,300 m bought, so a quantity change moves the forecast. Owner decision 2026-10-14 12:06. The 04/06 e2e use the PLANNED LED downlights row MAT-ELE-008, which is just as valid.)
4. **Construction → Windows & doors**: the alert "Windows arrive 9 days after installation start". Move the delivery date earlier and the alert disappears.
5. Click a supplier → modal with contacts, the responsible person and this organisation's deadlines.
6. **Profitability**: change the markup from 15% to 12% → contract price, profit and margin are recalculated, and the charts redraw.
7. (stretch) **Delivery tracking** → upload a CSV → actuals and dates update, bad rows are shown with the reason.
8. (stretch) **Analytics** across the 3 projects, **Search** for "arotherm" (heat pump) → jump to the row, **Calculate project** → a new project from the template.

## 4. Key decisions (details in shared/CONTRACTS.md)

- Money is stored as **integer euro cents** (`Int`), quantities as **integer milli-units**. Rounding is half-up (away from zero) in exactly two places. All amounts are **net (excl. 19% VAT)**.
- **Forecast (EAC) per row** depends on status; the uncontracted remainder of scope is always counted (see CONTRACTS §3).
- One shared **pure engine** `@default-project/budget-engine` (scope:shared): the API and the web app compute the same numbers. The web app recalculates from the cache instantly.
- The web app reads **one snapshot** `GET /api/projects/:id` through TanStack Query. Edits are optimistic `setQueryData` calls plus a coalescing save queue (400 ms, flushed on blur/unmount/route change/beforeunload).
- Parallel work: **one git worktree and branch per block**, frozen W0 contracts, registry files owned by the integrator, contract changes only through CRs.
