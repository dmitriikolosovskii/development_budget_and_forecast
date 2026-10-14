import { organizationSchema } from '@default-project/types';
import { buildOrganizations } from './organizations';

describe('seed organisations', () => {
  const orgs = buildOrganizations();

  it('should seed the 14 fictional organisations of GERMANY-DATA §8 with unique slugs [AC-03.6]', () => {
    expect(orgs).toHaveLength(14);
    expect(new Set(orgs.map((o) => o.slug)).size).toBe(14);
  });

  it('should give every organisation an email ending in .example [AC-03.6]', () => {
    for (const o of orgs) expect([o.slug, /\.example$/.test(o.email)]).toEqual([o.slug, true]);
  });

  it('should have 5 contractors, 4 suppliers, 3 consultants, 1 agency and 1 authority [AC-03.6]', () => {
    const roles = orgs.reduce<Record<string, number>>((acc, o) => ({ ...acc, [o.role]: (acc[o.role] ?? 0) + 1 }), {});
    expect(roles).toEqual({ CONTRACTOR: 5, SUPPLIER: 4, CONSULTANT: 3, AGENCY: 1, AUTHORITY: 1 });
  });

  it('should match the Organization contract when given an id and timestamps', () => {
    const ts = '2026-10-14T00:00:00.000Z';
    for (const o of orgs) expect(() => organizationSchema.parse({ id: o.slug, ...o, createdAt: ts, updatedAt: ts })).not.toThrow();
  });
});
