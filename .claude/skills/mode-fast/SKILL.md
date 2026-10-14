---
name: mode-fast
description: Switch the session back to the default fast mode. Invoked only by the user as /mode-fast.
disable-model-invocation: true
allowed-tools: Bash(printf *), Bash(cat *)
---

Mode flag after switching: !`printf fast > .interview-mode && cat .interview-mode`

Reply with exactly one line: `Mode: <the flag value shown above>`.
If the value is not `fast`, say that the switch failed and show the output above.
