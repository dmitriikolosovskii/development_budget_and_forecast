import { computeProfitability, itemForecastCents, summarizeProject } from '@default-project/budget-engine';
import { BUDGET_CATALOG } from '@default-project/types';
import { buildOrganizations } from './organizations';
import { buildTauchaSeed } from './taucha';
import { toSnapshot } from './to-snapshot';

describe('Taucha seed: budget', () => {
  const snapshot = toSnapshot(buildTauchaSeed(), buildOrganizations());
  const summary = summarizeProject(snapshot);
  const line = (section: string) => {
    const found = Object.values(summary.byLine).find((l) => l.section === section);
    if (!found) throw new Error(`no line ${section}`);
    return found;
  };

  it('should total 573,861.00 € approved per GERMANY-DATA §9 when summarized by the engine [AC-03.1]', () => {
    expect(summary.project.approved).toBe(57_386_100);
    expect(summary.byCategory.LAND.approved).toBe(15_984_000);
    expect(summary.byCategory.ARCHITECTURE.approved).toBe(4_928_100);
    expect(summary.byCategory.MATERIALS.approved).toBe(14_485_500);
    expect(summary.byCategory.CONSTRUCTION.approved).toBe(19_988_500);
    expect(summary.byCategory.MARKETING.approved).toBe(2_000_000);
  });

  it('should have exactly one line per catalogue section when built [AC-03.1]', () => {
    const keys = snapshot.budgetLines.map((l) => `${l.category}/${l.section}`);
    expect(keys).toEqual(BUDGET_CATALOG.map((c) => `${c.category}/${c.section}`));
  });

  it('should give a contract price of 659,940.15 € when the markup is 15 % [AC-03.1]', () => {
    const p = computeProfitability(summary.project, 1500);
    expect(p.contractPrice).toBe(65_994_015);
    expect(p.plannedProfit).toBe(8_607_915);
  });

  it('should plan land, architecture and marketing lines exactly at their approved amount when built [AC-03.1]', () => {
    for (const l of Object.values(summary.byLine)) {
      if (['LAND', 'ARCHITECTURE', 'MARKETING'].includes(l.category)) expect([l.section, l.planned]).toEqual([l.section, l.approved]);
    }
    expect(line('contingency').planned).toBe(0);
    expect(line('sales-commission').planned).toBe(0);
  });

  it('should overrun exactly concrete, electrical and earthworks when forecast [AC-03.2]', () => {
    const overruns = Object.fromEntries(summary.overrunLines.map((o) => [o.section, o.overrunCents]));
    expect(overruns).toEqual({ earthworks: 380_000, concrete: 170_075, electrical: 100_400 });
    expect(summary.overrunLines.map((o) => o.section)).toEqual(['earthworks', 'concrete', 'electrical']);
  });

  it('should keep every other line within budget and the project under budget when the contingency is unused [AC-03.2]', () => {
    for (const l of Object.values(summary.byLine)) {
      if (!['concrete', 'electrical', 'earthworks'].includes(l.section)) expect([l.section, l.forecast <= l.approved]).toEqual([l.section, true]);
    }
    const totalOverrun = summary.overrunLines.reduce((s, o) => s + o.overrunCents, 0);
    expect(totalOverrun).toBeLessThan(line('contingency').approved);
    expect(summary.project.overrun).toBe(false);
  });

  it('should keep electrical installation within budget when electrical materials overrun [AC-03.2]', () => {
    expect(line('electrical-install').overrun).toBe(false);
    expect(line('electrical').overrun).toBe(true);
  });

  it('should keep the demo cable PARTIAL so a quantity edit moves the forecast [AC-03.7]', () => {
    const cable = snapshot.items.find((i) => i.code === 'MAT-ELE-001');
    if (!cable) throw new Error('no MAT-ELE-001');
    expect([cable.status, cable.committedCents, cable.actualCents]).toEqual(['PARTIAL', 76_000, 76_000]);
    expect(itemForecastCents(cable)).toBe(98_800);
    // SUMMARY §3 step 3: the CFO lowers the quantity to 900 m → EAC falls (1,000 m already paid stays the floor)
    expect(itemForecastCents({ ...cable, qtyMilli: 900_000 })).toBe(76_000);
  });

  it('should leave the demo forecast unchanged when the cable is PARTIAL [AC-03.7]', () => {
    expect(summary.project.forecast).toBe(54_045_565);
    expect(line('electrical').forecast - line('electrical').approved).toBe(100_400);
  });
});
