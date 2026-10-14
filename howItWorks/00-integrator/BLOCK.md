# 00 — Integrator (main tree, coordinates the waves)

**Where:** `/Users/dmitriyluba/WebstormProjects/Interview/Kairon`, branch `main`. **Runs:** throughout the whole job, between waves and at the end.
**Only this session:** merges branches, sets tags, applies CRs, edits frozen files after `w0-frozen`, runs `serve`/e2e on 3454/4274, commits `howItWorks/`, `docs/`, `SOLUTION.md`.

> With a parallel launch, worktrees, merges and the `w0-frozen` tag are done by the block sessions themselves through `bin/` (see PARALLEL-RUN.md). The integrator does the start, the CRs, monitoring and the finish.

## Step 0: baseline (the owner, or with their explicit permission)
`bash /Users/dmitriyluba/WebstormProjects/Interview/Kairon/howItWorks/bin/baseline.sh` commits the current state of main and sets the `baseline` flag, which opens the gate for 01/02. Note the time: per TASK.md the clock starts from the fork.

## Step 1: monitoring
- `bash howItWorks/bin/status.sh` shows who is waiting for what and which locks are held.
- CRs from `shared/change-requests/`: apply them in the main tree with `bin/main-commit.sh "<msg>" <files>` (it takes the same git lock as the merges). A schema change goes through `npx nx run api:prisma-migrate -- --name <cr>`. Then post a note to the affected blocks (`bin/note.sh`) and raise CONTRACT_VERSION.
- Main is red after a merge: `bin/flag.sh main.broken "<reason>"` (merges pause), fix it or send it back to the block, then `rm howItWorks/state/main.broken.flag`.
- A block stuck in `conflict`: help resolve it in its worktree (only that block's files).

## Step 4: e2e and the demo (main tree only)
- Run e2e only via `bash howItWorks/bin/e2e.sh` (machine-wide `e2e` lock, JSON report, `ac-ledger.sh --e2e-report`). The specs come from the blocks.
- Write `apps/web-e2e/src/cfo-journey.spec.ts`: the scenario from SUMMARY §3 (steps 1–6) as one journey test **on a copy of the demo** (`POST /api/projects/:id/duplicate`).
- Ports: dev `serve` web 4274 / api 3454; e2e uses `web:preview` on **4300** + api 3454 (stop your own `serve` api before e2e, or keep it: `reuseExistingServer` reuses the api).
- `/e2e-full`, then `/explore-app` (browser walkthrough through the Playwright MCP; the app runs via `bin/app.sh`), then `/review-full` before shipping.

## Step 5: finish (when the time is up or W1 is done)
- **SOLUTION.md** (TASK.md requires it). Cover: what was done; assumptions (net prices, markup on the whole approved budget, partial CSV import, Int cent limit, last write wins, Kairon stack instead of Next.js/Postgres); decisions (engine, snapshot, worktrees); what was left out (W2/W3 if unfinished, auth, VAT toggle); limitations; the next day.
- README: how to run it (`npm ci`, `prisma migrate deploy`, `prisma db seed`, `npm start`).
- `docs/architecture/` via `/update-doc`.
- `bin/main-commit.sh "docs: block designs and handoffs" howItWorks docs` (DESIGN/HANDOFF/CR of the blocks).
- `git worktree remove ../Kairon-wt/<b>` for the merged blocks (only after `NN.merged` and with the owner's agreement; check `git worktree list` first).
- Do not push. The owner runs `/mr` themselves.

## Acceptance (AC-00)
- AC-00.1 (check) Every merged block passes `npx nx run-many -t lint test typecheck build` (exit 0).
- AC-00.2 (e2e, integrator) `cfo-journey.spec.ts` is green: seed → overrun visible → materials edit → EAC and Profitability change → reload keeps the value.
- AC-00.3 (check) SOLUTION.md has all 6 sections from TASK.md.
- AC-00.4 (check) History has no squash/force: `git log --merges` shows a merge for every block.
