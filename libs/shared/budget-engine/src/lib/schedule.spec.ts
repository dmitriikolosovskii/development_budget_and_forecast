import type {
  CostItem,
  MaterialScheduleResult,
  WorkScheduleResult,
} from '@default-project/types';
import { addDays, checkSchedule, daysBetween } from './schedule';
import { makeItem } from './testing';

const TODAY = '2026-10-14';
const work = (overrides: Partial<CostItem> = {}) =>
  makeItem({
    id: 'W',
    kind: 'WORK',
    startDate: '2026-11-10',
    endDate: '2026-11-20',
    ...overrides,
  });
const mat = (overrides: Partial<CostItem> = {}) =>
  makeItem({ id: 'M', kind: 'MATERIAL', requiredForWorkId: 'W', ...overrides });
const material = (items: CostItem[], id = 'M', today = TODAY) =>
  checkSchedule(items, today)[id] as MaterialScheduleResult;
const workResult = (items: CostItem[], id = 'W') =>
  checkSchedule(items, TODAY)[id] as WorkScheduleResult;

describe('daysBetween', () => {
  it('should count calendar days in UTC across a DST change', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-11-10', '2026-11-01')).toBe(-9);
  });
});

describe('checkSchedule — materials', () => {
  it('should be ON_TIME when delivery is on the work start day (slack 0) [AC-01.7]', () => {
    expect(
      material([work(), mat({ deliveryDate: '2026-11-10' })]),
    ).toMatchObject({
      status: 'ON_TIME',
      needBy: '2026-11-10',
      workId: 'W',
      slackDays: 0,
    });
  });

  it('should be LATE_FOR_WORK with delayDays 1 when delivery is a day after the start [AC-01.7]', () => {
    expect(
      material([work(), mat({ deliveryDate: '2026-11-11' })]),
    ).toMatchObject({ status: 'LATE_FOR_WORK', delayDays: 1 });
  });

  it('should be UNSCHEDULED when there is no delivery date [AC-01.7]', () => {
    expect(material([work(), mat()]).status).toBe('UNSCHEDULED');
  });

  it('should be DELIVERED when delivered, even if the planned date was late [AC-01.7]', () => {
    expect(
      material([
        work(),
        mat({ deliveryDate: '2026-11-30', deliveredDate: '2026-10-01' }),
      ]).status,
    ).toBe('DELIVERED');
  });

  it('should be OVERDUE when not delivered and the date is before today [AC-01.7]', () => {
    expect(
      material([
        work({ startDate: '2026-12-01' }),
        mat({ deliveryDate: '2026-10-10' }),
      ]).status,
    ).toBe('OVERDUE');
  });

  it('should prefer LATE_FOR_WORK over OVERDUE', () => {
    expect(
      material([
        work({ startDate: '2026-09-30' }),
        mat({ deliveryDate: '2026-10-01' }),
      ]).status,
    ).toBe('LATE_FOR_WORK');
  });

  it('should prefer OVERDUE over AT_RISK', () => {
    expect(
      material([
        work({ startDate: '2026-10-11' }),
        mat({ deliveryDate: '2026-10-10' }),
      ]).status,
    ).toBe('OVERDUE');
  });

  it.each([
    ['2026-11-09', 'AT_RISK'],
    ['2026-11-08', 'AT_RISK'],
    ['2026-11-07', 'ON_TIME'],
  ])('should classify delivery %p as %p', (deliveryDate, status) => {
    expect(material([work(), mat({ deliveryDate })]).status).toBe(status);
  });

  it('should only be ON_TIME or OVERDUE when there is no linked work', () => {
    expect(
      material([mat({ requiredForWorkId: null, deliveryDate: '2026-11-01' })]),
    ).toEqual({ kind: 'MATERIAL', status: 'ON_TIME' });
    expect(
      material([mat({ requiredForWorkId: null, deliveryDate: '2026-10-01' })])
        .status,
    ).toBe('OVERDUE');
  });
});

describe('checkSchedule — works', () => {
  it('should give the work its blocking materials and the worst delay [AC-01.7]', () => {
    const items = [
      work(),
      mat({ id: 'M1', deliveryDate: '2026-11-19' }),
      mat({ id: 'M2', deliveryDate: '2026-11-12' }),
      mat({ id: 'M3', deliveryDate: '2026-11-01' }),
    ];
    expect(workResult(items)).toEqual({
      kind: 'WORK',
      status: 'BLOCKED',
      blockingMaterials: ['M1', 'M2'],
      worstDelayDays: 9,
    });
  });

  it('should be READY when linked materials are delivered', () => {
    expect(
      workResult([
        work(),
        mat({ deliveryDate: '2026-12-01', deliveredDate: '2026-10-01' }),
      ]).status,
    ).toBe('READY');
  });

  it('should be INVALID_DATES before BLOCKED when the end is before the start', () => {
    const items = [
      work({ endDate: '2026-11-01' }),
      mat({ deliveryDate: '2026-11-30' }),
    ];
    expect(workResult(items)).toEqual({
      kind: 'WORK',
      status: 'INVALID_DATES',
      blockingMaterials: [],
      worstDelayDays: 0,
    });
  });

  it('should leave SERVICE rows out of the result', () => {
    expect(
      checkSchedule([makeItem({ id: 'S', kind: 'SERVICE' })], TODAY),
    ).toEqual({});
  });
});

describe('addDays (CR-05)', () => {
  it('should cross month and year boundaries when adding days', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01');
  });

  it('should go back in time when n is negative and keep the date when n is 0', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-10-19', 0)).toBe('2026-10-19');
  });

  it('should be the inverse of daysBetween when shifting a date', () => {
    expect(daysBetween('2026-10-19', addDays('2026-10-19', 9))).toBe(9);
  });
});
