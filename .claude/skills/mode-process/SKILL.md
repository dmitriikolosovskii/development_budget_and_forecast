---
name: mode-process
description: Switch the session to "show the process" mode (plan, test first, verify before done). Invoked only by the user as /mode-process.
disable-model-invocation: true
allowed-tools: Bash(printf *), Bash(cat *)
---

Mode flag after switching: !`printf process > .interview-mode && cat .interview-mode`

Reply with exactly one line: `Mode: <the flag value shown above>`.
If the value is not `process`, say that the switch failed and show the output above.
From the next prompt on, follow the `[mode: process]` checklist that is injected with each prompt.
