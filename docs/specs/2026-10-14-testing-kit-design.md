# Testing kit for parallel block sessions (adapted from DraftIq)

Date: 2026-10-14 · Scope chosen by the owner: **lean core** · Panel verdict: **A-modified, risk medium**

## Goal

Give every Kairon session (the ≤5 block worktrees and the main tree) one consistent testing toolkit, adapted from
`DraftIq/draftiq_app/.claude`. It should:
- prove each block's acceptance criteria (`AC-NN.M` in `howItWorks/NN-*/BLOCK.md`) with tagged tests;
- show that the tests catch the bug (red-proof);
- find lost guards before the merge;
- fix failing tests without weakening them.

It must fit the 3-hour timebox and the 24 GB memory budget.

## Non-goals

- The DoD Stop-hook gate with markers (`write-task-marker.sh`, `dod-test-task-gate.sh`), and the ratchet against `origin/main`.
- Prod, deploy and delivery pieces: `completion-auditor`, `prod-acceptance-visualizer`, `product-accept`, `adversarial-verifier`.
- The `qa-lead-orchestrator` and `qa-judge` agents. There is no integrator session to host them, because `merge-block.sh` merges blocks itself. Each one would also add subagent fan-out on a 24 GB machine.
- `registry-coverage-analyst` and `/pin-feature`: `ac-ledger.sh` and `/e2e-full` cover them.
- A Playwright MCP server. The exploratory tester uses the Playwright CLI and runner, and the global MCP rules say not to add a `.mcp.json` "for later".
- The e2e side issues: web-e2e `tags: []`, port 4274 vs 4300, and `webServer` starting only the web app. These are owned by block 01 (CONTRACTS §7) and are listed under Open questions.

## Chosen approach and why not the others

**A-modified: adapt a lean core natively.** There is one AC registry, the `- AC-NN.M` lines in BLOCK.md. Tests carry `[AC-NN.M]` in their titles, and one script reconciles the two. The skills know whether they are running in a block worktree or in the main tree.

- **B, port DraftIq verbatim (rejected).** It would bring in Telegram, PII, deploy and prod-only steps. It would keep the `AC:<slug>/<n>` tags and `docs/acceptance`, which contradict PROTOCOL §7 and all 94 ACs in BLOCK.md. It would also keep e2e runs inside blocks.
- **C, scripts only in `howItWorks/bin` (rejected).** It is deterministic, but it has no test-writing or exploratory layer, and that layer is what the owner asked to adapt.

Inconsistencies in the current kit that A fixes:
1. **Tag format.** `test-task` and `e2e-full` use `AC:<slug>/<n>`. PROTOCOL §7 and every BLOCK.md use `[AC-NN.M]`.
2. **Registry location.** The registry is `docs/acceptance/` (empty), while the real ACs are in BLOCK.md.
3. **Scan scope.** `e2e-full` scans only `apps/web-e2e`, but most ACs are Jest or Vitest tests.
4. **e2e inside blocks.** `done-check` step 3 runs e2e in blocks, which PROTOCOL §6–7 forbids.
5. **Serving in blocks.** `test-task` tells blocks to serve the API.

## Final components

| Kind | Path | Status |
|---|---|---|
| Script | `howItWorks/bin/ac-ledger.sh` (+ `howItWorks/bin/tests/ac-ledger.test.sh`, fixtures built in a temp dir) | new |
| Script | `howItWorks/bin/e2e.sh`: the only e2e entry — main tree only, holds the `e2e` mkdir lock for the whole run (a lock taken in one Bash tool call dies with that shell), Playwright list+JSON, then `ac-ledger.sh --e2e-report`; `--exec CMD` for exploratory scripts (+ `tests/e2e.test.sh`) | new |
| Script | `howItWorks/bin/check.sh`: weakening check also catches `test.fixme`, `.todo`, `xdescribe`, `describe.skip`, `it.skip`/`test.skip` | edit |
| Agent | `.claude/agents/test-automator.md`: turns a confirmed defect or an uncovered AC into a tagged test with red-proof | new |
| Agent | `.claude/agents/regression-scout.md`: diff → ACs and spec files to re-run, including those outside the diff (read-only) | new |
| Agent | `.claude/agents/exploratory-qa-tester.md`: main tree only, once before shipping, charters and evil data via the Playwright CLI, no code edits | new |
| Skill | `/done-check`: in a worktree → `$MAIN/howItWorks/bin/check.sh <id>`; in the main tree → the full gate + `ac-ledger.sh` | rewrite |
| Skill | `/test-task`: ACs come from BLOCK.md or the task text; tags `[AC-NN.M]`; Jest/Vitest in blocks; e2e specs are written in blocks but run only in the main tree | rewrite |
| Skill | `/e2e-full`: main tree only, under the `lib.sh` mkdir lock; run-many + e2e with the JSON reporter + `ac-ledger.sh --e2e-report` | rewrite |
| Skill | `/fix-test`: classify infra vs regression → hypotheses → fix the product, never the assertion | new |
| Skill | `/test`: unchanged except for routing heavy runs through `heavy.sh` in a worktree | small edit |
| Docs | `.claude/CLAUDE.md` (Commands/Artifacts), `README.md` command list, `howItWorks/shared/PROTOCOL.md` §7, `brainstorm` (AC naming), delete `docs/acceptance/` | edit |

### `ac-ledger.sh` contract

- **Registry.** Lines matching `^- AC-[0-9]{2}\.[0-9]+` in `$MAIN/howItWorks/[0-9][0-9]-*/BLOCK.md`. The kind comes from the line's marker (`(Vitest)`, `(Jest)`, `(e2e…)`, `(manual…)`); if there is none, it comes from the default in the section heading. ACs of block 00, ACs marked `manual`, and ACs whose text checks git history or `SOLUTION.md` are reported as `MANUAL`.
- **Tags.** Only inside `it|test|describe(` titles, in `apps/**` and `libs/**` (`*.spec.ts(x)`, `*-e2e/src/**/*.ts`), excluding `node_modules`, `dist` and `.nx`. Matching is exact, so `[AC-01.1]` ≠ `[AC-01.10]`. A title may carry several tags.
- **Buckets.**
  - `OK`: a live tag. For e2e ACs, also `passed` in `--e2e-report <playwright json>` when one is given; without a report an e2e AC is `UNRUN`.
  - `UNCOVERED`, `SKIPPED` (skip, fixme, todo, x-prefixed), `ORPHAN` (tag without a registry line), `DUPLICATE` (the same id twice in the registry), `MANUAL`.
  - The last line is `SUMMARY`.
- **Exit codes.** Exit 1 only for:
  - `ORPHAN` or `DUPLICATE` anywhere;
  - `UNCOVERED` or `SKIPPED` in a merged block (`state/NN.merged`) or the block given with `--block NN`;
  - in `--e2e-report` mode, a failed or unrun e2e AC of a merged block.

  Otherwise exit 0. Stretch blocks that are not merged never fail the check.
- Bash 3.2. `--self-test` runs the fixture suite.

## Addendum (2026-10-14, owner: "where are test results stored, so there is no regression?")

The first version had no persistent results: the e2e JSON lived in `/tmp` and ledger output only in the console, so
"proven once" could silently become "not covered" again. Added (owner chose storage in git, since the history is part
of the result):
- `docs/test-runs/<stamp>-e2e.md`: one record per `e2e.sh` run (verdict, commit, scope, exit codes, ledger rows that
  are not OK/MANUAL, e2e tests that did not pass), committed at once by `e2e.sh` via `main-commit.sh`. The main tree
  must stay clean outside `howItWorks/`, otherwise `merge-block.sh` stops with `main-dirty`.
- `docs/test-runs/ledger-baseline.txt`: the regression ratchet. A union of ACs proven OK, grown only after a green
  FULL run. `ac-ledger.sh` reads it by default and reports `REGRESSED` (exit 1, any block, merged or not) when one
  is no longer OK. e2e ids are judged only when a report is given; `--block` limits it to that block; ids removed
  from BLOCK.md show as `RETIRED` (info).
- Red-proof per AC: the block's `howItWorks/NN-*/HANDOFF.md`, section `## Red-proof`. Blocks can't write to `docs/`,
  because `check.sh` enforces file ownership.
- `howItWorks/bin/pw-report.js`: shared Playwright JSON parser (ledger + run record).
- Tooling ACs: AC-11 ledger baseline tests R8–R12 pass, and a mutant that ignores REGRESSED fails 3 of them;
  AC-12 `e2e.test.sh` run-record cases pass (green record + baseline + commit, red record keeps the baseline,
  `--grep` partial, `KAIRON_E2E_NO_COMMIT`).

## Addendum 2 (2026-10-14, owner: "set everything up, including Playwright MCP, so the finished app can be worked through")

- Playwright MCP registered for this repo only: `claude mcp add -s local playwright-kairon -- ~/.local/npm-global/.../playwright-mcp
  --headless --isolated --browser chromium --viewport-size 1440,900 --output-dir /tmp/kairon-explore/mcp
  --allowed-origins "http://localhost:4274;http://localhost:3454;http://localhost:4300"`. It is named `playwright-kairon`
  because `playwright` is taken in `~/.claude/mcp-optional.json` with another config (MCP rule 5). It uses the pinned
  shared binary (0.0.80, rule 8), and worktrees don't get it (local scope is keyed to the main repo path). The live
  probe passed: launch, navigate, `browser_snapshot` shows heading and button, a foreign origin is blocked.
- `howItWorks/bin/app.sh up [--seed] | down | status`: main tree only. It takes the same `e2e` lock as `e2e.sh`, and
  the lock's pid becomes the api server's, so the lock lives exactly as long as the app. It starts api and web in
  their own process groups; `down` stops them and then runs the CLAUDE.md stop order. Tests: `tests/app.test.sh`.
- `/explore-app`: the SUMMARY §3 journey through MCP at 3 viewports with console and network checks, then one
  `exploratory-qa-tester` (now MCP-first), then a record `docs/test-runs/<stamp>-explore.md`, committed.
- `.claude/settings.json`: allow `mcp__playwright-kairon`, deny `mcp__playwright-kairon__browser_run_code_unsafe`.
- Block 01's branch already has the e2e webServer config (api 3454 + preview 4300); it is left to block 01.

## Judge constraints (binding)

1. The only tag format is `[AC-NN.M]` in `it`/`test`/`describe` titles. Every mention of `AC:<slug>/<n>` and `docs/acceptance` is removed.
2. IDs match exactly (`AC-01.1` ≠ `AC-01.10`). Duplicate registry IDs are reported. Multiple tags per test are allowed.
3. UNCOVERED fails only for merged blocks or for `--block NN`. Manual, integrator and git/SOLUTION ACs are MANUAL. Unmarked ACs inherit the heading default.
4. A Playwright AC counts as OK only when it is `passed` in the JSON report. For Jest/Vitest a live tag is enough, because `check.sh` runs those tests.
5. `check.sh` stays the merge gate. The ledger is advisory inside blocks and mandatory in `/e2e-full`.
6. Every heavy command in the skills and agents goes through `howItWorks/bin/heavy.sh`. At most **one** test-running subagent per session. The global emulator and memory rules apply.
7. All of `.claude/**`, `ac-ledger.sh` and the docs changes are **committed before `baseline.sh`/`bootstrap.sh`**, because worktrees only get committed files. Right now most skills are untracked (`??`).
8. In the same change:
   - CLAUDE.md Commands and Artifacts and the README command list are updated.
   - PROTOCOL §7 says that blocks run `check.sh` (affected against the merge base) instead of "do not run affected".
   - The e2e lock is the `lib.sh` mkdir lock `/tmp/kairon-locks/e2e`, not `/tmp/kairon-e2e.lock`.
9. **Red-proof.** Reverse the block's **product** files from `merge-base..HEAD` (`git diff $MB HEAD -- <product files> | git apply -R`), run the tagged tests, then re-apply. Never use `stash` or `checkout`. `git status` must be unchanged afterwards. For a new feature a compile error counts as red, but the report must say so.
10. The tooling's own acceptance is AC-1..AC-10 below.

## Affected files

- New:
  - `howItWorks/bin/ac-ledger.sh`
  - `howItWorks/bin/tests/ac-ledger.test.sh` + `howItWorks/bin/tests/fixtures/**`
  - `.claude/agents/{test-automator,regression-scout,exploratory-qa-tester}.md`
  - `.claude/skills/fix-test/SKILL.md`
- Edited:
  - `howItWorks/bin/check.sh` (weakening regex)
  - `.claude/skills/{done-check,test-task,e2e-full,test,brainstorm}/SKILL.md`
  - `.claude/CLAUDE.md`
  - `README.md`
  - `howItWorks/shared/PROTOCOL.md` §7
  - `howItWorks/00-integrator/BLOCK.md` (e2e lock path)
- Deleted: `docs/acceptance/.gitkeep`.
- Not touched: product code, `playwright.config.ts`, `project.json` (owned by block 01).

## Risks

| Risk | Mitigation |
|---|---|
| This lands late and the blocks start on the old kit | Constraint 7: it is a precondition for `baseline.sh`. The integrator's step 1 checks `git status .claude` is clean |
| False alarms from the ledger slow the blocks down | Scoped to merged blocks and `--block`. Advisory inside blocks |
| Subagents running tests freeze the machine | `heavy.sh` semaphore (3 slots), one test-running subagent per session, the exploratory tester only in the main tree |
| A red-proof reverse leaves the tree dirty | Patch-based reverse with a `git status` before/after check, a trap that re-applies, and no stash |
| Agent and skill descriptions overlap | Each description names its negative boundary. `core-skill-lint` checks overlap |

## Test strategy (tooling acceptance)

- **AC-1** `bash howItWorks/bin/ac-ledger.sh --self-test` exits 0. The fixtures cover OK, UNCOVERED, SKIPPED (skip/fixme/todo/xdescribe), ORPHAN, DUPLICATE, MANUAL, UNRUN, e2e routing (an e2e AC tagged only in a unit spec → UNCOVERED), prefix safety (`[AC-01.10]` does not cover AC-01.1), multiple tags, and an exact `SUMMARY` line.
- **AC-2** Mutation: breaking the matcher (prefix-unsafe regex) makes `--self-test` exit ≠ 0.
- **AC-3** On the real repo now: exit 0, `ORPHAN=0`, `DUPLICATE=0`, and all 94 registry lines are classified (AC-00.1/00.3/00.4 and AC-01.11 got an explicit `(check)` marker, AC-00.2 an `(e2e, integrator)` marker).
- **AC-4** Demo with a temporary spec:
  - with the tag `it('… [AC-05.1]')`, AC-05.1 is OK;
  - with `it.skip`, it is SKIPPED, and with `--block 05` the exit code is 1;
  - after the file is removed, the output matches the baseline.
- **AC-5** It runs under `/bin/bash` 3.2 (no `declare -A`, `mapfile`, `${x,,}` or `grep -P`).
- **AC-6** `check.sh` weakening check (`weakening_lines` in `lib.sh`): fixture diffs that add `test.fixme(`, `it.todo(`, `xdescribe(` or `describe.skip(` are flagged (`howItWorks/bin/tests/check-weakening.test.sh`).
- **AC-7** `core-skill-lint` and `core-claude-lint` pass for the 3 agents and the 5 changed or new skills.
- **AC-8** `grep -rn 'AC:<\|AC:[a-z]\|docs/acceptance' .claude README.md howItWorks` → no matches.
- **AC-9b** `bash howItWorks/bin/tests/e2e.test.sh` exits 0: `e2e.sh` refuses outside the main tree (exit 2), runs `--exec` under the lock, releases it, and passes the exit code through.
- **AC-9** The `/done-check` text routes worktree → `check.sh <id>` and main tree → full gate + ledger. Neither path runs e2e inside a worktree (grep check).
- **AC-10** After the commit, `git status --porcelain .claude howItWorks/bin` is empty, so it is ready for `baseline.sh`.

## How to verify

```bash
bash howItWorks/bin/ac-ledger.sh --self-test; echo "exit $?"
bash howItWorks/bin/ac-ledger.sh; echo "exit $?"
bash howItWorks/bin/tests/check-weakening.test.sh; echo "exit $?"
grep -rn 'AC:[a-z<]\|docs/acceptance' .claude README.md howItWorks; echo "exit $? (1 = none)"
```

Then run `/core-skill-lint` and `/core-claude-lint` on `.claude`, then `/done-check` in the main tree.

## Open questions

0. **Constraint 7 was overtaken (2026-10-14 10:55).** `baseline.sh` ran while this was being implemented. `0adaf17` contains the ledger, the scripts, the BLOCK.md markers and early agent versions, but the OLD `/done-check`, `/test-task` and `/e2e-full`. Worktrees 01 and 02 were cut from it. Fix: commit the rest to main with `bin/main-commit.sh` BEFORE `w0-frozen` (blocks 04–13 are cut from main after it), then tell 01 and 02 to `git merge main` (`bin/note.sh`). Block 03 is cut from `feat/01`, so it gets the kit once 01 merges main.
1. **Commit permission (owner).** Constraint 7 needs the kit committed before the baseline. CLAUDE.md says "do not commit unless asked", so a separate "commit" from the owner is needed.
2. **Block 01 e2e wiring (findings, not part of this change).** Playwright `webServer` starts only `web:preview` on 4274, while the plan says api 3454 + preview 4300. Also, `apps/web-e2e/project.json` has `tags: []` and no `scope:*`. Block 01 owns both. Before the start, add them to `01-foundation-contracts/BLOCK.md` steps or confirm that they are already there.
