# howItWorks: implementation plan in blocks

This folder lets you implement the take-home task **Development Budget / Cost Forecast** in **parallel Claude Code sessions**, one session per block. Each block knows what its neighbours are doing through shared contracts and the status board.

> The design behind this split (approaches, panel, judge, constraints) is in `docs/specs/2026-10-14-budget-forecast-design.md`.

## ⚠️ Parallel launch: a block session reads [PARALLEL-RUN.md](PARALLEL-RUN.md) FIRST

All blocks are started at the same time, each in its own tab. The waves are ordered **mechanically**: flags and the scripts in `bin/` (`bootstrap.sh` waits for the gate, `merge-block.sh` merges into main in the right order). Board: `bash howItWorks/bin/status.sh`.
**The owner, before starting:** `bash /Users/dmitriyluba/WebstormProjects/Interview/Kairon/howItWorks/bin/baseline.sh`.

## Start here (every session reads these, in this order)

| # | File | Why |
|---|---|---|
| 1 | [SUMMARY.md](SUMMARY.md) | What we are building and why: the task plus the owner's comments, condensed |
| 2 | [shared/PROTOCOL.md](shared/PROTOCOL.md) | How sessions work in parallel: worktrees, branches, commits, tests, ports, change requests |
| 3 | [shared/CONTRACTS.md](shared/CONTRACTS.md) | **Single source of truth**: data model, money formulas, API, query keys, file ownership |
| 4 | [shared/DESIGN-SYSTEM.md](shared/DESIGN-SYSTEM.md) | UI: Tailwind tokens, responsive layout, animations, components |
| 5 | [shared/GERMANY-DATA.md](shared/GERMANY-DATA.md) | Researched German market figures (2025–2026) for the seed and defaults |
| 0 | [PARALLEL-RUN.md](PARALLEL-RUN.md) | **How a session runs in parallel**: gates, scripts, /brainstorm in block mode, merge, recovery |
| 6 | `bash bin/status.sh` (+ [shared/STATUS.md](shared/STATUS.md) as the legend) | **Live board**: block states, flags, locks, events |
| 7 | `NN-<block>/BLOCK.md` | Your block's assignment |

## Block map

```
W0 (contracts; 01 and 02 in parallel, 02 merges 01 once contracts are ready)
  01-foundation-contracts   schema+migration, types, budget engine, core API, deps, e2e wiring
  02-app-shell-ui-kit       Tailwind, header, collapsible sidebar, routes, UI kit, snapshot hooks, autosave
        └── tag w0-frozen ──────────────────────────────────────────────────────────────┐
W1 (MUST, in parallel)                                                                   │
  03-seed-germany           demo project + 2 more projects + template, German data        │
  04-building-materials     "Building materials" tab: sections, table, org modal, late flag│
  05-construction-works     "Construction" tab: works, schedule, material/work conflicts  │
  06-profitability          "Profitability" tab: markup, profit, charts, cashflow         │
W2 (STRETCH, in parallel)                                                                 │
  07-land  08-architecture  09-marketing  10-delivery-tracking  11-analytics              │
W3 (STRETCH)                                                                              │
  12-calculate-project (wizard)   13-search                                               │
00-integrator — the main-tree session: baseline, worktrees, merges, CRs, e2e, SOLUTION.md ┘
```

Merge order is enforced by `bin/blocks.conf`: `01 → 02 → (w0-frozen)`, then 03 and the rest as they finish (10 after 03, 11 after 06, 12 starts after 03), then the integrator's final step. Files are owned by exactly one block, so the order of the remaining merges doesn't matter.
The 3-hour timebox realistically covers W0 + W1 + the final step. W2/W3 are done if time allows; anything unfinished is described in `SOLUTION.md`.

## How to launch a block session

The owner's prompt in a tab (as it is now):
```
/brainstorm context /Users/dmitriyluba/WebstormProjects/Interview/Kairon/howItWorks, you need to work out and implement
/Users/dmitriyluba/WebstormProjects/Interview/Kairon/howItWorks/NN-slug, taking into account the parallel sessions
```
Everything else (worktree, waiting, commits, merge) is described in PARALLEL-RUN.md and done by the scripts.

## Session limits on the machine (24 GB)

Sessions are cheap while they wait: bootstrap and wait-for just sleep. Heavy commands (npm ci, nx test/lint/typecheck/build) go through `bin/heavy.sh`: **at most 3 at once** on the machine (`KAIRON_HEAVY_SLOTS`), and they wait while `~/.claude/emu/pressure-critical` exists. The Nx daemon is off in the worktrees. Blocks do not `serve`.
