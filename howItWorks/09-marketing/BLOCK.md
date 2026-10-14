# 09 — "Marketing" tab

> **Parallel launch:** first read [../PARALLEL-RUN.md](../PARALLEL-RUN.md). Gate, base branch, merge order and your files are in `bin/blocks.conf` (row `09`). Start: `bash $BIN/bootstrap.sh 09` (in the background) → brainstorm into `DESIGN.md` → code in `$WT` → `bash $BIN/check.sh 09` → `bash $BIN/merge-block.sh 09`.

**Wave:** W2 · **Priority:** STRETCH · **Estimate:** 45 min · **Worktree:** `Kairon-wt/09-marketing` (gate and base: `bin/blocks.conf`)
**In parallel:** 07, 08, 10, 11. No overlap: you use only the 02 kit and the shared snapshot. Your SERVICE rows go into the MARKETING category, so Profitability (06) and Analytics (11) pick them up automatically.

## Goal
Route `/projects/:id/marketing/:section?`: the marketing plan and budget for selling the house. The sections follow how homebuilders and developers market themselves in Germany/Europe (GERMANY-DATA §6).

## You own
`apps/web/src/features/marketing/**` (`MarketingPage`), `apps/web-e2e/src/marketing.spec.ts`.

## Page content
1. SubNav of the 8 MARKETING sections (CONTRACTS §4). Each section has a short channel description and benchmarks (static English texts in `channels.ts`, figures from GERMANY-DATA §6, for example "Google Ads CPC for real estate: €2–6").
2. A table of SERVICE rows: Code · Activity · Qty + unit (months, days, pcs) · Unit price · Planned · Committed · Actual · Status · **Agency/vendor** (OrgCell → modal) · **Start** · **End** · Flag "Running now" / "Planned" / "Finished" (by dates against `useToday()`).
3. A **marketing calendar** (a simple timeline of campaigns by month, the same idea as the Gantt in 05, but your own small component).
4. A **channel mix** donut chart (forecast by section) + the share of marketing in the contract price (benchmark ~3 %, flag when > 5 %).
5. BudgetHealthPanel(MARKETING).

## Acceptance criteria
- AC-09.1 (Vitest) 8 sections in SubNav; switching keeps edits (as in 04).
- AC-09.2 (Vitest) Changing the cost of the `paid-search` row changes the donut, the MARKETING total and the KPI immediately.
- AC-09.3 (Vitest) The status flag by dates: start ≤ today ≤ end → "Running now".
- AC-09.4 (Vitest) The marketing share > 5 % of the contract price → warn badge; ≤ 5 % → ok.
- AC-09.5 (Vitest) Clicking an agency opens OrganizationModal.
