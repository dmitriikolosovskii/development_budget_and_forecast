import { makeLand, makePlan, makeRooms } from './architecture-fixtures';
import {
  allowedFootprintM2,
  findRoomIssues,
  formatAreaM2,
  innerFrame,
  isHouseOnPlot,
  issueMessages,
  livingAreaCm2,
  siteSetbacks,
} from './plan-geometry';

describe('plan geometry', () => {
  const frame = innerFrame(makePlan());

  it('should derive the 920 × 820 room frame from the 1000 × 900 footprint', () => {
    expect(frame).toEqual({ widthCm: 920, depthCm: 820 });
  });

  it('should compute the living area as the sum of the 14 rooms, 143.65 m² [AC-08.2]', () => {
    const rooms = makeRooms();

    expect(rooms).toHaveLength(14);
    expect(formatAreaM2(livingAreaCm2(rooms))).toBe('143.65 m²');
    expect(formatAreaM2(livingAreaCm2(rooms.filter((r) => r.floor === 0)))).toBe('71.81 m²');
    expect(formatAreaM2(livingAreaCm2(rooms.filter((r) => r.floor === 1)))).toBe('71.84 m²');
  });

  it('should change the total when a room width changes [AC-08.2]', () => {
    const rooms = makeRooms().map((r) => (r.code === 'GF-LIV' ? { ...r, wCm: 600 } : r));

    expect(formatAreaM2(livingAreaCm2(rooms))).toBe('146.01 m²');
  });

  it('should round labels half-up to one decimal', () => {
    expect(formatAreaM2(330_400, 1)).toBe('33.0 m²');
    expect(formatAreaM2(71_300, 1)).toBe('7.1 m²');
    expect(formatAreaM2(108_100, 1)).toBe('10.8 m²');
    expect(formatAreaM2(1_250, 1)).toBe('0.1 m²');
  });

  it('should find no issues in the seed plan where rooms only touch at the walls [AC-08.3]', () => {
    expect(findRoomIssues(makeRooms(), frame)).toEqual({});
  });

  it('should flag both rooms when two rooms on the same floor overlap [AC-08.3]', () => {
    const rooms = makeRooms().map((r) => (r.code === 'GF-KIT' ? { ...r, xCm: 500 } : r));

    const issues = findRoomIssues(rooms, frame);

    expect(issues['GF-KIT'].overlapsWith).toEqual(['GF-LIV']);
    expect(issues['GF-LIV'].overlapsWith).toEqual(['GF-KIT']);
    expect(issueMessages(rooms.filter((r) => r.floor === 0), issues)).toEqual(['Living + dining overlaps Kitchen']);
  });

  it('should not report an overlap between rooms on different floors [AC-08.3]', () => {
    const rooms = makeRooms().filter((r) => r.code === 'GF-LIV' || r.code === 'UF-MBR');

    expect(findRoomIssues(rooms, frame)).toEqual({});
  });

  it('should flag a room outside the footprint frame [AC-08.3]', () => {
    const rooms = makeRooms().map((r) => (r.code === 'GF-KIT' ? { ...r, wCm: 400 } : r));

    const issues = findRoomIssues(rooms, frame);

    expect(issues['GF-KIT'].outside).toBe(true);
    expect(issueMessages(rooms, issues)).toContain('Kitchen is outside the house footprint');
  });

  it('should compute setbacks 4.0 street, 7.0 rear, 8.0 left and right for the seed plot [AC-08.6]', () => {
    const s = siteSetbacks(makePlan(), makeLand());

    expect(s).toEqual({ street: 400, rear: 700, left: 800, right: 800 });
    expect(isHouseOnPlot(s)).toBe(true);
  });

  it('should detect a house that sticks out of the plot [AC-08.6]', () => {
    expect(isHouseOnPlot(siteSetbacks(makePlan({ siteOffsetXcm: 1700 }), makeLand()))).toBe(false);
    expect(isHouseOnPlot(siteSetbacks(makePlan({ siteOffsetYcm: -10 }), makeLand()))).toBe(false);
  });

  it('should allow 208 m² of footprint for 520 m² at GRZ 0.4', () => {
    expect(allowedFootprintM2(makeLand())).toBe(208);
  });
});
