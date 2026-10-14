---
name: mr
description: Ships the current branch — scoped commits by file name, checks and review, merge of main, a completeness check, push of the branch and a PR with a what / why / how-to-verify body. Reports "delivered" only from git and PR state. Invoked only by the user as /mr.
disable-model-invocation: true
allowed-tools: Bash(git *), Bash(npx nx *), Bash(gh *), Read, Grep, Skill, Agent
---

1. **Branch gate:** on `main` → stop: "create a branch first: /checkout <name>". Never create or switch branches yourself.
2. **Commit plan:** `git status --porcelain` → table `file | scope (api, web, types, e2e, chore) | message type(scope): …`. Exclude `.env*`, secrets (by path and by content: `PRIVATE KEY`, tokens), scratch files. Print the plan and go on.
3. **Commit by name:** `git add <files>` and `git commit`, one commit per scope. A hook failure is fixed in the code (up to 3 attempts), never with `--no-verify`.
4. **Sync:** if a remote exists — `git fetch origin && git merge --no-edit origin/main`. Resolve conflicts by keeping both sides' intent; never drop the other side's hunk. Below, `BASE` = `origin/main`, or `main` without a remote.
5. **Checks on the merged state:**
   - `npx nx format:check`
   - `npx nx affected -t lint test typecheck build --base=$BASE`
   - `bash howItWorks/bin/e2e.sh` when `apps/web/src` or any `*.controller.ts` changed (main tree, e2e lock, AC ledger).
   Red = fix now, not "pre-existing".
6. **Review:** `/review-full` on `git diff $BASE...HEAD`. Blockers are fixed, then back to step 2.
7. **Completeness:** `git rev-list --count HEAD..$BASE` must be 0; every file in `git diff --name-status $BASE HEAD` is explained by the plan.
8. **Push:** `git push -u origin <branch>` — the permission prompt is expected; the owner approves it. Never push to `main`, never force.
9. **PR:** `gh pr create --base main --title "<type(scope): …>" --body-file -`. Body sections: What changed · Why · How to verify (exact `npx nx` commands and click path) · Affected projects · Risks and edge cases · Prisma migration yes/no. No `gh` or no remote → print the body for the owner.
10. **Report:** commits, checks table with exit codes, review verdict, PR link or "push pending".

Never `git add -A` or `git add .`. Never rebuild a branch with plumbing commands — only a real merge and a push of the real HEAD. Never push or report done before review and checks are green. "Delivered" only for what git and the PR show.
