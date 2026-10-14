---
name: fix-test
description: Repairs a failing Jest, Vitest or Playwright test in this workspace WITHOUT tuning it to green — reproduces it, classifies the failure as infrastructure or regression (a UI-element timeout counts as regression), and for a regression stops, lists 2–4 hypotheses, finds the root cause (core-debug) and fixes the product. Use when a specific test is red ("fix the test", "spec fails"). Not for build or type errors (build-error-resolver), proving a new task (/test-task), or an intended behaviour change the owner has not approved.
argument-hint: "<failing test name or spec path>"
allowed-tools: Read, Edit, Grep, Glob, Agent, Bash(npx nx *), Bash(git *), Bash(bash *)
---

The iron rule: **fix the cause, never the assertion.** Turning the light green is not the same as fixing it.
`$MAIN` = `/Users/dmitriyluba/WebstormProjects/Interview/Kairon`.

1. **Reproduce exactly this test** and keep the output. In a worktree, run it through `"$MAIN/howItWorks/bin/heavy.sh" "$PWD"`.
   - `npx nx test api --testFile=<file> -t '<name>'`. Use `budget-engine` or `types` the same way.
   - `npx nx test web -- <file> -t '<name>'`
   - e2e, main tree only: `bash howItWorks/bin/e2e.sh --grep "<name or [AC-NN.M]>"`
2. **Classify the failure.** Explain what broke in plain words.
   - **Infrastructure:**
     - a port is busy (3454/4274/4300), or the API is not up;
     - a stale `prisma generate`, or a missing `dev.db` (`npx prisma migrate deploy`);
     - a merge without `npm ci`;
     - no Playwright browser, or the e2e lock is held.

     Fix the environment and rerun **once**.
   - **Regression:** a deterministic failure on an `expect`. A UI-element timeout (`findBy*` or `toBeVisible` never came)
     also counts as a regression unless the logs prove the server did not answer.
3. **For a regression, stop and diagnose.**
   - Find the AC: `grep -o '\[AC-[0-9.]*\]' <file>` → read the line in `$MAIN/howItWorks/NN-*/BLOCK.md` and the related
     section of `howItWorks/shared/CONTRACTS.md`.
   - Write 2–4 hypotheses, each with its trade-off: `git log --oneline -15 -- <files>`, `git log -S '<symbol>'`.
     A recent merge (`git log --merges -5`) is the first suspect.
   - Find the root cause with `core-debug`: reproduce, compare the working and broken paths, settle on one hypothesis
     with evidence. No fix without an established root cause.
   - Fix the **product** in files you own. If the cause is in another block's files, write a CR or tell that block. If
     the business meaning is unclear (the change may be intended), ask the owner one question.
4. **For a bug,** a test that fails on the old code for the right reason must exist first. The failing test usually
   is that test. If the bug is wider than the test, add a red test first (`test-automator`).
5. **After the fix.** Rerun the same test and confirm it is green. Then ask `regression-scout` which neighbouring ACs
   to re-run, run them, and run `/done-check`.

Forbidden, because these mask a breakage:
- editing the assertion, loosening a matcher (`toBe` → `toBeDefined`, `toHaveLength(1)` → `>= 1`), or raising a timeout;
- `-u` / `--update-snapshots` without reviewing every change;
- `.skip` / `.fixme` / `.todo` / `x`-prefixed tests;
- retrying an assertion failure until it goes green;
- deleting the code that implements an AC so the test "is no longer needed".

If the expectation really must change, because the owner approved new behaviour: update the AC line in BLOCK.md
first (main tree), then the test (named, with the reason in the commit message), then the code.

Report:
- what failed and its class;
- the hypotheses and the confirmed root cause;
- what changed in the product;
- red→green with commands and exit codes;
- what else was run;
- whether the test was left unchanged, or what changed in it and why.
