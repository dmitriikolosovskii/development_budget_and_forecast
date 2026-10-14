---
name: create-task
description: Turns a raw task statement (text, chat quotes, screenshots) into a clear task file with goal, behaviour, atomic acceptance criteria and a how-to-verify path, critiqued by subagents. Never implements. Use when a new task or bug arrives, before designing or coding it.
allowed-tools: Read, Grep, Glob, Write, Agent
---

1. **Collect the raw input:** text, quoted conversation (keep quotes verbatim), screenshots (transcribe what they show).
2. **Dedup:** search `docs/tasks/` for the same subject. Found → show it and stop.
3. **Read only the code and docs** that make the criteria concrete.
4. **Draft at product level:**
   - Goal / pain
   - Behaviour / UX
   - Acceptance criteria — one statement = one checkable value
   - How to verify — click path or request
   - Assumptions marked `[ASSUMPTION: …]`
   No code, file or class names in the body.
5. **Critique — parallel subagents** (one adversary, one per touched area: api / web). Each point: `scenario → why it is real (source) → pointed question`. A point without a source is dropped.
6. **Ask only blocking questions**, self-contained, in plain words, with the visible consequence of each option. Merge the answers, remove resolved assumptions.
7. **Show the full draft;** write `docs/tasks/<YYYY-MM-DD>-<slug>.md` after an explicit "yes".
8. **Report the path and stop.** Next steps: `/brainstorm` for the design, `/test-task` uses these criteria.

Never start implementing. Never invent acceptance values — unknowns stay assumptions or open questions.
