import { healthStatusSchema } from './types';

describe('healthStatusSchema', () => {
  it('should accept a valid health payload', () => {
    expect(healthStatusSchema.parse({ status: 'ok', db: 'up' })).toEqual({ status: 'ok', db: 'up' });
  });

  it('should reject an unknown db state', () => {
    expect(healthStatusSchema.safeParse({ status: 'ok', db: 'maybe' }).success).toBe(false);
  });
});
