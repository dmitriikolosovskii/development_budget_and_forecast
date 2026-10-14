---
name: checkout
description: Creates a new branch from the freshest main and carries over the current work — unpushed commits via cherry-pick and all uncommitted changes including untracked files — without touching the source branch. Invoked only by the user as /checkout <name>.
disable-model-invocation: true
allowed-tools: Bash(git *)
---

Arguments: `$ARGUMENTS` = `<name> [--dry-run] [--no-commits]`.

1. **Validate:** `git check-ref-format --branch <name>`; the name is not taken locally (`git show-ref --verify refs/heads/<name>`) or on the remote.
2. **Base:** remote exists → `git fetch origin` (failure = stop) and `BASE=origin/main`; no remote → `BASE=main`.
3. **Snapshot:** `CUR=$(git branch --show-current)`; `CARRY=$(git rev-list --reverse --no-merges $BASE..HEAD)` (empty with `--no-commits`); `git status --porcelain`. With `--dry-run` print the plan and stop.
4. **Recovery point:** dirty tree → `git stash push --include-untracked -m "checkout:<name>"`.
5. **Branch:** `git switch -c <name> $BASE`. Failure → `git stash pop` on `CUR`, stop.
6. **Carry commits:** `git cherry-pick $CARRY`. Already in base → `git cherry-pick --skip`. Real conflict → resolve by meaning after reading both sides, or `git cherry-pick --abort` and report "commits intact on CUR".
7. **Restore work:** `git stash pop`. On conflict resolve, then `git stash drop`. Never drop a stash that was not applied.
8. **Report:** branch, base sha, commits carried, files restored, `git range-diff $BASE..$CUR $BASE..<name>` when commits were carried.

Never branch from a stale base. Never reset or delete the source branch — commits are copied, not moved. Never overwrite an existing branch.
