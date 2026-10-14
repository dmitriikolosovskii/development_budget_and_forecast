---
name: test
description: Run the unit tests that matter for the current change in this Nx workspace (Jest for apps/api and libs, Vitest for apps/web). Use when asked to run tests or after changing code. Not for proving a task by its ACs (/test-task), repairing a red test (/fix-test) or the definition-of-done gate (/done-check).
allowed-tools: Bash(npx nx *)
---

1. Pick the narrowest command:
   - one project: `npx nx test <api|web|types>`
   - one file: `npx nx test api --testFile=<file>` (Jest) or `npx nx test web -- <file>` (Vitest)
   - everything touched: `npx nx affected -t test --base=HEAD`
2. In a block worktree prefix it with the memory semaphore: `bash /Users/dmitriyluba/WebstormProjects/Interview/Kairon/howItWorks/bin/heavy.sh "$PWD" <command>`; never `affected` there (`/done-check` runs it via check.sh). Run it and report the exit code and the pass/fail counts from the output.
3. On failure: show the first failing assertion, fix the cause (not the assertion), re-run the same command.
