# STATUS — legend for the board

**The live board is a command, not this file:** `bash /Users/dmitriyluba/WebstormProjects/Interview/Kairon/howItWorks/bin/status.sh`
(blocks, flags, locks, latest events; data lives in `howItWorks/state/`, git-ignored).
Nobody edits this file: concurrent edits of one file by 10 sessions would lose changes.

Block states (`bin/flag.sh --status NN <state> "<note>"`): `waiting-gate` → `installing` → `in-progress` → `checked` → `waiting-merge` → `merged` (plus `conflict`, `check-failed`).

Flags (milestones, `bin/flag.sh <flag>`):
| Flag | Who sets it | Who waits for it |
|---|---|---|
| `baseline` | owner (`bin/baseline.sh`) | 01, 02 (start) |
| `01.deps-ready` | 01 after installing dependencies | 02 (merges feat/01 + npm ci) |
| `01.contracts-ready` | 01 after types + engine | 02 (merges feat/01 again) |
| `01.schema-ready` | 01 after the schema + migration | 03 (start, branched from feat/01) |
| `NN.merged` | `merge-block.sh` | 02←01, 10←03, 11←06, 12←03 (start) |
| `w0-frozen` | `merge-block.sh 02` (+ the git tag) | 03 (merge), 04–11, 13 (start) |
| `main.broken` | integrator, if main is red | every merge waits |

`CONTRACT_VERSION: 2`. Applied CRs are listed in `shared/change-requests/README.md`.
