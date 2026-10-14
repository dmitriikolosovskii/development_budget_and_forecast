import { checkSchedule } from '@default-project/budget-engine';
import type { MaterialScheduleResult, WorkScheduleResult } from '@default-project/types';
import { buildOrganizations } from './organizations';
import { buildTauchaSeed } from './taucha';
import { toSnapshot } from './to-snapshot';

const TODAY = '2026-10-14';

describe('Taucha seed: schedule', () => {
  const items = toSnapshot(buildTauchaSeed(), buildOrganizations()).items;
  const schedule = checkSchedule(items, TODAY);
  const material = (code: string) => schedule[code] as MaterialScheduleResult;
  const codesWith = (status: string) =>
    Object.entries(schedule)
      .filter(([, r]) => r.status === status)
      .map(([code]) => code)
      .sort();

  it('should flag the windows as late for installation by 9 days when today is 2026-10-14 [AC-03.2]', () => {
    expect(material('MAT-WIN-001')).toMatchObject({ status: 'LATE_FOR_WORK', needBy: '2026-10-19', delayDays: 9, workId: 'WRK-WIN-001' });
  });

  it('should flag the heat pump as late for installation by 18 days when today is 2026-10-14 [AC-03.2]', () => {
    expect(material('MAT-HEA-001')).toMatchObject({ status: 'LATE_FOR_WORK', needBy: '2026-11-02', delayDays: 18, workId: 'WRK-HEA-001' });
  });

  it('should mark the gypsum plaster at risk with 2 days of slack when today is 2026-10-14 [AC-03.2]', () => {
    expect(material('MAT-DRP-001')).toMatchObject({ status: 'AT_RISK', slackDays: 2, needBy: '2026-11-30' });
  });

  it('should have no other conflicts, nothing overdue and nothing unscheduled when today is 2026-10-14 [AC-03.2]', () => {
    expect(codesWith('LATE_FOR_WORK')).toEqual(['MAT-HEA-001', 'MAT-WIN-001']);
    expect(codesWith('AT_RISK')).toEqual(['MAT-DRP-001']);
    expect(codesWith('OVERDUE')).toEqual([]);
    expect(codesWith('UNSCHEDULED')).toEqual([]);
    expect(codesWith('INVALID_DATES')).toEqual([]);
  });

  it('should block exactly window and heating installation, each by one material [AC-03.2]', () => {
    expect(codesWith('BLOCKED')).toEqual(['WRK-HEA-001', 'WRK-WIN-001']);
    expect(schedule['WRK-WIN-001'] as WorkScheduleResult).toMatchObject({ blockingMaterials: ['MAT-WIN-001'], worstDelayDays: 9 });
    expect(schedule['WRK-HEA-001'] as WorkScheduleResult).toMatchObject({ blockingMaterials: ['MAT-HEA-001'], worstDelayDays: 18 });
  });

  it('should keep the front door on time when it arrives exactly 3 days before installation [AC-03.2]', () => {
    expect(material('MAT-WIN-002')).toMatchObject({ status: 'ON_TIME', slackDays: 3 });
  });

  it('should show slab concrete, rebar and roof tiles as delivered [AC-03.2]', () => {
    for (const code of ['MAT-CON-001', 'MAT-CON-003', 'MAT-ROF-002']) expect([code, material(code).status]).toEqual([code, 'DELIVERED']);
  });

  it('should link the stair and interior doors to the February 2027 installation rows [AC-03.2]', () => {
    expect(material('MAT-WIN-005')).toMatchObject({ workId: 'WRK-WIN-004', needBy: '2027-02-15', status: 'ON_TIME' });
    expect(material('MAT-WIN-006')).toMatchObject({ workId: 'WRK-WIN-005', needBy: '2027-02-15', status: 'ON_TIME' });
  });
});
