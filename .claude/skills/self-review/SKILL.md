---
name: self-review
description: One-pass review of the current diff against this stack's checklist (NestJS, Prisma, React, Nx boundaries). Use in process mode after the tests are green, or when the user asks for a review of the changes.
allowed-tools: Bash(git *)
---

Review `git diff HEAD` plus untracked files once. For each finding give file:line, the problem and the fix. Severity order: security > correctness > reliability > architecture > tests > style.

Checklist:
- Security: no raw SQL built by string interpolation (use `Prisma.sql` or the query builder); no `dangerouslySetInnerHTML` with user data; secrets only from `ConfigService` / `import.meta.env.VITE_*` (never secrets in `VITE_*`).
- Validation: every request body is a class-validator DTO; the global `ValidationPipe` uses `whitelist: true`.
- Data: multi-step writes wrapped in `$transaction`; no N+1 (use `include`/`select`); counters via `{ increment }`.
- Errors: Nest exceptions (`NotFoundException`, …) instead of generic `Error`; UI shows error and loading states.
- React: server data only through TanStack Query hooks; no `useEffect` + `fetch`; query keys are stable arrays.
- Nx: imports across projects only via `@default-project/types`; no deep imports into another app.
- Tests: each new behaviour has a test; no weakened assertions.

Finish with: "Blocking: N, Non-blocking: M". Do not rewrite code during the review unless asked.
