---
name: done-check
description: Definition-of-done gate before claiming a task is finished. In a block worktree it runs howItWorks/bin/check.sh and the block's AC ledger; in the main tree it runs format, affected lint/test/typecheck, the test-weakening check and the full AC ledger. Judged by exit codes. Use when about to say "done" or "finished" ("is it done?", "run the DoD"), and always in process mode. Not for repairing a red test (/fix-test) or the pre-ship regression (/e2e-full).
allowed-tools: Bash(npx nx *), Bash(git *), Bash(bash *)
---

Run each step and report its exit code. "Done" is allowed only if every step exits 0.
`$MAIN` = `/Users/dmitriyluba/WebstormProjects/Interview/Kairon`.

**Where am I?** Run `git rev-parse --show-toplevel`.

## A. Block worktree (`…/Kairon-wt/NN-slug`)

1. `bash "$MAIN/howItWorks/bin/check.sh" NN`. It checks file ownership, that `howItWorks/` is unedited, format,
   `affected` lint/test/typecheck/build against the merge base with `main` (through the memory semaphore), and
   test weakening. Use `--quick` (no build) only for intermediate runs, never for the final one.
2. `bash "$MAIN/howItWorks/bin/ac-ledger.sh" --block NN`. Every unit AC of the block must be `OK`. e2e ACs stay
   `UNRUN`, because only the main tree runs them; their spec files must exist and be tagged. `REGRESSED` (an AC proven
   earlier, see `docs/test-runs/`) is always a blocker. If any AC is
   `UNCOVERED` or `SKIPPED`, the block is not done: write the test (`test-automator`), or ask the owner to drop the AC.
3. **Red-proof** for a bug fix or a new AC: `/test-task` step 4.

Never run `serve` or `e2e` in a worktree (PROTOCOL §6–7).

## B. Main tree

1. `npx nx format:write --uncommitted`
2. `bash howItWorks/bin/heavy.sh "$PWD" npx nx affected -t lint test typecheck --base=HEAD`
3. Test weakening: `git diff HEAD -- '*.spec.ts' '*.spec.tsx' | bash -c '. howItWorks/bin/lib.sh; weakening_lines'`.
   The output must be empty. If it isn't, the only allowed exception is a rewrite the owner asked for, named in the report.
4. `bash howItWorks/bin/ac-ledger.sh`: exit 0, which means no ORPHAN, DUPLICATE or REGRESSED (against
   `docs/test-runs/ledger-baseline.txt`), and no gaps in merged blocks.
5. If `apps/web/src`, `apps/api/src` or `apps/web-e2e` changed after a merge, run `bash howItWorks/bin/e2e.sh`
   (it holds the e2e lock). If no block is merged yet, skip it and say so.
6. If `.claude/` or `howItWorks/bin/` changed, run the tooling tests:
   - `bash howItWorks/bin/ac-ledger.sh --self-test`
   - `bash howItWorks/bin/tests/check-weakening.test.sh`
   - `bash howItWorks/bin/tests/e2e.test.sh`
   - `bash howItWorks/bin/tests/app.test.sh`

Report a short table of step, command and exit code. If any step fails, say "not done" and fix the cause, never
the assertion (`/fix-test`).
