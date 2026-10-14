---
name: explore-app
description: Full browser walkthrough of the finished app in the MAIN TREE through the Playwright MCP server `playwright-kairon` — starts the app (howItWorks/bin/app.sh), drives the CFO demo journey from howItWorks/SUMMARY.md §3 on a duplicated project at desktop, tablet and mobile sizes, checks console and network, then sends one exploratory-qa-tester for unscripted charters, and commits a record to docs/test-runs/. Use when the blocks are merged and /e2e-full is green and the owner asks to "walk through the app", "check it in the browser", "do the acceptance pass". Not inside block worktrees, not a replacement for tagged e2e tests (/test-task, /e2e-full), and not for fixing what it finds (/fix-test, test-automator).
allowed-tools: Read, Grep, Glob, Agent, Write, Bash(bash howItWorks/bin/*), Bash(curl -s *), Bash(git *), mcp__playwright-kairon
---

The MCP server is registered for this repo only (`claude mcp get playwright-kairon`): headless chromium, profile in
memory, viewport 1440×900, files in `/tmp/kairon-explore/mcp`, origins limited to localhost 4274/3454/4300. It is loaded
at session start: if its tools are missing, tell the owner to restart the session in the main tree.

## 1. Start

1. Make sure you are in the main tree: `git rev-parse --show-toplevel` = `/Users/dmitriyluba/WebstormProjects/Interview/Kairon`.
   Check what is merged with `ls howItWorks/state/*.merged.flag`, and walk only through merged features.
2. Run `bash howItWorks/bin/app.sh status`. If it is down, run `bash howItWorks/bin/app.sh up --seed` with `run_in_background`.
   It waits for the e2e lock, runs migrate deploy and seed (the seed never deletes), and starts api :3454 and web :4274.
   Wait for it to finish; exit 0 means healthy. If it fails, read `/tmp/kairon-app/{db,api,web}.log`. That is
   infrastructure: fix it and retry once.
3. **Work on a copy, never on the demo project:**
   - `curl -s localhost:3454/api/projects` → the Taucha project id;
   - `curl -s -X POST localhost:3454/api/projects/<id>/duplicate -H 'content-type: application/json' -d '{"name":"Explore <stamp>"}'` → the copy's id.

## 2. Scripted journey (SUMMARY §3) through MCP

For each step, use `browser_navigate` → `browser_snapshot` (read the accessibility tree; prefer it over screenshots)
→ act (`browser_click`, `browser_type`, `browser_fill_form`, `browser_select_option`, `browser_press_key`,
`browser_file_upload`) → `browser_snapshot` again, and compare the numbers to the cent.

| # | Step | Must see |
|---|---|---|
| 1 | Current projects → the copy | KPI strip: Budget / Spent / Open commitments / Forecast (EAC) / Variance, "N lines over budget" |
| 2 | Materials → Electrical, change the NYM-J cable quantity | row amount, section total, KPI and Profitability change at once; after `browser_navigate` (reload) the value is still there |
| 3 | Construction → Windows & doors | the alert "Windows arrive 9 days after installation start"; moving the delivery earlier removes it |
| 4 | Click a supplier | modal with contacts, the responsible person and deadlines; Esc closes it |
| 5 | Profitability: markup 15 % → 12 % | contract price, profit and margin recalculated; charts redraw |
| 6 | (if merged) Delivery tracking → upload `apps/web-e2e/fixtures/deliveries-*.csv` | bad rows with reasons, then actuals and dates update |
| 7 | (if merged) Analytics, Search "arotherm", Calculate project | numbers across projects; the jump to the row; a new project from the template |

After every step, run `browser_console_messages` (any error = a finding) and `browser_network_requests` (any 4xx/5xx
not caused by deliberate bad input = a finding). Repeat steps 1–2 at `browser_resize` 768×1024 and 375×812: the sidebar
becomes a drawer, and tables stay usable. Take screenshots only as proof of a finding. Always pass an absolute
`filename` inside the MCP output dir: `/tmp/kairon-explore/mcp/<page>-<viewport>-<section>.png`. A bare name is saved
relative to the MCP process's cwd, which is the repo root, and any other absolute path is denied. Afterwards,
`git status --porcelain` must show no new `*.png`/`*.yml`.

## 3. Unscripted pass

Spawn **one** `exploratory-qa-tester`. Give it the copy's id, the list of merged blocks, and the MCP note above. It
writes 3–5 charters and returns defects with proof, plus hypotheses. Don't run a second browser-driving agent in
parallel.

## 4. Record and finish

1. Write `docs/test-runs/<YYYY-MM-DD-HHMMSS>-explore.md`:
   - the main commit and the merged blocks;
   - a table `step | expected | observed | PASS/FAIL`;
   - console and network findings;
   - the tester's defects (severity, steps, proof path, oracle, proposed AC);
   - hypotheses;
   - what was not checked.
2. Commit it at once so the main tree stays clean for merges:
   `bash howItWorks/bin/main-commit.sh "test(run): explore <stamp> <PASS|FAIL>" docs/test-runs/<file>`.
3. For each confirmed defect, use an existing AC → `test-automator` (a tagged guard with red-proof) and the fix via
   `/fix-test`. For a new behaviour with no AC, ask the owner one question before adding an AC.
4. Run `bash howItWorks/bin/app.sh down`, unless the owner wants the app left running. It holds the e2e lock, so
   `e2e.sh` waits while it is up.

Report the journey table, the defects, the record path and the commit. Never call a step PASS from a screenshot alone
when the snapshot or an API value can show the number.
