# 00 — Integrator: design (brainstorm in block mode)

Date: 2026-10-14 · Verdict: **A2 (integrator worktree + watcher), risk medium** · Panel: prosecutor, advocate, architect, tester → judge.

## Goal
- Keep the 13 block sessions flowing:
  - apply CRs to frozen files without blocking anyone's merge;
  - notice merges, conflicts, failed checks and a dirty main without spending the session's context on polling.
- Finish the job:
  - `cfo-journey.spec.ts` (AC-00.2);
  - `SOLUTION.md` with the 6 sections (AC-00.3);
  - the README run section;
  - one architecture doc;
  - a green full `run-many` in main (AC-00.1);
  - a `--no-ff` merge per block (AC-00.4).

## Non-goals
- Merging blocks. That is self-service through `merge-block.sh`.
- Committing or stashing another session's uncommitted work (`.claude/**`, `bin/e2e.sh`, other blocks' HANDOFFs).
- Changing block-owned files. Before `w0-frozen` the frozen files belong to block 01/02, so a CR raised before the freeze is sent to them with `note.sh`.
- Push, rebase, squash. The owner runs `/mr`.

## Chosen approach and why not the others
**A2: the integrator is block `00` with its own worktree and branch** (`Kairon-wt/00-integrator`, `feat/00-integrator`). Every change outside `howItWorks/` lands there:
- CR batches;
- the final `SOLUTION.md`, README, docs and `cfo-journey.spec.ts`.

Each change lands through `check.sh 00` → `merge-block.sh 00`, the same path every block uses. Coordination files in `howItWorks/` are committed with `main-commit.sh` using **explicit paths**.

A background watcher, `bin/integrator-watch.sh`, wakes the session only when there is something to do.

Rejected alternatives:
- **A1 (edit directly in the main tree).** `merge-block.sh` refuses to merge when main has *any* change outside `howItWorks/`. A CR edit or a `SOLUTION.md` draft sitting in main would fail every block's merge. `main-commit.sh` locks only around add+commit. Frozen-file edits would also land without `check.sh`.
- **B (poll `status.sh` by hand).** It costs context and reacts late.
- **C (passive finish only).** CRs would go unapplied and blocks would stall (PARALLEL-RUN §6).

## Judge constraints (binding)
1. Row `00|00-integrator|w0-frozen|main||<PROTOCOL §4 frozen globs> SOLUTION.md README.md docs/* apps/web-e2e/src/cfo-journey.spec.ts` in `bin/blocks.conf`. The gate is `w0-frozen`, because before it 01/02 own those files.
2. An interim merge is `merge-block.sh 00; rm -f state/00.merged.flag`. Otherwise `ac-ledger` gates block 00, and AC-00.2 would fail everyone's `e2e.sh` until the journey is green. `00.merged` stays set only after the final merge, once AC-00.2 is green under `ac-ledger.sh --block 00 --e2e-report`.
3. Main is dirty right now: another session's kit (`.claude/**`, `bin/e2e.sh`). The owner or that session has to commit it before the first merge. The integrator never commits or stashes another session's work. The watcher reports the dirt.
4. CRs are batched: every `00` merge moves main and costs each in-flight merge one of its 5 attempts. Run a full `check.sh 00` before every merge.
5. `main-commit.sh` only with explicit paths, after checking `git diff --cached --quiet`. Never pass `howItWorks` as a whole.
6. The final `run-many` and e2e run in main only after every MUST block is merged and `pgrep -f merge-block.sh` is empty. A red result mid-run gets one rerun before `main.broken`.
7. `playwright.config.ts` (4300 + api webServer) belongs to block 01 and must be merged before the journey runs. The integrator seeds main itself (`migrate deploy && db seed`), never `migrate reset`.
8. The watcher:
   - reads `events.log` from a byte offset that only `--ack` advances, so no event is lost if the session dies;
   - ignores its own `00` events;
   - ignores CR files younger than 10 s;
   - reports dirt only when its fingerprint changes.
9. `merge-block.sh` records `main-dirty` in the block's status before refusing a dirty main. `bin/*` is edited by writing a temp file and `mv`-ing it into place, because a running bash reads its script as it goes.
10. Watcher tests run in a sandbox (`KAIRON_*` env, `KAIRON_SKIP_HEAVY=1`) on bash 3.2.
11. `cfo-journey`:
    - one `[AC-00.2]` test, one `test.step` per step of SUMMARY §3 (1–6), on a copy made with `POST /api/projects/:id/duplicate`;
    - `waitForResponse` on the PATCH before the reload;
    - `expect.poll` for the numbers; no `waitForTimeout`.
12. Final deliverables land through the last `00` merge:
    - `SOLUTION.md` at the root, 6 sections;
    - the README run section;
    - `docs/architecture/integration-flow.md` plus its index row.

## The watcher contract: `bin/integrator-watch.sh`
```
integrator-watch.sh            block until ≥1 event, print them, write state/integrator.pending, exit 0
integrator-watch.sh --once     one pass: exit 0 with events, 3 without
integrator-watch.sh --ack      accept integrator.pending (offset, CR list, dirt fingerprint); exit 0
anything else                  exit 2
```
Interval: `KAIRON_WATCH_INTERVAL` (20 s). Events, one per line:

| Line | Source |
|---|---|
| `MERGED NN <sha>` | `FLAG NN.merged` in events.log (NN ≠ 00) |
| `FLAG w0-frozen` / `FLAG main.broken` | events.log |
| `STATUS NN <conflict\|check-failed\|main-dirty> <note>` | events.log (NN ≠ 00) |
| `CR <file>` | new or changed `shared/change-requests/CR-*.md`, ≥ 10 s old (name+mtime) |
| `DIRTY <paths>` | main outside `howItWorks/` went from clean to dirty (once per dirty episode; a merge it blocks arrives as `STATUS NN main-dirty`) |

The state (`state/` is git-ignored) lives in `integrator.offset`, `integrator.cr`, `integrator.dirty` and `integrator.pending`.

## Integrator loop (operations)
1. Start `integrator-watch.sh` in the background → event → act → `--ack` → start it again.
2. `MERGED` → read the block's HANDOFF, `bash bin/status.sh`. After `03.merged`: `cd $MAIN/apps/api && npx prisma migrate deploy && npx prisma db seed`.
3. `CR` → read it, accept or reject it (status line in the CR file).
   - Before `w0-frozen`: send it to 01/02 with `note.sh`.
   - After: edit in `$WT00`, run `nx run api:prisma-migrate` for a schema change, raise `CONTRACT_VERSION`, run `check.sh 00`, then `merge-block.sh 00; rm -f state/00.merged.flag`, then `note.sh` to the affected blocks, and record it in `change-requests/README.md`.
4. `STATUS conflict/check-failed` → read the block's status; help only inside that block's files.
5. `DIRTY` / `STATUS main-dirty` → tell the owner who is dirtying main. Never clean someone else's work.
6. Finish (W1 merged, or time is up): journey + deliverables in `$WT00` → `check.sh 00` → `merge-block.sh 00` → seed main → `bin/e2e.sh` → `ac-ledger.sh --block 00 --e2e-report …` → full `run-many` in main.

## Affected files
- New: `howItWorks/bin/integrator-watch.sh`, `howItWorks/bin/tests/integrator-watch.test.sh`, this DESIGN.md, `00-integrator/HANDOFF.md`.
- Changed: `howItWorks/bin/blocks.conf` (row 00), `howItWorks/bin/merge-block.sh` (the `main-dirty` status).
- Later (in `$WT00`): `apps/web-e2e/src/cfo-journey.spec.ts`, `SOLUTION.md`, `README.md`, `docs/architecture/integration-flow.md`, `docs/architecture/README.md`, plus any CR files.

## Risks
| Risk | Mitigation |
|---|---|
| Another session leaves main dirty, so every merge is refused | `DIRTY` event plus the `main-dirty` status; the owner clears it |
| A CR merge forces in-flight merges to re-check | Batching; merge `00` when no block is `checked` |
| `npm ci`/`migrate` after a merge break an e2e run in main | Constraint 6 (no live `merge-block`); one rerun |
| AC-00.2 gates everyone's e2e | Constraint 2 (the interim `00.merged` flag is removed) |
| The session hits its limit | Offset/ack in `state/`; HANDOFF.md; `/core-continue` |

## Test strategy
- AC-00.5 (check) `--once` with no events → exit 3, prints nothing; the offset does not move.
- AC-00.6 (check) A new CR older than 10 s → `CR <file>`. A CR younger than 10 s and `README.md` → no event.
- AC-00.7 (check) `FLAG 04.merged` in events.log → `MERGED 04 …`. `FLAG 00.merged` and `STATUS 00 …` → no event.
- AC-00.8 (check) `STATUS 05 conflict|check-failed|main-dirty` → an event. `in-progress`/`waiting-merge` → none.
- AC-00.9 (check) `FLAG main.broken`, `FLAG w0-frozen` → an event.
- AC-00.10 (check) A file outside `howItWorks/` → `DIRTY`; a file inside `howItWorks/` → none; after `--ack`, more dirt in the same episode → none; clean, then dirt again → `DIRTY`. (Changed 11:50: per-file re-alerts were noise while the kit session kept writing.)
- AC-00.11 (check) Without `--ack` the event repeats (it survives a killed run); after `--ack` it doesn't.
- AC-00.12 (check) Blocking mode exits once an event appears; `--bogus` → exit 2; bash 3.2 (`/bin/bash`).
- AC-00.13 (check) `merge-block.sh` on a dirty main → the status file says `main-dirty`.
- AC-00.1–00.4 from BLOCK.md: AC-00.2 is e2e, the rest are checks at the finish.

The watcher's ACs are not added to BLOCK.md: another session is editing that file right now, and the ledger only scans `*.spec.ts` files anyway.

## How to verify
```bash
bash howItWorks/bin/tests/integrator-watch.test.sh; echo "exit $?"
bash howItWorks/bin/tests/e2e.test.sh; bash howItWorks/bin/tests/ac-ledger.test.sh; bash howItWorks/bin/tests/check-weakening.test.sh
bash howItWorks/bin/status.sh          # row 00 present, waiting for w0-frozen
# finish
bash howItWorks/bin/e2e.sh && bash howItWorks/bin/ac-ledger.sh --block 00 --e2e-report /tmp/kairon-e2e/report.json
npx nx run-many -t lint test typecheck build; git log --merges --oneline
```

## Open questions
- The owner: who commits the kit session's uncommitted `.claude/**` and `bin/e2e.sh`, and when? (Blocker for the first merge.)

## As built (2026-10-14, after the run)
- **The watcher** works as specified, with two changes made during the run (tests updated in the same commits):
  - `--ack` records the current mtime of the CRs it reported, so the integrator's own status edit doesn't wake it again (`ac5042b`);
  - `DIRTY` fires once per dirty episode, while blocked merges still arrive as `STATUS NN main-dirty` (`9868eaa`).
  
  `state/integrator.*` is shared: a second session acking with the same script swallows events. **Run one integrator per repo.**
- **Row 00** grew during the run. On top of the frozen files it now owns:
  - `apps/api/.env.example` (CR-11);
  - `budget-engine/src/lib/schedule.ts` + spec (CR-05);
  - the 04/05/06 e2e specs (post-merge e2e fixes, `state/00.spec-rewrite`);
  - `features/land/plot-diagram.tsx` + spec (07 → 08's SitePlan).
- **CRs:**
  - CR-12 was docs only;
  - CR-11 and CR-05 shipped as code in the first 00 merge (`1e0fe11`, CONTRACT_VERSION 2);
  - 01's as-built differences were written into CONTRACTS.
- **e2e fixes, all test-side (no assertion removed):**
  - tabs are `role="tab"`;
  - `textContent` instead of `innerText`;
  - whole-euro amounts;
  - a hanging `blur()`;
  - the demo quantity edit moves the forecast only on a row whose status allows it. The owner's decisions: 04/06 specs use the PLANNED MAT-ELE-008; the cable is PARTIAL in the seed and the journey edits it.
- **Interim 00 merges** removed `00.merged` each time (constraint 2). There were 6 `merge: 00-integrator` commits.
- **Lessons:**
  - Another session editing `.claude/**` in the main tree blocked merges three times. The kit should be committed before baseline, as the testing-kit spec already said.
  - `e2e.sh` can leave a run record uncommitted in main.
  - The orchestrator session also wrote as `00`. One integrator id per session would avoid that.
