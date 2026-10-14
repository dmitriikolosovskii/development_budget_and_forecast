import {
  checkSchedule,
  summarizeProject,
} from '@default-project/budget-engine';
import { normalise } from '../project/project-cache';
import {
  buildGanttModel,
  buildScheduleAlerts,
  conflictCountBySection,
  contingencyUsage,
  formatDayMonth,
  INVALID_DATES_MESSAGE,
  nextWorkCode,
  readinessLabel,
  shiftTargetForWork,
  shiftWorkToDate,
  validateWorkDates,
  workDurationDays,
} from './construction-model';
import {
  constructionSnapshot,
  LINE,
  patchItem,
  TODAY,
} from './construction-fixture';

function model(
  items?: NonNullable<Parameters<typeof constructionSnapshot>[0]>['items'],
) {
  const cache = normalise(constructionSnapshot({ items }));
  const schedule = checkSchedule(cache.items, TODAY);
  return { cache, schedule };
}

describe('construction-model', () => {
  describe('dates', () => {
    it('should format day and month in UTC without a leading zero', () => {
      expect(formatDayMonth('2026-11-02')).toBe('2 Nov');
      expect(formatDayMonth('2026-09-30')).toBe('30 Sep');
    });

    it('should shift across month and year boundaries (engine addDays)', () => {
      const shift = (start: string, end: string, to: string) =>
        shiftWorkToDate({ startDate: start, endDate: end }, to).endDate;
      expect(shift('2026-10-19', '2026-10-30', '2026-10-28')).toBe(
        '2026-11-08',
      );
      expect(shift('2026-12-01', '2026-12-04', '2026-12-30')).toBe(
        '2027-01-02',
      );
    });

    it('should count duration with both ends included', () => {
      expect(workDurationDays('2026-10-19', '2026-10-30')).toBe(12);
      expect(workDurationDays('2026-10-19', '2026-10-19')).toBe(1);
      expect(workDurationDays(null, '2026-10-19')).toBeNull();
    });
  });

  it('should shift 19.10–30.10 to 28.10–08.11, keeping the duration [AC-05.3]', () => {
    expect(
      shiftWorkToDate(
        { startDate: '2026-10-19', endDate: '2026-10-30' },
        '2026-10-28',
      ),
    ).toEqual({
      startDate: '2026-10-28',
      endDate: '2026-11-08',
    });
  });

  it('should reject an end before the start and accept the same day [AC-05.4]', () => {
    expect(validateWorkDates('2026-10-19', '2026-10-18')).toBe(
      INVALID_DATES_MESSAGE,
    );
    expect(INVALID_DATES_MESSAGE).toContain('Invalid dates');
    expect(validateWorkDates('2026-10-19', '2026-10-19')).toBeNull();
    expect(validateWorkDates(null, '2026-10-18')).toBeNull();
  });

  describe('buildScheduleAlerts', () => {
    it('should list late materials by delay, largest first, with the full text [AC-05.1]', () => {
      const { cache, schedule } = model();

      const alerts = buildScheduleAlerts(cache, schedule);

      expect(alerts.map((a) => a.text)).toEqual([
        'Heat pump (MAT-HEA-001) arrive 20 Nov, 18 days after Heating installation starts (2 Nov)',
        'Windows (MAT-WIN-001) arrive 28 Oct, 9 days after Window installation starts (19 Oct)',
      ]);
      expect(alerts[1]).toMatchObject({
        kind: 'LATE',
        materialSection: 'windows-doors',
        shiftTo: '2026-10-28',
      });
    });

    it('should drop the alert when the delivery is the same day as the start and keep it one day later [AC-05.2]', () => {
      const sameDay = model(patchItem('m-win', { deliveryDate: '2026-10-19' }));
      const dayLater = model(
        patchItem('m-win', { deliveryDate: '2026-10-20' }),
      );

      expect(
        buildScheduleAlerts(sameDay.cache, sameDay.schedule).some((a) =>
          a.text.startsWith('Windows'),
        ),
      ).toBe(false);
      expect(
        buildScheduleAlerts(dayLater.cache, dayLater.schedule).find((a) =>
          a.text.startsWith('Windows'),
        )?.text,
      ).toContain('1 day after');
    });

    it('should put works with invalid dates after the late materials [AC-05.4]', () => {
      const { cache, schedule } = model(
        patchItem('w-shell', { endDate: '2026-06-01' }),
      );

      const alerts = buildScheduleAlerts(cache, schedule);

      expect(alerts.map((a) => a.kind)).toEqual(['LATE', 'LATE', 'INVALID']);
      expect(alerts[2].text).toBe(
        'Shell walls (WRK-SHL-001): end 1 Jun is before start 29 Jun',
      );
    });
  });

  it('should target the latest delivery when a work has two late materials [AC-05.12]', () => {
    const { cache, schedule } = model(
      patchItem('m-door', { deliveryDate: '2026-11-03' }),
    );

    expect(shiftTargetForWork('w-win', cache.itemsById, schedule)).toBe(
      '2026-11-03',
    );
    expect(shiftTargetForWork('w-shell', cache.itemsById, schedule)).toBeNull();
  });

  it('should count blocked and invalid works per construction section [AC-05.8]', () => {
    const { cache, schedule } = model(
      patchItem('w-shell', { endDate: '2026-06-01' }),
    );

    expect(conflictCountBySection(cache, schedule)).toEqual({
      'windows-install': 1,
      'heating-install': 1,
      shell: 1,
    });
  });

  it('should label readiness from the engine status', () => {
    expect(readinessLabel('BLOCKED', 9, 'Windows')).toBe(
      'Blocked: Windows arrive 9 days late',
    );
    expect(readinessLabel('INVALID_DATES', 0, null)).toBe('Invalid dates');
    expect(readinessLabel('READY', 0, null)).toBe('Ready');
  });

  it('should build a bar per work and a marker per dated linked material, late ones flagged [AC-05.5]', () => {
    const { cache, schedule } = model();

    const gantt = buildGanttModel(cache, schedule, cache.budgetLines, TODAY);

    const works = gantt.groups.flatMap((g) => g.works);
    expect(works.map((w) => w.code)).toEqual([
      'WRK-SHL-001',
      'WRK-WIN-001',
      'WRK-HEA-001',
    ]);
    const win = works.find((w) => w.code === 'WRK-WIN-001');
    expect(win?.markers.map((m) => [m.code, m.late])).toEqual([
      ['MAT-WIN-002', false],
      ['MAT-WIN-001', true],
    ]);
    expect(gantt.range).toEqual({ start: '2026-06-29', end: '2026-11-27' });
  });

  it('should compute the reserve and its use by the overruns of other lines [AC-05.6]', () => {
    const { cache } = model();

    const usage = contingencyUsage(summarizeProject(cache), LINE.contingency);

    expect(usage).toEqual({
      reserve: 2_000_000,
      used: 35_000,
      remaining: 1_965_000,
    });
  });

  it('should pick the next free work code for a section prefix', () => {
    const { cache } = model();
    expect(nextWorkCode(cache.items, 'WIN')).toBe('WRK-WIN-002');
    expect(nextWorkCode(cache.items, 'PAI')).toBe('WRK-PAI-001');
  });
});
