# DESIGN — 01 Foundation & contracts (express brainstorm, 2026-10-14)

## Goal / Non-goals
**Goal:** CONTRACTS §1–§5, §8 as code: dependencies, `@default-project/types` (zod 4), `@default-project/budget-engine` (pure, tested), Prisma schema + one `init` migration + a seed runner that resolves `@default-project/*`, the core NestJS API (projects incl. duplicate, budget lines, cost items, organisations), stub modules for 07–13, and Playwright wiring (`web:preview` on 4300 + api).
**Non-goals:** seed data (03), web code (02), bodies of `cashflow.ts`/`portfolio.ts` (06/11), land/plan/deliveries/analytics/wizard/search endpoints (07–13), `migrate reset`.

## Chosen approach and why not the others
1. **Types:** one zod file per concept. Entity schemas are the **wire shape** (timestamps are ISO strings, nullable = `null`). Input schemas mirror the API DTOs so web forms validate with the same rules. Extra inputs for 07/08/10 are added now, because `libs/shared/types` is frozen after `w0-frozen`.
2. **Engine:** pure functions over **structural minimal inputs** (`EngineItem`/`EngineLine` = `Pick<…>`), so the API passes Prisma rows (Date timestamps) and the web passes JSON without mapping. bigint only inside `roundHalfUp`; sums are numbers checked with `Number.isSafeInteger`.
   *Rejected:* engine on full zod types (the API would have to serialise every row first); decimal.js (an extra dependency, and the rules need only one division).
3. **API:** a folder per feature. Services are typed by Prisma (zod is the wire/web contract). A shared `ProjectScopeService` does every "belongs to the project" lookup (`findFirst({ where: { id, projectId } })`).
   *Rejected:* a generic repository layer (YAGNI).
4. **Duplicate:** one interactive `$transaction` with pre-generated `randomUUID` ids and old→new maps. FK order: project → lines → land + utilities → plan + rooms + BOQ → import batches → items (unlinked first, then linked) → deliveries. `deepCopy(tx, srcId, overrides)` is exported for block 12.
   *Rejected:* recursive Prisma nested `create` (it can't remap `requiredForWorkId`/`boqComponentId`/`batchId`).

## Judge constraints (verdict: ACCEPT WITH CHANGES, risk **medium**)
1. Child routes look rows up by `{ id, projectId }`; a miss → 404. A foreign `budgetLineId`/`requiredForWorkId`/`boqComponentId`/org id → 400.
2. `BigInt(1000)`, never `1000n` (target es2015, probed). `roundHalfUp` throws on non-safe integers.
3. Seed runner: ts-node + `tsconfig-paths` pinned 4.2.0 with an explicit base URL. *As built:* a preload `prisma/register-paths.cjs`, because Prisma spawns the seed without a shell (an env-prefixed command failed with ENOENT).
4. Services are Prisma-typed; ids `z.string().min(1)`; dates `z.iso.date()`; zod 4 `error:`.
5. Duplicate: one transaction, every FK remapped, organisations referenced (not copied), copy `isTemplate=false`, default name `"<name> (copy)"`, slug `<slug>-copy-<n>` (first free n), P2002 retried 3× then 409.
6. `kind` and `code` are immutable on PATCH. `requiredForWorkId` is allowed only on MATERIAL and must point to a WORK of the same project.
7. PATCH: non-nullable fields reject `null`; nullable fields accept `null` (clears the field).
8. `GET /projects/:id` organisations = those referenced by `supplierId`, `contractorId` and `plan.architectOrgId`.
9. Every AC has a test; AC-01.6 pins 65,994,015¢ / 8,607,915¢.
- Overruled by the judge: INVALID_DATES → `blockingMaterials: []`. Owner's answer: `DELETE` of a budget line **that still has rows → 409**.
- Ties in `overrunLines`: overrun desc, then name, then id. `parseEurToCents`: trims, optional `€`, rejects negatives.

## Affected files (all within `bin/blocks.conf` row 01)
`package.json`, `package-lock.json`, `tsconfig.base.json`, `libs/shared/types/**`, `libs/shared/budget-engine/**`, `apps/api/prisma/{schema.prisma,migrations/**,seed.ts,register-paths.cjs}`, `apps/api/prisma.config.ts`, `apps/api/src/{app,projects,budget-lines,cost-items,organizations,land,architecture,deliveries,analytics,project-wizard,search}/**`, `apps/web-e2e/playwright.config.ts`.

## Risks
- A missed FK remap in duplicate would silently point copy rows at the source → AC-01.12 asserts every remapped FK and that no write touches source ids.
- Contract drift after `w0-frozen` → all extra types are added now.
- Seed runner fragility → verified with a real `prisma db seed` that imports `@default-project/types` and an engine import check.

## Test strategy (Jest; Prisma mocked in the API)
- AC-01.1/2 `money.spec.ts` · AC-01.3/4/5 `rollup.spec.ts` (a 500-row seeded PRNG property test) · AC-01.6 `profitability.spec.ts` · AC-01.7 `schedule.spec.ts` (AT_RISK boundaries 0/1/2/3, precedence) · AC-01.8 `money.spec.ts` · AC-01.9 `types/money.spec.ts`.
- AC-01.10 `cost-items.service.spec.ts`, `projects.service.spec.ts` · AC-01.12 `project-copy.service.spec.ts` · DTO caps through `ValidationPipe.transform` (no supertest installed).
- AC-01.11: `nx lint api web budget-engine types`.
- Mutation check: flipping `>=`→`>` in `roundHalfUp` and `<3`→`<=3` in AT_RISK fails 6 tests. *As built:* the full per-AC red-proof (HANDOFF) found 2 survivors: AC-01.4 had only checked 2 of 7 fields per line, and AC-01.1 used only tiny magnitudes. Both tests were strengthened, and every AC is now red under its mutant.

## How to verify
`npx nx test budget-engine types api && npx nx lint api budget-engine types && npx nx typecheck api budget-engine types` → exit 0; `cd apps/api && npx prisma migrate status && npx prisma db seed`; `npx playwright test --list -c apps/web-e2e/playwright.config.ts`; `bash howItWorks/bin/check.sh 01`.

## Open questions
None. DELETE of a line with rows was answered by the owner: 409.
