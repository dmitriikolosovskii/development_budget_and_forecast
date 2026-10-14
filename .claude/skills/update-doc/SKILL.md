---
name: update-doc
description: Syncs architecture docs with a finished behavioural change — finds the one relevant doc by feature name and code path, updates it as-built with file:line and invariants, records bug history, creates a new doc only for a real gap, and refreshes the index. Use after a behaviour change is verified and before reporting done.
allowed-tools: Read, Write, Edit, Grep, Glob, Bash(git *)
---

1. **Scope check** on `git diff HEAD --name-only`. Behavioural changes: `apps/api/src/**/*.{service,controller,module}.ts`, `apps/api/prisma/schema.prisma`, `apps/web/src/features/**`, `libs/shared/types/**`. Only tests, config, formatting or `.claude/**` → "doc sync not needed", stop.
2. **Locate the one relevant doc** in `docs/architecture/`:
   - by name: `grep -rin '<feature>' docs/architecture/`;
   - by path: match the changed paths against the `paths:` header of each doc and the table in `docs/architecture/README.md`.
   Matched only by a catch-all → it is a GAP.
3. **Update the section in place** (not a changelog at the end): what changed, `file:line`, the invariant, link to `docs/specs/…`.
4. **Bug fix → 3–5 lines of history:** symptom as the user saw it · root cause `file:line` · fix · link.
5. **New doc only for a real gap:** no specific match AND the feature is self-standing (at least two of: own NestJS module, own Prisma model, own page in `apps/web/src/features`, own spec) AND an unambiguous name. Otherwise add a section to the nearest doc. A new doc starts with `<!-- paths: <globs> | <topic> -->`, then H1 and a short as-built description.
6. **Refresh the index:** add or update the row `doc | paths | topic` in `docs/architecture/README.md`.
7. **Check for leaked secrets** in the touched docs — key names and `file:line` only, never values.

One doc per topic, never a duplicate. Never drop the `paths:` header line when rewriting a doc. Docs describe the current state; plans live in `docs/specs/`.
