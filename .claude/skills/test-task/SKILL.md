---
name: test-task
description: Proves the current task works by its acceptance criteria — AC-NN.M from the block's BLOCK.md (or the task text), each guarded by a test tagged [AC-NN.M] (Jest/Vitest in blocks, Playwright e2e written in blocks but run only in the main tree), with a negative assertion beside each positive one and red-proof (red without the fix, green with it). Use when a feature or bug fix is implemented and before claiming it is done. Not for repairing a failing test (/fix-test) or the full pre-ship regression (/e2e-full).
allowed-tools: Read, Write, Edit, Grep, Glob, Agent, Bash(npx nx *), Bash(npx playwright *), Bash(git *), Bash(bash *)
---

`$MAIN` = `/Users/dmitriyluba/WebstormProjects/Interview/Kairon`. Always read `howItWorks/` from `$MAIN`, never
from a worktree copy.

1. **Criteria come from the task, not from the screen.**
   - In a block, the source is the `- AC-NN.M` lines of `$MAIN/howItWorks/NN-*/BLOCK.md`.
   - For a new task or bug, the source is `docs/tasks/…`, the spec, or the user's exact words. Write them as new
     `AC-NN.M` lines in the main tree: the next free number in the right block, or `00` for cross-cutting work.
   - One statement = one checkable value. Fix the ACs BEFORE the fix, and narrow one only with the user's words.
   - Each AC's kind comes from its marker: `(Vitest)`, `(Jest)`, `(e2e…)`, or `(manual)`/`(check)`, which need no test.
2. **Write the test in the tier the marker names.** Use `test-automator` if the test is non-trivial; spawn at most one
   test-running subagent per session.
   - Pure money, rollup or schedule logic: `libs/shared/budget-engine/src/lib/*.spec.ts`. Use exact cents and pass `today` in explicitly.
   - API: Jest next to the module, with Prisma mocked.
   - Web: Vitest + Testing Library next to the component, with fake timers (autosave is 400 ms), mocked `fetch` and `findBy*`.
   - e2e: `apps/web-e2e/src/<feature>.spec.ts`. In `beforeEach`, `POST /api/projects/<taucha id>/duplicate`, then work on the copy.
   - The title is tagged `[AC-NN.M]`, one bracket per id. Use one decisive `expect` per AC.
3. **Add a negative assertion next to each positive one**, such as:
   - exactly one PATCH;
   - no error banner;
   - the source or demo project unchanged;
   - the other rows not re-rendered.

   Use stable selectors (roles, labels, `data-testid`).
4. **Red-proof.** A test that was never red proves nothing. Commit first, so the tree is clean.
   ```bash
   MB=$(git merge-base main HEAD); before=$(git status --porcelain)
   git diff "$MB" -- <product files only, no specs> > /tmp/red-$$.patch && git apply -R /tmp/red-$$.patch
   <the tagged test command>     # must FAIL on the tagged assertion (a compile error counts, but say so)
   git apply /tmp/red-$$.patch && [ "$(git status --porcelain)" = "$before" ] && echo restored
   ```
   Never use `git stash` or `git checkout` for this. If the test fails before any assertion (setup or import), that
   is not red-proof.
5. **Run.**
   - Block: `bash "$MAIN/howItWorks/bin/heavy.sh" "$PWD" npx nx test <api|web|budget-engine|types> …`. For e2e ACs,
     the block only writes the spec. The main tree runs it later with `bash howItWorks/bin/e2e.sh --grep "AC-NN\."`.
   - Main tree: `bash howItWorks/bin/e2e.sh --grep "<AC ids>"`. It takes the lock and checks the JSON report against the ledger.
6. **Triage.** A failure before any assertion (port busy, server down, browser missing) is infrastructure: fix it and
   rerun once. A failure on an assertion or a UI-element timeout is a regression: stop and use `/fix-test`.
7. **Store the red-proof.** Append to `$MAIN/howItWorks/NN-*/HANDOFF.md` (absolute path, main tree), section
   `## Red-proof`: one line per AC — `AC-NN.M · spec file · red: <failing assertion / compile error> · green: <command>, exit 0`.
   Run results live in `docs/test-runs/` (see its README); the ratchet there fails any AC that was proven once.
8. **Report.** Show a table `AC | test file:line | red? | green?` and the ledger rows
   (`bash "$MAIN/howItWorks/bin/ac-ledger.sh" --block NN`). Include the commands with their exit codes and what is
   NOT covered (`manual`). Then run `/done-check`.

Never weaken, delete or `.skip` an assertion, and never raise a timeout to get green. Never change the expected value
after a red run without re-running red. A second red on the same criteria means stop tuning and find the root cause.
"Done" means every AC is green, not "the fix had an effect".
