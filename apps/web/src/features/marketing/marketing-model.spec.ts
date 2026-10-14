import {
  addMonths,
  campaignPhase,
  channelMix,
  marketingCalendar,
  marketingShare,
} from './marketing-model';

const TODAY = '2026-10-14';

describe('campaignPhase', () => {
  it('should return RUNNING when start ≤ today ≤ end [AC-09.3]', () => {
    expect(campaignPhase('2026-10-01', '2026-10-31', TODAY)).toBe('RUNNING');
  });

  it('should return RUNNING when today is the start day or the end day [AC-09.3]', () => {
    expect(campaignPhase(TODAY, '2026-12-31', TODAY)).toBe('RUNNING');
    expect(campaignPhase('2026-09-01', TODAY, TODAY)).toBe('RUNNING');
  });

  it('should return PLANNED when today is one day before the start [AC-09.3]', () => {
    expect(campaignPhase('2026-10-15', '2026-12-31', TODAY)).toBe('PLANNED');
  });

  it('should return FINISHED when today is one day after the end [AC-09.3]', () => {
    expect(campaignPhase('2026-09-01', '2026-10-13', TODAY)).toBe('FINISHED');
  });

  it('should return NO_DATES when a date is null or empty', () => {
    expect(campaignPhase(null, '2026-10-31', TODAY)).toBe('NO_DATES');
    expect(campaignPhase('2026-10-01', null, TODAY)).toBe('NO_DATES');
    expect(campaignPhase('', '', TODAY)).toBe('NO_DATES');
  });

  it('should return INVALID when end is before start', () => {
    expect(campaignPhase('2026-10-20', '2026-10-10', TODAY)).toBe('INVALID');
  });
});

describe('marketingShare', () => {
  it('should be ok when the share is exactly 5 % [AC-09.4]', () => {
    expect(marketingShare(50_000, 1_000_000)).toEqual({ bps: 500, tone: 'ok' });
  });

  it('should warn when the share is above 5 % even if it rounds to 500 bps [AC-09.4]', () => {
    expect(marketingShare(50_001, 1_000_000)).toEqual({
      bps: 500,
      tone: 'warn',
    });
    expect(marketingShare(50_100, 1_000_000)).toEqual({
      bps: 501,
      tone: 'warn',
    });
  });

  it('should be ok when the share is near the 3 % benchmark [AC-09.4]', () => {
    expect(marketingShare(2_000_000, 66_000_000)).toEqual({
      bps: 303,
      tone: 'ok',
    });
  });

  it('should be neutral when the contract price is 0', () => {
    expect(marketingShare(10_000, 0)).toEqual({ bps: 0, tone: 'neutral' });
  });
});

describe('channelMix', () => {
  const lines = [
    { id: 'l1', section: 'listings', name: 'Property portals' },
    { id: 'l2', section: 'paid-search', name: 'Paid search' },
    { id: 'l3', section: 'events', name: 'Show house & open days' },
  ];

  it('should drop zero slices and split the forecast in line order', () => {
    const mix = channelMix(lines, {
      l1: { forecast: 100 },
      l2: { forecast: 300 },
      l3: { forecast: 0 },
    });

    expect(mix).toEqual([
      {
        section: 'listings',
        name: 'Property portals',
        forecast: 100,
        bps: 2500,
      },
      { section: 'paid-search', name: 'Paid search', forecast: 300, bps: 7500 },
    ]);
  });

  it('should return an empty mix when there is no forecast', () => {
    expect(channelMix(lines, {})).toEqual([]);
  });
});

describe('marketingCalendar', () => {
  const project = { startDate: '2026-04-01', endDate: '2027-03-31' };
  const row = (
    id: string,
    startDate: string | null,
    endDate: string | null,
  ) => ({ id, code: id, name: id, section: 'social', startDate, endDate });

  it('should add months across a year boundary', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });

  it('should build continuous months from the first start to the last end', () => {
    const cal = marketingCalendar(
      [
        row('a', '2026-10-05', '2026-12-20'),
        row('b', '2027-01-10', '2027-02-01'),
      ],
      project,
      TODAY,
    );

    expect(cal.months).toEqual([
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ]);
    expect(
      cal.bars.map((b) => [b.itemId, b.fromCol, b.toCol, b.phase]),
    ).toEqual([
      ['a', 0, 2, 'RUNNING'],
      ['b', 3, 4, 'PLANNED'],
    ]);
  });

  it('should clamp a mistyped year to the project window plus one month', () => {
    const cal = marketingCalendar(
      [row('a', '2026-11-01', '2062-11-30')],
      project,
      TODAY,
    );

    expect(cal.months[0]).toBe('2026-11');
    expect(cal.months[cal.months.length - 1]).toBe('2027-04');
    expect(cal.bars[0]).toMatchObject({
      fromCol: 0,
      toCol: cal.months.length - 1,
    });
  });

  it('should leave out rows with no or invalid dates', () => {
    const cal = marketingCalendar(
      [row('a', null, null), row('b', '2026-12-01', '2026-11-01')],
      project,
      TODAY,
    );

    expect(cal).toEqual({ months: [], bars: [] });
  });
});
