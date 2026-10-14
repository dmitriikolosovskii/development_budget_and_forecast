<!-- paths: apps/api/src/projects/**, apps/api/src/budget-lines/**, apps/api/src/cost-items/**, apps/api/src/organizations/**, apps/api/src/prisma/**, apps/api/src/app/**, apps/api/prisma/schema.prisma | core API: projects, budget lines, cost items, organisations, duplicate -->
# Core API (projects, budget lines, cost items, organisations)

NestJS 11 + Prisma 6 (SQLite) API built by block 01. Global prefix `/api`, port `PORT ?? 3454`, global
`ValidationPipe({ whitelist: true, transform: true })` (`apps/api/src/main.ts:14`). Responses are
Prisma rows that serialise to the zod wire types of `@default-project/types`; errors are Nest HTTP
exceptions. Schema = CONTRACTS §2 in one migration `apps/api/prisma/migrations/20261014080515_init`.

## Endpoints
| Route | Behaviour | Code |
|---|---|---|
| `GET /projects` | non-template projects + engine `summary` and `profitability`, one query | `projects/projects.service.ts:80` |
| `GET /projects/:id` | `ProjectSnapshot` via one `include`; `organizations` = those referenced by `supplierId`, `contractorId`, `plan.architectOrgId`; 404 | `projects.service.ts:97` |
| `POST /projects` | empty project + all 43 catalogue lines at approved 0; slug from the name (`-2`…`-20` on collision, then 409) | `projects.service.ts:128` |
| `PATCH /projects/:id` | name, clientName, city, status, dates, markupBps; `end < start` → 400 | `projects.service.ts:161` |
| `POST /projects/:id/duplicate` | deep copy, see below | `projects.service.ts:172`, `project-copy.service.ts:53` |
| `POST/PATCH/DELETE /projects/:projectId/budget-lines[/:lineId]` | duplicate section → 409; DELETE with rows → 409 | `budget-lines/budget-lines.service.ts:22`, `:40`, `:50` |
| `POST/PATCH/DELETE /projects/:projectId/items[/:itemId]` | scoped lookups, reference checks, duplicate code → 409 | `cost-items/cost-items.service.ts:24`, `:42`, `:52` |
| `GET/POST /organizations`, `PATCH /organizations/:id` | shared across projects; duplicate slug → 409 | `organizations/organizations.service.ts:18`, `:22`, `:32` |

Module order in `apps/api/src/app/app.module.ts:24`: `ProjectWizardModule` is registered before
`ProjectsModule` (`:25`), so `/projects/wizard/*` is not captured by `/projects/:id` (CR-12).

## Validation and scoping
- DTO helpers (`apps/api/src/projects/dto/validators.ts`): `IsIsoDate` (`:13`), `IsCappedInt` =
  `@IsInt() @Min(0) @Max(2_000_000_000)` for every money/quantity field (`:31`), `OptionalNotNull`
  (PATCH may omit, `null` → 400, `:36`), `OptionalNullable` (`null` clears the column, `:41`).
- `UpdateCostItemDto` has no `kind`/`code`, so `whitelist` strips them: both are immutable
  (`cost-items/dto/update-cost-item.dto.ts:24`). Create requires a code like `MAT-ELE-003`
  (`create-cost-item.dto.ts:31`).
- `ProjectScopeService` (`projects/project-scope.service.ts`) does every "belongs to the project"
  check: unknown project → 404 (`:21`); foreign line / WORK / BOQ component → 400 (`:29`, `:44`,
  `:59`); unknown organisation → 400 (`:74`). Child rows are looked up by `{ id, projectId }`, a miss
  is 404 (`cost-items.service.ts:57`, `budget-lines.service.ts:62`).
- `requiredForWorkId` only on MATERIAL rows, never self, must point to a WORK row of the same project
  (`cost-items.service.ts:80`).
- `isUniqueViolation(error, field?)` maps Prisma P2002 to 409 (`apps/api/src/prisma/prisma-errors.ts:4`).

## Duplicate (`apps/api/src/projects/project-copy.service.ts`)
- `duplicate()` runs `deepCopy` in one interactive `$transaction`; a unique collision retries up to
  `SLUG_RETRIES = 3` (`:25`), then 409 (`:57`).
- `deepCopy(tx, sourceId, overrides)` (`:76`) pre-generates `randomUUID()` ids and old→new maps
  (`:94`), then writes in FK order: project → lines → land + utilities → plan + rooms + BOQ → import
  batches → items (unlinked first, then linked, chained links patched after, `:183`) → deliveries
  (`:220`). Every FK (`budgetLineId`, `requiredForWorkId`, `boqComponentId`, `batchId`,
  `costItemId`) is remapped; organisations are referenced, not copied.
- Defaults: name `"<name> (copy)"`, `isTemplate: false` (`:106`, `:109`), slug `<slug>-copy-<n>`
  (`nextCopySlug`, `:238`). `deepCopy` is exported for the wizard (block 12), which calls it with
  overrides inside its own transaction.
- Every e2e test works on a copy, so the demo project is never mutated by tests.

## Invariants
- A budget line that still has rows is never deleted (409, `budget-lines.service.ts:55`); project
  deletion still cascades through the schema.
- Templates (`isTemplate = true`) are hidden from `GET /projects`.
- `planned` is not stored; list rollups come from `summarizeProject` + `computeProfitability`.
- Logging via Nest `Logger`; no `console.log`.

## Decisions and deviations from CONTRACTS
- DELETE of a line with rows → 409 (owner decision, recorded in CONTRACTS §5 as as-built 01).
- Copied rows get `randomUUID()` ids, not cuids; id schemas are `z.string().min(1)`.
- `WizardInput.approvedByCategory` is optional (CONTRACTS showed it required).
- Services are typed by Prisma, not zod; zod is the wire/web contract.
- Copy slug is `max(existing n) + 1`, not "first free n" as 01 DESIGN wrote (`:247`–`:250`).

## Known gaps
- No authentication or per-user scoping; organisations are global.
- No optimistic concurrency (`updatedAt` is not checked on PATCH); last write wins.
- Unit tests mock Prisma (no supertest); real-SQLite behaviour is covered by e2e only.
