# PROTOCOL: how parallel sessions work without getting in each other's way

> The operating procedure for a session (gates, scripts, merging) is in [../PARALLEL-RUN.md](../PARALLEL-RUN.md). It takes precedence over this file where they differ. This file holds the rules.

These rules are binding for every block. They come from the judge's verdict (`docs/specs/2026-10-14-budget-forecast-design.md`, "Judge constraints").

## 1. Roles and places

| Who | Where | What |
|---|---|---|
| **Integrator** (block 00, the owner's session) | main tree `/Users/dmitriyluba/WebstormProjects/Interview/Kairon`, branch `main` | applying CRs (via `bin/main-commit.sh` under the git lock), the only one who runs `serve` on 3454/4274 and e2e, writes SOLUTION.md. **Worktrees, merges and the `w0-frozen` tag are done by the scripts** (`bootstrap.sh`, `merge-block.sh`) |
| **Block NN** | worktree `/Users/dmitriyluba/WebstormProjects/Interview/Kairon-wt/NN-slug`, branch `feat/NN-slug` | only the files listed in CONTRACTS §7 for its block |

`$MAIN` below means `/Users/dmitriyluba/WebstormProjects/Interview/Kairon`.

## 2. Coordination files (live in the main tree only, always use absolute paths)

- The board is `bash $MAIN/howItWorks/bin/status.sh` (machine-readable, from `howItWorks/state/`). You publish status and milestones only through `bin/flag.sh` (one file per block, no edit races). `shared/STATUS.md` is just the legend.
- Notes to a neighbour: `bin/note.sh <to> <from> "…"`; read your own with `bin/note.sh --read NN`.
- `$MAIN/howItWorks/NN-slug/DESIGN.md`: your block's spec from /brainstorm (neighbours read it).
- `$MAIN/howItWorks/NN-slug/HANDOFF.md`: your block's journal: what was done, which exports/components/endpoints are available, how to use them, known gaps. Neighbours read it before using your work.
- `$MAIN/howItWorks/shared/change-requests/CR-NN-<slug>.md`: a request to change a frozen contract (template in that folder's README).
- **Never edit `howItWorks/` inside your worktree**: it is a stale copy and would cause merge conflicts. Only the integrator commits `howItWorks/`.

## 3. Git

- A block commits **on its own branch only**, in small meaningful steps (Conventional style: `feat(materials): editable table with autosave`), with the attribution line from the system reminder.
- No `push`, `rebase`, `squash`, `--force` or `commit --amend` on commits that already exist. History is part of the result.
- You may pull fresh `main` into your branch with `git merge main` (when the flag you need appears, e.g. `03.merged`). **After every merge, run `npm ci`** (the lock may have changed), and also `cd apps/api && npx prisma migrate deploy` if there are new migrations.
- Merging into `main` is done **only** by `bin/merge-block.sh NN`. It waits for the merge-after flags, merges main into the branch, runs `check.sh`, and does `merge --no-ff` under the git lock. Merging by hand in `$MAIN` is forbidden.

## 4. Frozen contracts (after the `w0-frozen` tag)

Owned **only by the integrator** (changed through a CR):
`apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/**`, `apps/api/src/app/app.module.ts`,
`apps/web/src/app/routes.tsx`, `apps/web/src/app/nav-config.ts`, `apps/web/src/features/project/tabs-config.ts`,
`libs/shared/types/src/**` (all of it), `libs/shared/budget-engine/src/index.ts`, `package.json`, `package-lock.json`,
`tsconfig.base.json`, `nx.json`, `.eslintrc.json`, `apps/web/vite.config.mts`, `apps/web-e2e/playwright.config.ts`, `.claude/**`.

When you need a change: (1) write the CR, (2) **don't wait**: keep going with a local adapter or type in your own folder (`features/<x>/local-types.ts`) marked `// TODO CR-NN`, (3) `bin/flag.sh --status NN in-progress "blocked by CR-NN"`. The integrator applies the CR and tells you through `bin/note.sh`.

**Do not use `/scaffold-feature`** inside blocks: it edits `app.module.ts` and `app.tsx`. Create files by hand, in your own folders.

## 5. Dependencies

Every npm package is installed in block 01 (CONTRACTS §8). In blocks **only `npm ci`**. Need a new package? Write a CR.

## 6. Processes, ports, database

- Each worktree has its own `node_modules` (`npm ci`), its own Nx daemon, its own `apps/api/.env` (copied) and its own `apps/api/prisma/dev.db` (git-ignored).
- **Blocks do not run serve or e2e by default.** If a UI block needs to look at the screen: `PORT=35NN npx nx serve api` and `WEB_PORT=42NN API_PORT=35NN npx nx serve web`, where NN is the block number (block 02 sets this up in vite.config). Afterwards stop it with `pkill -f "$PWD/node_modules"` **only from your worktree**, then `npx nx daemon --stop`.
- Database in a worktree: `cd apps/api && npx prisma migrate deploy && npx prisma db seed` (after block 03 is merged into your branch). **Never** `migrate reset`, `db push --force-reset` or `migrate dev` (blocks do not create migrations).
- At most 5 sessions on the machine at once.

## 7. Tests and "done"

- In a block: `bash $MAIN/howItWorks/bin/heavy.sh $WT npx nx test|lint|typecheck <project>` for the projects you touched. Always go through heavy.sh (the memory semaphore).
- Inside a block, `/done-check` is replaced by `bash $MAIN/howItWorks/bin/check.sh NN` (ownership, format, affected lint/test/typecheck/build, test weakening). Its exit code is what counts.
- New behaviour gets a test in the same commit. Names: `should X when Y`. Assertions are never weakened. If an old test conflicts with a new requirement, rewrite it deliberately and explain why in the commit message.
- **e2e is only for the main tree**, one runner on the machine: always `bash $MAIN/howItWorks/bin/e2e.sh [--grep RE]` (it holds the `e2e` mkdir lock under `/tmp/kairon-locks`, writes a JSON report and checks it with the AC ledger). A block writes its e2e spec `apps/web-e2e/src/<feature>.spec.ts`. You may write it, but the integrator runs it. Each e2e test calls `POST /api/projects/<taucha-stadtvilla id>/duplicate` (CONTRACTS §5) in `beforeEach` and works on the copy. The demo project is never modified.
- Tag tests with an AC from the block, e.g. `it('should ... [AC-04.3]')` (one bracket per id: `[AC-05.1][AC-05.2]`). `bash $MAIN/howItWorks/bin/ac-ledger.sh --block NN` shows which of your ACs are OK / UNCOVERED / SKIPPED; e2e ACs stay UNRUN until the main tree runs them. `REGRESSED` = an AC proven earlier (`$MAIN/docs/test-runs/ledger-baseline.txt`) is broken now: fix it, never edit the baseline. Store red-proof in your HANDOFF.md, section `## Red-proof`. Run records: `$MAIN/docs/test-runs/` (written and committed by `e2e.sh`).
- Testing commands: `/test-task` (prove ACs, red-proof), `/fix-test` (repair a red test without weakening it); agents `test-automator`, `regression-scout`. Design: `docs/specs/2026-10-14-testing-kit-design.md`.

## 8. Before finishing a block

1. `bin/check.sh NN` → `CHECK: PASS`.
2. HANDOFF.md is filled in (what is available to neighbours, how to check it, gaps).
3. `bin/merge-block.sh NN` (in the background) has merged the block into main (the `NN.merged` flag).
4. Report to the owner: what was done, commands with their exit codes, what is left.
