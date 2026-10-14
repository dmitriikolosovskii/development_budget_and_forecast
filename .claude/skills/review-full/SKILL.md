---
name: review-full
description: Adversarial review of the branch diff — a prosecutor and a defender subagent run in parallel, then a judge rules on each finding with file:line evidence and returns APPROVE, REQUEST CHANGES or NEEDS DISCUSSION. Use before /mr or when a thorough review is requested; /self-review is the one-pass light version.
allowed-tools: Bash(git *), Read, Grep, Glob, Agent
---

Start at once, no confirmation. Do not rewrite code during the review unless asked.

1. **Scope:** the paths in `$ARGUMENTS`, else `git diff main...HEAD` plus uncommitted and untracked files (`git status --porcelain`). Empty → say so and stop.
2. **Read every changed file in full**, not only the hunks.
3. **In ONE message launch two subagents in parallel**, each with the diff and its role file:
   - Prosecutor — `references/prosecutor.md`
   - Defender — `references/defender.md`
4. **Judge subagent** (`references/judge.md`) receives both outputs and the diff and rules on every charge. A charge without `file:line` is a hypothesis: open the file and verify before ruling.
5. **Output:**
   - summary table: aspect | OK / Fix / Block | count;
   - blocking fixes (file:line, why, concrete fix);
   - non-blocking;
   - tech debt;
   - verdict APPROVE / REQUEST CHANGES / NEEDS DISCUSSION and risk high / medium / low.

Severity hierarchy everywhere: security > correctness > reliability > architecture > tests > quality. Better one extra blocker than a missed one.
