# CR-05-add-days
- Author: block 05 · Date: 2026-10-14
- Status: applied in main 1e0fe11 (merge: 00-integrator), CONTRACT_VERSION 2
- Affected: engine (`libs/shared/budget-engine/src/lib/schedule.ts` + index export)
- Blocks affected: 05 (shift a work's dates), possibly 12 (the wizard shifts template dates)

## What to change (exact diff or field list)
Add, next to `daysBetween` in `schedule.ts`:
```ts
/** `YYYY-MM-DD` + n days, in UTC. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
```
plus a spec: month/year boundaries (`2026-12-30` + 3 = `2027-01-02`) and negative n.

## Why it can't be done inside the block
`budget-engine/src/**` belongs to 01 (frozen after `w0-frozen`). Date maths should live in one place, like `daysBetween`.

## Local workaround in the meantime (file with TODO CR-NN)
`apps/web/src/features/construction/construction-model.ts` → `addDaysUtc` (`// TODO CR-05-add-days`), covered by `construction-model.spec.ts`. Once applied, block 05 (or the integrator) swaps the import.
