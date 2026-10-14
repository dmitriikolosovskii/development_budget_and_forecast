import {
  itemHref,
  lineHref,
  organizationHref,
  projectHref,
} from './search-href';

describe('search hrefs', () => {
  it('should build the materials row link when the item is in a MATERIALS line [AC-13.3]', () => {
    expect(itemHref('p1', 'MATERIALS', 'heating', 'i1')).toBe(
      '/projects/p1/materials/heating?highlight=i1',
    );
    expect(itemHref('p1', 'MATERIALS', 'heating', 'i1')).not.toContain('/land');
  });

  it.each([
    [
      'CONSTRUCTION',
      'heating-install',
      '/projects/p1/construction/heating-install?highlight=i1',
    ],
    ['MARKETING', 'listings', '/projects/p1/marketing/listings?highlight=i1'],
    ['LAND', 'purchase', '/projects/p1/land?highlight=i1'],
    ['ARCHITECTURE', 'design', '/projects/p1/architecture?highlight=i1'],
  ] as const)(
    'should link a %s item to its tab when building the href [AC-13.8]',
    (category, section, href) => {
      expect(itemHref('p1', category, section, 'i1')).toBe(href);
    },
  );

  it('should link lines and projects without highlight when building their hrefs [AC-13.8]', () => {
    expect(lineHref('p1', 'MATERIALS', 'electrical')).toBe(
      '/projects/p1/materials/electrical',
    );
    expect(lineHref('p1', 'LAND', 'purchase')).toBe('/projects/p1/land');
    expect(lineHref('p1', 'LAND', 'purchase')).not.toContain('purchase');
    expect(projectHref('p1')).toBe('/projects/p1');
  });

  it('should encode ids and fall back to the search page when an organisation has no project [AC-13.7]', () => {
    expect(itemHref('p/1', 'MATERIALS', 'a b', 'i?1')).toBe(
      '/projects/p%2F1/materials/a%20b?highlight=i%3F1',
    );
    expect(organizationHref('o1', 'p1', 'X')).toBe(
      '/projects/p1/materials?org=o1',
    );
    expect(organizationHref('o1', null, ' Holzbau & Bedachung Mühlberg ')).toBe(
      '/search?q=Holzbau%20%26%20Bedachung%20M%C3%BChlberg',
    );
    expect(organizationHref('o1', null, 'x'.repeat(80))).toBe(
      `/search?q=${'x'.repeat(64)}`,
    );
  });
});
