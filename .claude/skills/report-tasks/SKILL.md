---
name: report-tasks
description: Summarises a day's work across all sessions of this repo as numbered "did X so that Y" lines, with git commits as the spine and session transcripts only to recover the why. Invoked only by the user as /report-tasks [YYYY-MM-DD].
disable-model-invocation: true
allowed-tools: Bash(git *), Bash(jq *), Bash(find *), Bash(date *), Bash(cut *), Bash(ls *), Agent
---

1. **Day:** `TODAY=${ARGUMENTS:-$(date +%F)}`.
2. **Spine:** `git log --all --since="$TODAY 00:00" --until="$TODAY 23:59" --author="$(git config user.email)" --pretty='%h %d %s'`.
3. **Dedup:** the same normalized subject on several branches = one task; related commits become sub-items 1.1, 1.2. When in doubt keep two lines.
4. **Why, if commit messages are poor:** from `~/.claude/projects/<repo path with / replaced by ->/*.jsonl` extract that day's user messages with `jq` only, truncated with `cut -c1-400`. Skip the current (newest) session. For large sessions delegate to a subagent under the same rule.
5. **Drop trivia** into one closing line "+ minor: …".
6. **Delivery caveat from git, not from chat:** commits not on `main` (or on no remote) → one line "not yet merged: items N, M".
7. **Print one copyable block:** a header line with the count and the main result, then `1. <task>: did X, so that Y`. First person, no file or class names.

Never open a `.jsonl` with Read or cat — `jq` with truncation only. Never invent money, numbers or value: no value is better than a made-up one. Empty result → "no committed work found for <date>, check the date", never "nothing was done". Never quote raw transcript text. Nothing is written to files.
