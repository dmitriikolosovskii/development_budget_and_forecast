---
name: scaffold-feature
description: Create a full vertical slice for a new entity — Prisma model and migration, NestJS module (DTOs, service, controller, tests), shared zod schema, and a React page with TanStack Query and a Vitest test. Use when the task asks for a new resource, CRUD, list or form backed by the API.
allowed-tools: Bash(npx nx *), Bash(npx prisma *), Read, Write, Edit, Glob
---

Inputs to settle first (ask the interviewer only if the task does not say): entity name, fields with types, which operations (list / get / create / update / delete), validation rules.

Follow `reference.md` in this skill directory — it holds the file templates. Replace `Item`/`item`/`items` with the entity name in PascalCase / camelCase / plural kebab-case.

Order (each step leaves the workspace green):
1. **Model.** Add the model to `apps/api/prisma/schema.prisma`, then `npx nx run api:prisma-migrate -- --name add-<entity>` (runs `prisma migrate dev`, which also regenerates the client). SQLite has no `mode: 'insensitive'` and no `createMany({ skipDuplicates })`.
2. **Shared contract.** `libs/shared/types/src/lib/<entity>.ts` with the zod schema and inferred type; export it from `libs/shared/types/src/index.ts`.
3. **API.** Create `apps/api/src/<entities>/` with `dto/create-<entity>.dto.ts`, `dto/update-<entity>.dto.ts`, `<entities>.service.ts`, `<entities>.controller.ts`, `<entities>.module.ts`, `<entities>.service.spec.ts`; import the module into `apps/api/src/app/app.module.ts`.
4. **Web.** `apps/web/src/features/<entities>/` with `use-<entities>.ts` (query + mutation hooks), `<entities>-page.tsx`, `<entities>-page.spec.tsx`; add a `<Route>` in `apps/web/src/app/app.tsx`.
5. **Verify.** `npx nx run-many -t lint test typecheck -p api web types` must exit 0.

In process mode write the service spec (step 3) before the service body and show it failing once.
