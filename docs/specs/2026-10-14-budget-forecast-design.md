# Design — Development Budget & Cost Forecast (parallel block implementation)

Date: 2026-10-14 · Status: **proposed (awaiting the owner's "yes")** · Risk: **high** across the full scope / **medium** for W0+W1
Detailed plan per block: `howItWorks/` (README → SUMMARY → shared/* → NN-*/BLOCK.md).

## Goal
- An MVP for a CFO of a German house builder. It answers five questions per project and across the portfolio: budget state, actual spend, existing costs and commitments, forecast final cost (EAC), and lines going over budget.
- It also covers the owner's additions: tabs Land / Architecture / Building materials / Construction / Marketing / Profitability, delivery tracking, analytics, a calculation wizard, search, a collapsible menu, responsive layout, a light UI on Tailwind, and a German demo project.
- The implementation runs as **parallel Claude Code sessions, one per block**, with consistent contracts.

## Non-goals
Auth, multi-currency, multi-tenancy, bank integrations, deploy, audit log, approval workflow, a VAT toggle (amounts are net), real-time collaboration (last write wins), a real CAD drawing (the floor plan is rectangles in SVG).

## Owner's decisions (clarification)
1. Stack: **the Kairon Nx workspace** (NestJS + Prisma/SQLite + React/Vite + Tailwind), not the Next.js/Postgres skeleton. This deviation is recorded in SOLUTION.md.
2. Scope: **core first**. W0+W1 are MUST (contracts, shell, seed, Materials, Construction, Profitability). W2 (Land, Architecture, Marketing, Delivery tracking, Analytics) and W3 (Wizard, Search) are stretch. Anything unfinished goes into SOLUTION.md.

## Approaches
- **A (chosen, modified):**
  - Contracts are frozen first: schema, zod types, a pure engine `@default-project/budget-engine` (scope:shared).
  - The web app uses one `ProjectSnapshot` through TanStack Query, with optimistic edits and a save queue.
  - Each block runs in its own **git worktree and branch**, and the integrator merges them with `--no-ff`.
- **B (rejected):** client state in zustand/localStorage. It breaks the CLAUDE.md rule (server data goes through TanStack Query), Prisma would sit unused, there would be nothing to test for money handling on the server, and the demo data would disappear.
- **C (rejected):** the server computes everything and the client refetches after each edit. That is correct, but it is not "real-time" (a round trip per edit), causes more re-renders, and makes the engine harder to test on the client.

## Panel (summary)
- **Prosecutor:**
  - A shared working tree breaks: the stop hook and done-check see other sessions' files, `pkill` and ports collide, there would be one `dev.db`, and `npm i` would run in parallel.
  - Prisma `Int` caps at €21.47M.
  - The EAC rule understates when committed < planned.
  - There are optimistic-update races.
  - e2e cannot reach the API (no `/api` proxy on preview).
  - Tailwind is not wired up.
  - The full scope does not fit into 3 hours.
- **Advocate:** A is the only option that fits TASK.md (money correctness plus tests) and CLAUDE.md. A `scope:shared` engine is allowed by `.eslintrc.json`. The workspace is empty, so freezing contracts costs little.
- **Architect:**
  - The generator call was verified with a dry run.
  - Hot spots: `app.module.ts`, routes, nav, the types barrel, the schema, `package.json`.
  - Dependencies: recharts 3.10.1 + react-is 19.3.0, lucide-react, papaparse.
  - `/scaffold-feature` must not be used inside blocks.
- **Tester:** at-risk tests are `app.spec.tsx` and the e2e example; 41 ACs; one e2e runner; affected checks only in the main tree.

## Judge constraints (binding)
1. One worktree and one branch per block (`../Kairon-wt/NN-slug`), each with its own `npm ci`, `.env` and `dev.db`. The baseline commit to main needs the owner's go-ahead.
2. Blocks commit only to their own branch, with the owner's permission in the session prompt. No squash, rebase or force; the integrator merges with `--no-ff`.
3. Money is an integer number of euro cents (`Int`); quantities are integer milli-units; DTO caps are ≤ 2,000,000,000. BigInt is used only inside the engine for multiplication, with a safe-integer check.
4. Rounding is half-up away from zero, in exactly two places (row amount, markup). Totals are sums and are never rounded again. Percentages are stored as integer bps.
5. EAC by status: DONE=actual; CONTRACTED=max(actual,committed); PLANNED/PARTIAL=max(actual, committed+max(planned−committed,0)). Overrun means forecast > approved.
6. `contractPrice = roundHalfUp(approved×(10000+bps)/10000)`; profit = price − EAC; margin is 0 when the price is 0. Markup is 15%.
7. All amounts are net (excl. VAT). This is an assumption recorded in SOLUTION.md.
8. Autosave:
   - optimistic update of one row plus a coalescing queue of 400 ms;
   - flush on blur, unmount, route change and beforeunload;
   - saves for the same key run sequentially;
   - a failed save rolls back and shows a toast;
   - the cache is updated with the server's row only if no newer patches are pending;
   - `refetchOnWindowFocus:false`.
9. Re-renders: rows are memo components that subscribe to their own item; `setQueryData` changes only the edited row.
10. The W0 freeze (`w0-frozen` tag) covers: schema plus one migration, all zod types, engine signatures and tests, core CRUD, stub modules, routes/nav/tabs placeholders, the seed dispatcher, the UI kit, and the rewritten heading tests.
11. Registry files and dependencies belong only to the integrator after the freeze; changes go through CRs.
12. Tailwind is wired up in block 02. The e2e `webServer` covers api + preview, and preview gets the `/api` proxy (block 01).
13. Blocks run `nx test|lint|typecheck <project>` only, with no serve, e2e or affected. e2e runs only in the main tree, one runner at a time.
14. The seed is idempotent (upsert by slug/code). No migrations in blocks, and never `migrate reset`.

## Affected files
New:
- `libs/shared/budget-engine/**`
- `libs/shared/types/src/lib/*`
- `apps/api/prisma/{schema.prisma,migrations,seed.ts,seed/**}`
- `apps/api/src/{projects,budget-lines,cost-items,organizations,land,architecture,deliveries,analytics,project-wizard,search}/**`
- `apps/web/src/{app,ui,lib,features/*}/**`
- `apps/web-e2e/src/*.spec.ts`, `apps/web-e2e/fixtures/*.csv`
- `SOLUTION.md`

Changed:
- `package.json`/lock
- `tsconfig.base.json`
- `apps/web/vite.config.mts`, `apps/web/src/styles.css`, `main.tsx`, `app.tsx`
- `apps/web/src/app/app.spec.tsx`
- `apps/web-e2e/{playwright.config.ts,src/example.spec.ts}`
- `apps/api/src/app/app.module.ts`, `apps/api/prisma.config.ts`

Full ownership table: `howItWorks/shared/CONTRACTS.md` §7.

## Consistency review (after the panel)
An independent pass over every doc found 25 mismatches, and all of them are fixed:
- e2e works on `POST /projects/:id/duplicate` instead of the W3 wizard;
- one schedule order (same day = ON_TIME) and the `ScheduleResult` type;
- exact `Profitability`/`PortfolioAnalytics`/`WizardInput`/`ProjectListItem` types;
- the cash-flow rules;
- `vite.config.mts` owned only by 02 (preview 4300 + proxy + `__DEMO_TODAY__`);
- `deps-ready` for 02;
- W2/W3 branch from `main`;
- the template keeps its dates;
- row code prefixes;
- an exact per-line budget table (Σ 573,861.00 €, price 659,940.15 €);
- verified room rectangles (143.65 m², no overlaps);
- a seed schedule with no accidental conflicts.

## Risks (top residual)
1. **Time:** 14 blocks plus `npm ci` in every worktree plus merges do not fit into 3 hours. Mitigation: W0+W1 are MUST, the rest is stretch, and SOLUTION.md describes what is left.
2. **Change requests pile up:** the freeze will miss fields. Mitigation: the contract is detailed up front (CONTRACTS §2–§5), local adapters keep blocks moving, and the integrator applies CRs in batches.
3. **Autosave edge cases:** losing an edit on a tab switch or a server error. Mitigation: AC-02.4/02.5/04.2 plus the e2e "switch tab mid-edit".
4. The owner's machine has 24 GB of RAM. Mitigation: at most 5 sessions at once; blocks do not run serve.

## Test strategy (summary; per-block ACs are in `howItWorks/NN-*/BLOCK.md`)
- **Engine (Jest), the core of money correctness:**
  - AC-01.1–01.9: rounding, EAC by status, rollup additivity (property test), overrun boundaries, profitability with an exact cent value, schedule boundaries (same day = OK), parsing of money input;
  - AC-06.1: lossless cash flow;
  - AC-11.1: portfolio totals.
- **API (Jest, Prisma mocked):**
  - validation and 400/404 (AC-01.10, 07.1);
  - BOQ→items transaction (AC-08.1);
  - CSV import: partial, idempotent, bad rows with row numbers (AC-10.1–10.5);
  - wizard: Σ exact, links remapped, template untouched (AC-12.1–12.3);
  - search: case and umlauts (AC-13.1–13.3).
- **Web (Vitest + Testing Library, fake timers, mocked fetch):**
  - autosave and no data loss (AC-02.4, 02.5, 04.2);
  - re-renders (AC-02.6, 04.6);
  - cross-tab recalculation (AC-06.3, 08.4);
  - schedule conflicts (AC-04.3, 05.1–05.3);
  - responsive layout (AC-02.8).
- **e2e (Playwright, integrator only):** the CFO journey `cfo-journey.spec.ts` (AC-00.2) plus the block specs.
- **Existing tests:** `app.spec.tsx` and `example.spec.ts` are rewritten deliberately (the heading becomes the app shell), keeping the HealthBadge `status` check. Health tests are untouched.

## How to verify
1. `npx nx run-many -t lint test typecheck build`: every exit code is 0.
2. `cd apps/api && npx prisma migrate deploy && npx prisma db seed` (twice; row counts stay the same).
3. `npm start`, then open http://localhost:4274 and walk through the scenario in `howItWorks/SUMMARY.md` §3.
4. `npx nx e2e web-e2e` (main tree).
5. `git log --graph --oneline`: there is a merge commit for each block, and no squash or force pushes.

## Open questions (answered by assumption, recorded in SOLUTION.md; the owner may override any of them)
- Net vs gross: in reality a developer cannot reclaim construction VAT (GERMANY-DATA, top note). The MVP uses net amounts.
- The markup applies to the whole approved budget, land included. A markup only on construction costs is an alternative.
- CSV import: partial (good rows are written) or atomic. We chose **partial**.
- Simultaneous editing: last write wins.
