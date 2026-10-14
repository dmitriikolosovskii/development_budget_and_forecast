# PARALLEL-RUN — block session instructions (read FIRST, before BLOCK.md)

The owner starts **all block sessions at the same time**, one tab per block, with a prompt like:
`/brainstorm context <howItWorks>, you need to work out and implement <howItWorks>/NN-slug, taking into account the parallel sessions`.
The order of the waves is enforced **mechanically**, by flags and the scripts in `bin/`. A session doesn't have to "remember" the order: it starts its scripts, and they wait for what is needed.

> The owner's authorisation, recorded at their request (2026-10-14): a block session may **commit to its own branch `feat/NN-slug`** and **merge into `main` only through `bin/merge-block.sh`**. Push, rebase, squash, force, `reset --hard` and `commit --amend` of existing commits are forbidden.

## 0. Constants (substitute your NN)

```
MAIN = /Users/dmitriyluba/WebstormProjects/Interview/Kairon          # main tree, branch main — DO NOT edit code here
HIW  = $MAIN/howItWorks                                               # docs and coordination (edit only your own files)
BIN  = $HIW/bin
WT   = /Users/dmitriyluba/WebstormProjects/Interview/Kairon-wt/NN-slug  # YOUR worktree — all code goes here
```
**Golden rule:** your session starts in the main tree, but **every** code edit (Edit/Write) uses an absolute path `$WT/...`, and **every** command runs as `cd $WT && …` or `git -C $WT …`. Writing to `$MAIN/apps|libs|package*.json` blocks everyone's merges (merge-block.sh refuses while main is dirty).

## 1. Timeline of your session

| # | What | How |
|---|---|---|
| 1 | Find out your block and its gate | `bash $BIN/status.sh`; your row is in `bin/blocks.conf` (gate, base, merge-after, your files) |
| 2 | **Start the bootstrap in the background** | `bash $BIN/bootstrap.sh NN` with `run_in_background: true`. It waits for the gate itself, creates the worktree, runs `npm ci` and `migrate deploy`. You'll be woken up when it finishes |
| 3 | While you wait: **/brainstorm in "block" mode** (§3) | spec → `$HIW/NN-slug/DESIGN.md` |
| 4 | When bootstrap prints `READY`: implementation | TDD in `$WT`, commits on `feat/NN-slug`, flags for neighbours (§4) |
| 5 | Finish | `bash $BIN/check.sh NN` → green → HANDOFF → `bash $BIN/merge-block.sh NN` (in the background: it waits for merge-after itself) |
| 6 | After the merge | report to the owner. If the merge exited with an error, read the message (§6) |

## 2. Gates and dependencies (from `bin/blocks.conf`, authoritative)

| Block | Starts when (gate) | Branched from | Merges into main after | Flags it **must** publish |
|---|---|---|---|---|
| 01 foundation | `baseline` | main | — | `01.deps-ready` (step 1), `01.contracts-ready` (step 4), `01.schema-ready` (step 5) |
| 02 shell | `baseline` | main | `01.merged` | — (merging it sets the `w0-frozen` tag/flag) |
| 03 seed | `01.schema-ready` | feat/01 | `w0-frozen` | — |
| 04, 05, 06, 07, 08, 09, 13 | `w0-frozen` | main | — | — |
| 10 delivery | `w0-frozen` | main | `03.merged` (CSV fixtures) | — |
| 11 analytics | `w0-frozen` | main | `06.merged` (charts) | — |
| 12 wizard | `03.merged` (template) | main | — | — |

Publish a flag with `bash $BIN/flag.sh 01.contracts-ready "<what is ready>"`. Wait for someone else's flag with `bash $BIN/wait-for.sh <flag>` (in the background).
**Critical path:** 01 → 02 → `w0-frozen` → everyone else. That's why **blocks 01 and 02 run brainstorm in "express" mode** (≤ 10 min, panel of 2 agents: prosecutor + tester) and publish flags as early as possible. Blocks 03–13 have plenty of time while they wait for the gate: they do a full brainstorm.

Inside a block, after the gate:
- **02** after `01.deps-ready`: `git -C $WT merge --no-edit feat/01-foundation-contracts && bash $BIN/heavy.sh $WT npm ci`. Do it again after `01.contracts-ready`.
- **Blocks after `w0-frozen`** that want the seed data: after `03.merged`, run `git -C $WT merge --no-edit main`, then `npm ci` (via heavy.sh), then `cd $WT/apps/api && npx prisma migrate deploy && npx prisma db seed`.
- **11** after `06.merged`: `git -C $WT merge main` and import the charts from `features/profitability/charts/`.

## 3. /brainstorm in "block" mode (adapts the skill to the parallel run)

The skill steps apply with these clarifications:
1. **Context.** Read `README.md` → `SUMMARY.md` → `shared/PROTOCOL.md` → `shared/CONTRACTS.md` → `shared/DESIGN-SYSTEM.md` → your `BLOCK.md` → the `BLOCK.md`, `DESIGN.md` and `HANDOFF.md` of your **neighbours** (named in your BLOCK.md under "In parallel"/"Later"). Data blocks also read `shared/GERMANY-DATA.md`.
2. **Split.** It's already done; don't split further.
3. **Questions to the owner.** The business questions are already answered: SUMMARY, `docs/specs/2026-10-14-budget-forecast-design.md` → "Open questions", and the assumptions in CONTRACTS. Ask only about **new** business ambiguity in your block. At most 1 question, prefixed `[Block NN]`, because the owner has 10 tabs open. Don't ask technical questions: decide them yourself, within CONTRACTS.
4. **Approaches.** Only inside your block (component structure, algorithm). Contracts are not up for debate (that's a CR).
5. **Panel.** One message, in parallel. The brief for every role: your BLOCK.md + CONTRACTS + your neighbours' BLOCK.md. The Architect checks file ownership (`bin/blocks.conf`) and contract compliance. The Tester takes the ACs from your BLOCK.md.
6. **Judge.** As in the skill.
7. **Spec.** Write it to **`$HIW/NN-slug/DESIGN.md`**, not to `docs/specs` (there may be no worktree yet, and neighbours read it here). The integrator commits it.
8. **Start implementation without waiting for "yes"** (the owner launched the session with the instruction "implement"), if the verdict doesn't contradict CONTRACTS. Otherwise: write a CR (`shared/change-requests/`) and keep going on a local adapter.
9. **Implementation:** failing test → code → `bash $BIN/check.sh NN` (this **replaces `/done-check`** inside the worktree). Don't run `/test-task` or e2e: write the spec file `apps/web-e2e/src/<feature>.spec.ts`, and the integrator runs it.

## 4. How to work in your worktree

- Every heavy command goes through the semaphore (at most 3 at once on the machine; it waits while `~/.claude/emu/pressure-critical` exists):
  `bash $BIN/heavy.sh $WT npx nx test web` · `… npx nx lint api` · `… npx nx typecheck budget-engine`
  For Bash calls set `timeout: 600000`, or use `run_in_background` for long ones.
- Light commands: `git -C $WT status`, `git -C $WT add <files by name>`, `git -C $WT commit -m "feat(NN): …"` (with the attribution line from the system instructions).
- Commit after every green step: small commits, a readable history.
- Status for the board: `bash $BIN/flag.sh --status NN in-progress "<what's done / what's next>"` at every milestone.
- Your files are the patterns in `bin/blocks.conf`. `check.sh` fails if you touched someone else's file. Need someone else's file? Write a CR, or `bash $BIN/note.sh <owner-id> NN "<what you need>"`.
- Notes from neighbours: `bash $BIN/note.sh --read NN`. Read them at every milestone and before merging.
- `HANDOFF.md` (`$HIW/NN-slug/HANDOFF.md`): fill it in **as you go** (exports, hooks, endpoints, usage examples), so parallel neighbours can rely on it before your merge.
- Never: `serve` on 3454/4274/4300 (use 35NN/42NN when needed, see PROTOCOL §6), e2e, `nx daemon --stop` or `pkill` in `$MAIN`, `git worktree remove`, `checkout`, `reset` or `merge` in `$MAIN` by hand, `prisma migrate dev/reset` (only 01 creates the migration).

## 5. Finishing a block

1. `bash $BIN/check.sh NN` → `CHECK: PASS` (ownership, format, affected lint/test/typecheck/build, test weakening).
2. HANDOFF is final. Your DESIGN.md is up to date.
3. `bash $BIN/merge-block.sh NN` (run_in_background). It:
   - waits for the merge-after flags;
   - merges `main` into your branch;
   - reinstalls dependencies if the lock file changed, and reruns check.sh;
   - takes the git lock, checks that main hasn't moved, and does `merge --no-ff` into main;
   - sets `NN.merged`. For 02 it also sets the `w0-frozen` tag.
4. Report to the owner: the check table with exit codes, the merge commit, what is left.

## 6. Failures and recovery

| Situation | What to do |
|---|---|
| merge-block exit 5 (conflict merging main) | Resolve **only your own files** in `$WT`, commit, run again. If the conflict is in someone else's file: `git -C $WT merge --abort`, then `note.sh <owner> NN …`, and tell the owner |
| merge-block exit 4 (dirty) | Commit, or remove your own uncommitted files in `$WT` |
| "main tree has uncommitted changes outside howItWorks/" | Someone wrote to `$MAIN` by mistake. If it was you, move the changes to `$WT` and revert them in `$MAIN` (only your own files). Otherwise tell the owner |
| check.sh fails on ownership | Revert the edits to someone else's files and write a CR |
| check.sh fails on test weakening | Fix it. A deliberate rewrite is allowed only if your BLOCK.md lists it (the allowlist is `state/NN.spec-rewrite`, added by the owner/integrator) |
| The session hit its limit or crashed | In a new session: the same prompt. `bootstrap.sh NN` is idempotent. Read `status.sh`, HANDOFF and `git -C $WT log`, then continue (or `/core-continue`) |
| A gate has been closed for a long time | `bash $BIN/status.sh` shows who is blocking. Don't bypass the gate; work on your DESIGN/tests with fixtures |
| You need a contract change (schema/types/registry/package.json) | A CR in `shared/change-requests/`. The integrator (the owner's session in `$MAIN`) applies it between merges. Meanwhile use a local adapter `// TODO CR-NN` |

## 7. The owner and the integrator

- Owner, before starting: `bash $BIN/baseline.sh` (commits the current kit and plan to main and opens the gate for 01/02). Without it everyone waits, and that is correct.
- Board: `bash $BIN/status.sh` (any terminal).
- Integrator (`00-integrator`, the owner's session in `$MAIN`): CRs, final e2e (`cfo-journey`), SOLUTION.md, the commit of `howItWorks/` and `docs/`. Merging blocks **does not need** it: it is self-service through merge-block.sh.
