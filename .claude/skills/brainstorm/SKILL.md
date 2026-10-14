---
name: brainstorm
description: Turns a feature idea or change request into a dated design spec before any code — self-gathered context, one-question-at-a-time clarification, 2–3 candidate approaches, an adversarial subagent panel and a judge — then hands off to implementation. Use when asked to build or change behaviour and the approach is not obvious.
allowed-tools: Read, Grep, Glob, Write, Agent, Bash(git *), Bash(npx nx *)
---

Design before code. No code, scaffolding or tests until the panel has run and the spec file exists.

1. **Gather context yourself first.** Read the related code, `docs/specs/`, `docs/tasks/`, `docs/architecture/` — search by feature name and by code path. For a bug, check `git log -S`/`git log --grep` for earlier fixes of the same symptom: a recurrence changes the design.
2. **Split** a request that spans independent parts (`api`, `web`, `types`) into separate specs and propose an order.
3. **Clarify one question per message**, multiple choice where possible, and only about business ambiguity: goal, non-goals, constraints, how "done" will be checked. Decide technical questions yourself.
4. **Propose 2–3 distinct approaches**, each with one line of essence and its trade-off (complexity, risk, migration, touched projects). Name your favourite. YAGNI: no unrelated refactoring.
5. **Panel — in ONE message, parallel subagents:**
   - Prosecutor: why the favourite fails; each claim `{claim, evidence file:line, what would refute it}`.
   - Advocate: why it is justified.
   - Architect: conflicts or duplication with existing modules, Nx boundaries (`scope:*`), docs.
   - Tester: which existing tests are at risk; new acceptance criteria as `AC-NN.M` lines (next free number in the owning block of `howItWorks/`, `00` for cross-cutting).
   Scale the brief to the task, never skip the panel.
6. **Judge subagent** weighs everything by security > correctness > reliability > architecture > tests > quality and returns: chosen approach, mandatory constraints, risk level. A claim "library X cannot do Y" counts only with a live probe.
7. **Write `docs/specs/<YYYY-MM-DD>-<slug>-design.md`:** Goal / Non-goals · Chosen approach and why not the others · Judge constraints · Affected files · Risks · Test strategy with AC-N · How to verify · Open questions. Re-read it for placeholders and contradictions.
8. **Show the spec in full.** Start implementing automatically only if the verdict is positive, the first step is reversible and the user did not ask for "spec only". Otherwise wait for "yes".
9. **Implementation:** failing test → code → `/test-task` for user-visible behaviour → `/done-check`.

A rejected spec goes back to step 4 with a fresh panel; two rejections in a row go back to step 3.
