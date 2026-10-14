# Interview workspace

Nx monorepo for live-coding sessions. Keep answers short, show commands and their exit codes, and prefer small verified steps.

## Stack (exact versions are pinned in package.json)
- Nx 22.7.1, TypeScript 5.9, npm (`npm ci` only; `package-lock.json` is committed)
- `apps/api` — NestJS 11, Prisma 6.19 with SQLite (`apps/api/prisma/schema.prisma`), class-validator, Jest (@swc/jest)
- `apps/web` — React 19, Vite 8, React Router 7, TanStack Query 5, zustand 5, react-hook-form + zod, Vitest + Testing Library; dev server proxies `/api` to `localhost:3454`
- `apps/web-e2e` — Playwright (chromium)
- `libs/shared/types` — zod schemas and inferred types, imported as `@default-project/types`

## Commands
- Serve: `npx nx serve api` (http://localhost:3454/api), `npx nx serve web` (http://localhost:4274)
- Checks: `npx nx affected -t lint test typecheck --base=HEAD`; everything: `npx nx run-many -t lint test typecheck build`
- Run the app for a browser walkthrough (main tree only): `bash howItWorks/bin/app.sh up [--seed] | status | down`; Playwright MCP `playwright-kairon` (local scope, headless, localhost only) → `/explore-app`.
- E2E (main tree only): `bash howItWorks/bin/e2e.sh [--grep RE]`; AC registry check: `bash howItWorks/bin/ac-ledger.sh [--block NN]`
- Prisma: `npx nx run api:prisma-migrate -- --name <change>`, `npx nx run api:prisma-generate`
- Stop only this project's processes: `pkill -f "$PWD/node_modules"`, then `npx nx daemon --stop` (in this order: killing a served app respawns the daemon); never kill processes by a generic name (other projects run on this machine).

## Modes
- Default is **fast**: no ceremony, work directly, still keep tests green.
- `/mode-process` switches to **process** mode: a checklist is injected with every prompt (plan ≤5 steps → failing test → code → `/done-check`). `/mode-fast` switches back. A new session always starts in fast mode.
- Use Claude Code's built-in `/plan` for a visible planning phase.

## Working agreement
- Do technical steps without asking. Ask the interviewer at once about business ambiguity (rules, edge cases, what "done" means) — do not guess requirements.
- Create projects and libraries with Nx generators, not by hand. For a new API resource with UI use `/scaffold-feature`.
- Fix every error you see; do not defer.
- "Done" means `/done-check` passed by exit codes, not "should work".
- Never weaken, delete or skip assertions to get green. If a test is wrong, say so explicitly and explain why.
- Never run `prisma migrate reset`, `prisma db push --force-reset` or drop data without explicit permission in the current message.
- Do not commit or push unless asked.

## NestJS
- One folder per feature: `module`, `controller`, `service`, `dto/`, `*.spec.ts`.
- Global `ValidationPipe({ whitelist: true, transform: true })` is on; every body is a class-validator DTO.
- Configuration through `ConfigService`; logging through Nest `Logger`, not `console.log`.
- Throw Nest HTTP exceptions (`NotFoundException`, `BadRequestException`, `ConflictException`).
- A new constructor dependency means updating every `Test.createTestingModule` that builds the class.

## Data (Prisma 6, SQLite)
- Models: `id String @id @default(cuid())`, `createdAt @default(now())`, `updatedAt @updatedAt`.
- Multi-step writes in `prisma.$transaction`; avoid N+1 with `include`/`select`.
- Idempotency at the database level: unique constraint + `upsert`; status changes as conditional `updateMany({ where: { id, status } })`; counters with `{ increment: n }`, never read-modify-write.
- SQLite limits: no `mode: 'insensitive'`, no `createMany({ skipDuplicates })`. Switching to Postgres needs a fresh initial migration.
- External HTTP calls: explicit timeout; retry only transient failures (429, 5xx, network) of idempotent operations, with backoff and jitter.

## React
- Function components, `interface` for props, named exports.
- Server data only through TanStack Query hooks (`features/<name>/use-<name>.ts`); never `useEffect` + `fetch`.
- zustand only for client UI state; forms with react-hook-form + zod resolver using schemas from `@default-project/types`.
- Always render loading and error states.

## Tests
- Every new behaviour gets a test in the same change. Arrange-Act-Assert, names like `should X when Y`.
- API: Jest with `@nestjs/testing`, Prisma mocked in unit tests. Web: Vitest + Testing Library, `findBy*` for async, mock `fetch`.
- Fake timers instead of real waiting. Playwright: explicit expectations (`toBeVisible`, `toHaveText`), never `waitForTimeout`.

## Nx boundaries
- Tags: `scope:api`, `scope:web`, `scope:shared`; apps may depend only on their scope and `scope:shared` (enforced by `@nx/enforce-module-boundaries`).
- Share contracts through `libs/shared/types`; never import from another app.

## Security
- No string-built SQL (use `Prisma.sql` or the query builder); no `dangerouslySetInnerHTML` with user data.
- Secrets never in code or in `VITE_*` variables; `.env` is git-ignored, `.env.example` documents variables.

## Commands (full list with descriptions: README.md)
- Flow for a task: `/create-task` → `/brainstorm` → code with tests → `/test-task` → `/update-doc` → `/done-check`; a red test → `/fix-test`; before shipping `/e2e-full`, `/review-full`, then the user runs `/mr`.
- Testing agents (spawned by the skills above, at most one test-running agent per session): `test-automator` (tagged guard test + red-proof), `regression-scout` (diff → ACs to re-run, read-only), `exploratory-qa-tester` (main tree, once before shipping, through `/explore-app`).
- Owner-only (never invoke them yourself): `/mr`, `/checkout`, `/report-tasks`, `/mode-process`, `/mode-fast`.
- Artifacts: `docs/tasks/` (task statements), `docs/specs/` (designs), acceptance criteria `- AC-NN.M` in `howItWorks/NN-*/BLOCK.md`, tests tagged `[AC-NN.M]`, `docs/test-runs/` (e2e run records + `ledger-baseline.txt` regression ratchet, written by `e2e.sh`), `docs/architecture/` (as-built docs, index in its README).

## Global skills available here
`core-debug` (root-cause debugging), `core-explain` (plain-language explanation), `core-writing-skill` (writing new skills) come from the user-level setup and work in this project too.
